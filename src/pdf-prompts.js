/** Build grounded assistant requests from a passage the researcher selected in the PDF reader. */
export function buildPdfExcerptPrompt({ title = 'this PDF', citationKey = null, text = '', level = 'simple' } = {}) {
  const excerpt = String(text).replace(/\s+/g, ' ').trim().slice(0, 5000);
  const source = citationKey ? ` from "${title}" [@${citationKey}]` : ` from "${title}"`;
  const instruction = level === 'technical'
    ? 'Explain it at a technical level. Define the methods and assumptions, distinguish the authors\' claim from evidence in the excerpt, and flag what cannot be concluded from this passage alone.'
    : 'Explain it in plain language for a researcher new to this topic. Define unfamiliar terms, use a short example if helpful, and distinguish the authors\' claim from evidence in the excerpt.';
  return `I selected this passage${source}:\n\n"${excerpt}"\n\n${instruction} Do not add facts, results, or citations that are not supported by the selected passage or my workspace.`;
}
