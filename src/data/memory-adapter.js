// A vault held only in memory: for tests, and the fallback when a browser
// refuses on-device storage (some private windows). `durable: false` lets the
// app say plainly that nothing will be kept.

export function createMemoryAdapter({ durable = false } = {}) {
  const records = new Map(); // "collection\u0000key" → { collection, key, value, ord }
  const meta = new Map();
  const id = (collection, key) => `${collection}\u0000${key}`;
  return {
    durable,
    failNext: null, // tests: set to an Error to make the next apply fail
    async loadAll() { return [...records.values()].map(r => ({ ...r })); },
    async apply(ops) {
      if (this.failNext) { const err = this.failNext; this.failNext = null; throw err; }
      for (const op of ops) {
        if (op.op === 'delete') records.delete(id(op.collection, op.key));
        else records.set(id(op.collection, op.key), { collection: op.collection, key: op.key, value: op.value, ord: op.ord });
      }
    },
    async replaceAll(ops) { records.clear(); await this.apply(ops); },
    async getMeta(key) { return meta.get(key); },
    async setMeta(key, value) { meta.set(key, value); },
    close() {},
  };
}
