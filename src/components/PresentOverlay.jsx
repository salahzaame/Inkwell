import { useState } from 'react';
import { Renderer } from '@json-render/react';
import { monthYear } from '../data.js';
import SketchSnapshot from './SketchSnapshot.jsx';
import { deckRegistry, DeckAssets, DeckProviders, deckSlideKeys, getDeckTheme, slideSpec } from '../deck/registry.jsx';
import { SlideBoundary } from './SlidesView.jsx';

export default function PresentOverlay({ template, slideIx, slides, sketches, deck, images, references = [], onClose, onPrev, onNext, onGo }) {
  const [showNotes, setShowNotes] = useState(false);
  const deckTheme = getDeckTheme(deck?.elements?.[deck?.root]?.props?.theme || (template === 'light' ? 'paper' : 'midnight'));
  const light = deck ? deckTheme.light : template === 'light';
  const ink = deck ? deckTheme.ink : (light ? '#26221a' : '#e8eaf0');
  const slideKeys = deck ? deckSlideKeys(deck) : [];
  const total = deck ? slideKeys.length : slides.length;
  const slide = deck ? null : slides[slideIx];
  const deckSlideKey = deck ? slideKeys[Math.min(slideIx, slideKeys.length - 1)] : null;
  const speakerNotes = deckSlideKey ? deck.elements[deckSlideKey]?.props?.speakerNotes : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: deck ? deckTheme.background : (light ? '#f4f1e9' : '#101114'), color: ink,
    }}>
      <div className="hv-fade" onClick={onClose} style={{ position: 'absolute', top: '18px', right: '20px', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'inherit' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
      </div>

      {deck && deckSlideKey && (
        <div key={slideIx} style={{ width: 'min(1180px, 90vw)', animation: 'fadeUp .3s ease-out' }}>
          <DeckAssets.Provider value={{ sketches, images: images || {}, references, light }}>
            <DeckProviders>
              <div className={'deck-slide deck-present' + (light ? ' light' : '')} style={{ fontSize: 'min(1.4vw, 2.5vh)', background: deckTheme.background, color: deckTheme.ink, borderColor: deckTheme.border, '--acc': deckTheme.accent || 'var(--acc)', boxShadow: '0 30px 80px rgba(0,0,0,.4)' }}>
                <SlideBoundary>
                  <Renderer spec={slideSpec(deck, deckSlideKey)} registry={deckRegistry} />
                </SlideBoundary>
              </div>
            </DeckProviders>
          </DeckAssets.Provider>
        </div>
      )}

      {deck && speakerNotes && showNotes && (
        <aside style={{ position: 'absolute', left: '24px', bottom: '22px', maxWidth: 'min(440px, 45vw)', padding: '12px 14px', background: light ? 'rgba(38,34,26,.09)' : 'rgba(255,255,255,.08)', border: '1px solid ' + (light ? 'rgba(38,34,26,.18)' : 'rgba(255,255,255,.16)'), borderRadius: '8px', color: ink, fontSize: '13px', lineHeight: 1.45 }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .6, marginBottom: '5px' }}>Speaker notes</div>
          {speakerNotes}
        </aside>
      )}

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
          {Array.from({ length: total }).map((_, ix) => (
            <span key={ix} onClick={() => onGo(ix)} style={{ width: '8px', height: '8px', borderRadius: '50%', cursor: 'pointer', background: slideIx === ix ? 'var(--acc)' : (light ? '#d5cfbf' : '#2c2f37'), display: 'inline-block' }} />
          ))}
        </div>
        <div className="hv-fade" onClick={onNext} style={{ cursor: 'pointer', display: 'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
      {deck && speakerNotes && (
        <button type="button" onClick={() => setShowNotes(v => !v)} style={{ position: 'absolute', right: '22px', bottom: '21px', border: '1px solid ' + (light ? '#d5cfbf' : '#343841'), background: 'transparent', color: ink, borderRadius: '7px', cursor: 'pointer', padding: '7px 10px', fontSize: '11.5px', fontWeight: 600 }}>
          {showNotes ? 'Hide notes' : 'Show notes'}
        </button>
      )}
    </div>
  );
}
