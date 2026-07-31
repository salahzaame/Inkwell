// Minimal markdown engine for Inkwell notes.
// Supported: # ## ### headings, paragraphs, - / 1. lists, - [ ] tasks, > quotes,
// --- rules, ``` code fences, ```sketch <id> embeds, and inline **bold**, *italic*,
// `code`, [text](url), [[wikilinks]], #tags.

export { parseBlocks } from './blocks.js';

const INLINE_RX = /(\[\[[^\]]+\]\])|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|((?:^|(?<=\s))#[\w][\w/-]*)/g;

const TAG_STYLE = {
  background: 'color-mix(in oklab, var(--acc) 14%, transparent)', color: 'var(--acc)',
  padding: '1px 7px', borderRadius: '99px', fontSize: '.85em',
};
const LINK_STYLE = {
  color: 'var(--acc)',
  borderBottom: '1px solid color-mix(in oklab, var(--acc) 40%, transparent)',
  textDecoration: 'none',
};

export function Inline({ text, onWiki }) {
  const out = [];
  let last = 0;
  let k = 0;
  for (const m of (text || '').matchAll(INLINE_RX)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const s = m[0];
    if (m[1]) {
      // wikilinks render as plain colored links — the [[brackets]] stay in the source only
      const name = s.slice(2, -2);
      out.push(
        <a key={k++} href="#" style={LINK_STYLE} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onWiki && onWiki(name); }}>
          {name}
        </a>,
      );
    } else if (m[2]) out.push(<strong key={k++}>{s.slice(2, -2)}</strong>);
    else if (m[3]) out.push(<em key={k++}>{s.slice(1, -1)}</em>);
    else if (m[4]) out.push(<code key={k++} style={{ background: 'color-mix(in srgb, currentColor 9%, transparent)', border: '1px solid color-mix(in srgb, currentColor 12%, transparent)', borderRadius: '4px', padding: '1px 5px', fontSize: '.88em', fontFamily: 'ui-monospace, Consolas, monospace' }}>{s.slice(1, -1)}</code>);
    else if (m[5]) {
      const lm = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm[2].startsWith('hl://')) {
        // backlink to a PDF highlight — jump to it instead of navigating
        const hlId = lm[2].slice(5);
        out.push(
          <a
            key={k++} href="#" className="hl-link"
            title="Jump to this highlight in the paper"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('inkwell:jump-hl', { detail: { id: hlId } }));
            }}
          >{lm[1]}</a>,
        );
      } else {
        out.push(<a key={k++} href={lm[2]} target="_blank" rel="noreferrer" style={LINK_STYLE}>{lm[1]}</a>);
      }
    } else if (m[6]) out.push(<span key={k++} style={TAG_STYLE}>{s}</span>);
    last = m.index + s.length;
  }
  if (last < (text || '').length) out.push(text.slice(last));
  return out;
}

/** Flip the ix-th task checkbox in a markdown document. */
export function toggleTaskInDoc(doc, ix) {
  let n = -1;
  return doc.split('\n').map(line => {
    const m = line.match(/^(\s*[-*]\s+)\[([ xX])\](\s+.*)$/);
    if (!m) return line;
    n++;
    if (n !== ix) return line;
    return m[1] + (m[2] === ' ' ? '[x]' : '[ ]') + m[3];
  }).join('\n');
}

export function extractTags(doc) {
  const tags = new Set();
  const clean = (doc || '').replace(/```[\s\S]*?(```|$)/g, '').replace(/^#{1,3}\s.*$/gm, '');
  for (const m of clean.matchAll(/(?:^|\s)(#[\w][\w/-]*)/g)) tags.add(m[1]);
  return [...tags];
}

/** Strip markdown syntax for plain-text contexts (slides, mentions, word counts). */
export function stripInline(text) {
  return (text || '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export function docStats(doc) {
  const noFences = (doc || '').replace(/```[\s\S]*?(```|$)/g, ' ');
  const words = stripInline(noFences).replace(/[#>*|-]/g, ' ').split(/\s+/).filter(Boolean).length;
  const sketches = ((doc || '').match(/```sketch\s/g) || []).length;
  const tasks = ((doc || '').match(/^\s*[-*]\s+\[[ xX]\]/gm) || []).length;
  return { words, sketches, tasks };
}

/** Find notes whose documents mention [[name]], with the first matching line as excerpt. */
export function findMentions(name, files, docs, excludeId) {
  const needle = '[[' + name + ']]';
  const out = [];
  for (const f of files) {
    if (f.folder || f.id === excludeId) continue;
    const doc = docs[f.id] || '';
    if (!doc.includes(needle)) continue;
    const line = doc.split('\n').find(l => l.includes(needle)) || '';
    let excerpt = stripInline(line).replace(/^[\s>#*-]+|\[[ xX]\]\s*/g, '').trim();
    if (excerpt.length > 110) excerpt = excerpt.slice(0, 107) + '…';
    out.push({ id: f.id, name: f.name, excerpt });
  }
  return out;
}

/** Extract [[wikilink]] target names from a document. */
export function extractWikiNames(doc) {
  const names = new Set();
  for (const m of (doc || '').matchAll(/\[\[([^\]]+)\]\]/g)) names.add(m[1]);
  return [...names];
}
