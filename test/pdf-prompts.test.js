import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfExcerptPrompt } from '../src/pdf-prompts.js';

test('simple PDF excerpt prompt preserves paper provenance and asks for plain language', () => {
  const prompt = buildPdfExcerptPrompt({
    title: 'A study of cells', citationKey: 'smith2025', text: '  The cells   divided quickly. ', level: 'simple',
  });
  assert.match(prompt, /A study of cells" \[@smith2025\]/);
  assert.match(prompt, /plain language/);
  assert.match(prompt, /The cells divided quickly\./);
  assert.match(prompt, /Do not add facts/);
});

test('technical PDF excerpt prompt asks the assistant to separate claims and evidence', () => {
  const prompt = buildPdfExcerptPrompt({ title: 'Methods', text: 'A model was fitted.', level: 'technical' });
  assert.match(prompt, /technical level/);
  assert.match(prompt, /claim from evidence/);
  assert.doesNotMatch(prompt, /\[@/);
});
