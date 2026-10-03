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

import { canMoveInto, descendantIds, folderPath, moveDestinations } from '../src/vault.js';

const TREE = [
  { id: 'n-z', name: 'zebra notes', mtime: 5 },
  { id: 'thesis', name: 'Thesis', folder: true, kind: 'project' },
  { id: 'ch10', name: 'Chapter 10', parent: 'thesis', mtime: 1 },
  { id: 'ch2', name: 'Chapter 2', parent: 'thesis', mtime: 9 },
  { id: 'methods', name: 'Methods', folder: true, kind: 'folder', parent: 'thesis' },
  { id: 'proto', name: 'Protocol', parent: 'methods' },
  { id: 'deep', name: 'Pilots', folder: true, kind: 'folder', parent: 'methods' },
  { id: 'inbox', name: 'Inbox', folder: true, kind: 'folder' },
  { id: 'alpha', name: 'Alpha', folder: true, kind: 'project' },
];

test('projects come first, then folders, then notes, in natural name order', () => {
  assert.deepEqual(vaultRows(TREE, {}).map(r => r.file.id),
    ['alpha', 'thesis', 'methods', 'deep', 'proto', 'ch2', 'ch10', 'inbox', 'n-z']);
});

test('sorting by last edit reorders notes only; folders stay by name', () => {
  assert.deepEqual(vaultRows(TREE, { methods: true }, { sort: 'edited' }).filter(r => r.file.parent === 'thesis').map(r => r.file.id),
    ['methods', 'ch2', 'ch10']);
});

test('a folder never moves into itself or anything inside it; projects stay top level', () => {
  assert.equal(canMoveInto(TREE, 'methods', 'deep'), false, 'into its own child');
  assert.equal(canMoveInto(TREE, 'methods', 'methods'), false, 'into itself');
  assert.equal(canMoveInto(TREE, 'methods', 'thesis'), false, 'already there');
  assert.equal(canMoveInto(TREE, 'methods', 'inbox'), true);
  assert.equal(canMoveInto(TREE, 'methods', null), true, 'to the root');
  assert.equal(canMoveInto(TREE, 'thesis', 'inbox'), false, 'a project inside a folder');
  assert.equal(canMoveInto(TREE, 'proto', 'ch2'), false, 'into a note');
  assert.equal(canMoveInto(TREE, 'ghost', 'inbox'), false);
});

test('"Move to" lists only the folders an item may go to, in tree order', () => {
  assert.deepEqual(moveDestinations(TREE, 'methods').map(d => [d.file.id, d.depth]), [['alpha', 0], ['inbox', 0]]);
  assert.deepEqual(moveDestinations(TREE, 'proto').map(d => d.file.id), ['alpha', 'thesis', 'deep', 'inbox']);
});

test('a delete reaches everything inside a folder, and paths read top-down', () => {
  assert.deepEqual(descendantIds(TREE, 'thesis').sort(), ['ch10', 'ch2', 'deep', 'methods', 'proto']);
  assert.deepEqual(folderPath(TREE, 'deep'), ['Thesis', 'Methods', 'Pilots']);
  assert.deepEqual(folderPath(TREE, 'missing'), []);
});

test('a rename keeps its own name free: renaming to itself is not a clash', () => {
  assert.equal(uniqueVaultName(TREE, 'Methods', 'thesis', 'methods'), 'Methods');
  assert.equal(uniqueVaultName(TREE, 'methods', 'thesis'), 'methods 2');
});
