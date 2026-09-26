import test from 'node:test';
import assert from 'node:assert/strict';
import { citedKeys, formatReference, generateBibliography } from '../src/bibliography.js';

const lovelace = {
  citationKey: 'lovelace2024',
  authors: ['Ada Lovelace', 'Grace Hopper'],
  year: '2024',
  title: 'Computing in practice',
  journal: 'Research Systems',
  doi: '10.1000/demo',
};

test('citation extraction preserves first-use order and removes duplicates', () => {
  assert.deepEqual(citedKeys('See [@hopper1952], then [@lovelace2024] and [@hopper1952].'), ['hopper1952', 'lovelace2024']);
});

test('reference formatter produces local APA, IEEE, and Chicago variants', () => {
  assert.equal(
    formatReference(lovelace, 'apa'),
    'Lovelace, A., & Hopper, G. (2024). Computing in practice. *Research Systems*. https://doi.org/10.1000/demo',
  );
  assert.equal(
    formatReference(lovelace, 'ieee', 3),
    '[3] A. Lovelace, G. Hopper. “Computing in practice.” *Research Systems*, 2024. https://doi.org/10.1000/demo',
  );
  assert.equal(
    formatReference(lovelace, 'chicago'),
    'Lovelace, Ada, Grace Hopper. 2024. “Computing in practice.” *Research Systems*. https://doi.org/10.1000/demo',
  );
});

test('bibliography replaces a prior References section and reports missing records', () => {
  const result = generateBibliography('# Draft\n\nA claim [@lovelace2024]. Unknown [@missing].\n\n## References\n\nold entry', [lovelace], 'ieee');
  assert.equal(result.cited, 2);
  assert.deepEqual(result.missing, ['missing']);
  assert.doesNotMatch(result.text, /old entry/);
  assert.match(result.text, /## References/);
  assert.match(result.text, /\[1\] A\. Lovelace/);
  assert.match(result.text, /\*\*missing\*\*: Reference details not found/);
});
