import test from 'node:test';
import assert from 'node:assert/strict';
import { bareDoi, copiesFromSemanticScholar, findMoreCopies, orderPdfCandidates, publisherName, sourceRank } from '../src/pdf-sources.js';

test('repository copies are tried before publishers that block apps', () => {
  const acm = 'https://dl.acm.org/doi/pdf/10.1145/175247.175257';
  const uni = 'https://www.cs.example.edu/~smith/paper.pdf';
  const arxiv = 'https://arxiv.org/pdf/2106.09685';
  assert.deepEqual(orderPdfCandidates([acm, uni, arxiv, acm, '', null, 'ftp://x/y.pdf']), [arxiv, uni, acm]);
});

test('hosts are matched by domain, not by substring', () => {
  assert.equal(sourceRank('https://export.arxiv.org/pdf/1234'), 0);
  assert.equal(sourceRank('https://www.sciencedirect.com/science/article/pii/X/pdf'), 2);
  assert.equal(sourceRank('https://notarxiv.org/paper.pdf'), 1);
});

test('a Semantic Scholar record yields its arXiv, PubMed Central and open-access copies', () => {
  assert.deepEqual(copiesFromSemanticScholar({
    externalIds: { ArXiv: '2106.09685', PubMedCentral: '7654321' },
    openAccessPdf: { url: 'https://dl.acm.org/doi/pdf/10.1145/1' },
  }), [
    'https://arxiv.org/pdf/2106.09685',
    'https://europepmc.org/articles/PMC7654321?pdf=render',
    'https://dl.acm.org/doi/pdf/10.1145/1',
  ]);
  assert.deepEqual(copiesFromSemanticScholar(null), []);
});

test('looking for more copies never throws, and asks by bare DOI', async () => {
  let asked = '';
  const ok = async (url) => { asked = url; return { ok: true, json: async () => ({ externalIds: { ArXiv: '1' } }) }; };
  assert.deepEqual(await findMoreCopies({ doi: 'https://doi.org/10.1145/175247.175257' }, ok), ['https://arxiv.org/pdf/1']);
  assert.match(asked, /paper\/DOI:10\.1145%2F175247\.175257\?/);
  assert.deepEqual(await findMoreCopies({ doi: '10.1/x' }, async () => ({ ok: false, status: 429 })), []);
  assert.deepEqual(await findMoreCopies({ doi: '10.1/x' }, async () => { throw new Error('offline'); }), []);
  assert.deepEqual(await findMoreCopies({}), []);
  assert.equal(bareDoi('doi:10.5/abc'), '10.5/abc');
});

test('the reader is told who blocked the paper, in plain words', () => {
  assert.equal(publisherName('https://dl.acm.org/doi/pdf/10.1145/175247.175257'), 'ACM');
  assert.equal(publisherName('https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=1'), 'IEEE');
  assert.equal(publisherName('https://arxiv.org/pdf/1'), null);
});
