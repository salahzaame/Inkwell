import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenAlexWorksUrl, normalizePublicationYear } from '../src/openalex.js';

test('normalizes four-digit publication years and rejects malformed values', () => {
  assert.equal(normalizePublicationYear('2024'), '2024');
  assert.equal(normalizePublicationYear(' 1999 '), '1999');
  assert.equal(normalizePublicationYear('24'), '');
  assert.equal(normalizePublicationYear('10000'), '');
});

test('builds a bounded OpenAlex URL with researcher triage filters', () => {
  const url = new URL(buildOpenAlexWorksUrl('causal inference', { openAccessOnly: true, fromYear: '2020', toYear: '2024', sort: 'cited' }));
  assert.equal(url.searchParams.get('search'), 'causal inference');
  assert.equal(url.searchParams.get('per_page'), '12');
  assert.equal(url.searchParams.get('filter'), 'is_oa:true,from_publication_date:2020-01-01,to_publication_date:2024-12-31');
  assert.equal(url.searchParams.get('sort'), 'cited_by_count:desc');
});
