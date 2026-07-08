export default function QuickSwitcher({ files, query, onQuery, onOpen, onClose }) {
  const q = query.trim().toLowerCase();
  const results = files.filter(f => !f.folder && (!q || f.name.toLowerCase().includes(q)));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,11,13,.6)', zIndex: 50, display: 'flex', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '520px', height: 'fit-content', background: '#1e2025', border: '1px solid #2c2f37', borderRadius: '12px', boxShadow: '0 24px 60px rgba(0,0,0,.5)', overflow: 'hidden', animation: 'popIn .12s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', borderBottom: '1px solid #2c2f37' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b90a0" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results.length) onOpen(results[0].id); }}
            placeholder="Jump to a note…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#dadde5', fontSize: '15px' }}
          />
          <span style={{ fontSize: '10.5px', color: '#5b6170', border: '1px solid #2c2f37', borderRadius: '5px', padding: '2px 6px' }}>esc</span>
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '6px' }}>
          {results.map(r => (
            <div key={r.id} className="hv-result" onClick={() => onOpen(r.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '13.5px', color: '#c3c7d1' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5b6170" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></svg>
              {r.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
