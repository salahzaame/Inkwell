import { convertToExcalidrawElements } from '@excalidraw/excalidraw';

export const isMac = /mac/i.test(navigator.platform);
export const KBD = isMac ? '⌘K' : 'Ctrl+K';

const DAY = 86400000;
const now = Date.now();

export const INITIAL_FILES = [
  { id: 'f-research', folder: true, name: 'Research' },
  { id: 'neural', name: 'Neural Interfaces', parent: 'f-research', mtime: now - DAY },
  { id: 'reading', name: 'Reading List', parent: 'f-research', mtime: now - 4 * DAY },
  { id: 'f-projects', folder: true, name: 'Projects' },
  { id: 'bci', name: 'Brain–Computer UI', parent: 'f-projects', mtime: now },
  { id: 'sync', name: 'Weekly Sync', parent: 'f-projects', mtime: now - 3 * DAY },
  { id: 'daily', name: '2026-07-06', top: true, mtime: now },
  { id: 'inbox', name: 'Ideas Inbox', top: true, mtime: now },
];

export const INITIAL_DOCS = {
  bci: [
    'Prototype for a cursor you steer by thought. The headband streams EEG to an on-device decoder — background reading in [[Neural Interfaces]]. Target: thought → action in **under 90ms**, or it feels laggy. #bci #design',
    '',
    '## Signal flow',
    '',
    'Sketching the pipeline before writing any code. Draw directly below — everything stays in this note.',
    '',
    '```sketch signal-flow',
    '```',
    '',
    '## Open questions',
    '',
    '- [ ] Latency budget — is 90ms actually perceivable?',
    '- [x] Dry electrodes vs gel for daily wear',
    '- [ ] Fallback when decoder confidence drops below 0.6',
  ].join('\n'),
  neural: [
    'Non-invasive EEG only — nobody is drilling holes for a cursor. A dry-electrode headband over the motor cortex gives the cleanest motor-imagery signal for the [[Brain–Computer UI]] decoder. #bci #research',
    '',
    '## Electrode placement',
    '',
    'Two papers worth keeping: *Ferrante et al.* on C3/C4 montages for imagined movement, and the Graz-BCI review comparing dry against gel drift over long sessions. Both argue that **placement beats filtering**.',
    '',
    'Open thread: comfort. Anything that feels like a lab rig loses to a headband people forget they are wearing. More candidates collected in [[Reading List]].',
  ].join('\n'),
  reading: [
    'Queue for the [[Neural Interfaces]] deep-dive, roughly in order. #research',
    '',
    '1. A Primer on Motor Imagery Decoding',
    '2. EEG artifact rejection in the wild',
    '3. The 100ms rule for direct-manipulation interfaces',
    '4. Latency-budget notes for [[Brain–Computer UI]]',
  ].join('\n'),
  sync: [
    'Thursday agenda: demo the [[Brain–Computer UI]] cursor end-to-end, then settle the dry-vs-gel electrode question before ordering hardware. #team',
    '',
    '## Agenda',
    '',
    '- [ ] Demo the cursor end-to-end',
    '- [ ] Decide dry vs gel electrodes',
    '- [ ] Order hardware for the pilot',
    '',
    '> Carry-over from last week: latency looked good on the bench (72–84ms), but nobody has tried it standing up. Add a hallway test before the demo.',
  ].join('\n'),
  daily: [
    'Sketched the signal-flow diagram in [[Brain–Computer UI]] — the decoder box keeps growing, which is probably a sign it should be two boxes. #daily',
    '',
    'Quick capture: what if the cursor *eased* toward targets when decoder confidence drops, instead of freezing? Filed in [[Ideas Inbox]].',
  ].join('\n'),
  inbox: [
    'Confidence-weighted cursor easing — degrade gracefully instead of freezing (from [[2026-07-06]]). #inbox',
    '',
    '- Sketch blocks anywhere: every note should embed a canvas like [[Brain–Computer UI]] does',
    '- Publish a note straight to slides from the quick switcher',
  ].join('\n'),
};

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

const LEGACY_SIGNAL_FLOW = [
  { id: 'p1', type: 'rect', x: 56, y: 118, w: 128, h: 62, color: '#e8eaf0' },
  { id: 'p2', type: 'text', x: 86, y: 156, text: 'EEG cap', color: '#e8eaf0' },
  { id: 'p3', type: 'arrow', x0: 186, y0: 149, x1: 262, y1: 149, color: '#a78bfa' },
  { id: 'p4', type: 'ellipse', cx: 328, cy: 149, rx: 64, ry: 38, color: '#5eead4' },
  { id: 'p5', type: 'text', x: 293, y: 156, text: 'Decoder', color: '#5eead4' },
  { id: 'p6', type: 'arrow', x0: 394, y0: 149, x1: 468, y1: 149, color: '#a78bfa' },
  { id: 'p7', type: 'rect', x: 468, y: 118, w: 112, h: 62, color: '#fbbf24' },
  { id: 'p8', type: 'text', x: 486, y: 156, text: 'Cursor UI', color: '#fbbf24' },
  { id: 'p9', type: 'text', x: 210, y: 62, text: 'thought → action in <90ms', color: '#8b90a0' },
  { id: 'p10', type: 'arrow', x0: 305, y0: 74, x1: 322, y1: 104, color: '#8b90a0' },
];

export function buildInitialSketches() {
  return { 'signal-flow': legacySketchToScene(LEGACY_SIGNAL_FLOW) };
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
