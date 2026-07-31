import test from 'node:test';
import assert from 'node:assert/strict';
import { deckFromOutlineSlides } from '../src/deck/from-outline.js';

test('turns a heading preview into local editable slide blocks', () => {
  const deck = deckFromOutlineSlides([
    { type: 'title', title: 'Research map', sub: 'Vault' },
    { type: 'bullets', title: 'Findings', bullets: ['First finding', 'Second finding'] },
  ], { title: 'Research map', theme: 'paper' });
  assert.deepEqual(deck.elements.deck.children, ['slide-outline-1', 'slide-outline-2']);
  assert.equal(deck.elements['title-outline-1'].type, 'Title');
  assert.deepEqual(deck.elements['body-outline-2'].props.items, ['First finding', 'Second finding']);
  assert.equal(deck.elements.deck.props.theme, 'paper');
});

test('creates an editable starter slide when the outline is empty', () => {
  const deck = deckFromOutlineSlides([], { title: 'New deck' });
  assert.deepEqual(deck.elements.deck.children, ['slide-outline-1']);
  assert.equal(deck.elements['title-outline-1'].props.text, 'New deck');
});
