import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeckContext, buildVaultContext } from '../src/assistant.js';

const deck = {
  root: 'deck',
  elements: {
    deck: { type: 'Deck', props: { title: 'Causal study' }, children: ['slide-a', 'slide-b'] },
    'slide-a': { type: 'Slide', props: { layout: 'title', eyebrow: 'Overview' }, children: ['title'] },
    title: { type: 'Title', props: { text: 'Causal evidence', subtitle: null }, children: [] },
    'slide-b': { type: 'Slide', props: { layout: 'content', eyebrow: 'Finding', speakerNotes: 'Clarify the estimate.' }, children: ['bullets'] },
    bullets: { type: 'Bullets', props: { items: ['Use direct evidence', 'Flag uncertainty'], numbered: null }, children: [] },
  },
};

test('deck context contains slide content and marks the selected slide', () => {
  const context = buildDeckContext(deck, 'slide-b');
  assert.match(context, /ACTIVE PRESENTATION \(Causal study · 2 slides\)/);
  assert.match(context, /SLIDE 2 \(SELECTED\).*Speaker notes: Clarify the estimate\./);
  assert.match(context, /Title: Causal evidence/);
  assert.match(context, /Bullets: Use direct evidence · Flag uncertainty/);
});

test('vault context appends an active presentation when provided', () => {
  const context = buildVaultContext(
    [{ id: 'note-1', name: 'Project notes' }],
    { 'note-1': 'Research question' },
    'note-1',
    { deck, selectedSlide: 'slide-a' },
  );
  assert.match(context, /OPEN NOTE: Project notes/);
  assert.match(context, /ACTIVE PRESENTATION/);
  assert.match(context, /SLIDE 1 \(SELECTED\)/);
});
