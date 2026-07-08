export default function Sidebar({ files, activeFile, collapsed, onOpen, onNewNote, onDelete }) {
  const noteCount = files.filter(f => !f.folder).length;

  return (
    <div style={{ width: '228px', background: '#191b1f', borderRight: '1px solid #23252b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 8px 14px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '.4px', color: '#8b90a0', textTransform: 'uppercase' }}>Inkwell vault</div>
        <div className="hv-item-lit" title="New note" onClick={onNewNote} style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b90a0', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px 12px' }}>
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
                paddingLeft: f.parent ? '14px' : '6px', borderRadius: '6px', cursor: 'pointer',
                fontSize: '13px', color: active ? '#e6e2f7' : (f.folder ? '#aeb3c0' : '#9aa0af'),
                fontWeight: f.folder ? 600 : 400,
                background: active ? 'color-mix(in oklab, var(--acc) 16%, transparent)' : 'transparent',
              }}
            >
              <span style={{ width: '14px', display: 'inline-flex', justifyContent: 'center', color: '#5b6170', fontSize: '9px', flexShrink: 0 }}>
                {f.folder ? (collapsed[f.id] ? '▸' : '▾') : ''}
              </span>
              <span style={{ display: 'inline-flex', flexShrink: 0, color: active ? 'var(--acc)' : '#5b6170' }}>
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
                  style={{ width: '18px', height: '18px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#5b6170', flexShrink: 0 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></svg>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid #23252b', fontSize: '11px', color: '#5b6170', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
        {noteCount} {noteCount === 1 ? 'note' : 'notes'} · local only
      </div>
    </div>
  );
}
