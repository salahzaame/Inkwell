import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { assembleVault, diffVault, vaultToOps } from '../src/data/diff.js';
import { createMemoryAdapter } from '../src/data/memory-adapter.js';
import { openIdbAdapter } from '../src/data/idb-adapter.js';
import { createVaultStore } from '../src/data/vault-store.js';
import { readLegacyVault } from '../src/data/legacy.js';

const VAULT = {
  files: [{ id: 'p1', name: 'Thesis', folder: true, kind: 'project' }, { id: 'n1', name: 'Methods', parent: 'p1' }, { id: 'n2', name: 'Ideas' }],
  docs: { n1: '# Methods', n2: 'ideas' },
  sketches: { 'sketch-1': { elements: [], files: {} } },
  // an empty collection has no records and loads as absent; App falls back to {}
  settings: { spell: true },
  references: [{ citationKey: 'hu2021', title: 'LoRA' }],
  highlights: { hu2021: [{ id: 'h1', page: 5, text: 'We evaluate' }] },
};

/** A storage double for legacy reads. */
const storageOf = (entries) => ({ getItem: (k) => (k in entries ? entries[k] : null) });

test('a typed word saves one note, not the vault', () => {
  const next = { ...VAULT, docs: { ...VAULT.docs, n1: '# Methods\nmore' } };
  assert.deepEqual(diffVault(VAULT, next), [{ collection: 'docs', op: 'put', key: 'n1', value: '# Methods\nmore' }]);
});

test('deletes, moves and settings changes become the matching records', () => {
  const next = {
    ...VAULT,
    files: [VAULT.files[0], { ...VAULT.files[1], parent: undefined }],   // n2 deleted, n1 moved
    docs: { n1: VAULT.docs.n1 },
    settings: { spell: false },
  };
  const ops = diffVault(VAULT, next).map(o => `${o.op} ${o.collection}/${o.key}`);
  assert.deepEqual(ops.sort(), ['delete docs/n2', 'delete files/n2', 'put files/n1', 'put settings/_'].sort());
});

test('records come back as the same vault, list order included', () => {
  const records = vaultToOps(VAULT).map(({ collection, key, value, ord }) => ({ collection, key, value, ord }));
  assert.deepEqual(assembleVault(records.reverse()), VAULT);
});

test('the store saves only what changed since its last save, after a pause', async () => {
  const adapter = createMemoryAdapter({ durable: true });
  const applied = [];
  const apply = adapter.apply.bind(adapter);
  adapter.apply = async (ops) => { applied.push(ops.length); return apply(ops); };
  const store = createVaultStore(adapter, { delay: 5 });
  await store.load();
  store.update(VAULT);
  store.update({ ...VAULT, docs: { ...VAULT.docs, n2: 'ideas!' } }); // within the pause: one save
  await store.flush();
  assert.equal(applied.length, 1);
  const first = applied[0];
  store.update({ ...VAULT, docs: { ...VAULT.docs, n2: 'ideas!!' } });
  await store.flush();
  assert.deepEqual(applied, [first, 1]);
  assert.equal(store.status().status, 'saved');
});

test('a failed save is kept, reported, and retried with the latest changes', async () => {
  const adapter = createMemoryAdapter({ durable: true });
  const store = createVaultStore(adapter, { delay: 5, retryDelay: 5 });
  await store.load();
  const seen = [];
  store.subscribe(({ status }) => seen.push(status));
  adapter.failNext = new Error('disk full');
  store.update(VAULT);
  await store.flush();
  assert.equal(store.status().status, 'error');
  assert.equal(store.status().error.message, 'disk full');
  await new Promise(r => setTimeout(r, 30)); // the retry
  assert.equal(store.status().status, 'saved');
  assert.ok(seen.includes('error') && seen.at(-1) === 'saved');
  const reloaded = createVaultStore(adapter);
  assert.deepEqual(await reloaded.load(), VAULT);
});

test('a browser that keeps nothing says so instead of claiming "saved"', async () => {
  const store = createVaultStore(createMemoryAdapter({ durable: false }), { delay: 5 });
  await store.load();
  store.update(VAULT);
  await store.flush();
  assert.equal(store.status().status, 'unsaved');
});

test('IndexedDB keeps the vault across reopening, and the legacy vault moves in once', async () => {
  const idb = new IDBFactory();
  const legacy = storageOf({
    'inkwell:v3': JSON.stringify({ files: VAULT.files, docs: VAULT.docs, settings: VAULT.settings }),
    'inkwell:references': JSON.stringify(VAULT.references),
    'inkwell:highlights': JSON.stringify(VAULT.highlights),
  });
  let reads = 0;
  const readLegacy = () => { reads += 1; return readLegacyVault(legacy); };

  const a1 = await openIdbAdapter(idb);
  const s1 = createVaultStore(a1, { delay: 5 });
  const loaded = await s1.load({ legacy: readLegacy });
  assert.deepEqual(loaded.files, VAULT.files);
  assert.deepEqual(loaded.highlights, VAULT.highlights);
  s1.update({ ...loaded, docs: { ...loaded.docs, n1: 'edited after the move' } });
  await s1.flush();
  a1.close();

  const a2 = await openIdbAdapter(idb);
  const s2 = createVaultStore(a2);
  const again = await s2.load({ legacy: readLegacy });
  assert.equal(again.docs.n1, 'edited after the move');
  assert.equal(reads, 1, 'the legacy vault is read on the first start only');

  // emptying the vault later does not bring the old one back
  await s2.replace({});
  assert.deepEqual(await createVaultStore(a2).load({ legacy: readLegacy }), {});
  assert.equal(reads, 1);
  a2.close();
});

test('an imported backup replaces the whole vault', async () => {
  const adapter = createMemoryAdapter({ durable: true });
  const store = createVaultStore(adapter);
  await store.load();
  store.update(VAULT);
  await store.flush();
  await store.replace({ files: [{ id: 'x', name: 'Imported' }], docs: { x: 'hello' } });
  assert.deepEqual(await createVaultStore(adapter).load(), { files: [{ id: 'x', name: 'Imported' }], docs: { x: 'hello' } });
});

test('a pre-v3 vault converts its sketches only when it has to', async () => {
  let converted = 0;
  const convertSketch = async () => (shapes) => { converted += 1; return { elements: shapes, files: {} }; };
  const v2 = storageOf({ 'inkwell:v2': JSON.stringify({ files: [], docs: {}, sketches: { s: [{ type: 'rect' }] } }) });
  assert.deepEqual((await readLegacyVault(v2, { convertSketch })).sketches, { s: { elements: [{ type: 'rect' }], files: {} } });
  assert.equal(converted, 1);
  assert.equal(await readLegacyVault(storageOf({})), null);
});
