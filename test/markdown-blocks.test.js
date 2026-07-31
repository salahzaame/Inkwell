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
