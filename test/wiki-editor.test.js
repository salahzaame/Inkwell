import test from 'node:test';
import assert from 'node:assert/strict';
import { wikilinkEditorHtml } from '../src/wiki-editor.js';

test('wikilink editor renders the readable note name instead of markdown brackets', () => {
  const html = wikilinkEditorHtml('See [[Second note]] today.');
  assert.match(html, /data-wiki="Second note"/);
  assert.match(html, />Second note<\/span>/);
  assert.doesNotMatch(html, /\[\[Second note\]\]/);
});
