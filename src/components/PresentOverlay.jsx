import { monthYear } from '../data.js';
import SketchSnapshot from './SketchSnapshot.jsx';

export default function PresentOverlay({ template, slideIx, slides, sketches, onClose, onPrev, onNext, onGo }) {
  const light = template === 'light';
  const ink = light ? '#26221a' : '#e8eaf0';
  const slide = slides[slideIx];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: light ? '#f4f1e9' : '#101114', color: ink,
    }}>
      <div className="hv-fade" onClick={onClose} style={{ position: 'absolute', top: '18px', right: '20px', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'inherit' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
      </div>

      {slide && slide.type === 'title' && (
        <div key={slideIx} style={{ textAlign: 'center', animation: 'fadeUp .3s ease-out' }}>
          <div style={{ width: '44px', height: '4px', borderRadius: '2px', background: 'var(--acc)', margin: '0 auto 26px' }} />
          <div style={{ fontSize: 'min(72px, 7vw)', fontWeight: 700, letterSpacing: '-.03em', color: ink }}>{slide.title}</div>
          <div style={{ fontSize: '19px', color: light ? '#8a8272' : '#8b90a0', marginTop: '14px' }}>{slide.sub} · {monthYear()}</div>
        </div>
      )}
      {slide && slide.type === 'sketch' && (
        <div key={slideIx} style={{ textAlign: 'center', width: 'min(860px, 84vw)', animation: 'fadeUp .3s ease-out' }}>
          <div style={{ fontSize: '38px', fontWeight: 700, letterSpacing: '-.02em', color: ink, marginBottom: '30px' }}>{slide.title}</div>
          <SketchSnapshot data={sketches[slide.sketch]} dark={!light} style={{ width: '100%', height: '380px' }} />
        </div>
      )}
      {slide && slide.type === 'bullets' && (
        <div key={slideIx} style={{ width: 'min(720px, 80vw)', animation: 'fadeUp .3s ease-out' }}>
          <div style={{ fontSize: '38px', fontWeight: 700, letterSpacing: '-.02em', color: ink, marginBottom: '30px' }}>{slide.title}</div>
          {slide.bullets.map((b, j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: '16px', fontSize: '24px', lineHeight: 1.5, color: light ? '#4a443a' : '#c3c7d1', marginBottom: '18px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--acc)', flexShrink: 0, position: 'relative', top: '-2px' }} />
              {b}
            </div>
          ))}
          {slide.bullets.length === 0 && (
            <div style={{ fontSize: '19px', color: light ? '#8a8272' : '#8b90a0' }}>(no content under this heading yet)</div>
          )}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '26px', display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div className="hv-fade" onClick={onPrev} style={{ cursor: 'pointer', display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </div>
        <div style={{ display: 'flex', gap: '7px' }}>
          {slides.map((_, ix) => (
            <span key={ix} onClick={() => onGo(ix)} style={{ width: '8px', height: '8px', borderRadius: '50%', cursor: 'pointer', background: slideIx === ix ? 'var(--acc)' : (light ? '#d5cfbf' : '#2c2f37'), display: 'inline-block' }} />
          ))}
        </div>
        <div className="hv-fade" onClick={onNext} style={{ cursor: 'pointer', display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
    </div>
  );
}
