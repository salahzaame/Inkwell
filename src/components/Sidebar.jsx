export default function Sidebar({ files, activeFile, collapsed, onOpen, onNewNote, onDelete }) {
  const noteCount = files.filter(f => !f.folder).length;

  return (
    <div className="side-panel" style={{ width: '236px', borderRight: '1px solid var(--line)' }}>
      <div className="panel-header">
        <span className="panel-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7c0-1.1.9-2 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
          Vault
        </span>
        <div className="hv-item-lit panel-close" title="New note" onClick={onNewNote}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 12px' }}>
        {files.map(f => {
          if (f.parent && collapsed[f.parent]) return null;
          const active = !f.folder && activeFile === f.id;
          return (
            <div
              key={f.id}
              className="hv-item tree-row"
              onClick={() => onOpen(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px',
                paddingLeft: f.parent ? '14px' : '6px', borderRadius: 'var(--r-s)', cursor: 'pointer',
                fontSize: '13px', color: active ? '#e6e2f7' : (f.folder ? '#aeb3c0' : 'var(--ink-2)'),
                fontWeight: f.folder ? 600 : 400,
                background: active ? 'color-mix(in oklab, var(--acc) 16%, transparent)' : 'transparent',
              }}
            >
              <span style={{ width: '14px', display: 'inline-flex', justifyContent: 'center', color: 'var(--ink-3)', fontSize: '9px', flexShrink: 0 }}>
                {f.folder ? (collapsed[f.id] ? '▸' : '▾') : ''}
              </span>
              <span style={{ display: 'inline-flex', flexShrink: 0, color: active ? 'var(--acc)' : 'var(--ink-3)' }}>
                {f.folder
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 7c0-1.1.9-2 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></svg>}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              {!f.folder && (
                <span
                  className="tree-del"
                  title="Delete note"
                  onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', flexShrink: 0 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></svg>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: '11px', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
        {noteCount} {noteCount === 1 ? 'note' : 'notes'} · local only
      </div>
    </div>
  );
}
