// The vault as Inkwell kept it before the data layer: a few localStorage keys,
// the main one rewritten whole on every change. Read once, on the first start
// with the data layer, and moved into it. The old keys are left in place as a
// backup; nothing writes to them any more.

const readJson = (storage, key) => {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
};

/**
 * The legacy vault, or null when there is none. A pre-v3 vault holds sketches
 * as shape lists; `convertSketch` (only needed then) turns one into a scene.
 */
export async function readLegacyVault(storage, { convertSketch } = {}) {
  if (!storage) return null;
  let main = readJson(storage, 'inkwell:v3');
  if (!main) {
    const v2 = readJson(storage, 'inkwell:v2');
    if (v2) {
      const convert = convertSketch ? await convertSketch() : null;
      main = {
        files: v2.files,
        docs: v2.docs,
        settings: v2.settings,
        theme: v2.theme && { accent: v2.theme.accent, grid: v2.theme.grid !== 'plain' },
        sketches: v2.sketches && convert
          ? Object.fromEntries(Object.entries(v2.sketches).map(([k, shapes]) => [k, convert(shapes)]))
          : undefined,
      };
    }
  }
  const references = readJson(storage, 'inkwell:references');
  const highlights = readJson(storage, 'inkwell:highlights');
  const paperNotes = readJson(storage, 'inkwell:paper-notes');
  const savedSearches = readJson(storage, 'inkwell:saved-searches');
  if (!main && !references && !highlights && !paperNotes && !savedSearches) return null;

  const vault = {};
  for (const key of ['files', 'docs', 'sketches', 'images', 'decks', 'graphPositions', 'settings', 'theme']) {
    if (main?.[key] != null) vault[key] = main[key];
  }
  if (Array.isArray(references)) vault.references = references;
  if (highlights && typeof highlights === 'object') vault.highlights = highlights;
  if (paperNotes && typeof paperNotes === 'object') vault.paperNotes = paperNotes;
  if (Array.isArray(savedSearches)) vault.savedSearches = savedSearches;
  return vault;
}
