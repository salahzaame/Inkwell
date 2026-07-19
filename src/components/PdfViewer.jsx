import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import { MARKERS, newHighlightId } from '../highlights.js';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const READ_THEMES = ['paper', 'sepia', 'night'];
const THEME_LABEL = { paper: 'Paper', sepia: 'Sepia', night: 'Night' };

/** Drop selection rects fully contained in another rect on the same page
    (range.getClientRects() often doubles line + span boxes). */
function dedupeRects(rects) {
  const eps = 0.004;
  return rects.filter((a, i) => !rects.some((b, j) => (
    j !== i && b.page === a.page
    && b.x <= a.x + eps && b.y <= a.y + eps
    && b.x + b.w >= a.x + a.w - eps && b.y + b.h >= a.y + a.h - eps
    && (b.w * b.h > a.w * a.h || j < i)
  )));
}

function PdfPage({ doc, pageNum, baseW, baseH, scale, visible, hls, flashId, registerEl, onPageClick }) {
  const canvasRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (!visible || !doc) return;
    let cancelled = false;
    let renderTask = null;
    (async () => {
      try {
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const textDiv = textRef.current;
        if (!canvas || !textDiv) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        renderTask = page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
          // display intent paces painting with requestAnimationFrame, which never
          // fires in hidden/background tabs — pages would stall until refocus
          intent: 'print',
        });
        await renderTask.promise;
        if (cancelled) return;
        textDiv.textContent = '';
        const textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textDiv,
          viewport,
        });
        await textLayer.render();
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          console.error('pdf page render failed', pageNum, err);
        }
      }
    })();
    return () => { cancelled = true; try { renderTask?.cancel(); } catch { /* already done */ } };
  }, [doc, pageNum, visible, scale]);

  const w = baseW * scale;
  const h = baseH * scale;

  return (
    <div
      className="pdf-page"
      data-page={pageNum}
      ref={(el) => registerEl(pageNum, el)}
      onClick={(e) => onPageClick(e, pageNum)}
      style={{ width: w, height: h, '--total-scale-factor': scale, '--scale-factor': scale }}
    >
      <canvas ref={canvasRef} />
      <div className="pdf-hl-layer" aria-hidden="true">
        {hls.map(hl => hl.rects.filter(r => r.page === pageNum).map((r, i) => (
          <div
            key={hl.id + i}
            className={'pdf-hl' + (flashId === hl.id ? ' flash' : '')}
            style={{
              left: `${r.x * 100}%`, top: `${r.y * 100}%`,
              width: `${r.w * 100}%`, height: `${r.h * 100}%`,
              background: MARKERS[hl.color] || MARKERS.amber,
            }}
          />
        )))}
      </div>
      <div className="pdf-text-layer" ref={textRef} />
      <span className="pdf-page-num">{pageNum}</span>
    </div>
  );
}

export default function PdfViewer({
  pdfUrl, pdfUrls, landingUrl, localData, title, citationKey,
  highlights = [], onAddHighlight, onRemoveHighlight,
  jumpHl, onJumpDone,
  onSendToAi, onClose, onLocalFile,
  layout = 'split', onLayoutChange,
}) {
  const scrollerRef = useRef(null);
  const pageEls = useRef(new Map());
  const ioRef = useRef(null);
  const scrollTick = useRef(false);

  const [doc, setDoc] = useState(null);
  const [dims, setDims] = useState([]);
  const [scale, setScale] = useState(1);
  const [visiblePages, setVisiblePages] = useState(() => new Set([1, 2]));
  const [curPage, setCurPage] = useState(1);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [pending, setPending] = useState(null);   // fresh text selection awaiting a marker
  const [hlPop, setHlPop] = useState(null);       // clicked existing highlight
  const [flashId, setFlashId] = useState(null);
  const [readTheme, setReadTheme] = useState(() => localStorage.getItem('inkwell:pdf-theme') || 'paper');

  // ordered open-access copies of this paper; the reader walks the list until one loads
  const sources = localData ? [] : (pdfUrls?.length ? pdfUrls : (pdfUrl ? [pdfUrl] : []));
  const sourcesKey = sources.join('|');
  const [srcIx, setSrcIx] = useState(0);
  useEffect(() => { setSrcIx(0); }, [sourcesKey]);

  const hasSource = Boolean(localData || sources.length);
  const activeUrl = sources.length ? sources[Math.min(srcIx, sources.length - 1)] : null;

  /* ── document loading ── */
  useEffect(() => {
    if (!hasSource) { setDoc(null); setDims([]); setError(null); return; }
    let dead = false;
    setDoc(null); setDims([]); setError(null);
    setVisiblePages(new Set([1, 2])); setCurPage(1);
    pageEls.current.clear();
    const src = localData
      // copy: pdf.js transfers the buffer to its worker, which would detach ours
      ? { data: localData.slice() }
      : { url: activeUrl.startsWith('http') ? `/api/pdf?url=${encodeURIComponent(activeUrl)}` : activeUrl };
    const task = getDocument(src);
    (async () => {
      try {
        const d = await task.promise;
        if (dead) return;
        const out = [];
        for (let i = 1; i <= d.numPages; i++) {
          const p = await d.getPage(i);
          const v = p.getViewport({ scale: 1 });
          out.push({ w: v.width, h: v.height });
        }
        if (dead) return;
        const cw = scrollerRef.current?.clientWidth || 820;
        setScale(Math.min(1.8, Math.max(0.6, (cw - 56) / out[0].w)));
        setDims(out);
        setDoc(d);
      } catch (err) {
        if (dead) return;
        if (!localData && srcIx < sources.length - 1) {
          setSrcIx(i => i + 1); // this copy is blocked or broken — try the next one
        } else {
          setError(String(err?.message || err));
        }
      }
    })();
    return () => { dead = true; task.destroy().catch(() => {}); };
    // sources is derived from sourcesKey; srcIx drives activeUrl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl, srcIx, localData, hasSource, reloadTick]);

  /* ── lazy page rendering ── */
  const registerEl = useCallback((n, el) => {
    if (el) {
      pageEls.current.set(n, el);
      ioRef.current?.observe(el);
    } else {
      const old = pageEls.current.get(n);
      if (old) ioRef.current?.unobserve(old);
      pageEls.current.delete(n);
    }
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!doc || !scroller) return;
    const io = new IntersectionObserver((entries) => {
      setVisiblePages(prev => {
        let changed = false;
        const next = new Set(prev);
        for (const en of entries) {
          const n = Number(en.target.dataset.page);
          if (en.isIntersecting && !next.has(n)) { next.add(n); changed = true; }
        }
        return changed ? next : prev;
      });
    }, { root: scroller, rootMargin: '700px 0px' });
    ioRef.current = io;
    for (const el of pageEls.current.values()) io.observe(el);
    return () => { io.disconnect(); ioRef.current = null; };
  }, [doc]);

  /* ── current-page indicator + popover dismissal on scroll ── */
  const handleScroll = () => {
    setPending(null);
    setHlPop(null);
    if (scrollTick.current) return;
    scrollTick.current = true;
    setTimeout(() => {
      scrollTick.current = false;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const mid = scroller.scrollTop + scroller.clientHeight * 0.4;
      let best = 1;
      for (const [n, el] of pageEls.current) {
        if (el.offsetTop <= mid) best = Math.max(best, n);
      }
      setCurPage(best);
    }, 80);
  };

  /* ── text selection → marker popover ── */
  const handleMouseUp = () => {
    // setTimeout, not rAF: rAF never fires in hidden/background tabs
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setPending(null); return; }
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 2) { setPending(null); return; }
      const anchorEl = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      if (!anchorEl?.closest('.pdf-text-layer')) { setPending(null); return; }
      const range = sel.getRangeAt(0);
      const rects = [];
      for (const r of range.getClientRects()) {
        if (r.width < 1.5 || r.height < 1.5) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        for (const [n, el] of pageEls.current) {
          const b = el.getBoundingClientRect();
          if (cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom) {
            rects.push({
              page: n,
              x: (r.left - b.left) / b.width,
              y: (r.top - b.top) / b.height,
              w: r.width / b.width,
              h: r.height / b.height,
            });
            break;
          }
        }
      }
      if (!rects.length) { setPending(null); return; }
      const merged = dedupeRects(rects);
      const bb = range.getBoundingClientRect();
      setPending({
        text,
        rects: merged,
        page: merged[0].page,
        x: Math.min(Math.max(bb.left + bb.width / 2, 140), window.innerWidth - 140),
        y: Math.max(bb.top - 10, 58),
      });
    }, 0);
  };

  const addMarker = (color) => {
    if (!pending) return;
    onAddHighlight?.({
      id: newHighlightId(),
      page: pending.page,
      text: pending.text,
      color,
      rects: pending.rects,
      createdAt: Date.now(),
    });
    window.getSelection()?.removeAllRanges();
    setPending(null);
  };

  /* ── clicking an existing highlight ── */
  const onPageClick = (e, pageNum) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const el = pageEls.current.get(pageNum);
    if (!el) return;
    const b = el.getBoundingClientRect();
    const fx = (e.clientX - b.left) / b.width;
    const fy = (e.clientY - b.top) / b.height;
    const hit = highlights.find(h => h.rects.some(r => (
      r.page === pageNum && fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h
    )));
    if (hit) {
      setHlPop({ hl: hit, x: e.clientX, y: Math.max(e.clientY - 10, 58) });
    } else {
      setHlPop(null);
    }
  };

  /* ── jump to a highlight (from a note backlink) ── */
  useEffect(() => {
    if (!jumpHl || !doc || !dims.length) return;
    const hl = highlights.find(h => h.id === jumpHl);
    if (!hl) { onJumpDone?.(); return; }
    setVisiblePages(prev => (prev.has(hl.page) ? prev : new Set([...prev, hl.page])));
    const el = pageEls.current.get(hl.page);
    const scroller = scrollerRef.current;
    if (el && scroller) {
      const y = el.offsetTop + (hl.rects[0]?.y ?? 0) * el.clientHeight - 120;
      scroller.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
    setFlashId(hl.id);
    const t = setTimeout(() => { setFlashId(null); onJumpDone?.(); }, 1900);
    return () => clearTimeout(t);
    // highlights identity churns on every store write; jumpHl + doc are the real triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpHl, doc, dims.length]);

  /* ── reading theme ── */
  const cycleTheme = () => {
    const next = READ_THEMES[(READ_THEMES.indexOf(readTheme) + 1) % READ_THEMES.length];
    setReadTheme(next);
    localStorage.setItem('inkwell:pdf-theme', next);
  };

  /* ── AI summary straight from the already-loaded document ── */
  const handleSummarize = async () => {
    if (!doc) return;
    setExtracting(true);
    try {
      let text = '';
      const maxPages = Math.min(doc.numPages, 8);
      for (let i = 1; i <= maxPages; i++) {
        const p = await doc.getPage(i);
        const tc = await p.getTextContent();
        text += `\n[Page ${i}]\n` + tc.items.map(it => it.str).join(' ');
      }
      if (!text.trim()) throw new Error('No readable text found — this PDF may be scanned.');
      const paperTitle = title || 'this PDF';
      onSendToAi(`I have loaded the research paper: "${paperTitle}". Here is the extracted text of the first ${maxPages} pages:\n\n${text.slice(0, 7000)}\n\nCan you summarize the main goals, methodology, and key findings of this paper?`);
    } catch (err) {
      alert(`Text extraction failed: ${err.message}`);
    } finally {
      setExtracting(false);
    }
  };

  const zoom = (dir) => setScale(s => Math.min(2.6, Math.max(0.45, dir === 0 ? 1 : s * (dir > 0 ? 1.15 : 1 / 1.15))));

  return (
    <div className="pdf-shell">
      <div className="pdf-toolbar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2.2" style={{ flexShrink: 0 }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
        <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-1)', flex: 1, minWidth: 0 }}>
          {title || 'PDF Reader'}
        </span>

        {doc && (
          <>
            <span className="pdf-page-indicator">p. {curPage} / {doc.numPages}</span>
            <div className="seg" role="group" aria-label="Zoom">
              <button onClick={() => zoom(-1)} title="Zoom out" aria-label="Zoom out">−</button>
              <button onClick={() => zoom(0)} title="Reset zoom" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(scale * 100)}%</button>
              <button onClick={() => zoom(1)} title="Zoom in" aria-label="Zoom in">+</button>
            </div>
            <button className="tool-btn" onClick={cycleTheme} title="Reading light: paper, sepia or night">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></svg>
              {THEME_LABEL[readTheme]}
            </button>
          </>
        )}

        {hasSource && onLayoutChange && (
          <div className="seg" role="group" aria-label="Workspace layout">
            {['split', 'pdf', 'editor'].map(mode => (
              <button key={mode} className={layout === mode ? 'on' : ''} onClick={() => onLayoutChange(mode)}>
                {mode === 'split' ? 'Split' : mode === 'pdf' ? 'PDF' : 'Note'}
              </button>
            ))}
          </div>
        )}

        {doc && (
          <button className="tool-btn accent" onClick={handleSummarize} disabled={extracting}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6z" /></svg>
            {extracting ? 'Reading…' : 'Summarize'}
          </button>
        )}

        {citationKey && (
          <button
            className="tool-btn"
            title={`Copy citation key [@${citationKey}]`}
            onClick={() => navigator.clipboard.writeText(`[@${citationKey}]`)}
          >@</button>
        )}

        <button className="tool-btn" onClick={onClose} title="Close paper" aria-label="Close paper" style={{ padding: '5px 7px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {error ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--ink-2)', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>This paper couldn't be loaded</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-3)', maxWidth: '340px', lineHeight: 1.5 }}>
            {sources.length > 1
              ? `All ${sources.length} known copies are blocked or offline — publishers sometimes refuse automated access.`
              : 'The publisher blocked the download or the file is offline.'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-3)', maxWidth: '340px', lineHeight: 1.5, opacity: .7 }}>{error}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="tool-btn accent" style={{ border: 'none', font: 'inherit', fontSize: '12px', borderRadius: '7px', padding: '7px 14px', cursor: 'pointer' }} onClick={() => { setSrcIx(0); setReloadTick(t => t + 1); }}>Try again</button>
            {(landingUrl || activeUrl) && <a href={landingUrl || activeUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--acc)', alignSelf: 'center' }}>Open on the publisher's site ↗</a>}
          </div>
        </div>
      ) : hasSource ? (
        <div
          ref={scrollerRef}
          className={`pdf-scroller pdf-theme-${readTheme}`}
          onScroll={handleScroll}
          onMouseUp={handleMouseUp}
        >
          {!doc && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--ink-3)', fontSize: '13px', paddingTop: '80px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--acc)', animation: 'blinkDot 1.2s infinite' }} />
              {srcIx > 0 ? `Trying another copy (${srcIx + 1} of ${sources.length})…` : 'Fetching paper…'}
            </div>
          )}
          {doc && dims.map((d, ix) => (
            <PdfPage
              key={ix + 1}
              doc={doc}
              pageNum={ix + 1}
              baseW={d.w}
              baseH={d.h}
              scale={scale}
              visible={visiblePages.has(ix + 1)}
              hls={highlights.filter(h => h.rects.some(r => r.page === ix + 1))}
              flashId={flashId}
              registerEl={registerEl}
              onPageClick={onPageClick}
            />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: 'var(--ink-2)', padding: '20px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 12 15 15" /></svg>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>No paper open</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-3)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.5 }}>
            Pick a paper from your reading queue, search for one in the Research panel, or read a local file.
          </div>
          <label style={{ background: 'var(--acc)', color: '#17181c', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', marginTop: '6px', fontSize: '12px', fontWeight: 600 }}>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onLocalFile?.(f); }}
              style={{ display: 'none' }}
            />
            Open local PDF
          </label>
        </div>
      )}

      {/* marker popover: pick a highlighter for the current selection */}
      {pending && (
        <div className="pdf-pop" style={{ left: pending.x, top: pending.y, transform: 'translate(-50%, -100%)' }} onMouseDown={(e) => e.preventDefault()}>
          <span className="pop-label">mark it →</span>
          {Object.entries(MARKERS).map(([name, color]) => (
            <button
              key={name}
              className="marker-dot"
              style={{ background: color }}
              title={`Highlight in ${name} + add to note`}
              aria-label={`Highlight in ${name} and add to note`}
              onClick={() => addMarker(name)}
            />
          ))}
        </div>
      )}

      {/* existing highlight popover */}
      {hlPop && (
        <div className="pdf-pop" style={{ left: hlPop.x, top: hlPop.y, transform: 'translate(-50%, -100%)' }}>
          <span className="marker-dot" style={{ background: MARKERS[hlPop.hl.color] || MARKERS.amber, width: '14px', height: '14px', cursor: 'default' }} />
          <button className="pop-btn" onClick={() => { navigator.clipboard.writeText(hlPop.hl.text); setHlPop(null); }}>Copy text</button>
          <button className="pop-btn danger" onClick={() => { onRemoveHighlight?.(hlPop.hl.id); setHlPop(null); }}>Remove</button>
        </div>
      )}
    </div>
  );
}
