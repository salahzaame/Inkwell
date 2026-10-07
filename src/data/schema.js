// What a vault holds, and how each part is stored: one record per item, so a
// change to one note saves that note, not the whole vault.
//
//   map    an object keyed by id; each entry is a record   (docs, sketches…)
//   list   an array of objects with an id; each is a record, order kept
//   value  one record for the whole thing                  (settings, theme…)
//
// This is the vault's shape for every backend: IndexedDB in the browser now,
// Postgres rows later. Things about this screen rather than the research
// (the lamp, panel widths, folded folders) are device preferences: prefs.js.

export const COLLECTIONS = {
  files: { shape: 'list', key: (file) => file.id },  // the tree: projects, folders, notes
  docs: { shape: 'map' },                              // note id → markdown
  sketches: { shape: 'map' },                          // sketch id → Excalidraw scene
  images: { shape: 'map' },                            // image id → data URL
  decks: { shape: 'map' },                             // note id → slide deck spec
  highlights: { shape: 'map' },                        // paper id → highlights
  references: { shape: 'value' },                      // the reading library, in queue order
  paperNotes: { shape: 'value' },                      // paper id → its literature note
  savedSearches: { shape: 'value' },
  graphPositions: { shape: 'value' },
  settings: { shape: 'value' },
  theme: { shape: 'value' },
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS);

/** The record key a `value` collection is stored under. */
export const VALUE_KEY = '_';
