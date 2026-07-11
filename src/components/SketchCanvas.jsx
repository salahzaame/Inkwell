import { useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, getSceneVersion } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

const isTyping = () => {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/**
 * An embedded Excalidraw canvas, one per ```sketch fence.
 * `data` is a stored scene ({ elements, files }); changes flow up via onChange.
 * Can expand to a full-screen overlay — same component instance, so the scene
 * (and its undo history) survives the toggle.
 */
export default function SketchCanvas({ sketchId, data, onChange, grid, paper }) {
  const versionRef = useRef(null);
  const [full, setFull] = useState(false);
  const [api, setApi] = useState(null);

  useEffect(() => {
    if (!full) return undefined;
    const kd = (e) => {
      if (e.key === 'Escape' && !isTyping()) setFull(false);
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [full]);

  // re-fit the drawing whenever the canvas changes size (fullscreen toggle),
  // so leaving fullscreen never strands the content off-screen
  useEffect(() => {
    if (!api) return undefined;
    const t = setTimeout(() => {
      const els = api.getSceneElements();
      if (els.length) api.scrollToContent(els, { fitToViewport: true, viewportZoomFactor: 0.85, animate: false });
    }, 80);
    return () => clearTimeout(t);
  }, [full, api]);

  // initialData is only read on mount; memo it so the scene isn't rebuilt every render
  const initialData = useMemo(() => ({
    elements: data?.elements ?? [],
    files: data?.files ?? undefined,
    appState: {
      viewBackgroundColor: '#ffffff',
      currentItemStrokeColor: '#1e1e1e',
      currentItemRoughness: 1,
    },
    scrollToContent: true,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [sketchId]);

  const handleChange = (elements, appState, files) => {
    const v = getSceneVersion(elements);
    if (v === versionRef.current) return; // ignore selection/scroll-only changes
    versionRef.current = v;
    // drop soft-deleted elements — persisting them lets a remount resurrect undone shapes
    onChange({ elements: elements.filter(e => !e.isDeleted), files });
  };

  const frame = full
    ? { position: 'fixed', inset: 0, zIndex: 70, background: '#1a1c21', display: 'flex', flexDirection: 'column' }
    : {
      border: `1px solid ${paper ? '#e0d7bf' : '#2c2f37'}`, borderRadius: '12px',
      background: paper ? '#fffdf7' : '#1a1c21', margin: '0 0 30px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: paper ? '0 10px 26px -18px rgba(38,34,26,.5)' : 'none',
    };
  const headBorder = full ? '#23252b' : (paper ? '#eee7d5' : '#23252b');
  const labelColor = full ? '#8b90a0' : (paper ? '#8a8272' : '#8b90a0');
  const hintColor = full ? '#5b6170' : (paper ? '#b3aa93' : '#5b6170');

  return (
    <>
      {full && (
        <div style={{ border: `1px dashed ${paper ? '#d8cfb6' : '#2c2f37'}`, borderRadius: '12px', margin: '0 0 30px', padding: '24px', textAlign: 'center', color: hintColor, fontSize: '13px' }}>
          ✎ {sketchId}.sketch — open in full screen
        </div>
      )}
      <div style={frame}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: full ? '10px 16px' : '8px 12px', borderBottom: `1px solid ${headBorder}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "'Gochi Hand'", fontSize: '14px', color: labelColor }}>✎ {sketchId}.sketch</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10.5px', color: hintColor }}>excalidraw canvas</span>
            <div
              className={paper && !full ? 'hv-tool-paper' : 'hv-tool'}
              title={full ? 'Exit full screen  (Esc)' : 'Full screen'}
              onClick={() => setFull(f => !f)}
              style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: labelColor, cursor: 'pointer' }}
            >
              {full
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>}
            </div>
          </div>
        </div>
        <div style={full ? { flex: 1, minHeight: 0 } : { height: '440px' }}>
          <Excalidraw
            theme="light"
            excalidrawAPI={setApi}
            initialData={initialData}
            onChange={handleChange}
            gridModeEnabled={grid}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                saveToActiveFile: false,
                export: false,
                changeViewBackgroundColor: false,
                toggleTheme: false,
              },
            }}
          />
        </div>
      </div>
    </>
  );
}
