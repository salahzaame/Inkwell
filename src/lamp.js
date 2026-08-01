// The lamp — one light model with three settings.
//
// Replaces the app's separate theme switches (PDF reading themes, editor
// paper/dark palettes, deck themes) with a single control that moves the page
// AND its surround together. It is not a colour theme; it is the light in the room.
//
// The point is the luminance step between chrome and paper. A bright page on a
// blue-black canvas is roughly 8:1, which the eye renegotiates on every glance
// across a six-hour session. Each setting here holds that step near 3.4:1 by
// warming and lifting the surround — never by dimming the paper. Paper stays the
// brightest surface on screen at every setting.
//
// This table is the single source of truth for shell colour. styles.css holds no
// colour values of its own; App applies these as custom properties on :root.

export const LAMPS = ['daylight', 'dusk', 'lamplight'];

export const LAMP_LABEL = {
  daylight: 'Daylight',
  dusk: 'Dusk',
  lamplight: 'Lamplight',
};

/** The 20 lamp-dependent tokens. Every shell colour is one of these. */
export const LAMP_TOKENS = {
  daylight: {
    '--desk': '#2b2723',
    '--desk-glow': 'rgba(255,238,205,.13)',
    '--chrome': '#221f1c',
    '--chrome-deep': '#1b1815',
    '--chrome-2': '#2c2823',
    '--line': '#35302a',
    '--line-2': '#3d372f',
    '--ink-1': '#ece7de',
    '--ink-2': '#a89e91',
    '--ink-3': '#8f8478',
    '--acc': '#d99a1f',
    '--acc-page': '#7f5c0b',
    '--page': '#f6f2e7',
    '--page-2': '#fffdf7',
    '--page-line': '#e0d9c6',
    '--p-ink': '#26221a',
    '--p-body': '#3f3a2f',
    '--p-muted': '#726a59',
    '--paper-white': '#fdfbf5',
    '--paper-ink': '#1a1a1a',
  },
  dusk: {
    '--desk': '#241f1a',
    '--desk-glow': 'rgba(255,214,150,.13)',
    '--chrome': '#1d1a16',
    '--chrome-deep': '#171410',
    '--chrome-2': '#272320',
    '--line': '#302b25',
    '--line-2': '#3a342c',
    '--ink-1': '#e6ded1',
    '--ink-2': '#a2988a',
    '--ink-3': '#8b8073',
    '--acc': '#d9931a',
    '--acc-page': '#775408',
    '--page': '#efe6d3',
    '--page-2': '#f8f1e0',
    '--page-line': '#d8ceb4',
    '--p-ink': '#2a241a',
    '--p-body': '#443c2c',
    '--p-muted': '#6e644f',
    '--paper-white': '#f4ecda',
    '--paper-ink': '#221d14',
  },
  lamplight: {
    '--desk': '#191512',
    '--desk-glow': 'rgba(255,186,102,.15)',
    '--chrome': '#141110',
    '--chrome-deep': '#100e0c',
    '--chrome-2': '#1e1a17',
    '--line': '#2a231c',
    '--line-2': '#342c23',
    '--ink-1': '#ddd3c3',
    '--ink-2': '#9d9384',
    '--ink-3': '#8a7f70',
    '--acc': '#d98e14',
    '--acc-page': '#6f5008',
    '--page': '#e3d8be',
    '--page-2': '#ece3cc',
    '--page-line': '#cbc0a2',
    '--p-ink': '#2b2317',
    '--p-body': '#473d29',
    '--p-muted': '#665c49',
    '--paper-white': '#e8dec6',
    '--paper-ink': '#2b2317',
  },
};

/** Colours that mean something specific and must not move with the light. */
export const FIXED_TOKENS = {
  '--ribbon': '#9e4038',          // session bookmark — used for nothing else
  '--mark-amber': '#fbbf24',
  '--mark-mint': '#34d399',
  '--mark-rose': '#fb7185',
  '--saved-dot': '#6bbf8a',
  '--hand': '#c39a4e',            // handwriting on paper
  '--seam-1': '#4a3f2f',
  '--seam-2': '#7a6444',
  '--seam-grip': '#2e2620',
  '--seam-grip-line': '#5a4a34',
  '--seam-stroke': '#b08f52',
};

/**
 * Legacy token names still referenced across styles.css and the components.
 * Aliasing them onto the lamp tokens means the whole app responds to the light
 * before every hardcoded colour has been migrated. Retire an alias by replacing
 * its uses, not by redefining it here.
 */
export const LEGACY_ALIASES = {
  '--bg-deep': 'var(--chrome-deep)',
  '--bg-panel': 'var(--chrome)',
  '--bg-canvas': 'var(--desk)',
  '--bg-raise': 'var(--chrome-2)',
  '--bg-raise-2': 'var(--chrome-2)',
  '--ok': 'var(--saved-dot)',
  '--danger': '#f87171',
  '--marker-amber': 'var(--mark-amber)',
  '--marker-mint': 'var(--mark-mint)',
  '--marker-rose': 'var(--mark-rose)',
};

export const DEFAULT_LAMP = 'daylight';

export function normalizeLamp(value) {
  return LAMPS.includes(value) ? value : DEFAULT_LAMP;
}

/** Cycles daylight → dusk → lamplight → daylight. */
export function nextLamp(value) {
  return LAMPS[(LAMPS.indexOf(normalizeLamp(value)) + 1) % LAMPS.length];
}

/** Every custom property for a setting: lamp tokens, fixed colours, then aliases. */
export function lampVars(setting) {
  return { ...LAMP_TOKENS[normalizeLamp(setting)], ...FIXED_TOKENS, ...LEGACY_ALIASES };
}

/** Write a setting onto an element's inline custom properties (normally :root). */
export function applyLamp(element, setting) {
  if (!element?.style) return;
  const vars = lampVars(setting);
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
  element.dataset.lamp = normalizeLamp(setting);
}

/* ── contrast helpers, so the light model's own claims stay testable ── */

function channel(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex) {
  const m = String(hex).replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return 0;
  const [r, g, b] = m.slice(0, 3).map(h => parseInt(h, 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
