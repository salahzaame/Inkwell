// Resizable side bars, as in VS Code: a thin invisible strip on a panel's
// inner edge. Hover shows the resize cursor and, after a beat, an accent line;
// drag to resize; double-click for the default width; drag far past the
// minimum to close the panel. Widths are remembered per panel.

import { useCallback, useRef, useState } from 'react';

const STORE = 'inkwell:panel-widths';
const KEY_STEP = 16;
const COLLAPSE_SLACK = 56; // how far past the minimum a drag must go to close the panel

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function readWidths() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}

/** A remembered width for panel `key`, kept within [min, max]. */
export function usePanelWidth(key, fallback, min, max) {
  const [width, setWidthState] = useState(() => {
    const saved = Number(readWidths()[key]);
    return Number.isFinite(saved) ? clamp(saved, min, max) : fallback;
  });
  const setWidth = useCallback((next) => {
    const w = Math.round(clamp(next, min, max));
    setWidthState(w);
    try { localStorage.setItem(STORE, JSON.stringify({ ...readWidths(), [key]: w })); } catch { /* private mode */ }
  }, [key, min, max]);
  return [width, setWidth];
}

/**
 * The drag handle. `edge` is the side of the panel it sits on: 'right' for a
 * panel on the left of the screen (it grows rightwards), 'left' for one on the
 * right. `room()` may return how many more pixels the panel can take before
 * squeezing its neighbour.
 */
export function Sash({ edge, width, min, max, defaultWidth, onWidth, onCollapse, room, label, className = '', style }) {
  const start = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dir = edge === 'right' ? 1 : -1;

  const limit = () => Math.max(min, Math.min(max, width + (room ? room() : Infinity)));

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width, max: limit(), closed: false };
    setDragging(true);
    document.documentElement.classList.add('is-resizing');
  };
  const onPointerMove = (e) => {
    const s = start.current;
    if (!s) return;
    const raw = s.width + (e.clientX - s.x) * dir;
    if (onCollapse && raw < min - COLLAPSE_SLACK) {
      // closed, it reopens at the width it had before this drag, as VS Code does
      if (!s.closed) { s.closed = true; onWidth(s.width); finish(); onCollapse(); }
      return;
    }
    onWidth(clamp(raw, min, s.max));
  };
  const finish = () => {
    start.current = null;
    setDragging(false);
    document.documentElement.classList.remove('is-resizing');
  };

  const onKeyDown = (e) => {
    const grow = { ArrowRight: dir, ArrowLeft: -dir }[e.key];
    if (grow) { e.preventDefault(); onWidth(clamp(width + grow * KEY_STEP, min, limit())); }
    if (e.key === 'Home') { e.preventDefault(); onWidth(min); }
    if (e.key === 'End') { e.preventDefault(); onWidth(limit()); }
    if (e.key === 'Enter') { e.preventDefault(); onWidth(defaultWidth); }
  };

  return (
    <div
      className={`sash sash-${edge} ${className}` + (dragging ? ' is-dragging' : '')}
      style={style}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label} — drag to resize, double-click to reset`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onDoubleClick={() => onWidth(defaultWidth)}
      onKeyDown={onKeyDown}
    />
  );
}

/** Room the main area can still give up, keeping `keep` pixels of it for the page. */
export const mainAreaRoom = (keep = 380) => () => {
  const main = document.querySelector('[data-main-area]');
  return main ? Math.max(0, main.getBoundingClientRect().width - keep) : Infinity;
};

/**
 * A side bar of the app shell with a sash on its inner edge. The panel inside
 * fills it (its own width is 100%).
 */
export function ResizableSide({ id, edge, defaultWidth, min, max, onCollapse, label, children }) {
  const [width, setWidth] = usePanelWidth(id, defaultWidth, min, max);
  return (
    <div className="side-wrap" style={{ width }}>
      {children}
      <Sash
        edge={edge} width={width} min={min} max={max} defaultWidth={defaultWidth}
        onWidth={setWidth} onCollapse={onCollapse} room={mainAreaRoom()} label={label}
      />
    </div>
  );
}
