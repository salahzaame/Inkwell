// Where to fetch a paper's PDF from, and in what order.
//
// "Open access" often means free to read on the publisher's site, and many
// publishers (ACM, IEEE, Elsevier, Wiley...) sit behind bot checks that refuse
// any server fetching on the reader's behalf, Inkwell's PDF relay included.
// Repository copies (arXiv, PubMed Central, institutional archives) serve
// anyone, so they go first and publishers last; Semantic Scholar is asked for
// copies OpenAlex did not list.

// hosts known to answer automated requests with a bot challenge or a paywall page
const GATED_HOSTS = [
  'dl.acm.org', 'ieeexplore.ieee.org', 'sciencedirect.com', 'link.springer.com',
  'onlinelibrary.wiley.com', 'tandfonline.com', 'jstor.org', 'academic.oup.com',
  'journals.sagepub.com', 'pubs.acs.org', 'cambridge.org', 'emerald.com', 'researchgate.net', 'ssrn.com',
];

// hosts whose whole purpose is serving papers to anyone
const REPOSITORY_HOSTS = [
  'arxiv.org', 'europepmc.org', 'ncbi.nlm.nih.gov', 'biorxiv.org', 'medrxiv.org',
  'zenodo.org', 'hal.science', 'archives-ouvertes.fr', 'osf.io',
  'core.ac.uk', 'semanticscholar.org',
];

const hostOf = (url) => {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
};
const onHost = (host, list) => list.some(h => host === h || host.endsWith('.' + h));

/** 0 repository, 1 unknown (often a university archive), 2 gated publisher. */
export function sourceRank(url) {
  const host = hostOf(url);
  if (onHost(host, REPOSITORY_HOSTS)) return 0;
  if (onHost(host, GATED_HOSTS)) return 2;
  return 1;
}

/** De-duplicated, repositories first, gated publishers last; ties keep their order. */
export function orderPdfCandidates(urls = []) {
  const seen = new Set();
  return urls
    .filter(u => typeof u === 'string' && /^https?:\/\//i.test(u) && !seen.has(u) && seen.add(u))
    .map((u, i) => [u, sourceRank(u), i])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([u]) => u);
}

/** The DOI without its https://doi.org/ prefix, or ''. */
export const bareDoi = (doi = '') => String(doi).trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:/i, '');

/** PDF links in a Semantic Scholar paper record: its open-access PDF, arXiv and PMC copies. */
export function copiesFromSemanticScholar(record) {
  const out = [];
  const ids = record?.externalIds || {};
  if (ids.ArXiv) out.push(`https://arxiv.org/pdf/${ids.ArXiv}`);
  if (ids.PubMedCentral) out.push(`https://europepmc.org/articles/PMC${String(ids.PubMedCentral).replace(/^PMC/i, '')}?pdf=render`);
  if (record?.openAccessPdf?.url) out.push(record.openAccessPdf.url);
  return out;
}

/**
 * More copies of a paper, found by DOI. Never throws: no DOI, a rate limit or
 * an outage all mean "no more copies", and the reader falls back to attaching.
 */
export async function findMoreCopies({ doi } = {}, fetchImpl = fetch) {
  const id = bareDoi(doi);
  if (!id) return [];
  try {
    const res = await fetchImpl(
      `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(id)}?fields=openAccessPdf,externalIds`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    return copiesFromSemanticScholar(await res.json());
  } catch {
    return [];
  }
}

/** Plain words for the reader: who blocked the paper, if we know. */
export function publisherName(url) {
  const host = hostOf(url);
  const names = {
    'dl.acm.org': 'ACM', 'ieeexplore.ieee.org': 'IEEE', 'sciencedirect.com': 'Elsevier',
    'link.springer.com': 'Springer', 'onlinelibrary.wiley.com': 'Wiley', 'tandfonline.com': 'Taylor & Francis',
    'jstor.org': 'JSTOR', 'academic.oup.com': 'Oxford University Press', 'journals.sagepub.com': 'SAGE',
    'pubs.acs.org': 'ACS', 'cambridge.org': 'Cambridge University Press', 'emerald.com': 'Emerald',
  };
  const key = Object.keys(names).find(h => host === h || host.endsWith('.' + h));
  return key ? names[key] : null;
}
