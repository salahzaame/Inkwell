import test from 'node:test';
import assert from 'node:assert/strict';
import { removeHighlightFromDoc } from '../src/highlights.js';

const NOTE = `# Gemma

## Highlights

> "We train the Gemma models using TPUv5e;"
> — [@team2024, p. 3](hl://hlA)

> "Second quote"
> — [@team2024, p. 4](hl://hlB)

![](img:imgC)

— [@team2024, p. 5](hl://hlC)

My own thoughts.`;

test('removing a highlight takes its quote out of the note, and only that quote', () => {
  const { doc, images } = removeHighlightFromDoc(NOTE, 'hlA');
  assert.equal(doc, `# Gemma

## Highlights

> "Second quote"
> — [@team2024, p. 4](hl://hlB)

![](img:imgC)

— [@team2024, p. 5](hl://hlC)

My own thoughts.`);
  assert.deepEqual(images, []);
});

test('removing a clip takes its picture and caption, and reports the image', () => {
  const { doc, images } = removeHighlightFromDoc(NOTE, 'hlC');
  assert.equal(doc, `# Gemma

## Highlights

> "We train the Gemma models using TPUv5e;"
> — [@team2024, p. 3](hl://hlA)

> "Second quote"
> — [@team2024, p. 4](hl://hlB)

My own thoughts.`);
  assert.deepEqual(images, ['imgC']);
});

test('the last highlight in a note leaves no stray blank lines', () => {
  const { doc } = removeHighlightFromDoc('# P\n\n## Highlights\n\n> "only"\n> — [p. 1](hl://h1)\n', 'h1');
  assert.equal(doc, '# P\n\n## Highlights\n');
});

test('a link to the highlight in the reader\'s own sentence keeps its words', () => {
  const { doc } = removeHighlightFromDoc('As shown [on page 3](hl://hlA), they use TPUs.', 'hlA');
  assert.equal(doc, 'As shown on page 3, they use TPUs.');
});

test('lines the reader added inside the quote after the link stay', () => {
  const { doc } = removeHighlightFromDoc('> "quote"\n> — [p. 1](hl://h1)\n> my comment on it\n', 'h1');
  assert.equal(doc, '> my comment on it\n');
});

test('a note without the highlight is returned untouched', () => {
  assert.equal(removeHighlightFromDoc(NOTE, 'nope').doc, NOTE);
  assert.equal(removeHighlightFromDoc('', 'hlA').doc, '');
});
