export const BIBLIOGRAPHY_STYLES = {
  apa: { label: 'APA 7', description: 'Author–date' },
  ieee: { label: 'IEEE', description: 'Numbered' },
  chicago: { label: 'Chicago', description: 'Author–date' },
};

export function citedKeys(docText = '') {
  const keys = new Set();
  for (const match of String(docText).matchAll(/\[@([a-zA-Z0-9_-]+)\]/g)) keys.add(match[1]);
  return [...keys];
}

function nameParts(author = '') {
  const clean = String(author).trim() || 'Unknown Author';
  if (clean.includes(',')) {
    const [family, given = ''] = clean.split(',').map(part => part.trim());
    return { family: family || 'Unknown Author', given };
  }
  const words = clean.split(/\s+/).filter(Boolean);
  return { family: words.pop() || 'Unknown Author', given: words.join(' ') };
}

function initials(given = '') {
  return given.split(/[\s-]+/).filter(Boolean).map(name => `${name[0].toUpperCase()}.`).join(' ');
}

function apaAuthors(authors = []) {
  const formatted = authors.filter(Boolean).map(author => {
    const { family, given } = nameParts(author);
    return `${family}, ${initials(given)}`.trim().replace(/,\s*$/, '');
  });
  if (!formatted.length) return 'Unknown Author';
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
  return `${formatted.slice(0, -1).join(', ')}, & ${formatted.at(-1)}`;
}

function ieeeAuthors(authors = []) {
  const formatted = authors.filter(Boolean).map(author => {
    const { family, given } = nameParts(author);
    return `${initials(given)} ${family}`.trim();
  });
  if (!formatted.length) return 'Unknown Author';
  return formatted.join(', ');
}

function chicagoAuthors(authors = []) {
  const [first, ...rest] = authors.filter(Boolean);
  if (!first) return 'Unknown Author';
  const { family, given } = nameParts(first);
  const firstFormatted = `${family}, ${given}`.trim().replace(/,\s*$/, '');
  if (!rest.length) return firstFormatted;
  return `${firstFormatted}, ${rest.join(', ')}`;
}

function sourceUrl(ref) {
  if (ref.doi) return `https://doi.org/${String(ref.doi).replace(/^https?:\/\/doi\.org\//i, '')}`;
  return ref.url || '';
}

export function formatReference(ref = {}, style = 'apa', index = 1) {
  const title = String(ref.title || 'Untitled work').trim();
  const year = String(ref.year || 'n.d.').trim();
  const journal = String(ref.journal || '').trim();
  const url = sourceUrl(ref);
  const tail = url ? ` ${url}` : '';

  if (style === 'ieee') {
    return `[${index}] ${ieeeAuthors(ref.authors)}. “${title}.”${journal ? ` *${journal}*,` : ''} ${year}.${tail}`.replace(/\s+\./g, '.');
  }
  if (style === 'chicago') {
    return `${chicagoAuthors(ref.authors)}. ${year}. “${title}.”${journal ? ` *${journal}*.` : ''}${tail}`.replace(/\.\s*\./g, '.');
  }
  return `${apaAuthors(ref.authors)} (${year}). ${title}.${journal ? ` *${journal}*.` : ''}${tail}`.replace(/\.\s*\./g, '.');
}

function sortByAuthor(refs) {
  return [...refs].sort((a, b) => {
    const authorA = nameParts(a.authors?.[0]).family;
    const authorB = nameParts(b.authors?.[0]).family;
    return authorA.localeCompare(authorB) || String(a.year || '').localeCompare(String(b.year || '')) || String(a.title || '').localeCompare(String(b.title || ''));
  });
}

export function generateBibliography(docText, references = [], style = 'apa') {
  const keys = citedKeys(docText);
  const current = String(docText);
  if (!keys.length) return { text: current, cited: 0, missing: [] };
  const byKey = new Map(references.map(ref => [ref.citationKey, ref]));
  const known = keys.map(key => byKey.get(key)).filter(Boolean);
  const missing = keys.filter(key => !byKey.has(key));
  const ordered = style === 'ieee' ? known : sortByAuthor(known);
  const entries = ordered.map((ref, index) => `- ${formatReference(ref, style, index + 1)}`);
  missing.forEach(key => entries.push(`- **${key}**: Reference details not found in this vault.`));
  const cleanDoc = current.split(/\n## References\s*(?:\n|$)/i)[0].trim();
  return { text: `${cleanDoc}\n\n## References\n\n${entries.join('\n')}\n`, cited: keys.length, missing };
}
