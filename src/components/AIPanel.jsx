import { useEffect, useRef } from 'react';
import { Inline } from '../markdown.jsx';

export default function AIPanel({ messages, typing, input, onInput, onSend, onWiki, onInsert, onReplace, onSaveAsNote, onRequestRewrite, onCreateLiteratureMap, onCreateEvidenceMatrix, onAddToSlide, slideLabel, hasResearchLibrary, provider, localAi, onClose, noteName }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, typing]);

  const chip = { fontSize: '11.5px', color: 'var(--ink-2)', border: '1px solid var(--line-2)', borderRadius: '99px', padding: '4px 10px', cursor: 'pointer' };

  return (
    <div className="side-panel" style={{ width: '300px', borderLeft: '1px solid var(--line)' }}>
      <div className="panel-header">
        <span className="panel-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--acc)"><path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6z" /></svg>
          Assistant
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10.5px', color: 'var(--ink-2)', background: 'var(--bg-raise)', border: '1px solid var(--line-2)', padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap' }}>
            {provider ?? (localAi ? 'ollama → free cloud' : 'free cloud')}
          </span>
          {onClose && (
            <div className="hv-item panel-close" onClick={onClose} title="Close assistant">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </div>
          )}
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'u'
            ? { alignSelf: 'flex-end', maxWidth: '85%', background: 'color-mix(in oklab, var(--acc) 22%, var(--bg-raise))', color: '#e6e2f7', borderRadius: '10px 10px 3px 10px', padding: '9px 13px', fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap', animation: 'fadeUp .2s ease-out' }
            : { alignSelf: 'flex-start', maxWidth: '92%', background: 'var(--bg-raise)', color: '#c3c7d1', borderRadius: '10px 10px 10px 3px', padding: '9px 13px', fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap', animation: 'fadeUp .2s ease-out' }
          }>
            {m.role === 'a' ? <Inline text={m.text} onWiki={onWiki} /> : m.text}
            {m.role === 'a' && m.canApply && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '9px', paddingTop: '8px', borderTop: '1px solid var(--line-2)' }}>
                <button type="button" onClick={() => onInsert?.(m.text)} style={{ border: 'none', background: 'transparent', color: 'var(--acc)', cursor: 'pointer', padding: 0, fontSize: '11px', fontWeight: 700 }}>
                  Add to {noteName || 'note'}
                </button>
                <button type="button" onClick={() => onSaveAsNote?.(m.text)} style={{ border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', padding: 0, fontSize: '11px' }}>
                  Save as new note
                </button>
                {onAddToSlide && (
                  <button type="button" onClick={() => onAddToSlide(m.text)} style={{ border: 'none', background: 'transparent', color: '#9edcf7', cursor: 'pointer', padding: 0, fontSize: '11px', fontWeight: 700 }}>
                    Add to {slideLabel || 'slide'}
                  </button>
                )}
                {m.canReplace && (
                  <button type="button" onClick={() => onReplace?.(m.text)} style={{ border: 'none', background: 'transparent', color: '#f2b771', cursor: 'pointer', padding: 0, fontSize: '11px', fontWeight: 700 }}>
                    Replace note
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--bg-raise)', borderRadius: '10px 10px 10px 3px', padding: '10px 14px', display: 'flex', gap: '4px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--ink-2)', animation: 'blinkDot 1.2s infinite' }} />
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--ink-2)', animation: 'blinkDot 1.2s .2s infinite' }} />
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--ink-2)', animation: 'blinkDot 1.2s .4s infinite' }} />
          </div>
        )}
      </div>
      <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <div className="hv-chip" onClick={() => onSend('Summarize this note')} style={chip}>Summarize note</div>
        <div className="hv-chip" onClick={() => onSend('What links here?')} style={chip}>What links here?</div>
        <div className="hv-chip" onClick={() => onSend('Draft slides from this note')} style={chip}>Draft slides</div>
        <div className="hv-chip" onClick={() => onSend('Explain the key idea in this note in plain language')} style={chip}>Explain simply</div>
        <div className="hv-chip" onClick={() => onSend('Explain the key idea in this note at a technical level')} style={chip}>Explain technically</div>
        {noteName && <div className="hv-chip" onClick={onRequestRewrite} style={chip}>Rewrite this note</div>}
        {onAddToSlide && <div className="hv-chip" onClick={() => onSend('Review the selected slide in the active deck. Suggest a sharper, concise addition that improves its narrative, accuracy, or clarity.')} style={{ ...chip, color: '#9edcf7' }}>Improve selected slide</div>}
        {hasResearchLibrary && <div className="hv-chip" onClick={onCreateLiteratureMap} style={{ ...chip, color: 'var(--acc)' }}>Create research map</div>}
        {hasResearchLibrary && <div className="hv-chip" onClick={onCreateEvidenceMatrix} style={chip}>Create evidence matrix</div>}
      </div>
      <div style={{ padding: '0 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-canvas)', border: '1px solid var(--line-2)', borderRadius: '10px', padding: '8px 8px 8px 12px' }}>
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSend(input); }}
            placeholder="Ask your vault…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink-1)', fontSize: '13px', minWidth: 0 }}
          />
          <div className="hv-bright" onClick={() => onSend(input)} style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--acc)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#17181c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </div>
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', marginTop: '8px', textAlign: 'center' }}>
          {provider && provider.includes('on-device')
            ? 'Runs locally — your notes never leave this device'
            : 'Free model — your notes are sent as context when you ask'}
        </div>
      </div>
    </div>
  );
}
