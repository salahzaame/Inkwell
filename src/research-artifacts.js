import { paperIdOf } from './highlights.js';

function citation(ref) {
  return ref.citationKey ? `[@${ref.citationKey}]` : 'Citation key unavailable';
}

function tableCell(value = '') {
  return String(value).replace(/[|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function orderedReferences(references) {
  const rank = { reading: 0, done: 1, toread: 2 };
  return [...references].sort((a, b) => (rank[a.status || 'toread'] ?? 3) - (rank[b.status || 'toread'] ?? 3));
}

export function researchStats(references = [], highlights = {}) {
  return {
    papers: references.length,
    reading: references.filter(ref => ref.status === 'reading').length,
    finished: references.filter(ref => ref.status === 'done').length,
    highlights: Object.values(highlights).reduce((total, list) => total + (list?.length || 0), 0),
  };
}

export function buildLiteratureMap({ references = [], highlights = {}, dateLabel = '' } = {}) {
  const stats = researchStats(references, highlights);
  const name = `Literature map${dateLabel ? ` ${dateLabel}` : ''}`;
  const lines = [
    `# ${name}`,
    '',
    '## Working set',
    `- ${stats.papers} saved papers`,
    `- ${stats.reading} currently reading`,
    `- ${stats.finished} finished`,
    `- ${stats.highlights} saved highlights`,
    '',
    '## Papers',
  ];
  for (const ref of orderedReferences(references)) {
    const paperHighlights = highlights[paperIdOf(ref)] || [];
    lines.push(
      '',
      `### ${ref.title || 'Untitled paper'}`,
      `- **Status:** ${ref.status || 'toread'}`,
      `- **Citation:** ${citation(ref)}`,
      (ref.tags || []).length ? `- **Tags:** ${(ref.tags || []).map(tag => `#${tag}`).join(', ')}` : '',
      `- **Authors:** ${(ref.authors || []).join(', ') || 'Unknown'}`,
      `- **Year:** ${ref.year || 'n.d.'}`,
      ref.url ? `- **Source:** ${ref.url}` : '',
      ref.abstract ? `\n${ref.abstract}` : '',
    );
    if (paperHighlights.length) {
      lines.push('\n#### Saved highlights');
      paperHighlights.forEach(highlight => lines.push(`> ${highlight.text}\n> — ${citation(ref)}, p. ${highlight.page}`));
    }
  }
  lines.push('', '## Synthesis prompts', '- Where do the papers agree?', '- What remains uncertain?', '- Which claim needs stronger evidence?');
  return { name, content: lines.filter(Boolean).join('\n') + '\n' };
}

export function buildEvidenceMatrix({ references = [], highlights = {}, dateLabel = '' } = {}) {
  const name = `Evidence matrix${dateLabel ? ` ${dateLabel}` : ''}`;
  const lines = [
    `# ${name}`,
    '',
    '> This matrix collects only information saved in this vault. It does not infer findings; add your interpretation in the notes column.',
    '',
    '## At a glance',
    '| Paper | Status | Saved evidence | Metadata gaps |',
    '| --- | --- | --- | --- |',
  ];
  for (const ref of orderedReferences(references)) {
    const paperHighlights = highlights[paperIdOf(ref)] || [];
    const gaps = [!ref.abstract && 'abstract', !ref.doi && 'DOI', !ref.pdfUrl && 'full text'].filter(Boolean).join(', ') || 'none recorded';
    lines.push(`| ${tableCell(ref.title || 'Untitled paper')} (${citation(ref)}) | ${tableCell(ref.status || 'toread')} | ${paperHighlights.length} saved highlight${paperHighlights.length === 1 ? '' : 's'} | ${gaps} |`);
  }
  lines.push('', '## Evidence notes');
  for (const ref of orderedReferences(references)) {
    const paperHighlights = highlights[paperIdOf(ref)] || [];
    lines.push('', `### ${ref.title || 'Untitled paper'}`, `- **Citation:** ${citation(ref)}`, `- **Authors / year:** ${(ref.authors || []).join(', ') || 'Unknown'} · ${ref.year || 'n.d.'}`, `- **Abstract recorded:** ${ref.abstract ? 'Yes' : 'No'}`);
    if (paperHighlights.length) {
      lines.push('- **Direct excerpts:**');
      paperHighlights.forEach(highlight => lines.push(`  > ${highlight.text}\n  > — p. ${highlight.page}`));
    } else {
      lines.push('- **Direct excerpts:** none saved yet.');
    }
    lines.push('- **My interpretation:**');
  }
  return { name, content: lines.join('\n') + '\n' };
}
