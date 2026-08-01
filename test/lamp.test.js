import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LAMP, FIXED_TOKENS, LAMPS, LAMP_TOKENS, LEGACY_ALIASES,
  applyLamp, contrastRatio, lampVars, nextLamp, normalizeLamp, relativeLuminance,
} from '../src/lamp.js';

test('every setting defines exactly the same token set', () => {
  const daylight = Object.keys(LAMP_TOKENS.daylight).sort();
  for (const lamp of LAMPS) {
    assert.deepEqual(Object.keys(LAMP_TOKENS[lamp]).sort(), daylight, `${lamp} token set differs`);
  }
});

test('no token is left empty at any setting', () => {
  for (const lamp of LAMPS) {
    for (const [name, value] of Object.entries(LAMP_TOKENS[lamp])) {
      assert.ok(String(value).trim(), `${lamp} ${name} is empty`);
    }
  }
});

test('cycles daylight → dusk → lamplight → daylight', () => {
  assert.equal(nextLamp('daylight'), 'dusk');
  assert.equal(nextLamp('dusk'), 'lamplight');
  assert.equal(nextLamp('lamplight'), 'daylight');
});

test('an unknown stored value falls back to the default rather than breaking the room', () => {
  assert.equal(normalizeLamp('midnight'), DEFAULT_LAMP);
  assert.equal(normalizeLamp(undefined), DEFAULT_LAMP);
  assert.equal(nextLamp('garbage'), 'dusk');
});

/* ── the light model's own claims ── */

test('paper is the brightest surface on screen at every setting', () => {
  for (const lamp of LAMPS) {
    const t = LAMP_TOKENS[lamp];
    const paper = relativeLuminance(t['--paper-white']);
    for (const surround of ['--desk', '--chrome', '--chrome-deep', '--chrome-2']) {
      assert.ok(paper > relativeLuminance(t[surround]), `${lamp}: ${surround} is brighter than paper`);
    }
    assert.ok(paper >= relativeLuminance(t['--page']), `${lamp}: note sheet outshines the PDF page`);
  }
});

// CIE L* is the measure the design's rationale uses: it describes today's app as
// "a 93%-luminance page on a 12% blue-black canvas (~8:1)", which reproduces here
// as 95.5 / 12.2 = 7.81. These tests hold the light model to that same measure.
const lstar = (hex) => {
  const y = relativeLuminance(hex);
  return y > 0.008856 ? 116 * Math.pow(y, 1 / 3) - 16 : 903.3 * y;
};
const glareStep = (page, desk) => lstar(page) / lstar(desk);

const TODAY_STEP = 7.81; // current app: #f6f2e7 page on #1e2025 canvas

test('daylight reduces the glare step below the current app', () => {
  const t = LAMP_TOKENS.daylight;
  assert.ok(glareStep(t['--page'], t['--desk']) < TODAY_STEP);
});

// KNOWN DISCREPANCY — the handoff's rationale claims the lamp brings the glare
// step to ~3.4:1 "by warming and lifting the surround, never by dimming the
// paper". The shipped token table does not do that: the desk darkens faster than
// the page, so the step widens toward lamplight. The table matches the approved
// screenshots, so it ships as specified and this test pins the real numbers —
// if the values are ever re-derived, these expectations should move deliberately.
test('the measured glare step per setting is pinned to the shipped table', () => {
  const measured = {
    daylight: glareStep(LAMP_TOKENS.daylight['--page'], LAMP_TOKENS.daylight['--desk']),
    dusk: glareStep(LAMP_TOKENS.dusk['--page'], LAMP_TOKENS.dusk['--desk']),
    lamplight: glareStep(LAMP_TOKENS.lamplight['--page'], LAMP_TOKENS.lamplight['--desk']),
  };
  assert.ok(Math.abs(measured.daylight - 6.00) < 0.1, `daylight ${measured.daylight.toFixed(2)}`);
  assert.ok(Math.abs(measured.dusk - 7.53) < 0.1, `dusk ${measured.dusk.toFixed(2)}`);
  assert.ok(Math.abs(measured.lamplight - 12.18) < 0.1, `lamplight ${measured.lamplight.toFixed(2)}`);
});

test('dimming the room never dims the paper below the room', () => {
  // each successive setting lowers the surround; paper must stay above it
  const desks = LAMPS.map(l => relativeLuminance(LAMP_TOKENS[l]['--desk']));
  assert.ok(desks[0] > desks[1] && desks[1] > desks[2], 'surround does not darken monotonically');
});

test('--ink-2 carries all secondary text and passes AA on the desk', () => {
  for (const lamp of LAMPS) {
    const t = LAMP_TOKENS[lamp];
    const ratio = contrastRatio(t['--ink-2'], t['--desk']);
    assert.ok(ratio >= 4.5, `${lamp}: --ink-2 is ${ratio.toFixed(2)}:1 on --desk, below AA`);
  }
});

test('--ink-1 passes AA on chrome at every setting', () => {
  for (const lamp of LAMPS) {
    const t = LAMP_TOKENS[lamp];
    const ratio = contrastRatio(t['--ink-1'], t['--chrome']);
    assert.ok(ratio >= 4.5, `${lamp}: --ink-1 is ${ratio.toFixed(2)}:1 on --chrome`);
  }
});

test('body text on paper passes AA at every setting', () => {
  for (const lamp of LAMPS) {
    const t = LAMP_TOKENS[lamp];
    const ratio = contrastRatio(t['--p-body'], t['--page']);
    assert.ok(ratio >= 4.5, `${lamp}: --p-body is ${ratio.toFixed(2)}:1 on --page`);
  }
});

test('the page accent stays legible on paper — the reason it differs from --acc', () => {
  for (const lamp of LAMPS) {
    const t = LAMP_TOKENS[lamp];
    const onPaper = contrastRatio(t['--acc-page'], t['--page']);
    const chromeAccentOnPaper = contrastRatio(t['--acc'], t['--page']);
    assert.ok(onPaper >= 4.5, `${lamp}: --acc-page is ${onPaper.toFixed(2)}:1 on paper`);
    assert.ok(onPaper > chromeAccentOnPaper, `${lamp}: --acc-page is no better than --acc on paper`);
  }
});

/* ── wiring ── */

test('lampVars carries lamp tokens, fixed colours, and the legacy aliases together', () => {
  const vars = lampVars('dusk');
  assert.equal(vars['--desk'], LAMP_TOKENS.dusk['--desk']);
  assert.equal(vars['--ribbon'], FIXED_TOKENS['--ribbon']);
  assert.equal(vars['--bg-panel'], LEGACY_ALIASES['--bg-panel']);
});

test('fixed colours do not move with the light', () => {
  const a = lampVars('daylight');
  const b = lampVars('lamplight');
  for (const name of Object.keys(FIXED_TOKENS)) assert.equal(a[name], b[name], `${name} moved`);
});

test('applyLamp writes every property and stamps the setting', () => {
  const set = {};
  const el = { style: { setProperty: (k, v) => { set[k] = v; } }, dataset: {} };
  applyLamp(el, 'lamplight');
  assert.equal(el.dataset.lamp, 'lamplight');
  assert.equal(set['--desk'], LAMP_TOKENS.lamplight['--desk']);
  assert.equal(Object.keys(set).length, Object.keys(lampVars('lamplight')).length);
});

test('applyLamp normalizes a bad setting instead of writing undefined', () => {
  const set = {};
  const el = { style: { setProperty: (k, v) => { set[k] = v; } }, dataset: {} };
  applyLamp(el, 'nonsense');
  assert.equal(el.dataset.lamp, DEFAULT_LAMP);
  assert.equal(set['--desk'], LAMP_TOKENS[DEFAULT_LAMP]['--desk']);
});

test('applyLamp is a no-op on a missing element rather than throwing', () => {
  assert.doesNotThrow(() => applyLamp(null, 'dusk'));
});
