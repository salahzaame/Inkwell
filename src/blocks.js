// Block-level markdown parsing for Inkwell notes.
// Kept in a plain .js module (no JSX) so it is directly testable under `node --test`;
// markdown.jsx re-exports parseBlocks for existing callers.

// a table needs its header row plus the |---|---| separator on the next line
function isTableStart(lines, i) {
  return /^\s*\|.*\|\s*$/.test(lines[i] || '') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]);
}

// lines that end a running paragraph because they open a block of their own
const BLOCK_START_RX = /^(#{1,3}\s|```|>\s?|---+\s*$|!\[|\s*([-*]|\d+\.)\s+)/;

export function parseBlocks(text) {
  const lines = (text || '').split('\n');
  const blocks = [];
  let i = 0;
  let taskIx = 0;
  // every block records its source line range [line0, line1) so the editor can
  // map rendered blocks back onto the raw document
  const push = (b, line0) => {
    b.line0 = line0;
    b.line1 = Math.min(i, lines.length);
    blocks.push(b);
  };
  while (i < lines.length) {
    const start = i;
    const l = lines[i];
    if (/^```/.test(l)) {
      const m = l.match(/^```sketch\s+(\S+)/);
      i++;
      const buf = [];
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      push(m ? { t: 'sketch', id: m[1] } : { t: 'code', text: buf.join('\n') }, start);
      continue;
    }
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) { i++; push({ t: 'h' + h[1].length, text: h[2] }, start); continue; }
    if (/^---+\s*$/.test(l)) { i++; push({ t: 'hr' }, start); continue; }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      push({ t: 'quote', text: buf.join(' ') }, start);
      continue;
    }
    if (isTableStart(lines, i)) {
      const parseRow = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const header = parseRow(l);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(parseRow(lines[i])); i++; }
      push({ t: 'table', header, rows }, start);
      continue;
    }
    const im = l.match(/^!\[([^\]]*)\]\((\S+)\)\s*$/);
    if (im) { i++; push({ t: 'image', alt: im[1], src: im[2] }, start); continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\.\s+/.test(l);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const li = lines[i];
        const tm = li.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (tm) items.push({ task: true, done: tm[1] !== ' ', text: tm[2], taskIx: taskIx++ });
        else items.push({ text: li.replace(/^\s*([-*]|\d+\.)\s+/, '') });
        i++;
      }
      push({ t: 'list', ordered, items }, start);
      continue;
    }
    if (l.trim() === '') { i++; continue; }
    const buf = [l];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !isTableStart(lines, i) && !BLOCK_START_RX.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    push({ t: 'p', text: buf.join(' ') }, start);
  }
  return blocks;
}
