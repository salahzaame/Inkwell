import { monthYear } from '../data.js';
import SketchSnapshot from './SketchSnapshot.jsx';

export default function SlidesView({ noteName, slides, template, importNote, sketches, onTemplate, onPresent }) {
  const light = template === 'light';
  const thBg = light ? '#f4f1e9' : '#141518';
  const thInk = light ? '#26221a' : '#e8eaf0';
  const thSub = light ? '#8a8272' : '#5b6170';
  const box = {
    aspectRatio: '16/9', background: thBg, border: '1px solid ' + (light ? '#e0dbcd' : '#2c2f37'),
    borderRadius: '8px', padding: '16px 18px', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', gap: '7px', overflow: 'hidden',
  };
  const small = { fontSize: '12px', fontWeight: 600, color: thInk };
  const line = (w) => ({ height: '6px', borderRadius: '3px', background: light ? '#dcd6c6' : '#26292f', width: w, flexShrink: 0 });
  const chip = (on) => ({
    fontSize: '12.5px', padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
    border: on ? '1px solid var(--acc)' : '1px solid #2c2f37',
    color: on ? 'var(--acc)' : '#8b90a0',
    background: on ? 'color-mix(in oklab, var(--acc) 10%, transparent)' : 'transparent',
  });
  const caption = { fontSize: '11.5px', color: '#5b6170' };
  const LINE_WIDTHS = ['82%', '64%', '74%', '58%', '68%'];

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '36px 40px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#5b6170', marginBottom: '6px' }}>Presentation from</div>
            <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-.02em' }}>{noteName}</div>
          </div>
          {slides.length > 0 && (
            <div className="hv-bright" onClick={onPresent} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--acc)', color: '#17181c', fontWeight: 600, fontSize: '13.5px', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
              Present
            </div>
          )}
        </div>
        <div style={{ fontSize: '13px', color: '#8b90a0', marginBottom: '22px' }}>
          {slides.length} {slides.length === 1 ? 'slide' : 'slides'} drafted from your headings — pick a template, then present or export.
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '26px' }}>
          <div onClick={() => onTemplate('dark')} style={chip(template === 'dark')}>Dark minimal</div>
          <div onClick={() => onTemplate('light')} style={chip(light)}>Paper light</div>
          <div onClick={() => onTemplate('import')} style={chip(template === 'import')}>Import .pptx / .pdf template…</div>
        </div>
        {importNote && (
          <div style={{ border: '1px dashed #3a3e48', borderRadius: '10px', padding: '18px', textAlign: 'center', color: '#8b90a0', fontSize: '13px', marginBottom: '26px' }}>
            Drop a .pptx or .pdf here — Inkwell will map your headings onto its master slides. <span style={{ color: '#5b6170' }}>(mocked in this prototype)</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px' }}>
          {slides.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {s.type === 'title' && (
                <div style={box}>
                  <div style={{ width: '26px', height: '3px', borderRadius: '2px', background: 'var(--acc)' }} />
                  <div style={{ fontSize: '15px', fontWeight: 700, color: thInk, letterSpacing: '-.01em' }}>{s.title}</div>
                  <div style={{ fontSize: '10.5px', color: thSub }}>{s.sub} · {monthYear()}</div>
                </div>
              )}
              {s.type === 'sketch' && (
                <div style={box}>
                  <div style={small}>{s.title}</div>
                  <SketchSnapshot data={sketches[s.sketch]} dark={!light} style={{ width: '100%', height: '70px' }} />
                </div>
              )}
              {s.type === 'bullets' && (
                <div style={box}>
                  <div style={small}>{s.title}</div>
                  {(s.bullets.length ? s.bullets : ['']).slice(0, 4).map((_, j) => (
                    <div key={j} style={line(LINE_WIDTHS[j % LINE_WIDTHS.length])} />
                  ))}
                </div>
              )}
              <div style={caption}>
                {i + 1} · {s.type === 'title' ? 'Title' : s.title}{s.type === 'sketch' ? ' — your sketch' : ''}
              </div>
            </div>
          ))}
        </div>
        {slides.length === 0 && (
          <div style={{ color: '#5b6170', fontSize: '13.5px' }}>Open a note first — slides are drafted from its headings.</div>
        )}
      </div>
    </div>
  );
}
