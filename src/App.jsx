import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_FILES, INITIAL_DOCS, INITIAL_MSGS, buildInitialSketches, legacySketchToScene,
} from './data.js';
import { askAssistant, buildVaultContext, describeProviderFailures, proposeNoteEdits } from './assistant.js';
import { EDIT_TOOLS_PROMPT, applyProposal, parseEditProposals } from './assistant-edits.js';
import { parseBlocks, stripInline, extractWikiNames } from './markdown.jsx';
import { loadHighlightStore, findHighlight, paperIdOf, removeHighlightFromDoc } from './highlights.js';
import { normalizeSearchQuery, saveSearchQuery } from './references.js';
import { buildEvidenceMatrix, buildLiteratureMap } from './research-artifacts.js';
import { generateDeckSpec } from './deck/generate.js';
import { deckSlideKeys } from './deck/registry.jsx';
import { deckFromOutlineSlides } from './deck/from-outline.js';
import { fileToCompressedDataUrl, newImageId } from './images.js';
import { loadPaperPdf, savePaperPdf } from './pdf-store.js';
import { findMoreCopies, orderPdfCandidates } from './pdf-sources.js';
import { PROJECT_STARTER, canMoveInto, descendantIds, moveVaultItem, uniqueVaultName } from './vault.js';
import { DEFAULT_LAMP, applyLamp, nextLamp, normalizeLamp } from './lamp.js';
import { readSession, resolveSession, writeSession } from './session.js';
import IconRail from './components/IconRail.jsx';
import Sidebar from './components/Sidebar.jsx';
import TabBar from './components/TabBar.jsx';
import Editor from './components/Editor.jsx';
import AIPanel from './components/AIPanel.jsx';
import QuickSwitcher from './components/QuickSwitcher.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import StatusBar from './components/StatusBar.jsx';
import WorkspaceSplit from './components/WorkspaceSplit.jsx';
import { ResizableSide } from './components/Sash.jsx';
import 'katex/dist/katex.min.css';

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
  // Resume where the last session left off, rather than opening the first note in
  // file order every time. Read once — recomputing per render would re-hit
  // localStorage constantly and fight the session writer below.
  const [restored] = useState(() => resolveSession(readSession(localStorage), saved.files ?? INITIAL_FILES));

  const [view, setView] = useState(restored.view);
  // seeded from the restored session: the session writer runs on mount, and a ref
  // starting at 0 would overwrite the saved position before Editor can apply it
  const noteScrollRef = useRef(restored.scrollTop);
  const scrollSaveRef = useRef(null);
  // bumped on a settled scroll so the session write is debounced, not per-frame
  const [scrollTick, setScrollTick] = useState(0);
  useEffect(() => () => clearTimeout(scrollSaveRef.current), []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);
  const [files, setFiles] = useState(saved.files ?? INITIAL_FILES);
  const [docs, setDocs] = useState(saved.docs ?? INITIAL_DOCS);
  const [sketches, setSketches] = useState(() => saved.sketches ?? buildInitialSketches());
  const [images, setImages] = useState(saved.images ?? {});
  const [activeFile, setActiveFile] = useState(restored.noteId);
  const [openTabs, setOpenTabs] = useState(restored.tabs);
  // which folders are folded, kept across sessions as the reader left them
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inkwell:collapsed')) || {}; } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('inkwell:collapsed', JSON.stringify(collapsed)); } catch { /* private mode */ }
  }, [collapsed]);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(saved.settings ?? { localAi: true, sync: false, spell: true, vim: false });
  const [theme, setTheme] = useState({ accent: '#fbbf24', grid: true, paper: true, ...(saved.theme || {}) });
  // the lamp: one light model, three settings. Persisted on its own key so it
  // survives vault import/export, which carries documents rather than room state.
  const [lamp, setLamp] = useState(() => {
    try { return normalizeLamp(localStorage.getItem('inkwell.lamp')); } catch { return DEFAULT_LAMP; }
  });

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

  // remember where this session got to, so the next one resumes.
  // scroll is a ref, not state — it changes constantly and must not re-render.
  useEffect(() => {
    writeSession(localStorage, {
      noteId: activeFile,
      tabs: openTabs,
      view,
      scrollTop: noteScrollRef.current,
      paperId: activePdf?.paperId ?? null,
    });
  }, [activeFile, openTabs, view, activePdf, scrollTick]);

  // before paint, so the room is never briefly the wrong colour
  useLayoutEffect(() => {
    applyLamp(document.documentElement, lamp, theme.accent);
    try { localStorage.setItem('inkwell.lamp', lamp); } catch { /* private mode */ }
  }, [lamp, theme.accent]);

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

  /** What the reader needs for a library paper: its copies, free repositories
      first and blocking publishers last, and the attached file when there is one. */
  const readerFor = (ref, noteId, localData = null) => ({
    url: ref.pdfUrl || null,
    urls: orderPdfCandidates([...(ref.pdfCandidates || []), ref.pdfUrl]),
    landing: ref.url, doi: ref.doi,
    localData,
    title: ref.title, citationKey: ref.citationKey, paperId: paperIdOf(ref), noteId,
  });

  /** Keep a PDF the reader fetched by hand with its paper, and read from it. */
  const attachPdf = async (ref, file, pid = paperIdOf(ref)) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kept = await savePaperPdf(pid, bytes);
    if (kept) setReferences(rs => rs.map(r => (paperIdOf(r) === pid ? { ...r, hasLocalPdf: true } : r)));
    if (activePdf?.paperId === pid) setActivePdf(p => (p?.paperId === pid ? { ...p, localData: bytes } : p));
    else await openPaper({ ...ref, hasLocalPdf: kept }, { localData: bytes });
    if (!kept) alert('The paper is open, but this browser would not keep a copy (storage is blocked or full), so it will need attaching again next time.');
  };

  /** Open a paper in the reader; queue status moves to "reading". Papers straight
      from search get imported first, in the same tick, so the note never doubles.
      The paper opens ONTO its own literature note — other notes stay full-width. */
  const openPaper = async (ref, { localData = null } = {}) => {
    if (!ref.pdfUrl && !ref.hasLocalPdf && !localData) return;
    const pid = paperIdOf(ref);
    const inLibrary = references.some(r => paperIdOf(r) === pid);
    const noteId = inLibrary
      ? ensurePaperNote({ paperId: pid, title: ref.title, citationKey: ref.citationKey })
      : importReference(ref);
    // a copy the reader attached earlier opens at once, and never hits the publisher
    const stored = localData ?? (ref.hasLocalPdf ? await loadPaperPdf(pid) : null);
    if (ref.hasLocalPdf && !stored) {
      // site data was cleared: forget the attachment, fall back to the web copies
      setReferences(rs => rs.map(r => (paperIdOf(r) === pid ? { ...r, hasLocalPdf: false } : r)));
      if (!ref.pdfUrl) {
        alert('The PDF attached to this paper is no longer in this browser (its site data was cleared). Attach it again from the reading queue.');
        return;
      }
    }
    setActivePdf(readerFor(ref, noteId, stored));
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
    // kept, so its highlight links still open it after a reload
    savePaperPdf(pid, bytes);
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
  // A clip (a formula or figure boxed on the page) arrives with its picture and
  // lands as an image; the picture lives in the vault, not the highlight store.
  const addHighlight = ({ image, ...hl }) => {
    if (!activePdf) return;
    const pid = activePdf.paperId;
    setHighlights(s => ({ ...s, [pid]: [...(s[pid] || []), hl] }));
    const noteId = ensurePaperNote(activePdf);
    const label = activePdf.citationKey ? `@${activePdf.citationKey}, p. ${hl.page}` : `p. ${hl.page}`;
    let block;
    if (image) {
      const imgId = newImageId();
      setImageData(imgId, image);
      block = `\n![](img:${imgId})\n\n— [${label}](hl://${hl.id})\n`;
    } else {
      const quoteText = hl.text.length > 420 ? hl.text.slice(0, 417) + '…' : hl.text;
      block = `\n> "${quoteText}"\n> — [${label}](hl://${hl.id})\n`;
    }
    setDocs(d => ({ ...d, [noteId]: (d[noteId] ?? '').replace(/\n*$/, '\n') + block }));
    setFiles(f => f.map(x => (x.id === noteId ? { ...x, mtime: Date.now() } : x)));
    setOpenTabs(t => (t.includes(noteId) ? t : [...t, noteId]));
    setActiveFile(noteId);
    if (workspaceLayout === 'pdf') setWorkspaceLayout('split');
  };

  /** Remove a highlight from the paper and from every note that quotes or links it. */
  const removeHighlight = (id) => {
    if (!activePdf) return;
    const pid = activePdf.paperId;
    setHighlights(s => ({ ...s, [pid]: (s[pid] || []).filter(h => h.id !== id) }));
    const next = { ...docs };
    const freed = [];
    const touched = [];
    for (const [noteId, text] of Object.entries(docs)) {
      const { doc, images: gone } = removeHighlightFromDoc(text, id);
      if (doc === text) continue;
      next[noteId] = doc;
      touched.push(noteId);
      freed.push(...gone);
    }
    if (!touched.length) return;
    setDocs(next);
    setFiles(fs => fs.map(f => (touched.includes(f.id) ? { ...f, mtime: Date.now() } : f)));
    // a clip's picture goes with it, unless another note still shows it
    const orphans = freed.filter(img => !Object.values(next).some(d => d.includes(`img:${img}`)));
    if (orphans.length) setImages(s => { const out = { ...s }; for (const img of orphans) delete out[img]; return out; });
  };

  // clicking a hl:// backlink in any note jumps back to the exact spot in the paper
  useEffect(() => {
    const onJump = async (e) => {
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
      const ref = references.find(r => paperIdOf(r) === pid)
        ?? (pid.startsWith('local:') ? { title: pid.slice(6).replace(/\.pdf$/i, ''), localPid: pid } : null);
      const stored = await loadPaperPdf(pid);
      if (!ref || (!ref.pdfUrl && !stored)) {
        alert('This highlight lives in a PDF this browser no longer has — open or attach that file in the reader again, then the link will jump to it.');
        return;
      }
      const noteId = ensurePaperNote({ paperId: pid, title: ref.title, citationKey: ref.citationKey });
      setActivePdf(ref.localPid
        ? { localData: stored, title: ref.title, citationKey: null, paperId: pid, noteId }
        : readerFor(ref, noteId, stored));
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

  const vaultId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  /** A new note in `parent` (null: the vault root), opened. Returns its id. */
  const newNote = (parent = null, name = 'Untitled', body = '') => {
    const id = vaultId('n');
    const clean = uniqueVaultName(files, name, parent);
    setFiles(f => [...f, { id, name: clean, parent: parent || undefined, top: !parent, mtime: Date.now() }]);
    setDocs(d => ({ ...d, [id]: body }));
    if (parent) setCollapsed(current => ({ ...current, [parent]: false }));
    setOpenTabs(t => [...t, id]);
    setActiveFile(id);
    setView('editor');
    return id;
  };

  /**
   * A project or folder. A project made `withStarter` comes with Literature,
   * Methods and Writing folders and an Overview note, opened, to write in.
   */
  const createVaultFolder = (name, parent = null, kind = 'folder', { withStarter = false } = {}) => {
    const id = vaultId(kind + '-');
    const now = Date.now();
    const clean = uniqueVaultName(files, name || (kind === 'project' ? 'New project' : 'New folder'), parent);
    const made = [{ id, name: clean, folder: true, kind, parent: parent || undefined, top: !parent, mtime: now }];
    if (withStarter) {
      PROJECT_STARTER.folders.forEach((folder, i) => made.push({ id: `${id}-f${i}`, name: folder, folder: true, kind: 'folder', parent: id, top: false, mtime: now }));
      const overviewId = `${id}-overview`;
      made.push({ id: overviewId, name: `${clean} — Overview`, parent: id, top: false, mtime: now });
      setDocs(d => ({ ...d, [overviewId]: PROJECT_STARTER.overview(clean) }));
      setOpenTabs(t => [...t, overviewId]);
      setActiveFile(overviewId);
      setView('editor');
    }
    setFiles(current => [...current, ...made]);
    // starter folders start folded: the project opens on its Overview, not three empty rows
    const folded = Object.fromEntries(made.filter(f => f.folder && f.id !== id).map(f => [f.id, true]));
    setCollapsed(current => ({ ...current, ...folded, [id]: false, ...(parent ? { [parent]: false } : {}) }));
    return id;
  };

  /** Move a note or folder into `parent` (null: the vault root), if the tree allows it. */
  const moveItem = (id, parent) => {
    if (!canMoveInto(files, id, parent)) return;
    const item = files.find(f => f.id === id);
    // a name already taken there gets a number, as a new item would
    const name = uniqueVaultName(files, item.name, parent, id);
    setFiles(current => moveVaultItem(current, id, parent).map(f => (f.id === id ? { ...f, name } : f)));
    if (parent) setCollapsed(current => ({ ...current, [parent]: false }));
  };

  /** A copy of a note beside it; its sketches and images are copied too, so the two never share one. */
  const duplicateNote = (id) => {
    const src = files.find(f => f.id === id && !f.folder);
    if (!src) return;
    const newSketches = {};
    const newImages = {};
    const body = (docs[id] ?? '')
      .replace(/^```sketch[ \t]+(\S+)/gm, (line, skId) => {
        if (!sketches[skId]) return line;
        const copy = vaultId('sketch-');
        newSketches[copy] = structuredClone(sketches[skId]);
        return '```sketch ' + copy;
      })
      .replace(/\]\(img:([^)\s]+)\)/g, (ref, imgId) => {
        if (!images[imgId]) return ref;
        const copy = newImageId();
        newImages[copy] = images[imgId];
        return `](img:${copy})`;
      });
    setSketches(s => ({ ...s, ...newSketches }));
    setImages(s => ({ ...s, ...newImages }));
    newNote(src.parent || null, `${src.name} copy`, body);
  };

  /** Rename a note (rewriting [[wikilinks]] to it across the vault), or a folder or project. */
  const renameFile = (id, name) => {
    const old = files.find(f => f.id === id);
    if (!old) return;
    const clean = old.folder ? uniqueVaultName(files, name, old.parent || null, id) : (name.trim() || 'Untitled');
    if (old.name === clean) return;
    setFiles(f => f.map(x => (x.id === id ? { ...x, name: clean, mtime: Date.now() } : x)));
    if (old.folder) return; // links point at notes, never at folders
    setDocs(d => {
      const out = {};
      for (const [k, v] of Object.entries(d)) out[k] = v.split('[[' + old.name + ']]').join('[[' + clean + ']]');
      return out;
    });
  };

  /** Delete a note, or a folder or project with everything inside it, after asking. */
  const deleteNote = (id) => {
    const f = files.find(x => x.id === id);
    if (!f) return;
    const inside = f.folder ? descendantIds(files, id) : [];
    const noteIds = f.folder ? inside.filter(x => !files.find(y => y.id === x)?.folder) : [id];
    const what = f.kind === 'project' ? 'project' : f.folder ? 'folder' : 'note';
    const question = f.folder && noteIds.length
      ? `Delete the ${what} "${f.name}" and the ${noteIds.length} ${noteIds.length === 1 ? 'note' : 'notes'} inside it? This can't be undone.`
      : `Delete the ${what} "${f.name}"? This can't be undone.`;
    if (!window.confirm(question)) return;
    const gone = new Set([id, ...inside]);
    const doomedBlocks = noteIds.flatMap(n => parseBlocks(docs[n] ?? ''));
    const doomedSketches = doomedBlocks.filter(b => b.t === 'sketch').map(b => b.id);
    const doomedImages = doomedBlocks.filter(b => b.t === 'image' && b.src.startsWith('img:')).map(b => b.src.slice(4));
    setFiles(fs => fs.filter(x => !gone.has(x.id)));
    setDocs(d => { const out = { ...d }; for (const n of noteIds) delete out[n]; return out; });
    setCollapsed(c => { const out = { ...c }; for (const g of gone) delete out[g]; return out; });
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
    setDecks(d => { const out = { ...d }; for (const n of noteIds) delete out[n]; return out; });
    setOpenTabs(t => t.filter(x => !gone.has(x)));
    if (gone.has(activeFile)) {
      const rest = openTabs.filter(x => !gone.has(x));
      setActiveFile(rest[0] ?? files.find(x => !x.folder && !gone.has(x.id))?.id ?? null);
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
    } catch (e) {
      setAiMessages(m => [...m, {
        role: 'a',
        text: describeProviderFailures(e),
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
    } catch (e) {
      setAiMessages(m => [...m, { role: 'a', text: describeProviderFailures(e) }]);
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
        onNewNote={() => newNote(null)}
        spell={settings.spell} grid={theme.grid} paper={theme.paper}
        richEditor={settings.richEditor !== false}
        sketches={sketches} setSketchData={setSketchData}
        images={images} setImageData={setImageData}
        initialScrollTop={restored.noteId === activeFile ? restored.scrollTop : 0}
        onScroll={(top) => {
          noteScrollRef.current = top;
          clearTimeout(scrollSaveRef.current);
          scrollSaveRef.current = setTimeout(() => setScrollTick(t => t + 1), 400);
        }}
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
        onFindMoreSources={() => findMoreCopies({ doi: activePdf.doi })}
        onAttachPdf={(file) => attachPdf(
          references.find(r => paperIdOf(r) === activePdf.paperId) ?? { title: activePdf.title, citationKey: activePdf.citationKey, url: activePdf.landing },
          file,
          activePdf.paperId,
        )}
      />
    </Suspense>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden',
      background: 'var(--desk)',
    }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!focusMode && (
          <IconRail
            rail={rail}
            lamp={lamp}
            onCycleLamp={() => setLamp(l => nextLamp(l))}
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
          <ResizableSide id="research" edge="right" defaultWidth={330} min={260} max={720} label="Resize research library" onCollapse={() => setResearchOpen(false)}>
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
            onAttachPdf={attachPdf}
            onCreateSynthesis={createLiteratureMap}
            onCreateEvidenceMatrix={createEvidenceMatrix}
            onAskAssistant={(prompt) => { setAiOpen(true); setResearchOpen(false); sendMessage(prompt); }}
            onClose={() => setResearchOpen(false)}
          /></Suspense>
          </ResizableSide>
        )}

        {!focusMode && view === 'editor' && sidebarOpen && (
          <ResizableSide id="vault" edge="right" defaultWidth={252} min={190} max={520} label="Resize vault" onCollapse={() => setSidebarOpen(false)}>
          <Sidebar
            files={files} activeFile={activeFile} collapsed={collapsed}
            onOpen={openFile}
            onToggle={(id) => setCollapsed(c => ({ ...c, [id]: !c[id] }))}
            onSetCollapsed={setCollapsed}
            onNewNote={newNote}
            onCreateFolder={createVaultFolder}
            onMove={moveItem}
            onRename={renameFile}
            onDuplicate={duplicateNote}
            onDelete={deleteNote}
          />
          </ResizableSide>
        )}

        <div data-main-area style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#1e2025', position: 'relative' }}>
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
          <ResizableSide id="assistant" edge="left" defaultWidth={300} min={260} max={760} label="Resize assistant" onCollapse={() => setAiOpen(false)}>
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
          </ResizableSide>
        )}
      </div>

      {switcherOpen && (
        <QuickSwitcher files={files} query={query} onQuery={setQuery} onOpen={openFile} onClose={() => setSwitcherOpen(false)} />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings} setSettings={setSettings} theme={theme} setTheme={setTheme} lamp={lamp}
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
