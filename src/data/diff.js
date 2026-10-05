// From "the vault as it was saved" and "the vault as it is now" to the few
// records that changed. React state is updated immutably, so an untouched note
// is the very same object (or string) as before: comparing by identity finds
// the changes without walking their contents.

import { COLLECTIONS, VALUE_KEY } from './schema.js';

/**
 * Operations that turn `prev` into `next`, for the collections present in
 * `next`: { collection, op: 'put', key, value, ord? } or { collection, op: 'delete', key }.
 */
export function diffVault(prev = {}, next = {}) {
  const ops = [];
  for (const [name, spec] of Object.entries(COLLECTIONS)) {
    if (!(name in next)) continue;
    const before = prev[name];
    const after = next[name];
    if (before === after) continue;

    if (spec.shape === 'value') {
      ops.push({ collection: name, op: 'put', key: VALUE_KEY, value: after });
    } else if (spec.shape === 'map') {
      const was = before || {};
      const now = after || {};
      for (const key of Object.keys(now)) {
        if (was[key] !== now[key]) ops.push({ collection: name, op: 'put', key, value: now[key] });
      }
      for (const key of Object.keys(was)) {
        if (!(key in now)) ops.push({ collection: name, op: 'delete', key });
      }
    } else {
      // a list: records by key, each with its position so the order survives
      const was = new Map((before || []).map((item, ord) => [spec.key(item), { item, ord }]));
      const seen = new Set();
      (after || []).forEach((item, ord) => {
        const key = spec.key(item);
        if (key == null || seen.has(key)) return;
        seen.add(key);
        const old = was.get(key);
        if (!old || old.item !== item || old.ord !== ord) ops.push({ collection: name, op: 'put', key, value: item, ord });
      });
      for (const key of was.keys()) {
        if (!seen.has(key)) ops.push({ collection: name, op: 'delete', key });
      }
    }
  }
  return ops;
}

/** Rebuild collections from stored records: [{ collection, key, value, ord }]. */
export function assembleVault(records) {
  const out = {};
  const lists = {};
  for (const { collection, key, value, ord } of records) {
    const spec = COLLECTIONS[collection];
    if (!spec) continue;
    if (spec.shape === 'value') out[collection] = value;
    else if (spec.shape === 'map') (out[collection] ||= {})[key] = value;
    else (lists[collection] ||= []).push({ value, ord: ord ?? 0 });
  }
  for (const [name, items] of Object.entries(lists)) {
    out[name] = items.sort((a, b) => a.ord - b.ord).map(x => x.value);
  }
  return out;
}

/** Every record of a whole vault, as a first save would write it. */
export const vaultToOps = (vault) => diffVault({}, vault);
