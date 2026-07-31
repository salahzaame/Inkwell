import { useEffect, useRef, useState } from 'react';
import { diagramErrorMessage } from '../diagrams.js';

// mermaid is heavy (it ships every diagram grammar), so it loads on first use
// rather than with the app shell. One module instance serves every block.
let mermaidPromise = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base' });
      return mermaid;
    });
  }
  return mermaidPromise;
}

let renderSeq = 0;

/**
 * A ```mermaid fence, rendered as a diagram.
 * Falls back to the source text when the diagram will not parse — a half-typed
 * diagram should never blank out part of a note.
 */
export default function MermaidDiagram({ text, pal, onConvertToSketch, converting }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [showSource, setShowSource] = useState(false);
  const idRef = useRef('mermaid-' + (++renderSeq));

  useEffect(() => {
    let live = true;
    const source = String(text || '').trim();
    if (!source) { setSvg(''); setError(null); return undefined; }

    loadMermaid()
      .then(mermaid => mermaid.render(idRef.current + '-' + (++renderSeq), source))
      .then(({ svg: out }) => { if (live) { setSvg(out); setError(null); } })
      .catch(e => {
        if (!live) return;
        setSvg('');
        setError(diagramErrorMessage(e));
        // mermaid leaves its failed probe node behind on a parse error
        document.getElementById('d' + idRef.current)?.remove();
      });
    return () => { live = false; };
  }, [text]);

  const frame = {
    position: 'relative', margin: '0 0 22px', padding: '16px',
    border: `1px solid ${pal.border}`, borderRadius: '10px', background: pal.card,
  };
  const btn = {
    border: `1px solid ${pal.border}`, background: 'transparent', color: pal.muted,
    borderRadius: '6px', padding: '3px 8px', font: 'inherit', fontSize: '11px', cursor: 'pointer',
  };

  if (error) {
    return (
      <div style={{ ...frame, borderStyle: 'dashed' }}>
        <div style={{ fontSize: '11.5px', color: pal.muted, marginBottom: '8px' }}>
          Diagram won’t render — {error}
        </div>
        <pre style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: pal.body, overflowX: 'auto', fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {text}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return <div style={{ ...frame, fontSize: '11.5px', color: pal.muted }}>Drawing diagram…</div>;
  }

  return (
    <div className="note-diagram" style={frame}>
      <div
        style={{ overflowX: 'auto' }}
        // mermaid output; securityLevel 'strict' above sanitises the source
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="note-diagram-tools" style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
        {onConvertToSketch && (
          <button type="button" data-diagram-control disabled={converting}
            onClick={(e) => { e.stopPropagation(); onConvertToSketch(); }}
            style={{ ...btn, color: converting ? pal.muted : 'var(--acc)', borderColor: 'var(--acc)' }}>
            {converting ? 'Converting…' : 'Edit as sketch'}
          </button>
        )}
        <button type="button" data-diagram-control
          onClick={(e) => { e.stopPropagation(); setShowSource(s => !s); }} style={btn}>
          {showSource ? 'Hide source' : 'Show source'}
        </button>
      </div>
      {showSource && (
        <pre data-diagram-control style={{ margin: '10px 0 0', padding: '10px 12px', background: pal.codeBg, borderRadius: '8px', fontSize: '12.5px', lineHeight: 1.6, color: pal.body, overflowX: 'auto', fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {text}
        </pre>
      )}
    </div>
  );
}
