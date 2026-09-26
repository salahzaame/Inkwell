import test from 'node:test';
import assert from 'node:assert/strict';
import { moveVaultItem, uniqueVaultName, vaultRows } from '../src/vault.js';

test('builds a nested visible vault tree and respects collapsed projects', () => {
  const files = [
    { id: 'project', name: 'Project A', folder: true },
    { id: 'methods', name: 'Methods', folder: true, parent: 'project' },
    { id: 'note', name: 'Protocol', parent: 'methods' },
    { id: 'root', name: 'Scratch' },
  ];
  assert.deepEqual(vaultRows(files, {}).map(row => [row.file.id, row.depth]), [['project', 0], ['methods', 1], ['note', 2], ['root', 0]]);
  assert.deepEqual(vaultRows(files, { project: true }).map(row => row.file.id), ['project', 'root']);
});

test('names notes and folders uniquely among their siblings only', () => {
  const files = [{ id: 'one', name: 'Methods', parent: 'a' }, { id: 'two', name: 'Methods', parent: 'b' }];
  assert.equal(uniqueVaultName(files, 'Methods', 'a'), 'Methods 2');
  assert.equal(uniqueVaultName(files, 'Methods', 'b'), 'Methods 2');
  assert.equal(uniqueVaultName(files, 'Methods', 'c'), 'Methods');
});

test('moves an existing note into the selected project folder', () => {
  const moved = moveVaultItem([{ id: 'note', name: 'Scratch', top: true }], 'note', 'project');
  assert.deepEqual(moved[0].parent, 'project');
  assert.equal(moved[0].top, false);
});

test('can move a note back to the vault root', () => {
  const moved = moveVaultItem([{ id: 'note', name: 'Scratch', parent: 'project', top: false }], 'note', null);
  assert.equal(moved[0].parent, undefined);
  assert.equal(moved[0].top, true);
});
