import test from 'node:test';
import assert from 'node:assert/strict';
import { addImageBlock, addTwoColumnFrame } from '../src/deck/compose.js';

function draft() {
  return {
    root: 'deck',
    elements: {
      deck: { type: 'Deck', children: ['slide'] },
      slide: { type: 'Slide', children: [] },
    },
  };
}

test('adds a self-contained two-column frame with editable children', () => {
  const spec = draft();
  const key = addTwoColumnFrame(spec, 'slide', 'compare');
  assert.equal(key, 'columns-compare');
  assert.deepEqual(spec.elements.slide.children, ['columns-compare']);
  assert.deepEqual(spec.elements[key].children, ['column-left-compare', 'column-right-compare']);
  assert.equal(spec.elements['column-left-compare'].type, 'Column');
  assert.equal(spec.elements['column-left-heading-compare'].props.text, 'First perspective');
});

test('adds uploaded images as editable full-image blocks', () => {
  const spec = draft();
  const key = addImageBlock(spec, 'slide', 'img-example', 'image');
  assert.equal(key, 'noteimage-image');
  assert.deepEqual(spec.elements[key].props, { id: 'img-example', caption: null, fit: 'contain' });
  assert.deepEqual(spec.elements.slide.children, ['noteimage-image']);
});

test('does not compose into a missing slide', () => {
  const spec = draft();
  assert.equal(addTwoColumnFrame(spec, 'missing', 'x'), null);
  assert.equal(addImageBlock(spec, 'missing', 'img', 'x'), null);
});
