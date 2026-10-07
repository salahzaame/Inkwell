// The vault: research projects, folders and notes as one tree.
//
// Everything is reachable three ways, as in VS Code, Obsidian and Notion:
//   right-click     any row, or the empty space below the tree
//   hover buttons   + (a note inside a folder) and ⋯ (the same menu)
//   keys            ↑ ↓ to move, → ← to open and fold, Enter, F2 rename,
//                   Delete, Shift+F10 for the menu
// New things are named in place, where they will live. "New note" goes where
// the reader is working: the selected folder, else the open note's folder.

import { useEffect, useMemo, useRef, useState } from 'react';
import { canMoveInto, folderPath, moveDestinations, vaultRows } from '../vault.js';
import ContextMenu from './ContextMenu.jsx';

const ICON = {
  folder: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 7c0-1.1.9-2 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>,
  project: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 4h11l5 5v11H4z" /><path d="M8 12h8M8 16h5M8 8h4" /></svg>,
  note: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></svg>,
  plus: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  more: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>,
  newNote: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3H6v18h12V8z" /><path d="M13 3v5h5M12 11v6M9 14h6" /></svg>,
  rename: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>,
  duplicate: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>,
  move: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7c0-1.1.9-2 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M10 13h6M13.5 10.5L16 13l-2.5 2.5" /></svg>,
  link: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></svg>,
  fold: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l5 5 5-5M7 20l5-5 5 5" /></svg>,
  unfold: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9l5-5 5 5M7 15l5 5 5-5" /></svg>,
  root: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9H3z" /></svg>,
  newFolder: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7c0-1.1.9-2 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 10v6M9 13h6" /></svg>,
};

const readPref = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const writePref = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };

const DRAFT_LABEL = { note: 'Note name', folder: 'Folder name', project: 'Project name' };
const DRAFT_DEFAULT = { note: 'Untitled', folder: 'New folder', project: 'New project' };

/** The inline name box for a new item, or a rename. */
function NameInput({ initial, kind, onCommit, onCancel, starter, onStarter }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const box = useRef(null);
  const finish = (commit) => {
    if (done.current) return;
    done.current = true;
    if (commit && value.trim()) onCommit(value.trim()); else onCancel();
  };
  return (
    <div ref={box} className="tree-name-box" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        aria-label={DRAFT_LABEL[kind] || 'Name'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); finish(true); }
          if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        }}
        // clicking the starter toggle beside the box is not leaving it
        onBlur={(e) => { if (!box.current?.contains(e.relatedTarget)) finish(true); }}
      />
      {onStarter && (
        <label className="tree-starter" title="Start with Literature, Methods and Writing folders and an Overview note">
          <input type="checkbox" checked={starter} onChange={(e) => onStarter(e.target.checked)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } }} />
          Literature · Methods · Writing folders
        </label>
      )}
    </div>
  );
}

export default function Sidebar({
  files, activeFile, collapsed,
  onOpen, onToggle, onSetCollapsed,
  onNewNote, onCreateFolder, onMove, onRename, onDuplicate, onDelete,
}) {
  const [sort, setSort] = useState(() => readPref('inkwell:vault-sort', 'name'));
  const [starter, setStarter] = useState(() => readPref('inkwell:project-starter', '1') === '1');
  const [selected, setSelected] = useState(null);   // the row with focus / the last one clicked
  const [draft, setDraft] = useState(null);         // { kind, parent } — a new item being named
  const [renaming, setRenaming] = useState(null);   // id
  const [menu, setMenu] = useState(null);           // { x, y, items }
  const [dragId, setDragId] = useState(null);
  const [dropOn, setDropOn] = useState(undefined);  // folder id, null for the root, undefined: none
  const rowEls = useRef(new Map());
  const treeRef = useRef(null);
  const expandTimer = useRef(null);

  const byId = useMemo(() => new Map(files.map(f => [f.id, f])), [files]);
  const rows = useMemo(() => vaultRows(files, collapsed, { sort }), [files, collapsed, sort]);
  // notes inside each folder, however deep, for the count on a folded folder
  const noteCounts = useMemo(() => {
    const counts = {};
    for (const f of files) {
      if (f.folder) continue;
      const seen = new Set();
      for (let p = byId.get(f.parent); p && !seen.has(p.id); p = byId.get(p.parent)) { seen.add(p.id); counts[p.id] = (counts[p.id] || 0) + 1; }
    }
    return counts;
  }, [files, byId]);

  const projects = rows.filter(r => r.depth === 0 && r.file.kind === 'project' && r.file.folder);
  const loose = rows.filter(r => !projects.includes(r) && !isInProject(r.file));
  function isInProject(file) {
    for (let p = byId.get(file.parent); p; p = byId.get(p.parent)) if (p.kind === 'project' && p.folder) return true;
    return file.kind === 'project' && file.folder;
  }
  const projectRows = rows.filter(r => isInProject(r.file));

  // where "New note" goes: the selected folder, else wherever the open note lives
  const selectedFile = byId.get(selected);
  const contextFolder = selectedFile?.folder ? selectedFile.id
    : (selectedFile ? selectedFile.parent : byId.get(activeFile)?.parent) || null;
  const contextPath = contextFolder ? folderPath(files, contextFolder) : [];

  // a note opened elsewhere (tabs, links, search) becomes the selection
  useEffect(() => { if (activeFile) setSelected(activeFile); }, [activeFile]);
  useEffect(() => { rowEls.current.get(activeFile)?.scrollIntoView({ block: 'nearest' }); }, [activeFile]);

  const focusRow = (id) => { setSelected(id); requestAnimationFrame(() => rowEls.current.get(id)?.focus()); };
  const expand = (id) => { if (id && collapsed[id]) onToggle(id); };

  /* ── creating, renaming ── */

  const startDraft = (kind, parent = null) => {
    setMenu(null);
    setRenaming(null);
    if (parent) expand(parent);
    setDraft({ kind, parent });
  };
  const commitDraft = (name) => {
    const { kind, parent } = draft;
    setDraft(null);
    if (kind === 'note') onNewNote(parent, name);
    else if (kind === 'project') onCreateFolder(name, null, 'project', { withStarter: starter });
    else onCreateFolder(name, parent, 'folder');
  };
  const toggleStarter = (on) => { setStarter(on); writePref('inkwell:project-starter', on ? '1' : '0'); };
  const setSortPref = (value) => { setSort(value); writePref('inkwell:vault-sort', value); };

  /* ── menus ── */

  const moveItems = (file) => {
    const dests = moveDestinations(files, file.id);
    const items = [];
    if (canMoveInto(files, file.id, null)) items.push({ label: 'Vault root (unfiled)', icon: ICON.root, onSelect: () => onMove(file.id, null) });
    for (const { file: d, depth } of dests) {
      items.push({ label: d.name, icon: d.kind === 'project' ? ICON.project : ICON.folder, indent: depth, onSelect: () => onMove(file.id, d.id) });
    }
    return items.length ? items : [{ label: 'No other folders yet', disabled: true }];
  };

  const allFolders = () => Object.fromEntries(files.filter(f => f.folder).map(f => [f.id, true]));

  const viewItems = () => [
    { heading: 'Sort notes by' },
    { label: 'Name', checked: sort === 'name', onSelect: () => setSortPref('name') },
    { label: 'Last edited', checked: sort === 'edited', onSelect: () => setSortPref('edited') },
    { sep: true },
    { label: 'Collapse all', icon: ICON.fold, onSelect: () => onSetCollapsed(allFolders()) },
    { label: 'Expand all', icon: ICON.unfold, onSelect: () => onSetCollapsed({}) },
  ];

  const itemsFor = (file) => {
    if (!file) {
      return [
        { label: 'New note', icon: ICON.newNote, onSelect: () => startDraft('note', null) },
        { label: 'New folder', icon: ICON.newFolder, onSelect: () => startDraft('folder', null) },
        { label: 'New project', icon: ICON.project, onSelect: () => startDraft('project') },
        { sep: true },
        ...viewItems(),
      ];
    }
    if (file.folder) {
      const isProj = file.kind === 'project';
      return [
        { label: 'New note here', icon: ICON.newNote, onSelect: () => startDraft('note', file.id) },
        { label: 'New folder here', icon: ICON.newFolder, onSelect: () => startDraft('folder', file.id) },
        { sep: true },
        { label: 'Rename', hint: 'F2', icon: ICON.rename, onSelect: () => setRenaming(file.id) },
        ...(isProj ? [] : [{ label: 'Move to', icon: ICON.move, items: moveItems(file) }]),
        { label: collapsed[file.id] ? 'Expand' : 'Collapse', icon: collapsed[file.id] ? ICON.unfold : ICON.fold, onSelect: () => onToggle(file.id) },
        { sep: true },
        { label: isProj ? 'Delete project…' : 'Delete folder…', hint: 'Del', icon: ICON.trash, danger: true, onSelect: () => onDelete(file.id) },
      ];
    }
    return [
      { label: 'Open', icon: ICON.note, onSelect: () => onOpen(file.id) },
      { label: 'Rename', hint: 'F2', icon: ICON.rename, onSelect: () => setRenaming(file.id) },
      { label: 'Duplicate', icon: ICON.duplicate, onSelect: () => onDuplicate(file.id) },
      { label: 'Move to', icon: ICON.move, items: moveItems(file) },
      { label: 'Copy link', hint: `[[…]]`, icon: ICON.link, onSelect: () => navigator.clipboard?.writeText(`[[${file.name}]]`) },
      { sep: true },
      { label: 'Delete note', hint: 'Del', icon: ICON.trash, danger: true, onSelect: () => onDelete(file.id) },
    ];
  };

  const openMenuAt = (x, y, file, alignRight = false) => {
    setDraft(null);
    if (file) setSelected(file.id);
    setMenu({ x, y, alignRight, items: itemsFor(file) });
  };
  const openMenuFrom = (el, file) => {
    const b = el.getBoundingClientRect();
    openMenuAt(b.right, b.bottom + 4, file, true);
  };

  /* ── keyboard: a tree, as screen readers and VS Code expect ── */

  const onTreeKey = (e) => {
    if (renaming || draft || e.target.tagName === 'INPUT') return;
    const ids = rows.map(r => r.file.id);
    const ix = ids.indexOf(selected);
    const file = byId.get(selected);
    const go = (i) => { e.preventDefault(); if (ids[i]) focusRow(ids[i]); };
    switch (e.key) {
      case 'ArrowDown': go(ix < 0 ? 0 : Math.min(ids.length - 1, ix + 1)); break;
      case 'ArrowUp': go(ix < 0 ? 0 : Math.max(0, ix - 1)); break;
      case 'Home': go(0); break;
      case 'End': go(ids.length - 1); break;
      case 'ArrowRight':
        if (!file?.folder) return;
        e.preventDefault();
        if (collapsed[file.id]) onToggle(file.id);
        else if (rows[ix + 1]?.file.parent === file.id) focusRow(rows[ix + 1].file.id);
        break;
      case 'ArrowLeft':
        if (!file) return;
        e.preventDefault();
        if (file.folder && !collapsed[file.id]) onToggle(file.id);
        else if (file.parent && byId.has(file.parent)) focusRow(file.parent);
        break;
      case 'Enter':
        if (!file) return;
        e.preventDefault();
        if (file.folder) onToggle(file.id); else onOpen(file.id);
        break;
      case 'F2':
        if (!file) return;
        e.preventDefault();
        setRenaming(file.id);
        break;
      case 'Backspace':
        if (!e.metaKey) return; // ⌘⌫ on a Mac, as in Finder
      // falls through
      case 'Delete':
        if (!file) return;
        e.preventDefault();
        onDelete(file.id);
        break;
      case 'ContextMenu':
      case 'F10':
        if (e.key === 'F10' && !e.shiftKey) return;
        e.preventDefault();
        if (file && rowEls.current.get(file.id)) openMenuFrom(rowEls.current.get(file.id), file);
        else openMenuAt(40, 120, null);
        break;
      default:
    }
  };

  /* ── drag and drop: notes and folders, onto folders or the empty space ── */

  const dropTargetFor = (file) => (file ? (file.folder ? file.id : file.parent || null) : null);
  const onDragOverTarget = (e, target) => {
    if (!dragId || !canMoveInto(files, dragId, target)) { setDropOn(undefined); return; }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dropOn !== target) {
      setDropOn(target);
      clearTimeout(expandTimer.current);
      // hold over a folded folder to open it, to reach what is inside
      if (target && collapsed[target]) expandTimer.current = setTimeout(() => onToggle(target), 650);
    }
  };
  const onDropTarget = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(expandTimer.current);
    if (dragId && canMoveInto(files, dragId, target)) onMove(dragId, target);
    setDragId(null);
    setDropOn(undefined);
  };
  const endDrag = () => { clearTimeout(expandTimer.current); setDragId(null); setDropOn(undefined); };

  /* ── rows ── */

  const draftRow = (parent, depth) => (draft && (draft.parent || null) === (parent || null) && draft.kind !== 'project') && (
    <div className="tree-row is-draft" style={{ paddingLeft: 8 + depth * 14 }}>
      <span className="tree-chev" />
      <span className="tree-icon">{draft.kind === 'note' ? ICON.note : ICON.folder}</span>
      <NameInput initial={DRAFT_DEFAULT[draft.kind]} kind={draft.kind} onCommit={commitDraft} onCancel={() => setDraft(null)} />
    </div>
  );

  const renderRow = ({ file, depth }) => {
    const isFolder = file.folder;
    const isProj = isFolder && file.kind === 'project';
    const open = isFolder && !collapsed[file.id];
    const active = !isFolder && activeFile === file.id;
    const isSel = selected === file.id;
    const empty = open && !files.some(f => f.parent === file.id);
    return (
      <div key={file.id} role="none">
        <div
          ref={(el) => { if (el) rowEls.current.set(file.id, el); else rowEls.current.delete(file.id); }}
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={isFolder ? open : undefined}
          aria-selected={active || isSel}
          tabIndex={file.id === tabStop ? 0 : -1}
          className={'tree-row'
            + (isProj ? ' is-project' : isFolder ? ' is-folder' : '')
            + (active ? ' is-active' : '')
            + (isSel ? ' is-selected' : '')
            + (dropOn === file.id ? ' is-drop' : '')
            + (dragId === file.id ? ' is-dragging' : '')}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => { setSelected(file.id); if (isFolder) onToggle(file.id); else onOpen(file.id); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenuAt(e.clientX, e.clientY, file); }}
          draggable={renaming !== file.id}
          onDragStart={(e) => { setDragId(file.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', file.name); }}
          onDragEnd={endDrag}
          onDragOver={(e) => onDragOverTarget(e, dropTargetFor(file))}
          onDrop={(e) => onDropTarget(e, dropTargetFor(file))}
        >
          {Array.from({ length: depth }, (_, i) => <span key={i} className="tree-guide" style={{ left: 14 + i * 14 }} />)}
          <span className="tree-chev" aria-hidden="true">{isFolder ? (open ? '▾' : '▸') : ''}</span>
          <span className="tree-icon">{isProj ? ICON.project : isFolder ? ICON.folder : ICON.note}</span>
          {renaming === file.id ? (
            <NameInput
              initial={file.name} kind={isFolder ? 'folder' : 'note'}
              onCommit={(name) => { setRenaming(null); onRename(file.id, name); focusRow(file.id); }}
              onCancel={() => { setRenaming(null); focusRow(file.id); }}
            />
          ) : (
            <>
              <span className="tree-name" title={file.name}>{file.name}</span>
              {isFolder && !open && noteCounts[file.id] > 0 && <span className="tree-count">{noteCounts[file.id]}</span>}
              <span className="tree-actions">
                {isFolder && (
                  <button type="button" tabIndex={-1} title={`New note in ${file.name}`} aria-label={`New note in ${file.name}`}
                    onClick={(e) => { e.stopPropagation(); startDraft('note', file.id); }}>{ICON.plus}</button>
                )}
                <button type="button" tabIndex={-1} title="More actions" aria-label={`Actions for ${file.name}`}
                  onClick={(e) => { e.stopPropagation(); openMenuFrom(e.currentTarget, file); }}>{ICON.more}</button>
              </span>
            </>
          )}
        </div>
        {open && draftRow(file.id, depth + 1)}
        {empty && !(draft && draft.parent === file.id) && (
          <div className="tree-empty" style={{ paddingLeft: 8 + (depth + 1) * 14 + 18 }}>
            Empty —{' '}
            <button type="button" onClick={() => startDraft('note', file.id)}>add a note</button>
          </div>
        )}
      </div>
    );
  };

  // one row is reachable by Tab: the selected one, else the open note, else the first
  const tabStop = rows.some(r => r.file.id === selected) ? selected
    : rows.some(r => r.file.id === activeFile) ? activeFile : rows[0]?.file.id;

  const noteTotal = files.filter(f => !f.folder).length;
  const projectTotal = files.filter(f => f.folder && f.kind === 'project').length;

  return (
    <div className="side-panel vault" style={{ width: '100%', borderRight: '1px solid var(--line)' }}>
      <div className="panel-header">
        <span className="panel-title">{ICON.folder} Vault</span>
        <div className="vault-tools">
          <button type="button" onClick={() => startDraft('note', contextFolder)} title={contextPath.length ? `New note in ${contextPath.join(' › ')}` : 'New note'} aria-label="New note">{ICON.newNote}</button>
          <button type="button" onClick={() => startDraft('folder', contextFolder)} title={contextPath.length ? `New folder in ${contextPath.join(' › ')}` : 'New folder'} aria-label="New folder">{ICON.newFolder}</button>
          <button type="button" onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setMenu({ x: b.right, y: b.bottom + 4, alignRight: true, items: viewItems() }); }} title="Sort and fold" aria-label="Sort and fold">{ICON.more}</button>
        </div>
      </div>

      <button type="button" className="vault-new-note" onClick={() => startDraft('note', contextFolder)}>
        <span className="vault-new-plus">{ICON.plus}</span>
        <span>New note</span>
        {contextPath.length > 0 && <span className="vault-new-where">in {contextPath.join(' › ')}</span>}
      </button>

      <div
        ref={treeRef}
        role="tree"
        aria-label="Vault"
        className={'vault-tree' + (dropOn === null ? ' is-drop-root' : '')}
        onKeyDown={onTreeKey}
        onContextMenu={(e) => { e.preventDefault(); openMenuAt(e.clientX, e.clientY, null); }}
        onDragOver={(e) => onDragOverTarget(e, null)}
        onDrop={(e) => onDropTarget(e, null)}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropOn(undefined); }}
      >
        <div className="vault-section">
          <span>Projects</span>
          <button type="button" title="New research project" aria-label="New research project" onClick={() => startDraft('project')}>{ICON.plus}</button>
        </div>
        {draft?.kind === 'project' && (
          <div className="tree-row is-draft is-project" style={{ paddingLeft: 8 }}>
            <span className="tree-chev" />
            <span className="tree-icon">{ICON.project}</span>
            <NameInput initial={DRAFT_DEFAULT.project} kind="project" onCommit={commitDraft} onCancel={() => setDraft(null)} starter={starter} onStarter={toggleStarter} />
          </div>
        )}
        {projectRows.map(renderRow)}
        {projects.length === 0 && draft?.kind !== 'project' && (
          <button type="button" className="vault-hint" onClick={() => startDraft('project')}>
            Start a research project — its notes, papers and drafts in one place.
          </button>
        )}

        <div className="vault-section">
          <span>Notes</span>
          <button type="button" title="New note (not in a project)" aria-label="New unfiled note" onClick={() => startDraft('note', null)}>{ICON.plus}</button>
        </div>
        {draftRow(null, 0)}
        {loose.map(renderRow)}
        {loose.length === 0 && !(draft && !draft.parent && draft.kind !== 'project') && (
          <div className="vault-hint is-quiet">Notes outside any project land here.</div>
        )}
      </div>

      <div className="vault-foot">
        <span className="vault-dot" />
        {noteTotal} {noteTotal === 1 ? 'note' : 'notes'}{projectTotal ? ` · ${projectTotal} ${projectTotal === 1 ? 'project' : 'projects'}` : ''} · local vault
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
