import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSelectionText, mergeSelectionRects } from '../src/pdf-selection.js';

// fractions of a 900 x 1300 px page, as the browser reported them for a
// six-line selection on page 3 of the Gemma report: partial first and last
// lines, and for each middle line a text box plus its span box 2-3 px apart,
// with an empty box for each line break
const px = ([x, y, w, h]) => ({ page: 3, x: x / 900, y: y / 1300, w: w / 900, h: h / 1300 });
const GEMMA = [[98, 612, 363, 20], [0, 301, 0, 21], [98, 636, 365, 17], [98, 634, 365, 20], [0, 317, 0, 21],
  [99, 657, 361, 17], [99, 655, 361, 20], [0, 333, 0, 21], [98, 679, 364, 17], [98, 677, 364, 20], [0, 349, 0, 21], [99, 698, 168, 20]].map(px);

test('every selected line keeps exactly one box, middle lines included', () => {
  const out = mergeSelectionRects(GEMMA);
  assert.equal(out.length, 5);
  assert.deepEqual(out.map(r => Math.round(r.y * 1300)), [612, 634, 655, 677, 698]);
  // each middle line covers both of the boxes reported for it
  assert.equal(Math.round(out[1].h * 1300), 20);
});

test('two columns on the same line stay two boxes; touching runs on a line join', () => {
  const left = { page: 1, x: 0.1, y: 0.5, w: 0.35, h: 0.015 };
  const right = { page: 1, x: 0.55, y: 0.5, w: 0.35, h: 0.015 };
  assert.equal(mergeSelectionRects([left, right]).length, 2);
  const a = { page: 1, x: 0.1, y: 0.5, w: 0.1, h: 0.015 };
  const b = { page: 1, x: 0.201, y: 0.501, w: 0.1, h: 0.014 };
  assert.deepEqual(mergeSelectionRects([a, b]).map(r => +r.w.toFixed(3)), [0.201]);
});

test('lines on different pages never merge', () => {
  const r = { x: 0.1, y: 0.9, w: 0.3, h: 0.015 };
  assert.equal(mergeSelectionRects([{ page: 1, ...r }, { page: 2, ...r }]).length, 2);
});

test('words broken over a line end are joined; real hyphens stay', () => {
  assert.equal(
    cleanSelectionText('deployed in pods of 256 chips, con-\nfigured into a 2D torus. we train our model across 16 pods, to-\ntaling to 4096 TPUv5e.'),
    'deployed in pods of 256 chips, configured into a 2D torus. we train our model across 16 pods, totaling to 4096 TPUv5e.',
  );
  assert.equal(cleanSelectionText('the Smith-\nJones method'), 'the Smith- Jones method');
  assert.equal(cleanSelectionText('a well-known  result'), 'a well-known result');
  assert.equal(cleanSelectionText('hyphen­ation'), 'hyphenation');
});
