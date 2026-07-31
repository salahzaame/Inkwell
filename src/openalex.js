/** Build a bounded OpenAlex works search URL from researcher-facing triage controls. */
export function normalizePublicationYear(value = '') {
  const text = String(value).trim();
  return /^\d{4}$/.test(text) && Number(text) >= 1000 && Number(text) <= 9999 ? text : '';
}

export function buildOpenAlexWorksUrl(query, { openAccessOnly = false, fromYear = '', toYear = '', sort = 'relevance' } = {}) {
  const params = new URLSearchParams({ search: String(query || '').trim(), per_page: '12' });
  const filters = [];
  const from = normalizePublicationYear(fromYear);
  const to = normalizePublicationYear(toYear);
  if (openAccessOnly) filters.push('is_oa:true');
  if (from) filters.push(`from_publication_date:${from}-01-01`);
  if (to) filters.push(`to_publication_date:${to}-12-31`);
  if (filters.length) params.set('filter', filters.join(','));
  if (sort === 'cited') params.set('sort', 'cited_by_count:desc');
  if (sort === 'recent') params.set('sort', 'publication_date:desc');
  return `https://api.openalex.org/works?${params.toString()}`;
}
