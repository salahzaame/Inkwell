export default function TabBar({ files, openTabs, activeFile, view, onClick, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 10px 0', background: 'var(--bg-panel)', borderBottom: '1px solid var(--line)', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
      {openTabs.map(id => {
        const f = files.find(x => x.id === id);
        const active = activeFile === id && view === 'editor';
        return (
          <div
            key={id}
            onClick={() => onClick(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px 7px 14px',
              fontSize: '12.5px', cursor: 'pointer', borderRadius: '8px 8px 0 0',
              background: active ? 'var(--bg-canvas)' : 'transparent',
              color: active ? 'var(--ink-1)' : 'var(--ink-2)',
              borderTop: active ? '1px solid var(--line)' : '1px solid transparent',
              borderLeft: active ? '1px solid var(--line)' : '1px solid transparent',
              borderRight: active ? '1px solid var(--line)' : '1px solid transparent',
              flexShrink: 0,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{f ? f.name : id}</span>
            <span
              className="hv-close"
              onClick={(e) => { e.stopPropagation(); onClose(id); }}
              style={{ width: '16px', height: '16px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#5b6170', flexShrink: 0 }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
            </span>
          </div>
        );
      })}
    </div>
  );
}
