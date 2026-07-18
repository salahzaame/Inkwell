// Highlight store for PDF papers.
// Shape in localStorage 'inkwell:highlights': { [paperId]: Highlight[] }
// Highlight: { id, page, text, color, rects: [{ page, x, y, w, h }], createdAt }
// rects are fractions (0..1) of the page box, so they survive any zoom level.

export const MARKERS = {
  amber: '#fbbf24',
  mint: '#34d399',
  rose: '#fb7185',
};

/** Stable identity for a paper: citation key when known, else its URL/file name. */
export function paperIdOf({ citationKey, url, title } = {}) {
  return citationKey || url || (title ? 'local:' + title : null);
}

export function loadHighlightStore() {
  try {
    return JSON.parse(localStorage.getItem('inkwell:highlights')) || {};
  } catch {
    return {};
  }
}

export function newHighlightId() {
  return 'hl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Find which paper a highlight belongs to. Returns [paperId, highlight] or null. */
export function findHighlight(store, id) {
  for (const [paperId, list] of Object.entries(store)) {
    const hl = (list || []).find(h => h.id === id);
    if (hl) return [paperId, hl];
  }
  return null;
}
