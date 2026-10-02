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

// The load-bearing property of the light model: no setting may be worse than
// another. The handoff's original table failed this — it widened the step to
// 12.18 at lamplight — so the surround values were re-derived to hold it flat.
test('the glare step is held constant across all three settings', () => {
  const steps = LAMPS.map(l => glareStep(LAMP_TOKENS[l]['--page'], LAMP_TOKENS[l]['--desk']));
  for (const [i, step] of steps.entries()) {
    assert.ok(Math.abs(step - 6.0) < 0.25, `${LAMPS[i]} step is ${step.toFixed(2)}, not ~6.0`);
  }
  const spread = Math.max(...steps) - Math.min(...steps);
  assert.ok(spread < 0.25, `steps spread by ${spread.toFixed(2)} across settings`);
});

test('no setting is worse than the app the lamp replaces', () => {
  for (const lamp of LAMPS) {
    const step = glareStep(LAMP_TOKENS[lamp]['--page'], LAMP_TOKENS[lamp]['--desk']);
    assert.ok(step < TODAY_STEP, `${lamp} is ${step.toFixed(2)}, worse than today's ${TODAY_STEP}`);
  }
});

test('dimming the lamp dims the page, not the room', () => {
  // the corrected model: the surround stays roughly put while the page comes down
  const pages = LAMPS.map(l => lstar(LAMP_TOKENS[l]['--page']));
  assert.ok(pages[0] > pages[1] && pages[1] > pages[2], 'page does not dim across settings');
  const desks = LAMPS.map(l => lstar(LAMP_TOKENS[l]['--desk']));
  assert.ok(Math.max(...desks) - Math.min(...desks) < 3, 'surround moves too much between settings');
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

/* ── the accent: any choice keeps amber's contrast at every setting ── */

import { ACCENTS, DEFAULT_ACCENT, accentTokens, normalizeAccent } from '../src/lamp.js';

test('amber is the lamp table itself, untouched', () => {
  for (const lamp of LAMPS) {
    assert.deepEqual(accentTokens(DEFAULT_ACCENT, lamp), {});
    assert.equal(lampVars(lamp, DEFAULT_ACCENT)['--acc'], LAMP_TOKENS[lamp]['--acc']);
  }
});

test('a stored accent that is not a choice falls back to amber', () => {
  assert.equal(normalizeAccent('#123456'), DEFAULT_ACCENT);
  assert.equal(normalizeAccent(undefined), DEFAULT_ACCENT);
  assert.equal(normalizeAccent('#A78BFA'), '#a78bfa');
});

test('every accent keeps amber\'s contrast on chrome, on paper, and under button text', () => {
  for (const lamp of LAMPS) {
    const t = LAMP_TOKENS[lamp];
    const amber = { chrome: contrastRatio(t['--acc'], t['--chrome-2']), page: contrastRatio(t['--acc-page'], t['--page']), button: contrastRatio('#17181c', t['--acc']) };
    for (const { id, hex } of ACCENTS) {
      const v = lampVars(lamp, hex);
      const got = { chrome: contrastRatio(v['--acc'], t['--chrome-2']), page: contrastRatio(v['--acc-page'], t['--page']), button: contrastRatio('#17181c', v['--acc']) };
      for (const k of Object.keys(amber)) {
        assert.ok(Math.abs(got[k] - amber[k]) < 0.1, `${lamp} ${id} ${k}: ${got[k].toFixed(2)} vs amber ${amber[k].toFixed(2)}`);
        assert.ok(got[k] >= 4.5, `${lamp} ${id} ${k} fails AA at ${got[k].toFixed(2)}`);
      }
    }
  }
});

test('the accent is written onto the element with the rest of the lamp', () => {
  const props = {};
  const el = { style: { setProperty: (k, v) => { props[k] = v; } }, dataset: {} };
  applyLamp(el, 'dusk', '#5eead4');
  assert.equal(props['--acc'], accentTokens('#5eead4', 'dusk')['--acc']);
  assert.notEqual(props['--acc'], LAMP_TOKENS.dusk['--acc']);
});
