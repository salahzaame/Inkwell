import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_KEY, mostRecentNoteId, normalizeSession, readSession, resolveSession,
  writeSession,
} from '../src/session.js';

const files = [
  { id: 'n1', name: 'Old', mtime: 100 },
  { id: 'n2', name: 'Newest', mtime: 900 },
  { id: 'n3', name: 'Middle', mtime: 500 },
  { id: 'f1', name: 'Project', folder: true, mtime: 999 },
];

const memory = () => {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    _store: store,
  };
};

test('normalizes junk from storage into a usable session', () => {
  const s = normalizeSession(null);
  assert.deepEqual(s, { noteId: null, tabs: [], view: 'editor', scrollTop: 0, paperId: null, page: 1 });
});

test('rejects an unknown view rather than routing nowhere', () => {
  assert.equal(normalizeSession({ view: 'wormhole' }).view, 'editor');
  assert.equal(normalizeSession({ view: 'slides' }).view, 'slides');
});

test('drops non-string tab ids and negative scroll positions', () => {
  const s = normalizeSession({ tabs: ['a', 7, null, 'b'], scrollTop: -40 });
  assert.deepEqual(s.tabs, ['a', 'b']);
  assert.equal(s.scrollTop, 0);
});

test('restores the note you were actually on', () => {
  const r = resolveSession({ noteId: 'n3', tabs: ['n1', 'n3'], scrollTop: 220 }, files);
  assert.equal(r.noteId, 'n3');
  assert.deepEqual(r.tabs, ['n1', 'n3']);
  assert.equal(r.scrollTop, 220);
});

test('falls back to the most recently edited note, not the first in file order', () => {
  const r = resolveSession({ noteId: null, tabs: [] }, files);
  assert.equal(r.noteId, 'n2', 'should pick Newest, not Old');
});

test('a note deleted since last session does not strand the app', () => {
  const r = resolveSession({ noteId: 'gone', tabs: ['gone', 'n1'] }, files);
  assert.equal(r.noteId, 'n1', 'falls through to a surviving tab');
  assert.deepEqual(r.tabs, ['n1'], 'the dead tab is dropped');
});

test('a stale scroll position is discarded when the note changed', () => {
  const r = resolveSession({ noteId: 'gone', tabs: ['n1'], scrollTop: 400 }, files);
  assert.equal(r.scrollTop, 0);
});

test('the active note is always present in the tab list', () => {
  const r = resolveSession({ noteId: 'n2', tabs: ['n1'] }, files);
  assert.ok(r.tabs.includes('n2'));
});

test('folders are never restored as the open note', () => {
  const r = resolveSession({ noteId: 'f1', tabs: ['f1'] }, files);
  assert.notEqual(r.noteId, 'f1');
  assert.deepEqual(r.tabs, [r.noteId]);
});

test('an empty vault resolves to no note rather than throwing', () => {
  const r = resolveSession({ noteId: 'n1', tabs: ['n1'] }, []);
  assert.equal(r.noteId, null);
  assert.deepEqual(r.tabs, []);
});

test('mostRecentNoteId ignores folders even when they are newest', () => {
  assert.equal(mostRecentNoteId(files), 'n2');
  assert.equal(mostRecentNoteId([]), null);
});

test('round-trips through storage', () => {
  const store = memory();
  writeSession(store, { noteId: 'n2', tabs: ['n2'], view: 'slides', scrollTop: 88, page: 4 });
  const back = readSession(store);
  assert.equal(back.noteId, 'n2');
  assert.equal(back.view, 'slides');
  assert.equal(back.scrollTop, 88);
  assert.equal(back.page, 4);
  assert.ok(store._store.has(SESSION_KEY));
});

test('unreadable storage yields a default session instead of crashing the app', () => {
  const hostile = { getItem: () => '{not json', setItem: () => {} };
  assert.equal(readSession(hostile).noteId, null);
});

test('a storage write that throws is reported, not raised', () => {
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
  assert.equal(writeSession(full, { noteId: 'n1' }), false);
});
