import { useState } from 'react';
import { vaultRows } from '../vault.js';

function FolderIcon({ project = false }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 7c0-1.1.9-2 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />{project && <path d="M8 12h8M12 8v8" />}</svg>;
}

export default function Sidebar({ files, activeFile, collapsed, onOpen, onNewNote, onNewProject, onNewFolder, onMoveNote, onDelete }) {
  const noteCount = files.filter(f => !f.folder).length;
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [creating, setCreating] = useState(null); // 'project' | 'folder'
  const [name, setName] = useState('');
  const [moveMenuFor, setMoveMenuFor] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const rows = vaultRows(files, collapsed);
  const selectedFolderName = files.find(file => file.id === selectedFolder)?.name;
  const moveDestinations = files.filter(file => file.folder);

  const begin = (type) => { setCreating(type); setName(type === 'project' ? 'New project' : 'New folder'); };
  const submit = (event) => {
    event.preventDefault();
    if (!creating) return;
    if (creating === 'project') onNewProject?.(name);
    else onNewFolder?.(name, selectedFolder || null);
    setCreating(null);
    setName('');
  };

  return (
    <div className="side-panel" style={{ width: '252px', borderRight: '1px solid var(--line)' }}>
      <div className="panel-header">
        <span className="panel-title"><FolderIcon /> Vault</span>
        <div style={{ display: 'flex', gap: '3px' }}>
          <button type="button" className="vault-add" onClick={() => begin('project')} title="Create research project">+ Project</button>
          <button type="button" className="vault-add icon" onClick={() => begin('folder')} title={selectedFolderName ? `New folder in ${selectedFolderName}` : 'Create top-level folder'}>+</button>
        </div>
      </div>
      <div style={{ padding: '8px 10px 0', display: 'flex', gap: '6px' }}>
        <button type="button" className="vault-new-note" onClick={() => onNewNote?.(selectedFolder || null)}>{selectedFolderName ? `New note in ${selectedFolderName}` : 'New note'}</button>
      </div>
      {creating && (
        <form onSubmit={submit} className="vault-create-form">
          <span>{creating === 'project' ? 'Project' : selectedFolderName ? `Folder in ${selectedFolderName}` : 'Folder'}</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} onFocus={(event) => event.currentTarget.select()} onKeyDown={(event) => { if (event.key === 'Escape') setCreating(null); }} />
          <button type="submit">Create</button>
        </form>
      )}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 12px' }}>
        {rows.map(({ file, depth }) => {
          const active = !file.folder && activeFile === file.id;
          const selected = file.folder && selectedFolder === file.id;
          return (
            <div
              key={file.id}
              className={`hv-item tree-row${dropTarget === file.id ? ' tree-drop-target' : ''}`}
              onClick={() => { if (file.folder) setSelectedFolder(file.id); onOpen(file.id); }}
              onContextMenu={(event) => {
                if (file.folder) return;
                event.preventDefault();
                setMoveMenuFor(file.id);
              }}
              draggable={!file.folder}
              onDragStart={(event) => {
                if (file.folder) return;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', file.id);
              }}
              onDragOver={(event) => {
                if (!file.folder) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTarget(file.id);
              }}
              onDragLeave={() => { if (file.folder) setDropTarget(null); }}
              onDrop={(event) => {
                if (!file.folder) return;
                event.preventDefault();
                const noteId = event.dataTransfer.getData('text/plain');
                onMoveNote?.(noteId, file.id);
                setDropTarget(null);
                setMoveMenuFor(null);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 6px', position: 'relative',
                paddingLeft: `${6 + depth * 14}px`, borderRadius: 'var(--r-s)', cursor: 'pointer',
                fontSize: '13px', color: active ? '#e6e2f7' : (file.folder ? '#aeb3c0' : 'var(--ink-2)'),
                fontWeight: file.folder ? 600 : 400,
                background: active ? 'color-mix(in oklab, var(--acc) 16%, transparent)' : (selected ? 'var(--bg-raise)' : 'transparent'),
              }}
            >
              <span style={{ width: '12px', display: 'inline-flex', justifyContent: 'center', color: selected ? 'var(--acc)' : 'var(--ink-3)', fontSize: '9px', flexShrink: 0 }}>{file.folder ? (collapsed[file.id] ? '▸' : '▾') : ''}</span>
              <span style={{ display: 'inline-flex', flexShrink: 0, color: active || selected ? 'var(--acc)' : 'var(--ink-3)' }}>
                {file.folder ? <FolderIcon project={file.kind === 'project'} /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></svg>}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              {file.folder && file.kind === 'project' && <span style={{ color: 'var(--ink-3)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.05em' }}>project</span>}
              {!file.folder && <>
                <button className="tree-move" type="button" title="Move to…" aria-label={`Move ${file.name} to a folder`} onClick={(event) => { event.stopPropagation(); setMoveMenuFor(current => current === file.id ? null : file.id); }} style={{ width: '18px', height: '18px', borderRadius: '4px', border: 0, background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h9l3 3h4v11H4z" /><path d="M10 12h8M15 9l3 3-3 3" /></svg></button>
                <span className="tree-del" title="Delete note" onClick={(event) => { event.stopPropagation(); onDelete(file.id); }} style={{ width: '18px', height: '18px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', flexShrink: 0 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></svg></span>
                {moveMenuFor === file.id && (
                  <div className="vault-move-menu" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                    <div className="vault-move-menu-label">Move to</div>
                    <button type="button" onClick={() => { onMoveNote?.(file.id, null); setMoveMenuFor(null); }}>Vault root</button>
                    {moveDestinations.map(destination => (
                      <button key={destination.id} type="button" onClick={() => { onMoveNote?.(file.id, destination.id); setMoveMenuFor(null); }}>
                        {destination.kind === 'project' ? 'Project · ' : ''}{destination.name}
                      </button>
                    ))}
                    {moveDestinations.length === 0 && <div className="vault-move-empty">Create a project or folder first.</div>}
                  </div>
                )}
              </>}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: '11px', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />{noteCount} {noteCount === 1 ? 'note' : 'notes'} · local vault</div>
    </div>
  );
}
