// The one way Inkwell loads and saves the vault.
//
// The app hands over the whole vault whenever it changes (`update`); the store
// waits for a short pause, works out which records changed (diff.js) and saves
// only those, through an adapter: IndexedDB on this device now, the server
// later. Saves never overlap, a failed save is retried with the latest vault,
// and the app can watch the status: 'saved', 'saving', 'error', or 'unsaved'
// when the device keeps nothing.

import { assembleVault, diffVault, vaultToOps } from './diff.js';
import { COLLECTION_NAMES } from './schema.js';

const SCHEMA_VERSION = 1;

export function createVaultStore(adapter, { delay = 400, retryDelay = 4000, onError } = {}) {
  let saved = {};        // the vault as the backend has it
  let pending = null;    // the latest vault not yet saved
  let timer = null;
  let inFlight = null;
  let status = adapter.durable ? 'saved' : 'unsaved';
  let lastError = null;
  const listeners = new Set();

  const setStatus = (next, error = null) => {
    if (!adapter.durable) next = 'unsaved';
    if (next === status && error === lastError) return;
    status = next;
    lastError = error;
    for (const fn of listeners) fn({ status, error });
  };

  const run = async () => {
    timer = null;
    if (inFlight || !pending) return;
    const next = pending;
    pending = null;
    const ops = diffVault(saved, next);
    if (!ops.length) { if (!pending) setStatus('saved'); return; }
    setStatus('saving');
    inFlight = adapter.apply(ops)
      .then(() => {
        saved = { ...saved, ...next };
        if (!pending) setStatus('saved');
      })
      .catch((error) => {
        // keep the change: the next attempt diffs against what really was saved
        pending = pending ? { ...next, ...pending } : next;
        setStatus('error', error);
        onError?.(error);
        clearTimeout(timer);
        timer = setTimeout(run, retryDelay);
      })
      .finally(() => {
        inFlight = null;
        if (pending && !timer) timer = setTimeout(run, delay);
      });
    await inFlight;
  };

  return {
    /** Load the vault, moving a legacy vault in on first use. */
    async load({ legacy } = {}) {
      let records = await adapter.loadAll();
      const migrated = await adapter.getMeta('legacyImported');
      if (!records.length && !migrated && legacy) {
        const old = await legacy();
        if (old) {
          await adapter.apply(vaultToOps(old));
          records = await adapter.loadAll();
        }
        await adapter.setMeta('legacyImported', new Date().toISOString());
      }
      await adapter.setMeta('schemaVersion', SCHEMA_VERSION);
      saved = assembleVault(records);
      return saved;
    },

    /** The vault changed: save the parts that did, after a short pause. */
    update(vault) {
      pending = pending ? { ...pending, ...vault } : { ...vault };
      if (diffVault(saved, pending).length && status !== 'saving') setStatus('saving');
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    },

    /** Save now (the tab is closing, or a test wants to know). */
    async flush() {
      clearTimeout(timer);
      timer = null;
      if (inFlight) await inFlight;
      if (pending) await run();
      if (inFlight) await inFlight;
    },

    /** Swap the whole vault for another (an imported backup). */
    async replace(vault) {
      clearTimeout(timer);
      timer = null;
      pending = null;
      if (inFlight) await inFlight;
      const full = Object.fromEntries(COLLECTION_NAMES.filter(n => vault[n] != null).map(n => [n, vault[n]]));
      await adapter.replaceAll(vaultToOps(full));
      saved = full;
      setStatus('saved');
    },

    status: () => ({ status, error: lastError }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get durable() { return adapter.durable; },
  };
}
