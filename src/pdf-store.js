// PDFs the reader gave Inkwell by hand — downloaded from a publisher that
// blocks automated access, or got through a library — kept per paper, so the
// paper opens straight from this copy next time.
//
// IndexedDB, not localStorage: papers run to megabytes, past localStorage's
// whole-site quota. Every call degrades to "nothing stored" when IndexedDB is
// unavailable (private windows, blocked site data): the paper then simply
// has to be attached again, nothing breaks.

const DB = 'inkwell-pdfs';
const STORE = 'pdfs';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** The stored copy of a paper as bytes, or null. */
export async function loadPaperPdf(paperId) {
  if (!paperId) return null;
  try {
    const buf = await run('readonly', s => s.get(paperId));
    return buf ? new Uint8Array(buf) : null;
  } catch {
    return null;
  }
}

/** Keep a copy of a paper. Resolves false when it could not be stored. */
export async function savePaperPdf(paperId, bytes) {
  if (!paperId) return false;
  try {
    // a copy of the bytes: pdf.js detaches the buffers it is handed
    await run('readwrite', s => s.put(bytes.slice().buffer, paperId));
    return true;
  } catch {
    return false;
  }
}

export async function removePaperPdf(paperId) {
  try { await run('readwrite', s => s.delete(paperId)); } catch { /* nothing stored */ }
}
