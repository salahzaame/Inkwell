// Opening the vault at start-up: the device's IndexedDB when the browser
// allows it, memory (and a plain warning) when it does not.

import { openIdbAdapter } from './idb-adapter.js';
import { createMemoryAdapter } from './memory-adapter.js';
import { readLegacyVault } from './legacy.js';
import { createVaultStore } from './vault-store.js';

export { readPref, writePref, readRawPref, writeRawPref } from './prefs.js';

/** { store, vault }: the store to save through, and the vault as loaded. */
export async function openVault() {
  let adapter;
  try {
    adapter = await openIdbAdapter();
    // ask the browser not to clear the vault when the disk runs low
    navigator.storage?.persist?.().catch(() => {});
  } catch (error) {
    console.warn('Inkwell: on-device storage unavailable, this session will not be kept.', error);
    adapter = createMemoryAdapter();
  }
  const store = createVaultStore(adapter, {
    onError: (error) => console.error('Inkwell: saving the vault failed', error),
  });
  const vault = await store.load({
    legacy: () => readLegacyVault(globalThis.localStorage, {
      convertSketch: async () => (await import('../data.js')).legacySketchToScene,
    }),
  });

  // a closing tab gets one last chance to write what is pending
  const flush = () => { store.flush(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  return { store, vault };
}
