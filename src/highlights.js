// Highlight store for PDF papers.
// Shape in the vault's `highlights` collection: { [paperId]: Highlight[] }
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

export function newHighlightId() {
  return 'hl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const isQuoteLine = (line) => /^\s*>/.test(line);
const CLIP_IMAGE = /^\s*!\[[^\]]*\]\(img:([^)\s]+)\)\s*$/;

/**
 * Take a highlight out of a note when it is removed from the paper. A
 * highlight lands in its note in one of two shapes (see addHighlight):
 *
 *   > "the quoted words"            a quote: the quote goes, whole
 *   > — [@key, p. 3](hl://ID)
 *
 *   ![](img:IMG)                    a clip: the picture and its caption go,
 *                                   and IMG is reported so its bytes can go too
 *   — [@key, p. 5](hl://ID)
 *
 * A link to the highlight anywhere else (a sentence the reader wrote) keeps
 * its words and loses only the dead link. Returns { doc, images }.
 */
export function removeHighlightFromDoc(doc, id) {
  const link = `(hl://${id})`;
  if (!doc || !id || !doc.includes(link)) return { doc, images: [] };
  const linkRx = new RegExp(`\\[([^\\]]*)\\]\\(hl://${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g');
  const lines = doc.split('\n');
  const drop = new Set();
  const images = [];
  const dropRange = (a, b) => {
    for (let k = a; k <= b; k++) drop.add(k);
    // and one blank line with it, so no gap is left behind
    if (b + 1 < lines.length && lines[b + 1].trim() === '' && (a === 0 || lines[a - 1].trim() === '')) drop.add(b + 1);
    else if (a > 0 && lines[a - 1].trim() === '') drop.add(a - 1);
  };
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(link) || drop.has(i)) continue;
    if (isQuoteLine(lines[i])) {
      // the quote it closes: back to the start of the blockquote, or to the
      // line after another highlight's link if two quotes ever ran together
      let a = i;
      while (a > 0 && isQuoteLine(lines[a - 1]) && !lines[a - 1].includes('(hl://')) a--;
      // it ends at the link: quoted lines the reader added after it stay
      dropRange(a, i);
    } else if (lines[i].replace(linkRx, '').replace(/[—–-]/g, '').trim() === '') {
      // a clip's caption: it and the picture just above it
      let k = i - 1;
      while (k >= 0 && lines[k].trim() === '') k--;
      const img = k >= 0 && CLIP_IMAGE.exec(lines[k]);
      if (img) { images.push(img[1]); dropRange(k, i); } else dropRange(i, i);
    } else {
      lines[i] = lines[i].replace(linkRx, '$1');
    }
  }
  return { doc: lines.filter((_, k) => !drop.has(k)).join('\n'), images };
}

/** Find which paper a highlight belongs to. Returns [paperId, highlight] or null. */
export function findHighlight(store, id) {
  for (const [paperId, list] of Object.entries(store)) {
    const hl = (list || []).find(h => h.id === id);
    if (hl) return [paperId, hl];
  }
  return null;
}
