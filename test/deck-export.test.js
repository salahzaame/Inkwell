import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeckExportHtml, deckExportFileName } from '../src/deck/export.js';

const deck = {
  root: 'deck',
  elements: {
    deck: { type: 'Deck', props: { title: 'Study deck', theme: 'paper' }, children: ['slide-1'] },
    'slide-1': { type: 'Slide', props: { layout: 'content', eyebrow: 'Methods', speakerNotes: null }, children: ['heading-1', 'bullets-1', 'citation-1'] },
    'heading-1': { type: 'Heading', props: { text: 'A result' }, children: [] },
    'bullets-1': { type: 'Bullets', props: { items: ['First finding', 'Second finding'], numbered: null }, children: [] },
    'citation-1': { type: 'Citation', props: { citationKey: 'lovelace1843', label: null }, children: [] },
  },
};

test('deck export makes a printable standalone HTML deck', () => {
  const html = buildDeckExportHtml({ deck, noteName: 'Methods <review>', references: [{ citationKey: 'lovelace1843', authors: ['Ada Lovelace'], year: '1843' }], exportedAt: '2026-07-28T00:00:00.000Z' });
  assert.match(html, /@media print/);
  assert.match(html, /slideKeys\.forEach/);
  assert.match(html, /Methods &lt;review&gt;/);
  assert.match(html, /"theme":"paper"/);
  assert.match(html, /payload\.references/);
});

test('deck export data does not break out of its JSON script block', () => {
  const unsafeDeck = structuredClone(deck);
  unsafeDeck.elements['heading-1'].props.text = '</script><img src=x onerror=alert(1)>';
  const html = buildDeckExportHtml({ deck: unsafeDeck, noteName: 'Safe' });
  assert.match(html, /\\u003c\/script\\u003e/);
  assert.doesNotMatch(html, /<\/script><img src=x onerror=alert\(1\)>/);
});

test('deck export filenames remain portable on Windows', () => {
  assert.equal(deckExportFileName('A/B: C?'), 'A-B- C-.html');
  assert.equal(deckExportFileName('   '), 'Inkwell deck.html');
});
