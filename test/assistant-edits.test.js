import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProposal,
  describeProposal,
  extractJsonObject,
  looksLikeEditRequest,
  parseEditProposals,
  resolveProposal,
} from '../src/assistant-edits.js';

const vault = () => ({
  files: [
    { id: 'n1', name: 'Reading log', top: true },
    { id: 'n2', name: 'Methods', top: true },
    { id: 'f1', name: 'Project', folder: true },
  ],
  docs: {
    n1: 'Intro paragraph.\n\nOld finding here.\n',
    n2: '# Methods\n',
  },
});

const ids = () => { let n = 0; return () => `new${++n}`; };

test('pulls the payload out of a fenced reply', () => {
  const payload = extractJsonObject('Sure!\n```json\n{"summary":"x","proposals":[]}\n```\nHope that helps.');
  assert.deepEqual(payload, { summary: 'x', proposals: [] });
});

test('pulls the payload out of a reply padded with prose', () => {
  const payload = extractJsonObject('Here you go: {"summary":"y","proposals":[]} — done.');
  assert.deepEqual(payload, { summary: 'y', proposals: [] });
});

test('returns not-ok when the reply carries no JSON at all', () => {
  const parsed = parseEditProposals('I think you should rewrite the intro.');
  assert.equal(parsed.ok, false);
  assert.deepEqual(parsed.proposals, []);
});

test('keeps valid proposals and counts the malformed ones', () => {
  const parsed = parseEditProposals(JSON.stringify({
    summary: 'Two edits',
    proposals: [
      { type: 'append_to_note', note: 'Reading log', markdown: 'New line.' },
      { type: 'append_to_note', note: 'Reading log' },        // missing markdown
      { type: 'teleport_note', note: 'Reading log' },          // unknown type
    ],
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.summary, 'Two edits');
  assert.equal(parsed.proposals.length, 1);
  assert.equal(parsed.skipped, 2);
});

test('caps a runaway batch at eight proposals', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ type: 'create_note', name: `N${i}`, markdown: 'x' }));
  assert.equal(parseEditProposals(JSON.stringify({ proposals: many })).proposals.length, 8);
});

test('refuses a proposal that targets a note the vault does not have', () => {
  const r = resolveProposal({ type: 'append_to_note', note: 'Ghost', markdown: 'hi' }, vault());
  assert.equal(r.ok, false);
  assert.match(r.reason, /No note named/);
});

test('refuses a folder standing in for a note', () => {
  const r = resolveProposal({ type: 'append_to_note', note: 'Project', markdown: 'hi' }, vault());
  assert.equal(r.ok, false);
});

test('refuses replace_text when the find string is stale', () => {
  const r = resolveProposal({ type: 'replace_text', note: 'Reading log', find: 'Not present', replace: 'x' }, vault());
  assert.equal(r.ok, false);
  assert.match(r.reason, /not in the note/);
});

test('warns when the find string is ambiguous but still applies to the first hit', () => {
  const state = { files: [{ id: 'n1', name: 'A' }], docs: { n1: 'dog cat dog' } };
  const r = resolveProposal({ type: 'replace_text', note: 'A', find: 'dog', replace: 'fox' }, state);
  assert.equal(r.ok, true);
  assert.match(r.warning, /appears 2 times/);
  assert.equal(r.after, 'fox cat dog');
});

test('treats a replacement containing $& as literal text', () => {
  const state = { files: [{ id: 'n1', name: 'A' }], docs: { n1: 'keep OLD keep' } };
  const r = resolveProposal({ type: 'replace_text', note: 'A', find: 'OLD', replace: '$& and $1' }, state);
  assert.equal(r.after, 'keep $& and $1 keep');
});

test('append leaves the existing body intact', () => {
  const next = applyProposal({ type: 'append_to_note', note: 'Reading log', markdown: 'A new entry.' }, vault());
  assert.equal(next.applied, true);
  assert.equal(next.docs.n1, 'Intro paragraph.\n\nOld finding here.\n\nA new entry.\n');
  assert.equal(next.docs.n2, '# Methods\n', 'other notes are untouched');
});

test('append to an empty note does not leave leading blank lines', () => {
  const state = { files: [{ id: 'n1', name: 'A' }], docs: { n1: '' } };
  const next = applyProposal({ type: 'append_to_note', note: 'A', markdown: 'First.' }, state);
  assert.equal(next.docs.n1, 'First.\n');
});

test('create_note adds a note and reports which one to open', () => {
  const next = applyProposal({ type: 'create_note', name: 'Synthesis', markdown: '# Synthesis' }, vault(), { newId: ids() });
  assert.equal(next.applied, true);
  assert.equal(next.openId, 'new1');
  assert.equal(next.files.length, 4);
  assert.equal(next.docs.new1, '# Synthesis\n');
});

test('create_note sidesteps a name collision instead of overwriting', () => {
  const next = applyProposal({ type: 'create_note', name: 'Methods', markdown: 'body' }, vault(), { newId: ids() });
  const created = next.files.find(f => f.id === 'new1');
  assert.notEqual(created.name, 'Methods');
  assert.equal(next.docs.n2, '# Methods\n', 'the original Methods note is untouched');
});

test('rename_note refuses to collide with an existing note', () => {
  const r = resolveProposal({ type: 'rename_note', note: 'Methods', newName: 'Reading log' }, vault());
  assert.equal(r.ok, false);
  assert.match(r.reason, /already exists/);
});

test('rename_note changes the name and nothing else', () => {
  const next = applyProposal({ type: 'rename_note', note: 'Methods', newName: 'Protocol' }, vault());
  assert.equal(next.files.find(f => f.id === 'n2').name, 'Protocol');
  assert.deepEqual(next.docs, vault().docs);
});

test('applying does not mutate the snapshot it was given', () => {
  const state = vault();
  const before = JSON.parse(JSON.stringify(state));
  applyProposal({ type: 'replace_note', note: 'Reading log', markdown: 'gone' }, state);
  assert.deepEqual(state, before);
});

test('a rejected proposal returns the snapshot unchanged', () => {
  const state = vault();
  const next = applyProposal({ type: 'append_to_note', note: 'Ghost', markdown: 'hi' }, state);
  assert.equal(next.applied, false);
  assert.equal(next.docs, state.docs);
});

test('describes each supported change type', () => {
  assert.match(describeProposal({ type: 'create_note', name: 'X', markdown: '' }), /Create note/);
  assert.match(describeProposal({ type: 'rename_note', note: 'X', newName: 'Y' }), /Rename/);
});

test('spots change requests without firing on plain questions', () => {
  assert.equal(looksLikeEditRequest('Add a summary section to this note'), true);
  assert.equal(looksLikeEditRequest('rename this note to Protocol'), true);
  assert.equal(looksLikeEditRequest('What does this note say about sampling?'), false);
});
