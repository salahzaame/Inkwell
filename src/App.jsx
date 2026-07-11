import { useEffect, useMemo, useState } from 'react';
import {
  INITIAL_FILES, INITIAL_DOCS, INITIAL_MSGS, buildInitialSketches, legacySketchToScene,
} from './data.js';
import { askAssistant, buildVaultContext } from './assistant.js';
import { parseBlocks, stripInline, extractWikiNames } from './markdown.jsx';
import IconRail from './components/IconRail.jsx';
import Sidebar from './components/Sidebar.jsx';
import TabBar from './components/TabBar.jsx';
import Editor from './components/Editor.jsx';
import GraphView from './components/GraphView.jsx';
import SlidesView from './components/SlidesView.jsx';
import PresentOverlay from './components/PresentOverlay.jsx';
import AIPanel from './components/AIPanel.jsx';
import QuickSwitcher from './components/QuickSwitcher.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import StatusBar from './components/StatusBar.jsx';

const saved = (() => {
  try {
    const v3 = JSON.parse(localStorage.getItem('inkwell:v3'));
    if (v3) return v3;
  } catch { /* fall through to migration */ }
  try {
    const v2 = JSON.parse(localStorage.getItem('inkwell:v2'));
    if (v2) {
      return {
        files: v2.files,
        docs: v2.docs,
        settings: v2.settings,
        theme: v2.theme && { accent: v2.theme.accent, grid: v2.theme.grid !== 'plain' },
        sketches: v2.sketches && Object.fromEntries(
          Object.entries(v2.sketches).map(([k, shapes]) => [k, legacySketchToScene(shapes)]),
        ),
      };
    }
  } catch { /* corrupted legacy store — start fresh */ }
  return {};
})();

/** Build present slides from a note's markdown: title slide, then one per ## section. */
function buildSlides(name, crumb, doc) {
  const slides = [{ type: 'title', title: name, sub: crumb }];
  let cur = null;
  for (const b of parseBlocks(doc)) {
    if (b.t === 'h2') {
      cur = { type: 'bullets', title: b.text, bullets: [], sketch: null };
      slides.push(cur);
    } else if (cur) {
      if (b.t === 'sketch' && !cur.sketch) { cur.sketch = b.id; cur.type = 'sketch'; }
      else if (b.t === 'list') cur.bullets.push(...b.items.map(it => stripInline(it.text)));
      else if ((b.t === 'p' || b.t === 'quote') && cur.type === 'bullets') cur.bullets.push(stripInline(b.text));
    }
  }
  for (const s of slides) if (s.bullets) s.bullets = s.bullets.slice(0, 5);
  return slides;
}

export default function App() {
  const [view, setView] = useState('editor');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);
  const [files, setFiles] = useState(saved.files ?? INITIAL_FILES);
  const [docs, setDocs] = useState(saved.docs ?? INITIAL_DOCS);
  const [sketches, setSketches] = useState(() => saved.sketches ?? buildInitialSketches());
  const [activeFile, setActiveFile] = useState((saved.files ?? INITIAL_FILES).find(f => !f.folder)?.id ?? null);
  const [openTabs, setOpenTabs] = useState(() => {
    const first = (saved.files ?? INITIAL_FILES).find(f => !f.folder);
    return first ? [first.id] : [];
  });
  const [collapsed, setCollapsed] = useState({});

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(saved.settings ?? { localAi: true, sync: false, spell: true, vim: false });
  const [theme, setTheme] = useState({ accent: '#fbbf24', grid: true, paper: true, ...(saved.theme || {}) });

  const [slideTemplate, setSlideTemplate] = useState('dark');
  const [importNote, setImportNote] = useState(false);
  const [present, setPresent] = useState(false);
  const [slideIx, setSlideIx] = useState(0);

  const [aiMessages, setAiMessages] = useState(INITIAL_MSGS);
  const [aiInput, setAiInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const [aiProvider, setAiProvider] = useState(null); // set after the first real reply

  // debounced persistence — sketch drags update state at pointer-move rate
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem('inkwell:v3', JSON.stringify({ files, docs, sketches, settings, theme }));
      } catch { /* storage unavailable — the vault just won't persist */ }
    }, 250);
    return () => clearTimeout(t);
  }, [files, docs, sketches, settings, theme]);

  const activeNote = files.find(f => f.id === activeFile && !f.folder) || null;
  const activeDoc = activeNote ? (docs[activeNote.id] ?? '') : '';
  const crumb = activeNote?.parent ? (files.find(f => f.id === activeNote.parent)?.name ?? 'Vault') : 'Vault';

  const slides = useMemo(
    () => (activeNote ? buildSlides(activeNote.name, crumb, activeDoc) : []),
    [activeNote, crumb, activeDoc],
  );

  useEffect(() => {
    const kd = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuery('');
        setSwitcherOpen(o => !o);
        return;
      }
      if (e.key === 'Escape') {
        setSwitcherOpen(false);
        setSettingsOpen(false);
        setPresent(false);
      }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);

  useEffect(() => {
    if (!present) return;
    const max = Math.max(0, slides.length - 1);
    const kd = (e) => {
      if (e.key === 'ArrowRight') setSlideIx(i => Math.min(max, i + 1));
      if (e.key === 'ArrowLeft') setSlideIx(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [present, slides.length]);

  const openFile = (id) => {
    const f = files.find(x => x.id === id);
    if (!f) return;
    if (f.folder) {
      setCollapsed(c => ({ ...c, [id]: !c[id] }));
      return;
    }
    setActiveFile(id);
    setView('editor');
    setSwitcherOpen(false);
    setOpenTabs(t => (t.includes(id) ? t : [...t, id]));
  };

  /** Open a [[wikilink]] by name; creates the note if it doesn't exist (Obsidian-style). */
  const openWiki = (name) => {
    const f = files.find(x => !x.folder && x.name === name);
    if (f) { openFile(f.id); return; }
    const id = 'n' + Date.now();
    setFiles(fs => [...fs, { id, name, top: true, mtime: Date.now() }]);
    setDocs(d => ({ ...d, [id]: '' }));
    setActiveFile(id);
    setView('editor');
    setOpenTabs(t => [...t, id]);
  };

  const firstNoteId = (fs, excludeId) => {
    const n = fs.find(f => !f.folder && f.id !== excludeId);
    return n ? n.id : null;
  };

  const closeTab = (id) => {
    setOpenTabs(t => {
      const rest = t.filter(x => x !== id);
      if (activeFile === id) setActiveFile(rest[0] ?? firstNoteId(files, null));
      return rest;
    });
  };

  const newNote = () => {
    const id = 'n' + Date.now();
    const base = 'Untitled';
    let name = base;
    for (let n = 2; files.some(f => f.name === name); n++) name = `${base} ${n}`;
    setFiles(f => [...f, { id, name, top: true, mtime: Date.now() }]);
    setDocs(d => ({ ...d, [id]: '' }));
    setOpenTabs(t => [...t, id]);
    setActiveFile(id);
    setView('editor');
  };

  /** Rename a note and rewrite [[wikilinks]] pointing at it across the vault. */
  const renameFile = (id, name) => {
    const clean = name.trim() || 'Untitled';
    const old = files.find(f => f.id === id);
    if (!old || old.name === clean) return;
    setFiles(f => f.map(x => (x.id === id ? { ...x, name: clean, mtime: Date.now() } : x)));
    setDocs(d => {
      const out = {};
      for (const [k, v] of Object.entries(d)) out[k] = v.split('[[' + old.name + ']]').join('[[' + clean + ']]');
      return out;
    });
  };

  const deleteNote = (id) => {
    const f = files.find(x => x.id === id);
    if (!f || f.folder) return;
    if (!window.confirm(`Delete "${f.name}"? This can't be undone.`)) return;
    const doomedSketches = parseBlocks(docs[id] ?? '').filter(b => b.t === 'sketch').map(b => b.id);
    setFiles(fs => fs.filter(x => x.id !== id));
    setDocs(d => { const out = { ...d }; delete out[id]; return out; });
    setSketches(s => {
      const out = { ...s };
      for (const sk of doomedSketches) delete out[sk];
      return out;
    });
    setOpenTabs(t => t.filter(x => x !== id));
    if (activeFile === id) {
      const rest = openTabs.filter(x => x !== id);
      setActiveFile(rest[0] ?? firstNoteId(files, id));
    }
  };

  const updateDoc = (id, text) => {
    setDocs(d => ({ ...d, [id]: text }));
    setFiles(f => f.map(x => (x.id === id ? { ...x, mtime: Date.now() } : x)));
  };

  /** Register a fresh empty sketch and return its id (fence insertion is up to the caller). */
  const createSketch = () => {
    const used = (id) => sketches[id] !== undefined || Object.values(docs).some(d => (d || '').includes('```sketch ' + id));
    let n = 1;
    let skId = 'sketch-' + n;
    while (used(skId)) skId = 'sketch-' + ++n;
    setSketches(s => ({ ...s, [skId]: { elements: [], files: {} } }));
    return skId;
  };

  const insertSketch = (noteId) => {
    const skId = createSketch();
    const doc = docs[noteId] ?? '';
    updateDoc(noteId, (doc ? doc.replace(/\n*$/, '\n\n') : '') + '```sketch ' + skId + '\n```\n');
  };

  const setSketchData = (skId, data) => {
    setSketches(s => ({ ...s, [skId]: data }));
  };

  const sendMessage = async (text) => {
    const t = text.trim();
    if (!t || aiTyping) return;
    const history = [...aiMessages, { role: 'u', text: t }];
    setAiMessages(history);
    setAiInput('');
    setAiTyping(true);
    try {
      const vault = buildVaultContext(files, docs, activeFile);
      const { text: reply, provider } = await askAssistant({ history, vault, preferLocal: settings.localAi });
      setAiProvider(provider);
      setAiMessages(m => [...m, { role: 'a', text: reply }]);
    } catch {
      setAiMessages(m => [...m, {
        role: 'a',
        text: 'I couldn\'t reach a model. Check your internet connection — or run Ollama with a model pulled (e.g. "ollama pull llama3.2") and enable "Local assistant" in Settings.',
      }]);
    } finally {
      setAiTyping(false);
    }
  };

  const rail = {
    files: view === 'editor' && sidebarOpen,
    search: switcherOpen,
    graph: view === 'graph',
    slides: view === 'slides',
    ai: aiOpen,
    settings: settingsOpen,
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#17181c',
      '--acc': theme.accent,
    }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <IconRail
          rail={rail}
          onFiles={() => { if (view === 'editor') setSidebarOpen(o => !o); else setView('editor'); }}
          onSearch={() => { setQuery(''); setSwitcherOpen(o => !o); }}
          onGraph={() => setView('graph')}
          onSlides={() => setView('slides')}
          onAI={() => setAiOpen(o => !o)}
          onSettings={() => setSettingsOpen(true)}
        />

        {view === 'editor' && sidebarOpen && (
          <Sidebar files={files} activeFile={activeFile} collapsed={collapsed} onOpen={openFile} onNewNote={newNote} onDelete={deleteNote} />
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#1e2025' }}>
          <TabBar
            files={files} openTabs={openTabs} activeFile={activeFile} view={view}
            onClick={(id) => { setActiveFile(id); setView('editor'); }}
            onClose={closeTab}
          />

          {view === 'editor' && (
            <Editor
              note={activeNote} crumb={crumb} doc={activeDoc} files={files} docs={docs}
              onDocChange={(text) => activeNote && updateDoc(activeNote.id, text)}
              onWiki={openWiki} onOpen={openFile} onRename={renameFile}
              onDelete={() => activeNote && deleteNote(activeNote.id)}
              onInsertSketch={() => activeNote && insertSketch(activeNote.id)}
              onCreateSketch={createSketch}
              onNewNote={newNote}
              spell={settings.spell} grid={theme.grid} paper={theme.paper} accent={theme.accent}
              sketches={sketches} setSketchData={setSketchData}
            />
          )}
          {view === 'graph' && <GraphView files={files} docs={docs} onOpen={openFile} />}
          {view === 'slides' && (
            <SlidesView
              noteName={activeNote ? activeNote.name : 'No note'}
              slides={slides}
              template={slideTemplate} importNote={importNote} sketches={sketches}
              onTemplate={(t) => { setSlideTemplate(t); setImportNote(t === 'import'); }}
              onPresent={() => { setPresent(true); setSlideIx(0); }}
            />
          )}

          <StatusBar doc={activeDoc} hasNote={!!activeNote} />
        </div>

        {aiOpen && (
          <AIPanel
            messages={aiMessages} typing={aiTyping} input={aiInput}
            onInput={setAiInput} onSend={sendMessage} onWiki={openWiki} provider={aiProvider} localAi={settings.localAi}
          />
        )}
      </div>

      {switcherOpen && (
        <QuickSwitcher files={files} query={query} onQuery={setQuery} onOpen={openFile} onClose={() => setSwitcherOpen(false)} />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings} setSettings={setSettings} theme={theme} setTheme={setTheme}
          vault={{ files, docs, sketches, settings, theme }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {present && slides.length > 0 && (
        <PresentOverlay
          template={slideTemplate} slideIx={Math.min(slideIx, slides.length - 1)} slides={slides} sketches={sketches}
          onClose={() => setPresent(false)}
          onPrev={() => setSlideIx(i => Math.max(0, i - 1))}
          onNext={() => setSlideIx(i => Math.min(slides.length - 1, i + 1))}
          onGo={setSlideIx}
        />
      )}
    </div>
  );
}
