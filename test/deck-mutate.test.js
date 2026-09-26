import test from 'node:test';
import assert from 'node:assert/strict';
import { canMoveDeckElement, moveDeckElement } from '../src/deck/mutate.js';

function spec() {
  return {
    root: 'deck',
    elements: {
      deck: { type: 'Deck', children: ['slide'] },
      slide: { type: 'Slide', children: ['heading', 'body', 'source'] },
      heading: { type: 'Heading', children: [] },
      body: { type: 'Text', children: [] },
      source: { type: 'Citation', children: [] },
    },
  };
}

test('moves an editable block among its immediate siblings', () => {
  const draft = spec();
  assert.equal(moveDeckElement(draft, 'source', -1), true);
  assert.deepEqual(draft.elements.slide.children, ['heading', 'source', 'body']);
});

test('does not move a block beyond a sibling boundary', () => {
  const draft = spec();
  assert.equal(canMoveDeckElement(draft, 'heading', -1), false);
  assert.equal(moveDeckElement(draft, 'heading', -1), false);
  assert.deepEqual(draft.elements.slide.children, ['heading', 'body', 'source']);
});
