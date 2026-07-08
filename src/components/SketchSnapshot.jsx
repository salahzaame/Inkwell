import { useEffect, useRef } from 'react';
import { exportToSvg } from '@excalidraw/excalidraw';

/**
 * Static SVG snapshot of an Excalidraw scene — used by slide thumbnails and present mode.
 * `dark` renders with Excalidraw's dark-mode filter so ink stays legible on dark slides.
 */
export default function SketchSnapshot({ data, dark, style }) {
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    const elements = (data?.elements ?? []).filter(e => !e.isDeleted);
    if (!el) return undefined;
    if (elements.length === 0) { el.replaceChildren(); return undefined; }
    exportToSvg({
      elements,
      files: data?.files ?? null,
      appState: { exportBackground: false, exportWithDarkMode: !!dark },
      exportPadding: 16,
    }).then(svg => {
      if (!alive || !ref.current) return;
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      ref.current.replaceChildren(svg);
    }).catch(() => { /* snapshot is decorative — ignore render failures */ });
    return () => { alive = false; };
  }, [data, dark]);

  return <div ref={ref} style={style} />;
}
