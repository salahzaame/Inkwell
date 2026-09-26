import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocks } from '../src/blocks.js';

test('starts a table block even when it directly follows a paragraph line', () => {
  const doc = 'Intro\n| Study | Result |\n| --- | --- |\n| Pilot |  |\n| Trial | Positive |\nConclusion';
  const blocks = parseBlocks(doc);
  assert.deepEqual(blocks.map(b => b.t), ['p', 'table', 'p']);

  const table = blocks[1];
  assert.deepEqual(table.header, ['Study', 'Result']);
  assert.deepEqual(table.rows, [['Pilot', ''], ['Trial', 'Positive']]);
});

test('records the table source range as half-open [line0, line1)', () => {
  const doc = 'Intro\n| Study | Result |\n| --- | --- |\n| Pilot |  |\n| Trial | Positive |\n\nConclusion';
  const table = parseBlocks(doc).find(b => b.t === 'table');
  assert.equal(table.line0, 1);
  assert.equal(table.line1, 5);
});

test('a lone pipe row without a separator stays a paragraph', () => {
  const blocks = parseBlocks('| not | a table |\njust text');
  assert.deepEqual(blocks.map(b => b.t), ['p']);
});

test('records the fence info string as the code block language', () => {
  const [block] = parseBlocks('```mermaid\ngraph TD\n  A --> B\n```');
  assert.equal(block.t, 'code');
  assert.equal(block.lang, 'mermaid');
  assert.equal(block.text, 'graph TD\n  A --> B');
});

test('lowercases the language and ignores trailing info-string words', () => {
  assert.equal(parseBlocks('```Mermaid  title=x\nA\n```')[0].lang, 'mermaid');
});

test('a bare fence has no language', () => {
  const [block] = parseBlocks('```\nplain text\n```');
  assert.equal(block.t, 'code');
  assert.equal(block.lang, null);
  assert.equal(block.text, 'plain text');
});

test('a sketch fence is still its own block type, not a language', () => {
  const [block] = parseBlocks('```sketch sketch-1\n```');
  assert.equal(block.t, 'sketch');
  assert.equal(block.id, 'sketch-1');
});
