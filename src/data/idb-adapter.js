// The vault on this device: one IndexedDB store of records keyed by
// [collection, key], plus a small meta store (schema version, migration done).
//
// IndexedDB rather than localStorage: it holds gigabytes rather than ~5 MB,
// saves one record at a time without freezing the page, and its writes are
// transactions, so a save lands whole or not at all.

const DB_NAME = 'inkwell-vault';
const DB_VERSION = 1;
const RECORDS = 'records';
const META = 'meta';

const done = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
const finished = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('save aborted'));
});

export async function openIdbAdapter(indexedDBImpl = globalThis.indexedDB) {
  if (!indexedDBImpl) throw new Error('IndexedDB is not available in this browser');
  const req = indexedDBImpl.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS);
    if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
  };
  const db = await done(req);
  // another tab upgrading the schema later: let it, this tab reloads into it
  db.onversionchange = () => db.close();

  return {
    durable: true,

    /** Every record: [{ collection, key, value, ord }]. */
    async loadAll() {
      const tx = db.transaction(RECORDS, 'readonly');
      const store = tx.objectStore(RECORDS);
      const [keys, rows] = await Promise.all([done(store.getAllKeys()), done(store.getAll())]);
      return keys.map(([collection, key], i) => ({ collection, key, value: rows[i].value, ord: rows[i].ord }));
    },

    /** Apply put/delete operations in one transaction: all of them, or none. */
    async apply(ops) {
      if (!ops.length) return;
      const tx = db.transaction(RECORDS, 'readwrite');
      const store = tx.objectStore(RECORDS);
      for (const op of ops) {
        const key = [op.collection, op.key];
        if (op.op === 'delete') store.delete(key);
        else store.put(op.ord === undefined ? { value: op.value } : { value: op.value, ord: op.ord }, key);
      }
      await finished(tx);
    },

    /** Replace everything (an imported vault). */
    async replaceAll(ops) {
      const tx = db.transaction(RECORDS, 'readwrite');
      const store = tx.objectStore(RECORDS);
      store.clear();
      for (const op of ops) {
        if (op.op === 'put') store.put(op.ord === undefined ? { value: op.value } : { value: op.value, ord: op.ord }, [op.collection, op.key]);
      }
      await finished(tx);
    },

    async getMeta(key) {
      return done(db.transaction(META, 'readonly').objectStore(META).get(key));
    },
    async setMeta(key, value) {
      const tx = db.transaction(META, 'readwrite');
      tx.objectStore(META).put(value, key);
      await finished(tx);
    },

    close() { db.close(); },
  };
}
