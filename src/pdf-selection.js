// Turning a text selection in the PDF reader into a highlight: the boxes to
// paint and the words to quote. Kept free of the DOM so both are tested.

/**
 * One box per run of selected text on a line. The browser reports each
 * selected line twice or more (the text, and the span holding it, a few
 * pixels apart), plus empty boxes for line breaks. Boxes on the same page
 * that share most of their height and touch or overlap sideways are one line
 * segment, and become their union; the two columns of a paper stay apart.
 * Rects are fractions of the page: { page, x, y, w, h }.
 */
export function mergeSelectionRects(rects, { gap = 0.006, minSize = 0.002 } = {}) {
  const sameLine = (a, b) => {
    if (a.page !== b.page) return false;
    const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (overlap < 0.5 * Math.min(a.h, b.h)) return false;
    return a.x <= b.x + b.w + gap && b.x <= a.x + a.w + gap;
  };
  const union = (a, b) => {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { page: a.page, x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  let out = rects.filter(r => r.w > minSize && r.h > minSize).map(r => ({ ...r }));
  // merging can make two earlier boxes meet, so repeat until nothing joins
  for (let changed = true; changed;) {
    changed = false;
    const next = [];
    for (const r of out) {
      const ix = next.findIndex(k => sameLine(k, r));
      if (ix >= 0) { next[ix] = union(next[ix], r); changed = true; } else next.push(r);
    }
    out = next;
  }
  return out.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

/**
 * The selected words as a quote: words the typesetter broke over a line end
 * ("con-\nfigured") joined again, ligatures already folded by the caller,
 * whitespace collapsed. A break is only rejoined between lowercase letters,
 * so "Smith-\nJones" keeps its hyphen.
 */
export function cleanSelectionText(text) {
  return String(text || '')
    .replace(/(\p{Ll})[-­‐]\s*\n\s*(\p{Ll})/gu, '$1$2')
    .replace(/­/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
