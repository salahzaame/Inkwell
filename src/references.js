/** Reference-library transforms shared by the UI and automated tests. */
function cleanBibValue(value = '') {
  return value.replace(/^\s*[{"]|[}"]\s*$/g, '').replace(/\s+/g, ' ').trim();
}

/** Parse ordinary BibTeX exports from reference managers without a network request. */
export function parseBibtex(text) {
  const chunks = String(text || '').split(/(?=@[a-zA-Z]+\s*\{)/).filter(Boolean);
  return chunks.flatMap(raw => {
    const header = raw.match(/^\s*@([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,/);
    if (!header) return [];
    const fields = {};
    const body = raw.slice(header[0].length);
    const fieldRe = /(\w+)\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"(?:\\.|[^"])*")\s*,?/g;
    for (const match of body.matchAll(fieldRe)) fields[match[1].toLowerCase()] = cleanBibValue(match[2]);
    const authors = (fields.author || '').split(/\s+and\s+/i).map(author => author.trim()).filter(Boolean);
    const citationKey = header[2];
    const title = fields.title || citationKey;
    return [{
      id: `bib:${citationKey}`,
      title,
      authors,
      year: fields.year || null,
      doi: fields.doi || '',
      url: fields.url || (fields.doi ? `https://doi.org/${fields.doi}` : ''),
      journal: fields.journal || fields.booktitle || '',
      abstract: fields.abstract || '',
      citationKey,
      bibtex: raw.trim(),
      pdfUrl: '',
      pdfCandidates: [],
    }];
  });
}

function bibField(value) {
  return String(value || '').replace(/[{}]/g, '').trim();
}

export function referenceBibtex(ref, fallbackKey = 'reference') {
  if (ref.bibtex?.trim()) return ref.bibtex.trim();
  const key = ref.citationKey || fallbackKey;
  const type = ref.journal ? 'article' : 'misc';
  const fields = [
    ['title', ref.title],
    ['author', (ref.authors || []).join(' and ')],
    ['year', ref.year],
    ['journal', ref.journal],
    ['doi', ref.doi],
    ['url', ref.url],
  ].filter(([, value]) => value);
  return `@${type}{${key},\n${fields.map(([name, value]) => `  ${name} = {${bibField(value)}}`).join(',\n')}\n}`;
}

export function libraryBibtex(references) {
  return (references || []).map((reference, index) => referenceBibtex(reference, `reference${index + 1}`)).join('\n\n') + '\n';
}

export function normalizeDoi(value = '') {
  return String(value).trim().toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '')
    .replace(/[.)]+$/, '');
}

export function normalizeReferenceTitle(value = '') {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function titleTokenSimilarity(left, right) {
  const a = new Set(normalizeReferenceTitle(left).split(' ').filter(token => token.length > 2));
  const b = new Set(normalizeReferenceTitle(right).split(' ').filter(token => token.length > 2));
  if (a.size < 3 || b.size < 3) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / new Set([...a, ...b]).size;
}

/**
 * Find records that deserve human review. Exact DOI and exact title matches are
 * reliable; fuzzy title matches additionally require nearly the same year.
 */
export function findDuplicateCandidates(references = []) {
  const candidates = [];
  for (let leftIndex = 0; leftIndex < references.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < references.length; rightIndex += 1) {
      const left = references[leftIndex];
      const right = references[rightIndex];
      const leftDoi = normalizeDoi(left.doi);
      const rightDoi = normalizeDoi(right.doi);
      const leftTitle = normalizeReferenceTitle(left.title);
      const rightTitle = normalizeReferenceTitle(right.title);
      let reason = '';
      let confidence = 0;
      if (leftDoi && leftDoi === rightDoi) {
        reason = 'same DOI';
        confidence = 1;
      } else if (leftTitle && leftTitle === rightTitle) {
        reason = 'same title';
        confidence = .98;
      } else {
        const yearDistance = Number(left.year) && Number(right.year) ? Math.abs(Number(left.year) - Number(right.year)) : 0;
        const similarity = titleTokenSimilarity(left.title, right.title);
        if (similarity >= .8 && yearDistance <= 1) {
          reason = 'very similar title';
          confidence = similarity;
        }
      }
      if (reason) candidates.push({ left, right, reason, confidence });
    }
  }
  return candidates.sort((a, b) => b.confidence - a.confidence || a.left.title.localeCompare(b.left.title));
}

export function normalizeSearchQuery(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

/** Add a durable search query at the front, keeping a compact local history. */
export function saveSearchQuery(searches = [], value = '') {
  const query = normalizeSearchQuery(value);
  if (!query) return searches;
  const withoutMatch = searches.filter(item => normalizeSearchQuery(item).toLocaleLowerCase() !== query.toLocaleLowerCase());
  return [query, ...withoutMatch].slice(0, 16);
}
