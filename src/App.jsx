import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_FILES, INITIAL_DOCS, INITIAL_MSGS, buildInitialSketches, legacySketchToScene,
} from './data.js';
import { askAssistant, buildVaultContext, proposeNoteEdits } from './assistant.js';
import { EDIT_TOOLS_PROMPT, applyProposal, parseEditProposals } from './assistant-edits.js';
import { parseBlocks, stripInline, extractWikiNames } from './markdown.jsx';
import { loadHighlightStore, findHighlight, paperIdOf } from './highlights.js';
import { normalizeSearchQuery, saveSearchQuery } from './references.js';
import { buildEvidenceMatrix, buildLiteratureMap } from './research-artifacts.js';
import { generateDeckSpec } from './deck/generate.js';
import { deckSlideKeys } from './deck/registry.jsx';
import { deckFromOutlineSlides } from './deck/from-outline.js';
import { fileToCompressedDataUrl, newImageId } from './images.js';
import { moveVaultItem, uniqueVaultName } from './vault.js';
import IconRail from './components/IconRail.jsx';
import Sidebar from './components/Sidebar.jsx';
import TabBar from './components/TabBar.jsx';
import Editor from './components/Editor.jsx';
import AIPanel from './components/AIPanel.jsx';
import QuickSwitcher from './components/QuickSwitcher.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import StatusBar from './components/StatusBar.jsx';
import WorkspaceSplit from './components/WorkspaceSplit.jsx';

// These packages pull in PDF.js, Cytoscape, Excalidraw rendering, and the deck runtime.
// Keep the core note workspace responsive; each capability loads only when opened.
const GraphView = lazy(() => import('./components/GraphView.jsx'));
const SlidesView = lazy(() => import('./components/SlidesView.jsx'));
const PresentOverlay = lazy(() => import('./components/PresentOverlay.jsx'));
const ResearchPanel = lazy(() => import('./components/ResearchPanel.jsx'));
const PdfViewer = lazy(() => import('./components/PdfViewer.jsx'));

function FeatureLoading({ label = 'Opening workspace…' }) {
  return <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: '13px' }}>{label}</div>;
}

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
  const [images, setImages] = useState(saved.images ?? {});
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
  const [selectedDeckSlide, setSelectedDeckSlide] = useState(null);
  const [decks, setDecks] = useState(saved.decks ?? {}); // AI deck spec per note id
  const [graphPositions, setGraphPositions] = useState(saved.graphPositions ?? {});
  const [deckBusy, setDeckBusy] = useState(false);

  const [aiMessages, setAiMessages] = useState(INITIAL_MSGS);
  const [aiInput, setAiInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const [aiProvider, setAiProvider] = useState(null); // set after the first real reply

  const [researchOpen, setResearchOpen] = useState(false);
  const [activePdf, setActivePdf] = useState(null); // { url?, localData?, title, citationKey, paperId, noteId }
  // which literature note belongs to which paper — keeps local PDFs reattachable
  const [paperNotes, setPaperNotes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('inkwell:paper-notes')) || {};
    } catch {
      return {};
    }
  });
  const [highlights, setHighlights] = useState(loadHighlightStore);
  const [jumpHl, setJumpHl] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [workspaceLayout, setWorkspaceLayout] = useState('split'); // 'split' | 'pdf' | 'editor'
  const [workspaceRatio, setWorkspaceRatio] = useState(() => {
    const savedRatio = Number(localStorage.getItem('inkwell:workspace-ratio'));
    return savedRatio >= 0.28 && savedRatio <= 0.72 ? savedRatio : 0.5;
  });
  const [references, setReferences] = useState(() => {
    try {
      const refs = JSON.parse(localStorage.getItem('inkwell:references'));
      return refs || [];
    } catch {
      return [];
    }
  });
  const [savedSearches, setSavedSearches] = useState(() => {
    try {
      const searches = JSON.parse(localStorage.getItem('inkwell:saved-searches'));
      return Array.isArray(searches) ? searches.map(normalizeSearchQuery).filter(Boolean).slice(0, 16) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('inkwell:references', JSON.stringify(references));
  }, [references]);

  useEffect(() => {
    localStorage.setItem('inkwell:saved-searches', JSON.stringify(savedSearches));
  }, [savedSearches]);

  useEffect(() => {
    localStorage.setItem('inkwell:highlights', JSON.stringify(highlights));
  }, [highlights]);

  useEffect(() => {
    localStorage.setItem('inkwell:paper-notes', JSON.stringify(paperNotes));
  }, [paperNotes]);

  useEffect(() => {
    localStorage.setItem('inkwell:workspace-ratio', String(workspaceRatio));
  }, [workspaceRatio]);

  /** Save a paper to the library (reading queue) and give it a literature note.
      Returns the lit note's id so callers can bind to it without waiting on state. */
  const importReference = (ref, { open = true } = {}) => {
    const pid = paperIdOf(ref);
    const existing = references.find(r => paperIdOf(r) === pid);
    if (existing) {
      // already in the library — just surface its note
      if (open && existing.noteId && files.some(f => f.id === existing.noteId)) {
        setOpenTabs(t => (t.includes(existing.noteId) ? t : [...t, existing.noteId]));
        setActiveFile(existing.noteId);
        setView('editor');
        return existing.noteId;
      }
      return null;
    }
    const noteId = 'ref-' + ref.citationKey + '-' + Date.now();
    const noteName = `Lit - ${ref.title.slice(0, 40)}`;
    const docContent = [
      `# ${ref.title}`,
      `\n**Metadata:**`,
      `- **Authors:** ${ref.authors.join(', ')}`,
      `- **Year:** ${ref.year || 'n.d.'}`,
      `- **URL:** ${ref.url}`,
      `- **DOI:** ${ref.doi || 'N/A'}`,
      `- **Citation Key:** \`[@${ref.citationKey}]\``,
      `\n## Abstract`,
      `${ref.abstract || 'No abstract available.'}`,
      `\n## BibTeX`,
      `\`\`\`bibtex\n${ref.bibtex}\n\`\`\``,
      `\n## Highlights`,
      ``,
    ].join('\n');

    setReferences(prev => [...prev, { ...ref, noteId, status: 'toread', addedAt: Date.now() }]);
    setPaperNotes(m => ({ ...m, [pid]: noteId }));
    setFiles(fs => [...fs, { id: noteId, name: noteName, top: true, mtime: Date.now() }]);
    setDocs(docsMap => ({ ...docsMap, [noteId]: docContent }));
    if (open) {
      setOpenTabs(t => [...t, noteId]);
      setActiveFile(noteId);
      setView('editor');
    }
    return noteId;
  };

  const importReferenceBatch = (items) => {
    for (const item of items) importReference(item, { open: false });
  };

  /** Open a paper in the reader; queue status moves to "reading". Papers straight
      from search get imported first, in the same tick, so the note never doubles.
      The paper opens ONTO its own literature note — other notes stay full-width. */
  const openPaper = (ref) => {
    if (!ref.pdfUrl) return;
    const pid = paperIdOf(ref);
    const inLibrary = references.some(r => paperIdOf(r) === pid);
    const noteId = inLibrary
      ? ensurePaperNote({ paperId: pid, title: ref.title, citationKey: ref.citationKey })
      : importReference(ref);
    setActivePdf({
      url: ref.pdfUrl,
      urls: ref.pdfCandidates?.length ? ref.pdfCandidates : [ref.pdfUrl],
      landing: ref.url,
      title: ref.title, citationKey: ref.citationKey, paperId: pid, noteId,
    });
    setReferences(rs => rs.map(r => (paperIdOf(r) === pid
      ? { ...r, status: r.status === 'done' ? 'done' : 'reading', lastOpenedAt: Date.now() }
      : r)));
    setOpenTabs(t => (t.includes(noteId) ? t : [...t, noteId]));
    setActiveFile(noteId);
    setSidebarOpen(false);
    setResearchOpen(false);
    setAiOpen(false);
    setView('editor');
    setWorkspaceLayout('split');
  };

  const openLocalPdf = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const title = file.name.replace(/\.pdf$/i, '');
    const pid = 'local:' + file.name;
    const noteId = ensurePaperNote({ paperId: pid, title });
    setActivePdf({ localData: bytes, title, citationKey: null, paperId: pid, noteId });
    setOpenTabs(t => (t.includes(noteId) ? t : [...t, noteId]));
    setActiveFile(noteId);
    setSidebarOpen(false);
    setResearchOpen(false);
    setView('editor');
    setWorkspaceLayout('split');
  };

  const setPaperStatus = (pid, status) => {
    setReferences(rs => rs.map(r => (paperIdOf(r) === pid ? { ...r, status } : r)));
  };

  const setPaperTags = (pid, tags) => {
    setReferences(rs => rs.map(r => (paperIdOf(r) === pid ? { ...r, tags } : r)));
  };

  /** Create a grounded, editable research artifact from records already in the vault. */
  const createResearchArtifact = (kind) => {
    if (!references.length) return;
    const dateLabel = new Date().toLocaleDateString();
    const artifact = kind === 'matrix'
      ? buildEvidenceMatrix({ references, highlights, dateLabel })
      : buildLiteratureMap({ references, highlights, dateLabel });
    const id = `${kind === 'matrix' ? 'evidence-matrix' : 'literature-map'}-${Date.now()}`;
    setFiles(fs => [...fs, { id, name: artifact.name, top: true, mtime: Date.now() }]);
    setDocs(d => ({ ...d, [id]: artifact.content }));
    setOpenTabs(t => (t.includes(id) ? t : [...t, id]));
    setActiveFile(id);
    setResearchOpen(false);
    setView('editor');
  };

  const createLiteratureMap = () => createResearchArtifact('map');
  const createEvidenceMatrix = () => createResearchArtifact('matrix');

  /** Find (or create) the literature note for a paper; returns its id. */
  const ensurePaperNote = (paper) => {
    const pid = paper.paperId;
    const ref = references.find(r => paperIdOf(r) === pid);
    if (ref?.noteId && files.some(f => f.id === ref.noteId)) return ref.noteId;
    if (paperNotes[pid] && files.some(f => f.id === paperNotes[pid])) return paperNotes[pid];
    const legacy = ref && files.find(f => f.id.startsWith('ref-' + ref.citationKey + '-'));
    if (legacy) {
      setReferences(rs => rs.map(r => (paperIdOf(r) === pid ? { ...r, noteId: legacy.id } : r)));
      setPaperNotes(m => ({ ...m, [pid]: legacy.id }));
      return legacy.id;
    }
    const noteId = 'n' + Date.now();
    const name = `Lit - ${(paper.title || 'Paper').slice(0, 40)}`;
    setFiles(fs => [...fs, { id: noteId, name, top: true, mtime: Date.now() }]);
    setDocs(d => ({ ...d, [noteId]: `# ${paper.title || 'Paper notes'}\n\n## Highlights\n` }));
    if (ref) setReferences(rs => rs.map(r => (paperIdOf(r) === pid ? { ...r, noteId } : r)));
    setPaperNotes(m => ({ ...m, [pid]: noteId }));
    return noteId;
  };

  /** A fresh highlight lands in the store AND as a quote block in the paper's note. */
  const addHighlight = (hl) => {
    if (!activePdf) return;
    const pid = activePdf.paperId;
    setHighlights(s => ({ ...s, [pid]: [...(s[pid] || []), hl] }));
    const noteId = ensurePaperNote(activePdf);
    const quoteText = hl.text.length > 420 ? hl.text.slice(0, 417) + '…' : hl.text;
    const label = activePdf.citationKey ? `@${activePdf.citationKey}, p. ${hl.page}` : `p. ${hl.page}`;
    const block = `\n> "${quoteText}"\n> — [${label}](hl://${hl.id})\n`;
    setDocs(d => ({ ...d, [noteId]: (d[noteId] ?? '').replace(/\n*$/, '\n') + block }));
    setFiles(f => f.map(x => (x.id === noteId ? { ...x, mtime: Date.now() } : x)));
    setOpenTabs(t => (t.includes(noteId) ? t : [...t, noteId]));
    setActiveFile(noteId);
    if (workspaceLayout === 'pdf') setWorkspaceLayout('split');
  };

  const removeHighlight = (id) => {
    if (!activePdf) return;
    const pid = activePdf.paperId;
    setHighlights(s => ({ ...s, [pid]: (s[pid] || []).filter(h => h.id !== id) }));
  };

  // clicking a hl:// backlink in any note jumps back to the exact spot in the paper
  useEffect(() => {
    const onJump = (e) => {
      const id = e.detail?.id;
      const found = findHighlight(highlights, id);
      if (!found) return;
      const [pid] = found;
      setView('editor');
      if (activePdf?.paperId === pid) {
        if (activePdf.noteId) {
          setOpenTabs(t => (t.includes(activePdf.noteId) ? t : [...t, activePdf.noteId]));
          setActiveFile(activePdf.noteId);
        }
        if (workspaceLayout === 'editor') setWorkspaceLayout('split');
        setJumpHl(id);
        return;
      }
      const ref = references.find(r => paperIdOf(r) === pid);
      if (!ref?.pdfUrl) {
        alert('This highlight lives in a local PDF — open that file in the reader first, then the link will jump to it.');
        return;
      }
      const noteId = ensurePaperNote({ paperId: pid, title: ref.title, citationKey: ref.citationKey });
      setActivePdf({
        url: ref.pdfUrl,
        urls: ref.pdfCandidates?.length ? ref.pdfCandidates : [ref.pdfUrl],
        landing: ref.url,
        title: ref.title, citationKey: ref.citationKey, paperId: pid, noteId,
      });
      setOpenTabs(t => (t.includes(noteId) ? t : [...t, noteId]));
      setActiveFile(noteId);
      setSidebarOpen(false);
      setResearchOpen(false);
      setWorkspaceLayout('split');
      setJumpHl(id);
    };
    window.addEventListener('inkwell:jump-hl', onJump);
    return () => window.removeEventListener('inkwell:jump-hl', onJump);
  }, [highlights, references, activePdf, workspaceLayout, files, paperNotes]);

  // the reader is bound to its paper's note — any other note gets the full width
  const pdfHere = Boolean(activePdf && activeFile === activePdf.noteId);

  // debounced persistence — sketch drags update state at pointer-move rate
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem('inkwell:v3', JSON.stringify({ files, docs, sketches, images, decks, graphPositions, settings, theme }));
      } catch { /* storage unavailable — the vault just won't persist */ }
    }, 250);
    return () => clearTimeout(t);
  }, [files, docs, sketches, images, decks, graphPositions, settings, theme]);

  const activeNote = files.find(f => f.id === activeFile && !f.folder) || null;
  const activeDoc = activeNote ? (docs[activeNote.id] ?? '') : '';
  const crumb = activeNote?.parent ? (files.find(f => f.id === activeNote.parent)?.name ?? 'Vault') : 'Vault';

  const slides = useMemo(
    () => (activeNote ? buildSlides(activeNote.name, crumb, activeDoc) : []),
    [activeNote, crumb, activeDoc],
  );

  const activeDeck = (activeNote && decks[activeNote.id]) || null;
  const slideCount = activeDeck ? deckSlideKeys(activeDeck).length : slides.length;

  /** Make the locally derived heading outline editable without invoking an AI provider. */
  const editOutlineDeck = () => {
    if (!activeNote || activeDeck) return;
    const theme = slideTemplate === 'light' ? 'paper' : 'midnight';
    const spec = deckFromOutlineSlides(slides, { title: activeNote.name, theme });
    setDecks(d => ({ ...d, [activeNote.id]: spec }));
    setSlideIx(0);
  };

  /** Ask the assistant to design a json-render deck from the open note. */
  const generateDeck = async () => {
    if (!activeNote || deckBusy) return;
    setDeckBusy(true);
    try {
      const noteBlocks = parseBlocks(activeDoc);
      const spec = await generateDeckSpec({
        noteName: activeNote.name,
        doc: activeDoc,
        sketchIds: noteBlocks.filter(b => b.t === 'sketch').map(b => b.id),
        imageIds: noteBlocks.filter(b => b.t === 'image' && b.src.startsWith('img:')).map(b => b.src.slice(4)),
        researchReferences: references,
        settings,
      });
      setDecks(d => ({ ...d, [activeNote.id]: spec }));
      setSlideIx(0);
    } catch (e) {
      alert(e.message || 'Deck generation failed — try again.');
    } finally {
      setDeckBusy(false);
    }
  };

  const clearDeck = () => {
    if (!activeNote) return;
    setDecks(d => { const out = { ...d }; delete out[activeNote.id]; return out; });
    setSlideIx(0);
  };

  /** Build an editable deck from a local PPTX outline; the source file never leaves this browser. */
  const importDeck = async (file) => {
    if (!activeNote) throw new Error('Open a note before importing a presentation.');
    const theme = slideTemplate === 'light' ? 'paper' : 'midnight';
    const { importPptxDeck } = await import('./deck/import-pptx.js');
    const spec = await importPptxDeck(file, { theme });
    setDecks(d => ({ ...d, [activeNote.id]: spec }));
    setSlideIx(0);
  };

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
    const max = Math.max(0, slideCount - 1);
    const kd = (e) => {
      if (e.key === 'ArrowRight') setSlideIx(i => Math.min(max, i + 1));
      if (e.key === 'ArrowLeft') setSlideIx(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [present, slideCount]);

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
    if (parent) setCollapsed(current => ({ ...current, [parent]: false }));
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

  const newNote = (parent = null) => {
    const id = 'n' + Date.now();
    const name = uniqueVaultName(files, 'Untitled', parent);
    setFiles(f => [...f, { id, name, parent: parent || undefined, top: !parent, mtime: Date.now() }]);
    setDocs(d => ({ ...d, [id]: '' }));
    setOpenTabs(t => [...t, id]);
    setActiveFile(id);
    setView('editor');
  };

  const createVaultFolder = (name, parent = null, kind = 'folder') => {
    const id = `${kind}-${Date.now().toString(36)}`;
    const clean = uniqueVaultName(files, name || (kind === 'project' ? 'New project' : 'New folder'), parent);
    setFiles(current => [...current, { id, name: clean, folder: true, kind, parent: parent || undefined, top: !parent, mtime: Date.now() }]);
    setCollapsed(current => ({ ...current, [id]: false, ...(parent ? { [parent]: false } : {}) }));
    return id;
  };

  const moveNoteToFolder = (noteId, parent) => {
    if (!noteId || !files.some(file => file.id === noteId && !file.folder)) return;
    if (parent && !files.some(file => file.id === parent && file.folder)) return;
    setFiles(current => moveVaultItem(current, noteId, parent));
    if (parent) setCollapsed(current => ({ ...current, [parent]: false }));
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
    const doomedBlocks = parseBlocks(docs[id] ?? '');
    const doomedSketches = doomedBlocks.filter(b => b.t === 'sketch').map(b => b.id);
    const doomedImages = doomedBlocks.filter(b => b.t === 'image' && b.src.startsWith('img:')).map(b => b.src.slice(4));
    setFiles(fs => fs.filter(x => x.id !== id));
    setDocs(d => { const out = { ...d }; delete out[id]; return out; });
    setSketches(s => {
      const out = { ...s };
      for (const sk of doomedSketches) delete out[sk];
      return out;
    });
    setImages(s => {
      const out = { ...s };
      for (const im of doomedImages) delete out[im];
      return out;
    });
    setDecks(d => { const out = { ...d }; delete out[id]; return out; });
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
    setSketches(s => {
      if (data == null) {
        const out = { ...s };
        delete out[skId];
        return out;
      }
      return { ...s, [skId]: data };
    });
  };

  const setImageData = (imgId, data) => {
    setImages(s => {
      if (data == null) {
        const out = { ...s };
        delete out[imgId];
        return out;
      }
      return { ...s, [imgId]: data };
    });
  };

  /** Store an image in the local vault so the slide studio can embed it directly. */
  const importSlideImage = async (file) => {
    if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file to add it to this slide.');
    const id = newImageId();
    const data = await fileToCompressedDataUrl(file);
    setImageData(id, data);
    return id;
  };

  const sendMessage = async (text, { canReplace = false } = {}) => {
    const t = text.trim();
    if (!t || aiTyping) return;
    const history = [...aiMessages, { role: 'u', text: t }];
    setAiMessages(history);
    setAiInput('');
    setAiTyping(true);
    try {
      const selectedSlide = activeDeck?.elements?.[selectedDeckSlide]?.type === 'Slide' ? selectedDeckSlide : null;
      const vault = buildVaultContext(files, docs, activeFile, { references, highlights, deck: activeDeck, selectedSlide });
      const { text: reply, provider } = await askAssistant({ history, vault, preferLocal: settings.localAi, settings });
      setAiProvider(provider);
      setAiMessages(m => [...m, { role: 'a', text: reply, canApply: true, canReplace }]);
    } catch {
      setAiMessages(m => [...m, {
        role: 'a',
        text: 'I couldn\'t reach a model. Check your internet connection — or run Ollama with a model pulled (e.g. "ollama pull llama3.2") and enable "Local assistant" in Settings.',
      }]);
    } finally {
      setAiTyping(false);
    }
  };

  /**
   * Ask the assistant to propose structured note changes. Nothing is written here —
   * the proposals land in the transcript as review cards and wait for an explicit Apply.
   */
  const requestNoteEdits = async (text) => {
    const request = text.trim();
    if (!request || aiTyping) return;
    setAiMessages(m => [...m, { role: 'u', text: request }]);
    setAiInput('');
    setAiTyping(true);
    try {
      const vault = buildVaultContext(files, docs, activeFile, { references, highlights });
      const { text: reply, provider } = await proposeNoteEdits({
        request, vault, editPrompt: EDIT_TOOLS_PROMPT, preferLocal: settings.localAi, settings,
      });
      setAiProvider(provider);
      const { summary, proposals, skipped, ok } = parseEditProposals(reply);
      if (!ok) {
        setAiMessages(m => [...m, {
          role: 'a',
          text: 'I couldn\'t turn that into a set of reviewable changes. Try naming the note and the change explicitly — for example, "add a Limitations section to Reading log".',
        }]);
        return;
      }
      setAiMessages(m => [...m, {
        role: 'a',
        text: summary || `Proposed ${proposals.length} change${proposals.length === 1 ? '' : 's'}.`,
        proposals: proposals.map((proposal, i) => ({ id: `${Date.now().toString(36)}-${i}`, proposal, state: 'pending' })),
        skipped,
      }]);
    } catch {
      setAiMessages(m => [...m, { role: 'a', text: 'I couldn\'t reach a model to draft those changes. Check your connection, or run Ollama locally and enable "Local assistant" in Settings.' }]);
    } finally {
      setAiTyping(false);
    }
  };

  /** Apply one reviewed proposal against the live vault, then mark its card resolved. */
  const applyNoteProposal = (messageIndex, proposalId) => {
    const entry = aiMessages[messageIndex]?.proposals?.find(p => p.id === proposalId);
    if (!entry || entry.state !== 'pending') return;

    // resolved against current state, so a suggestion the note has outgrown fails
    // visibly on its card instead of clobbering something else
    const result = applyProposal(entry.proposal, { files, docs });
    if (result.applied) {
      setFiles(result.files);
      setDocs(result.docs);
      if (result.openId) {
        setOpenTabs(t => (t.includes(result.openId) ? t : [...t, result.openId]));
        setActiveFile(result.openId);
        setView('editor');
      }
    }
    const patch = result.applied ? { state: 'applied' } : { state: 'failed', reason: result.reason };
    setAiMessages(msgs => msgs.map((m, i) => (i !== messageIndex ? m : {
      ...m,
      proposals: m.proposals.map(p => (p.id === proposalId ? { ...p, ...patch } : p)),
    })));
  };

  /**
   * Apply every pending proposal in one pass. Each change is folded onto the result
   * of the previous one, so later edits see the text earlier edits produced.
   */
  const applyAllNoteProposals = (messageIndex) => {
    const pending = (aiMessages[messageIndex]?.proposals || []).filter(p => p.state === 'pending');
    if (!pending.length) return;

    let snapshot = { files, docs };
    let lastOpened = null;
    const outcomes = new Map();
    for (const entry of pending) {
      const result = applyProposal(entry.proposal, snapshot);
      if (result.applied) {
        snapshot = { files: result.files, docs: result.docs };
        lastOpened = result.openId ?? lastOpened;
        outcomes.set(entry.id, { state: 'applied' });
      } else {
        outcomes.set(entry.id, { state: 'failed', reason: result.reason });
      }
    }

    setFiles(snapshot.files);
    setDocs(snapshot.docs);
    if (lastOpened) {
      setOpenTabs(t => (t.includes(lastOpened) ? t : [...t, lastOpened]));
      setActiveFile(lastOpened);
      setView('editor');
    }
    setAiMessages(msgs => msgs.map((m, i) => (i !== messageIndex ? m : {
      ...m,
      proposals: m.proposals.map(p => (outcomes.has(p.id) ? { ...p, ...outcomes.get(p.id) } : p)),
    })));
  };

  const rejectNoteProposal = (messageIndex, proposalId) => {
    setAiMessages(msgs => msgs.map((m, i) => (i !== messageIndex ? m : {
      ...m,
      proposals: m.proposals.map(p => (p.id === proposalId ? { ...p, state: 'rejected' } : p)),
    })));
  };

  /** Assistant drafts remain user-controlled: insert into the current note or save as a separate note. */
  const insertAssistantDraft = (text) => {
    if (!activeNote) return;
    const heading = activeDoc.trim() ? '\n\n## Assistant draft\n\n' : '# Assistant draft\n\n';
    updateDoc(activeNote.id, activeDoc.replace(/\s*$/, '') + heading + text.trim() + '\n');
  };

  const requestNoteRewrite = () => {
    if (!activeNote) return;
    sendMessage(
      'Rewrite the open note as a complete, clearer research document. Preserve factual claims and citations from the source, improve its structure, and return only the replacement markdown with no introduction or commentary.',
      { canReplace: true },
    );
  };

  const replaceWithAssistantDraft = (text) => {
    if (!activeNote || !text.trim()) return;
    if (!window.confirm(`Replace the complete contents of "${activeNote.name}" with this assistant draft? You can export your vault first if you need a backup.`)) return;
    updateDoc(activeNote.id, text.trim() + '\n');
  };

  const saveAssistantDraft = (text) => {
    const id = 'ai-' + Date.now();
    const name = `AI draft ${new Date().toLocaleDateString()}`;
    setFiles(fs => [...fs, { id, name, top: true, mtime: Date.now() }]);
    setDocs(d => ({ ...d, [id]: `# ${name}\n\n${text.trim()}\n` }));
    setOpenTabs(t => (t.includes(id) ? t : [...t, id]));
    setActiveFile(id);
    setView('editor');
  };

  const updateDeck = (updater) => {
    if (!activeNote) return;
    setDecks(all => {
      const current = all[activeNote.id];
      if (!current) return all;
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...all, [activeNote.id]: next };
    });
  };

  /** Add an assistant response as an ordinary editable Text block on the selected slide. */
  const addAssistantToSlide = (text) => {
    if (!activeNote || !activeDeck || !selectedDeckSlide || activeDeck.elements?.[selectedDeckSlide]?.type !== 'Slide') return;
    const clean = String(text || '').trim().slice(0, 1800);
    if (!clean) return;
    const key = `assistant-text-${Date.now().toString(36)}`;
    setDecks(all => {
      const current = all[activeNote.id];
      const slide = current?.elements?.[selectedDeckSlide];
      if (!slide || slide.type !== 'Slide') return all;
      return {
        ...all,
        [activeNote.id]: {
          ...current,
          elements: {
            ...current.elements,
            [key]: { type: 'Text', props: { text: clean, dim: null }, children: [] },
            [selectedDeckSlide]: { ...slide, children: [...(slide.children || []), key] },
          },
        },
      };
    });
  };

  const saveResearchSearch = (search) => setSavedSearches(current => saveSearchQuery(current, search));
  const removeResearchSearch = (search) => setSavedSearches(current => current.filter(item => item !== search));

  const rail = {
    files: view === 'editor' && sidebarOpen,
    search: switcherOpen,
    graph: view === 'graph',
    slides: view === 'slides',
    research: researchOpen,
    focusMode: focusMode,
    ai: aiOpen,
    settings: settingsOpen,
  };

  const editorPanel = (alignTop = false) => (
    <div className="workspace-editor-panel">
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
        images={images} setImageData={setImageData}
        alignTop={alignTop}
        references={references}
      />
    </div>
  );

  const pdfPanel = activePdf && (
    <Suspense fallback={<FeatureLoading label="Opening paper reader…" />}>
      <PdfViewer
        pdfUrl={activePdf.url}
        pdfUrls={activePdf.urls}
        landingUrl={activePdf.landing}
        localData={activePdf.localData}
        title={activePdf.title}
        citationKey={activePdf.citationKey}
        highlights={highlights[activePdf.paperId] || []}
        onAddHighlight={addHighlight}
        onRemoveHighlight={removeHighlight}
        jumpHl={jumpHl}
        onJumpDone={() => setJumpHl(null)}
        layout={workspaceLayout}
        onLayoutChange={setWorkspaceLayout}
        onSendToAi={(text) => {
          setAiOpen(true);
          sendMessage(text);
        }}
        onClose={() => { setActivePdf(null); setJumpHl(null); }}
        onLocalFile={openLocalPdf}
      />
    </Suspense>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#17181c',
      '--acc': theme.accent,
    }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!focusMode && (
          <IconRail
            rail={rail}
            onFiles={() => {
              if (view === 'editor') {
                setSidebarOpen(o => {
                  const next = !o;
                  if (next) setResearchOpen(false);
                  return next;
                });
              } else {
                setView('editor');
                setResearchOpen(false);
                setSidebarOpen(true);
              }
            }}
            onSearch={() => { setQuery(''); setSwitcherOpen(o => !o); }}
            onGraph={() => setView('graph')}
            onSlides={() => setView('slides')}
            onResearch={() => setResearchOpen(o => {
              const next = !o;
              if (next) setSidebarOpen(false);
              return next;
            })}
            onAI={() => setAiOpen(o => !o)}
            onSettings={() => setSettingsOpen(true)}
            onFocusMode={() => setFocusMode(o => !o)}
          />
        )}

        {!focusMode && researchOpen && (
          <Suspense fallback={<FeatureLoading label="Opening research library…" />}><ResearchPanel
            references={references}
            highlights={highlights}
            savedSearches={savedSearches}
            onImportReference={importReference}
            onImportBibtex={importReferenceBatch}
            onSaveSearch={saveResearchSearch}
            onRemoveSavedSearch={removeResearchSearch}
            onOpenPaper={openPaper}
            onSetStatus={setPaperStatus}
            onSetTags={setPaperTags}
            onOpenNote={(ref) => {
              const noteId = ensurePaperNote({ paperId: paperIdOf(ref), title: ref.title, citationKey: ref.citationKey });
              setOpenTabs(t => (t.includes(noteId) ? t : [...t, noteId]));
              setActiveFile(noteId);
              setView('editor');
            }}
            onLocalPdf={openLocalPdf}
            onCreateSynthesis={createLiteratureMap}
            onCreateEvidenceMatrix={createEvidenceMatrix}
            onAskAssistant={(prompt) => { setAiOpen(true); setResearchOpen(false); sendMessage(prompt); }}
            onClose={() => setResearchOpen(false)}
          /></Suspense>
        )}

        {!focusMode && view === 'editor' && sidebarOpen && (
          <Sidebar files={files} activeFile={activeFile} collapsed={collapsed} onOpen={openFile} onNewNote={newNote} onNewProject={(name) => createVaultFolder(name, null, 'project')} onNewFolder={(name, parent) => createVaultFolder(name, parent, 'folder')} onMoveNote={moveNoteToFolder} onDelete={deleteNote} />
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#1e2025', position: 'relative' }}>
          {focusMode && (
            <div 
              onClick={() => setFocusMode(false)}
              style={{
                position: 'absolute', top: '16px', right: '18px', zIndex: 99,
                background: 'rgba(30, 32, 37, 0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid #2c2f37', borderRadius: '8px', padding: '6px 12px',
                fontSize: '11px', fontWeight: 600, color: 'var(--acc)', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
              className="hv-btn"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              </svg>
              Exit Focus Mode
            </div>
          )}

          {view === 'editor' && pdfHere && workspaceLayout === 'editor' && (
            <button
              className="workspace-return-split"
              type="button"
              onClick={() => setWorkspaceLayout('split')}
              title="Show the PDF beside this note"
            >
              <span aria-hidden="true">↔</span> bring paper back
            </button>
          )}

          {!focusMode && (
            <TabBar
              files={files} openTabs={openTabs} activeFile={activeFile} view={view}
              onClick={(id) => { setActiveFile(id); setView('editor'); }}
              onClose={closeTab}
            />
          )}

          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {view === 'editor' && !pdfHere && editorPanel()}
            {view === 'editor' && pdfHere && workspaceLayout === 'split' && (
              <WorkspaceSplit left={pdfPanel} right={editorPanel(true)} initialRatio={workspaceRatio} onRatioChange={setWorkspaceRatio} />
            )}
            {view === 'editor' && pdfHere && workspaceLayout === 'pdf' && <div className="workspace-single-panel">{pdfPanel}</div>}
            {view === 'editor' && pdfHere && workspaceLayout === 'editor' && editorPanel()}
            {view === 'graph' && <Suspense fallback={<FeatureLoading label="Building knowledge graph…" />}><GraphView files={files} docs={docs} onOpen={openFile} positions={graphPositions} onPositionsChange={setGraphPositions} onResetPositions={() => setGraphPositions({})} /></Suspense>}
            {view === 'slides' && (
              <Suspense fallback={<FeatureLoading label="Opening slide studio…" />}><SlidesView
                noteName={activeNote ? activeNote.name : 'No note'}
                slides={slides}
                template={slideTemplate} importNote={importNote} sketches={sketches}
                deck={activeDeck} deckBusy={deckBusy} images={images} references={references}
                onGenerateDeck={generateDeck} onClearDeck={clearDeck} onUpdateDeck={updateDeck} onImportDeck={importDeck}
                onEditOutline={editOutlineDeck}
                onImportSlideImage={importSlideImage}
                onTemplate={(t) => { setSlideTemplate(t); setImportNote(t === 'import'); }}
                onPresent={() => { setPresent(true); setSlideIx(0); }}
                onSelectSlide={setSelectedDeckSlide}
              /></Suspense>
            )}
          </div>

          {!focusMode && <StatusBar doc={activeDoc} hasNote={!!activeNote} />}
        </div>

        {!focusMode && aiOpen && (
          <AIPanel
            messages={aiMessages} typing={aiTyping} input={aiInput}
            onInput={setAiInput} onSend={sendMessage} onWiki={openWiki} provider={aiProvider} localAi={settings.localAi}
            onProposeEdits={requestNoteEdits} onApplyProposal={applyNoteProposal} onApplyAllProposals={applyAllNoteProposals} onRejectProposal={rejectNoteProposal}
            onInsert={insertAssistantDraft} onReplace={replaceWithAssistantDraft} onSaveAsNote={saveAssistantDraft} onRequestRewrite={requestNoteRewrite} noteName={activeNote?.name}
            onCreateLiteratureMap={createLiteratureMap} onCreateEvidenceMatrix={createEvidenceMatrix} hasResearchLibrary={references.length > 0}
            onAddToSlide={view === 'slides' && activeDeck?.elements?.[selectedDeckSlide]?.type === 'Slide' ? addAssistantToSlide : null}
            slideLabel={activeDeck?.elements?.[selectedDeckSlide]?.type === 'Slide' ? `slide ${Math.max(1, deckSlideKeys(activeDeck).indexOf(selectedDeckSlide) + 1)}` : null}
            onClose={() => setAiOpen(false)}
          />
        )}
      </div>

      {switcherOpen && (
        <QuickSwitcher files={files} query={query} onQuery={setQuery} onOpen={openFile} onClose={() => setSwitcherOpen(false)} />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings} setSettings={setSettings} theme={theme} setTheme={setTheme}
          vault={{ files, docs, sketches, images, decks, settings, theme }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {present && slideCount > 0 && (
        <Suspense fallback={null}><PresentOverlay
          template={slideTemplate} slideIx={Math.min(slideIx, slideCount - 1)} slides={slides} sketches={sketches}
          deck={activeDeck} images={images} references={references}
          onClose={() => setPresent(false)}
          onPrev={() => setSlideIx(i => Math.max(0, i - 1))}
          onNext={() => setSlideIx(i => Math.min(slideCount - 1, i + 1))}
          onGo={setSlideIx}
        /></Suspense>
      )}
    </div>
  );
}
