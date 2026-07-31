import test from 'node:test';
import assert from 'node:assert/strict';
import { addTableRowToDoc, updateTableCellInDoc } from '../src/tables.js';

const table = {
  line0: 1,
  line1: 5,
  header: ['Study', 'Result'],
  rows: [['Pilot', ''], ['Trial', 'Positive']],
};

test('updates one rendered table cell while preserving surrounding note content', () => {
  const doc = 'Intro\n| Study | Result |\n| --- | --- |\n| Pilot |  |\n| Trial | Positive |\n\nConclusion';
  assert.equal(
    updateTableCellInDoc(doc, table, 0, 1, 'Promising'),
    'Intro\n| Study | Result |\n| --- | --- |\n| Pilot | Promising |\n| Trial | Positive |\n\nConclusion',
  );
});

test('adds a blank visible row with the existing table width', () => {
  const doc = '| Study | Result |\n| --- | --- |\n| Pilot |  |\n| Trial | Positive |';
  const rootTable = { ...table, line0: 0, line1: 4 };
  assert.match(addTableRowToDoc(doc, rootTable), /\|  \|  \|$/);
});
