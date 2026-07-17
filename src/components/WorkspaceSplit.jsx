import { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * A tactile, two-pane reading workspace. The divider intentionally reads as an
 * ink seam instead of a generic IDE splitter, matching Inkwell's paper + studio
 * visual language.
 */
export default function WorkspaceSplit({ left, right, initialRatio = 0.5, onRatioChange }) {
  const frameRef = useRef(null);
  const [ratio, setRatio] = useState(initialRatio);
  const [dragging, setDragging] = useState(false);

  useEffect(() => setRatio(initialRatio), [initialRatio]);

  const updateFromPointer = useCallback((clientX) => {
    const frame = frameRef.current;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const next = clamp((clientX - bounds.left) / bounds.width, 0.28, 0.72);
    setRatio(next);
    onRatioChange?.(next);
  }, [onRatioChange]);

  const onPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    updateFromPointer(event.clientX);
  };

  const onPointerMove = (event) => {
    if (dragging) updateFromPointer(event.clientX);
  };

  const stopDragging = () => setDragging(false);

  const reset = () => {
    setRatio(0.5);
    onRatioChange?.(0.5);
  };

  return (
    <div ref={frameRef} className={'workspace-split' + (dragging ? ' is-dragging' : '')}>
      <section className="workspace-pane workspace-pane-pdf" style={{ flexBasis: `${ratio * 100}%` }}>
        {left}
      </section>

      <div
        className="split-gutter"
        role="separator"
        aria-label="Resize PDF and note panels"
        aria-orientation="vertical"
        aria-valuemin={28}
        aria-valuemax={72}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onDoubleClick={reset}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); onRatioChange?.(clamp(ratio - 0.03, 0.28, 0.72)); setRatio(r => clamp(r - 0.03, 0.28, 0.72)); }
          if (event.key === 'ArrowRight') { event.preventDefault(); onRatioChange?.(clamp(ratio + 0.03, 0.28, 0.72)); setRatio(r => clamp(r + 0.03, 0.28, 0.72)); }
          if (event.key === 'Home') { event.preventDefault(); setRatio(0.28); onRatioChange?.(0.28); }
          if (event.key === 'End') { event.preventDefault(); setRatio(0.72); onRatioChange?.(0.72); }
        }}
        title="Drag to resize · double-click to balance"
      >
        <span className="gutter-handle" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span className="gutter-tip">drag to balance</span>
      </div>

      <section className="workspace-pane workspace-pane-note" style={{ flexBasis: `${(1 - ratio) * 100}%` }}>
        {right}
      </section>
    </div>
  );
}
