import { convertToExcalidrawElements } from '@excalidraw/excalidraw';

export const isMac = /mac/i.test(navigator.platform);
export const KBD = isMac ? '⌘K' : 'Ctrl+K';

const DAY = 86400000;

// A brand-new vault starts empty — content belongs to the user.
export const INITIAL_FILES = [];

export const INITIAL_DOCS = {};

// Excalidraw stores canonical light-theme colors and inverts them for dark display,
// so legacy dark-canvas inks map to their light-palette counterparts.
const INK = {
  '#e8eaf0': '#1e1e1e',
  '#a78bfa': '#6741d9',
  '#5eead4': '#0c8599',
  '#fbbf24': '#f08c00',
  '#f87171': '#e03131',
  '#8b90a0': '#495057',
};
const ink = (c) => INK[c] ?? '#1e1e1e';

/** Convert a legacy (pre-Excalidraw) shape list into an Excalidraw scene. */
export function legacySketchToScene(shapes) {
  const skeletons = [];
  for (const s of shapes || []) {
    try {
      if (s.type === 'rect') skeletons.push({ type: 'rectangle', x: s.x, y: s.y, width: s.w, height: s.h, strokeColor: ink(s.color) });
      else if (s.type === 'ellipse') skeletons.push({ type: 'ellipse', x: s.cx - s.rx, y: s.cy - s.ry, width: 2 * s.rx, height: 2 * s.ry, strokeColor: ink(s.color) });
      else if (s.type === 'arrow') skeletons.push({ type: 'arrow', x: s.x0, y: s.y0, points: [[0, 0], [s.x1 - s.x0, s.y1 - s.y0]], strokeColor: ink(s.color) });
      else if (s.type === 'text') skeletons.push({ type: 'text', x: s.x, y: s.y - 16, text: s.text, fontSize: 16, strokeColor: ink(s.color) });
      else if (s.type === 'path' && s.points?.length > 1) {
        const xs = s.points.map(p => p[0]), ys = s.points.map(p => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        skeletons.push({ type: 'line', x, y, points: s.points.map(p => [p[0] - x, p[1] - y]), strokeColor: ink(s.color) });
      }
    } catch { /* skip shapes that fail conversion */ }
  }
  try {
    return { elements: convertToExcalidrawElements(skeletons), files: {} };
  } catch {
    return { elements: [], files: {} };
  }
}

export function buildInitialSketches() {
  return {};
}

export const COLORS = { white: '#e8eaf0', violet: '#a78bfa', teal: '#5eead4', amber: '#fbbf24', red: '#f87171' };
export const ACCENTS = ['#a78bfa', '#5eead4', '#fbbf24', '#f472b6'];

export const INITIAL_MSGS = [
  { role: 'a', text: 'Hi — ask me about your vault. I can see your notes, with the open one in full detail.' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtEdited(ts) {
  if (!ts) return 'never edited';
  const d = new Date(ts);
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - DAY).toDateString() === d.toDateString();
  if (sameDay) return `edited today · ${date}`;
  if (yesterday) return `edited yesterday · ${date}`;
  return `edited ${date}`;
}

export function monthYear(ts = Date.now()) {
  const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const d = new Date(ts);
  return `${FULL[d.getMonth()]} ${d.getFullYear()}`;
}
