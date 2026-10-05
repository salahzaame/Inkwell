// Preferences of this device, not of the research: the lamp, panel widths,
// folded folders, where the last session stopped. Small, read synchronously
// at start-up, and never synced: another computer has another screen.

export function readPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: the default next time */ }
}

/** A preference stored as plain text by older versions (not JSON). */
export function readRawPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function writeRawPref(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
}
