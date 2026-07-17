import { KBD } from '../data.js';

const btn = (on) => ({
  width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer',
  color: on ? 'var(--acc)' : '#8b90a0',
  background: on ? 'color-mix(in oklab, var(--acc) 14%, transparent)' : 'transparent',
});

export default function IconRail({ rail, onFiles, onSearch, onGraph, onSlides, onResearch, onAI, onSettings, onFocusMode }) {
  return (
    <div style={{ width: '46px', background: '#141518', borderRight: '1px solid #23252b', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: '4px', flexShrink: 0 }}>
      <div style={{ width: '30px', height: '30px', marginBottom: '8px', borderRadius: '8px', background: 'color-mix(in oklab, var(--acc) 16%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--acc)', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M3 21l3.5-1L20 6.5a2.12 2.12 0 0 0-3-3L3.5 17z" /><path d="M14 5.5l4.5 4.5" /></svg>
      </div>
      <div className="hv-item" onClick={onFiles} title="Files" style={btn(rail.files)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7c0-1.1.9-2 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
      </div>
      <div className="hv-item" onClick={onSearch} title={`Quick switcher  ${KBD}`} style={btn(rail.search)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
      </div>
      <div className="hv-item" onClick={onGraph} title="Graph view" style={btn(rail.graph)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="8" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M8.2 7l7.4.8M7 8.1l4 7.8M16.8 10l-3.6 6" /></svg>
      </div>
      <div className="hv-item" onClick={onSlides} title="Slides" style={btn(rail.slides)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v3M8 21h8" /></svg>
      </div>
      <div className="hv-item" onClick={onResearch} title="Research Library" style={btn(rail.research)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2M20 4v18" /><path d="M6 6h10M6 10h10" /></svg>
      </div>
      <div className="hv-item" onClick={onAI} title="Assistant" style={btn(rail.ai)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6zM19 15l.9 2.4 2.4.9-2.4.9L19 21.5l-.9-2.3-2.4-.9 2.4-.9z" /></svg>
      </div>
      <div style={{ flex: 1 }} />
      <div className="hv-item" onClick={onFocusMode} title="Zen Focus Mode" style={btn(rail.focusMode)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </div>
      <div className="hv-item" onClick={onSettings} title="Settings" style={btn(rail.settings)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="#141518" /><circle cx="15" cy="12" r="2" fill="#141518" /><circle cx="7" cy="17" r="2" fill="#141518" /></svg>
      </div>
    </div>
  );
}
