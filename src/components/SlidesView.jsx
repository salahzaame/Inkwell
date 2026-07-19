import { Component } from 'react';
import { Renderer } from '@json-render/react';
import { monthYear } from '../data.js';
import SketchSnapshot from './SketchSnapshot.jsx';
import { deckRegistry, DeckAssets, DeckProviders, deckSlideKeys, slideSpec } from '../deck/registry.jsx';

/** One bad slide should never take down the whole view. */
export class SlideBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: '12px', opacity: .5 }}>this slide failed to render</div>;
    }
    return this.props.children;
  }
}

export default function SlidesView({
  noteName, slides, template, importNote, sketches, images,
  deck, deckBusy, onGenerateDeck, onClearDeck,
  onTemplate, onPresent,
}) {
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
    border: on ? '1px solid var(--acc)' : '1px solid var(--line-2)',
    color: on ? 'var(--acc)' : 'var(--ink-2)',
    background: on ? 'color-mix(in oklab, var(--acc) 10%, transparent)' : 'transparent',
  });
  const caption = { fontSize: '11.5px', color: 'var(--ink-3)' };
  const LINE_WIDTHS = ['82%', '64%', '74%', '58%', '68%'];

  const slideKeys = deck ? deckSlideKeys(deck) : [];
  const hasContent = deck ? slideKeys.length > 0 : slides.length > 0;

  const aiBtn = {
    display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px',
    padding: '8px 15px', borderRadius: '8px', cursor: deckBusy ? 'default' : 'pointer',
    border: '1px solid color-mix(in oklab, var(--acc) 45%, transparent)',
    color: 'var(--acc)', background: 'color-mix(in oklab, var(--acc) 9%, transparent)',
    opacity: deckBusy ? .7 : 1,
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '36px 40px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '6px', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '6px' }}>Presentation from</div>
            <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noteName}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <div onClick={deckBusy ? undefined : onGenerateDeck} style={aiBtn} title="Let the assistant design a full deck from this note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6zM19 15l.9 2.4 2.4.9-2.4.9L19 21.5l-.9-2.3-2.4-.9 2.4-.9z" /></svg>
              {deckBusy ? 'Designing your deck…' : (deck ? 'Regenerate AI deck' : 'Design deck with AI')}
            </div>
            {hasContent && (
              <div className="hv-bright" onClick={onPresent} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--acc)', color: '#17181c', fontWeight: 600, fontSize: '13.5px', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
                Present
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--ink-2)', marginBottom: '22px' }}>
          {deck
            ? <>{slideKeys.length} slides designed by the assistant · <span onClick={onClearDeck} style={{ color: 'var(--acc)', cursor: 'pointer' }}>switch back to the heading outline</span></>
            : `${slides.length} ${slides.length === 1 ? 'slide' : 'slides'} drafted from your headings — or let the assistant design a full deck.`}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '26px' }}>
          <div onClick={() => onTemplate('dark')} style={chip(template === 'dark')}>Dark minimal</div>
          <div onClick={() => onTemplate('light')} style={chip(light)}>Paper light</div>
          {!deck && <div onClick={() => onTemplate('import')} style={chip(template === 'import')}>Import .pptx / .pdf template…</div>}
        </div>
        {importNote && !deck && (
          <div style={{ border: '1px dashed #3a3e48', borderRadius: '10px', padding: '18px', textAlign: 'center', color: 'var(--ink-2)', fontSize: '13px', marginBottom: '26px' }}>
            Drop a .pptx or .pdf here — Inkwell will map your headings onto its master slides. <span style={{ color: 'var(--ink-3)' }}>(mocked in this prototype)</span>
          </div>
        )}

        {deck ? (
          /* ── AI deck thumbnails ── */
          <DeckAssets.Provider value={{ sketches, images: images || {}, light }}>
            <DeckProviders>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '18px' }}>
                {slideKeys.map((key, i) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className={'deck-slide' + (light ? ' light' : '')} style={{ fontSize: '4px' }}>
                      <SlideBoundary>
                        <Renderer spec={slideSpec(deck, key)} registry={deckRegistry} />
                      </SlideBoundary>
                    </div>
                    <div style={caption}>{i + 1} · {deck.elements[key]?.props?.eyebrow || deck.elements[key]?.props?.layout}</div>
                  </div>
                ))}
              </div>
            </DeckProviders>
          </DeckAssets.Provider>
        ) : (
          /* ── heading-outline thumbnails ── */
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
        )}

        {!hasContent && !deckBusy && (
          <div style={{ color: 'var(--ink-3)', fontSize: '13.5px' }}>Open a note first — slides are drafted from its headings, or designed by the assistant.</div>
        )}
      </div>
    </div>
  );
}
