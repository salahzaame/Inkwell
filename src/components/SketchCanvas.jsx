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
export default function SketchCanvas({ sketchId, data, onChange, grid }) {
  const versionRef = useRef(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return undefined;
    const kd = (e) => {
      if (e.key === 'Escape' && !isTyping()) setFull(false);
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [full]);

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
    : { border: '1px solid #2c2f37', borderRadius: '12px', background: '#1a1c21', margin: '0 0 30px', overflow: 'hidden', display: 'flex', flexDirection: 'column' };

  return (
    <>
      {full && (
        <div style={{ border: '1px dashed #2c2f37', borderRadius: '12px', margin: '0 0 30px', padding: '24px', textAlign: 'center', color: '#5b6170', fontSize: '13px' }}>
          ✎ {sketchId}.sketch — open in full screen
        </div>
      )}
      <div style={frame}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: full ? '10px 16px' : '8px 12px', borderBottom: '1px solid #23252b', flexShrink: 0 }}>
          <span style={{ fontFamily: "'Gochi Hand'", fontSize: '14px', color: '#8b90a0' }}>✎ {sketchId}.sketch</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10.5px', color: '#5b6170' }}>excalidraw canvas</span>
            <div
              className="hv-tool"
              title={full ? 'Exit full screen  (Esc)' : 'Full screen'}
              onClick={() => setFull(f => !f)}
              style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b90a0', cursor: 'pointer' }}
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
