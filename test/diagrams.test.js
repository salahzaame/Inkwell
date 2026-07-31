import test from 'node:test';
import assert from 'node:assert/strict';
import { diagramErrorMessage, isMermaidBlock, replaceBlockWithSketchFence } from '../src/diagrams.js';
import { parseBlocks } from '../src/blocks.js';

test('recognises a mermaid fence and nothing else', () => {
  assert.equal(isMermaidBlock({ t: 'code', lang: 'mermaid', text: 'graph TD' }), true);
  assert.equal(isMermaidBlock({ t: 'code', lang: 'js', text: 'x' }), false);
  assert.equal(isMermaidBlock({ t: 'code', lang: null, text: 'x' }), false);
  assert.equal(isMermaidBlock({ t: 'sketch', id: 'sketch-1' }), false);
});

test('an empty mermaid fence is not treated as a diagram', () => {
  assert.equal(isMermaidBlock({ t: 'code', lang: 'mermaid', text: '   \n ' }), false);
});

test('swaps a mermaid block for a sketch fence, preserving the text around it', () => {
  const doc = 'Intro\n\n```mermaid\ngraph TD\n  A --> B\n```\n\nOutro';
  const block = parseBlocks(doc).find(b => b.lang === 'mermaid');
  assert.equal(
    replaceBlockWithSketchFence(doc, block, 'sketch-3'),
    'Intro\n\n```sketch sketch-3\n```\n\nOutro',
  );
});

test('the swapped fence re-parses as a sketch block with the right id', () => {
  const doc = '```mermaid\ngraph TD\n  A --> B\n```';
  const block = parseBlocks(doc).find(b => b.lang === 'mermaid');
  const next = replaceBlockWithSketchFence(doc, block, 'sketch-7');
  const reparsed = parseBlocks(next);
  assert.equal(reparsed.length, 1);
  assert.equal(reparsed[0].t, 'sketch');
  assert.equal(reparsed[0].id, 'sketch-7');
});

test('swapping the first block in a note leaves no stray blank line', () => {
  const doc = '```mermaid\ngraph TD\n```\nAfter';
  const block = parseBlocks(doc).find(b => b.lang === 'mermaid');
  assert.equal(replaceBlockWithSketchFence(doc, block, 'sketch-1'), '```sketch sketch-1\n```\nAfter');
});

test('shortens a multi-line mermaid error to one readable line', () => {
  const msg = diagramErrorMessage(new Error('Parse error on line 2:\n  graph TD --><\n         ^\nExpecting NODE'));
  assert.equal(msg, 'Parse error on line 2:');
});

test('falls back to a plain message when the error is empty', () => {
  assert.equal(diagramErrorMessage(null), 'Could not render this diagram.');
  assert.equal(diagramErrorMessage(new Error('')), 'Could not render this diagram.');
});

test('truncates a runaway error message', () => {
  const msg = diagramErrorMessage(new Error('x'.repeat(400)));
  assert.equal(msg.length, 160);
  assert.match(msg, /…$/);
});
