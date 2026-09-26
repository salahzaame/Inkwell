import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateCandidates, libraryBibtex, normalizeDoi, normalizeSearchQuery, parseBibtex, referenceBibtex, saveSearchQuery } from '../src/references.js';

test('parses a common BibTeX article with authors and DOI', () => {
  const [paper] = parseBibtex(`@article{doe2024,
    title = {A {Nested} Study},
    author = {Doe, Jane and Roe, Richard},
    year = {2024},
    journal = {Journal of Tests},
    doi = {10.1000/example}
  }`);

  assert.equal(paper.citationKey, 'doe2024');
  assert.equal(paper.title, 'A {Nested} Study');
  assert.deepEqual(paper.authors, ['Doe, Jane', 'Roe, Richard']);
  assert.equal(paper.url, 'https://doi.org/10.1000/example');
  assert.equal(paper.journal, 'Journal of Tests');
});

test('parses more than one entry and ignores non-BibTeX text', () => {
  const papers = parseBibtex(`A note before entries.
@misc{one, title={First}, year={2020}}
@inproceedings{two, title={Second}, author={Kim, Min}, year={2021}}`);

  assert.equal(papers.length, 2);
  assert.deepEqual(papers.map(paper => paper.citationKey), ['one', 'two']);
});

test('serializes generated and imported references into a portable library', () => {
  const generated = referenceBibtex({
    citationKey: 'smith2025', title: 'Evidence {Review}', authors: ['Smith, Ada'], year: 2025,
    journal: 'Open Science', doi: '10.1/test', url: 'https://doi.org/10.1/test',
  });
  assert.match(generated, /@article\{smith2025,/);
  assert.match(generated, /title = \{Evidence Review\}/);

  const library = libraryBibtex([
    { bibtex: '@book{kept, title={Kept exactly}}' },
    { title: 'Fallback', authors: [], year: 2023 },
  ]);
  assert.match(library, /@book\{kept, title=\{Kept exactly\}\}/);
  assert.match(library, /@misc\{reference2,/);
});

test('finds exact and high-confidence duplicate candidates without fuzzy false positives', () => {
  const papers = [
    { citationKey: 'one', title: 'A practical guide to resilient systems', year: 2024, doi: 'https://doi.org/10.10/RESILIENT' },
    { citationKey: 'two', title: 'A practical guide to resilient systems', year: 2023, doi: 'doi:10.10/resilient' },
    { citationKey: 'three', title: 'A practical guide to resilient systems: an overview', year: 2024 },
    { citationKey: 'four', title: 'An unrelated introduction to systems', year: 2024 },
  ];
  const matches = findDuplicateCandidates(papers);
  assert.equal(matches.length, 3);
  assert.equal(matches[0].reason, 'same DOI');
  assert.ok(matches.some(match => match.reason === 'very similar title'));
  assert.equal(normalizeDoi('DOI: 10.1000/example.'), '10.1000/example');
});

test('saved searches normalize whitespace, deduplicate case-insensitively, and stay bounded', () => {
  assert.equal(normalizeSearchQuery('  causal   inference  '), 'causal inference');
  const saved = saveSearchQuery(['Bayesian methods', 'causal inference'], '  CAUSAL   INFERENCE ');
  assert.deepEqual(saved, ['CAUSAL INFERENCE', 'Bayesian methods']);
  assert.equal(saveSearchQuery(Array.from({ length: 16 }, (_, i) => `search ${i}`), 'new search').length, 16);
});
