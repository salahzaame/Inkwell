import test from 'node:test';
import assert from 'node:assert/strict';
import { appendDeckReferencesSlide, deckCitationKeys, deckCitationLabel, referenceForCitation } from '../src/deck/references.js';

const references = [
  { citationKey: 'lovelace1843', title: 'Notes', authors: ['Ada Lovelace', 'Charles Babbage'], year: '1843' },
];

test('deck citation label uses a compact academic attribution', () => {
  assert.equal(deckCitationLabel(references[0], 'lovelace1843'), 'Lovelace et al. (1843)');
  assert.equal(deckCitationLabel(null, 'missing2026'), '[@missing2026]');
});

test('citation lookup links a slide key to its library record', () => {
  assert.equal(referenceForCitation(references, 'lovelace1843')?.title, 'Notes');
  assert.equal(referenceForCitation(references, 'not-there'), null);
});

test('collects linked citations and creates an editable sources slide', () => {
  const deck = {
    root: 'deck', elements: {
      deck: { type: 'Deck', children: ['slide'] },
      slide: { type: 'Slide', children: ['citation'] },
      citation: { type: 'Citation', props: { citationKey: 'lovelace1843' }, children: [] },
    },
  };
  assert.deepEqual(deckCitationKeys(deck), ['lovelace1843']);
  const key = appendDeckReferencesSlide(deck, references, 'apa');
  assert.equal(key, 'references-slide');
  assert.equal(deck.elements.deck.children.at(-1), 'references-slide');
  assert.equal(deck.elements['references-slide-heading'].props.text, 'Sources');
  assert.match(deck.elements['references-slide-list-1'].props.items[0], /Lovelace/);
});
