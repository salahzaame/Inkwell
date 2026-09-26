// Session restore — where you were, so the app resumes instead of starting over.
//
// The app used to open on `files.find(f => !f.folder)` every time: the first note
// in file order, regardless of what you were doing. Nothing about the working
// session was persisted. This module holds that state and resolves it back
// against the vault on load, since notes can be deleted between sessions.
//
export const SESSION_KEY = 'inkwell.session';

const VIEWS = ['editor', 'graph', 'slides'];

const asInt = (v, min = 0) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min ? n : 0;
};

/** Coerce anything read from storage into a session shape. */
export function normalizeSession(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    noteId: typeof s.noteId === 'string' ? s.noteId : null,
    tabs: Array.isArray(s.tabs) ? s.tabs.filter(t => typeof t === 'string') : [],
    view: VIEWS.includes(s.view) ? s.view : 'editor',
    scrollTop: asInt(s.scrollTop),
    paperId: typeof s.paperId === 'string' ? s.paperId : null,
    page: asInt(s.page, 1) || 1,
  };
}

const notesOnly = (files = []) => files.filter(f => f && !f.folder);

/**
 * Reconcile a stored session against the current vault.
 * Notes deleted since last time are dropped; if the active note is gone the
 * fallback is the most recently edited note, not the first in file order.
 */
export function resolveSession(raw, files = []) {
  const session = normalizeSession(raw);
  const notes = notesOnly(files);
  const byId = new Map(notes.map(n => [n.id, n]));

  const tabs = session.tabs.filter(id => byId.has(id));
  let noteId = session.noteId && byId.has(session.noteId) ? session.noteId : null;

  if (!noteId) noteId = tabs[0] ?? mostRecentNoteId(notes);
  if (noteId && !tabs.includes(noteId)) tabs.unshift(noteId);

  return {
    ...session,
    noteId,
    tabs,
    // a restored scroll position only means anything for the note it was taken in
    scrollTop: noteId === session.noteId ? session.scrollTop : 0,
  };
}

export function mostRecentNoteId(files = []) {
  const notes = notesOnly(files);
  if (!notes.length) return null;
  return notes.reduce((best, n) => ((n.mtime ?? 0) > (best.mtime ?? 0) ? n : best), notes[0]).id;
}

export function readSession(storage) {
  try {
    return normalizeSession(JSON.parse(storage.getItem(SESSION_KEY)));
  } catch {
    return normalizeSession(null);
  }
}

export function writeSession(storage, session) {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(normalizeSession(session)));
    return true;
  } catch {
    return false; // private mode / quota — resuming is a convenience, never fatal
  }
}
