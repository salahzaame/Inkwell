import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceMatrix, buildLiteratureMap, researchStats } from '../src/research-artifacts.js';

const references = [
  { citationKey: 'ada2024', title: 'Causal | evidence', authors: ['Ada Lovelace'], year: 2024, status: 'reading', abstract: 'A recorded abstract.', doi: '10.1/ada', pdfUrl: 'https://example.test/ada.pdf', tags: ['methods'] },
  { citationKey: 'grace2023', title: 'Systems at scale', authors: ['Grace Hopper'], year: 2023, status: 'done', abstract: '' },
];
const highlights = { ada2024: [{ text: 'Direct local evidence.', page: 4 }] };

test('literature map builds a grounded editable note from saved records', () => {
  const artifact = buildLiteratureMap({ references, highlights, dateLabel: '28/07/2026' });
  assert.equal(artifact.name, 'Literature map 28/07/2026');
  assert.match(artifact.content, /2 saved papers/);
  assert.match(artifact.content, /\[@ada2024\]/);
  assert.match(artifact.content, /Direct local evidence\./);
  assert.match(artifact.content, /Which claim needs stronger evidence\?/);
});

test('evidence matrix preserves excerpts and explicitly flags metadata gaps', () => {
  const artifact = buildEvidenceMatrix({ references, highlights, dateLabel: '28/07/2026' });
  assert.equal(artifact.name, 'Evidence matrix 28/07/2026');
  assert.match(artifact.content, /\| Causal evidence \(\[@ada2024\]\) \| reading \| 1 saved highlight \| none recorded \|/);
  assert.match(artifact.content, /\| Systems at scale \(\[@grace2023\]\) \| done \| 0 saved highlights \| abstract, DOI, full text \|/);
  assert.match(artifact.content, /> Direct local evidence\./);
  assert.match(artifact.content, /\*\*My interpretation:\*\*/);
});

test('research stats count papers by state and saved highlights', () => {
  assert.deepEqual(researchStats(references, highlights), { papers: 2, reading: 1, finished: 1, highlights: 1 });
});
