import { useEffect, useRef, useState } from 'react';
import { fmtEdited } from '../data.js';
import { parseBlocks, Inline, toggleTaskInDoc, extractTags, findMentions } from '../markdown.jsx';
import SketchCanvas from './SketchCanvas.jsx';

/* ── palettes: warm "paper" page (Inkwell's signature) vs classic dark ── */
const PAL = {
  dark: {
    ink: '#e7e9ef', body: '#c3c7d1', muted: '#8b90a0', faint: '#5b6170',
    border: '#2c2f37', card: '#1a1c21', codeBg: '#16181d',
    headFont: "'Instrument Sans', system-ui, sans-serif",
  },
  paper: {
    ink: '#26221a', body: '#3f3a2f', muted: '#8a8272', faint: '#a49b86',
    border: '#e0d9c6', card: '#fffdf7', codeBg: '#efe9d9',
    headFont: "'Fraunces', Georgia, serif",
  },
};

const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")";

const SLASH_COMMANDS = [
  { id: 'h1', label: 'Heading 1', glyph: 'H1', snippet: '# ' },
  { id: 'h2', label: 'Heading 2', glyph: 'H2', snippet: '## ' },
  { id: 'h3', label: 'Heading 3', glyph: 'H3', snippet: '### ' },
  { id: 'bullet', label: 'Bulleted list', glyph: '•', snippet: '- ' },
  { id: 'number', label: 'Numbered list', glyph: '1.', snippet: '1. ' },
  { id: 'todo', label: 'To-do list', glyph: '☑', snippet: '- [ ] ' },
  { id: 'table', label: 'Table', glyph: '⊞', snippet: '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|   |   |   |\n|   |   |   |\n', caretOffset: 2 },
  { id: 'quote', label: 'Quote', glyph: '❝', snippet: '> ' },
  { id: 'code', label: 'Code block', glyph: '</>', snippet: '```\n\n```\n', caretOffset: 4 },
  { id: 'divider', label: 'Divider', glyph: '—', snippet: '---\n\n', commitBlock: true },
  { id: 'sketch', label: 'Sketch (Excalidraw)', glyph: '✎', sketch: true, commitBlock: true },
];

/** Pixel position of the textarea caret, via the hidden-mirror technique. */
function caretPos(ta) {
  const s = getComputedStyle(ta);
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;visibility:hidden;top:0;left:0;white-space:pre-wrap;word-wrap:break-word;width:${ta.clientWidth}px;`
    + `font-family:${s.fontFamily};font-size:${s.fontSize};font-weight:${s.fontWeight};line-height:${s.lineHeight};letter-spacing:${s.letterSpacing};`;
  d.textContent = ta.value.slice(0, ta.selectionStart);
  const m = document.createElement('span');
  m.textContent = '​';
  d.appendChild(m);
  ta.parentElement.appendChild(d);
  const pos = { x: m.offsetLeft, y: m.offsetTop + m.offsetHeight + 6 };
  d.remove();
  return pos;
}

const linesOf = (doc) => (doc === '' ? [] : doc.split('\n'));

function RenderedBlock({ b, pal, doc, onDocChange, onWiki }) {
  const pStyle = { fontSize: '15.5px', lineHeight: 1.75, color: pal.body, margin: '0 0 22px' };
  const toggleTask = (ix) => onDocChange(toggleTaskInDoc(doc, ix));

  if (b.t === 'h1') return <h2 style={{ fontSize: '27px', fontWeight: 700, margin: '0 0 12px', letterSpacing: '-.01em', fontFamily: pal.headFont, color: pal.ink }}><Inline text={b.text} onWiki={onWiki} /></h2>;
  if (b.t === 'h2') return <h2 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 12px', letterSpacing: '-.01em', fontFamily: pal.headFont, color: pal.ink }}><Inline text={b.text} onWiki={onWiki} /></h2>;
  if (b.t === 'h3') return <h3 style={{ fontSize: '17.5px', fontWeight: 600, margin: '0 0 10px', fontFamily: pal.headFont, color: pal.ink }}><Inline text={b.text} onWiki={onWiki} /></h3>;
  if (b.t === 'hr') return <div style={{ borderTop: `1px solid ${pal.border}`, margin: '22px 0' }} />;
  if (b.t === 'p') return <p style={pStyle}><Inline text={b.text} onWiki={onWiki} /></p>;
  if (b.t === 'quote') {
    return (
      <blockquote style={{ ...pStyle, padding: '2px 0 2px 14px', borderLeft: '2.5px solid color-mix(in oklab, var(--acc) 55%, transparent)', color: pal.muted }}>
        <Inline text={b.text} onWiki={onWiki} />
      </blockquote>
    );
  }
  if (b.t === 'code') {
    return (
      <pre style={{ background: pal.codeBg, border: `1px solid ${pal.border}`, borderRadius: '10px', padding: '12px 16px', fontSize: '13px', lineHeight: 1.6, color: pal.body, overflowX: 'auto', margin: '0 0 22px', fontFamily: 'ui-monospace, Consolas, monospace' }}>
        {b.text}
      </pre>
    );
  }
  if (b.t === 'table') {
    const cell = { border: `1px solid ${pal.border}`, padding: '7px 12px', textAlign: 'left' };
    return (
      <div style={{ overflowX: 'auto', margin: '0 0 22px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '14px', lineHeight: 1.6 }}>
          <thead>
            <tr>{b.header.map((c, j) => <th key={j} style={{ ...cell, background: pal.card, fontWeight: 600, color: pal.ink }}><Inline text={c} onWiki={onWiki} /></th>)}</tr>
          </thead>
          <tbody>
            {b.rows.map((r, k) => (
              <tr key={k}>{b.header.map((_, j) => <td key={j} style={{ ...cell, color: pal.body }}><Inline text={r[j] ?? ''} onWiki={onWiki} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (b.t === 'list') {
    return (
      <div style={{ margin: '0 0 22px' }}>
        {b.items.map((it, j) => it.task ? (
          <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '5px 0', fontSize: '15.5px', lineHeight: 1.6 }}>
            <span
              data-cb
              onClick={(e) => { e.stopPropagation(); toggleTask(it.taskIx); }}
              style={{
                width: '17px', height: '17px', borderRadius: '5px', flexShrink: 0, marginTop: '3px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: it.done ? 'none' : `1.5px solid ${pal.faint}`,
                background: it.done ? 'var(--acc)' : 'transparent',
              }}
            >
              {it.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>}
            </span>
            <span style={{ color: it.done ? pal.faint : pal.body, textDecoration: it.done ? 'line-through' : 'none' }}>
              <Inline text={it.text} onWiki={onWiki} />
            </span>
          </div>
        ) : (
          <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '3px 0', fontSize: '15.5px', lineHeight: 1.6, color: pal.body }}>
            <span style={{ color: 'var(--acc)', flexShrink: 0, fontSize: b.ordered ? '13px' : '15.5px' }}>{b.ordered ? (j + 1) + '.' : '•'}</span>
            <span><Inline text={it.text} onWiki={onWiki} /></span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function Editor({
  note, crumb, doc, files, docs,
  onDocChange, onWiki, onOpen, onRename, onDelete, onInsertSketch, onCreateSketch, onNewNote,
  spell, grid, paper, accent, sketches, setSketchData,
}) {
  const taRef = useRef(null);
  const caretRef = useRef(null);        // caret to apply after (re)focus: number | 'end'
  const draftCaretRef = useRef(null);   // caret to apply after in-draft edits
  const pendingFocusRef = useRef(null); // { line, pos, virtual? } resolved after doc commits
  const [focus, setFocus] = useState(null); // { idx, virtual, anchorLine }
  const [draft, setDraft] = useState('');
  const [slash, setSlash] = useState(null);
  const [selIx, setSelIx] = useState(0);

  const pal = paper ? PAL.paper : PAL.dark;
  const blocks = parseBlocks(doc);
  const srcOf = (b) => linesOf(doc).slice(b.line0, b.line1).join('\n');

  /* ── focus plumbing ── */

  const resolvePending = (pf, blks) => {
    setSlash(null);
    if (!pf.virtual) {
      const idx = blks.findIndex(b => pf.line >= b.line0 && pf.line < Math.max(b.line1, b.line0 + 1));
      if (idx >= 0) {
        setFocus({ idx, virtual: false, anchorLine: null });
        setDraft(linesOf(doc === pf.doc ? doc : pf.doc ?? doc).slice(blks[idx].line0, blks[idx].line1).join('\n'));
        caretRef.current = pf.pos;
        return;
      }
    }
    let after = blks.findIndex(b => b.line0 >= pf.line);
    if (after === -1) after = blks.length;
    setFocus({ idx: after, virtual: true, anchorLine: Math.min(pf.line, linesOf(pf.doc ?? doc).length) });
    setDraft('');
    caretRef.current = 0;
  };

  const commitDoc = (newDoc, pf) => {
    if (pf) pf.doc = newDoc;
    if (newDoc !== doc) {
      pendingFocusRef.current = pf ?? null;
      if (!pf) setFocus(null);
      onDocChange(newDoc);
    } else if (pf) {
      resolvePending(pf, blocks);
    } else {
      setFocus(null);
    }
  };

  useEffect(() => {
    const pf = pendingFocusRef.current;
    if (!pf) return;
    pendingFocusRef.current = null;
    resolvePending(pf, parseBlocks(doc));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // switching notes: reset editing state; brand-new empty notes start focused
  useEffect(() => {
    setSlash(null);
    if ((docs[note?.id] ?? '') === '' && note) {
      setFocus({ idx: 0, virtual: true, anchorLine: 0 });
      setDraft('');
      caretRef.current = 0;
    } else {
      setFocus(null);
      setDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note && note.id]);

  // apply caret + autosize whenever the active textarea (re)renders
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    if (caretRef.current != null) {
      ta.focus();
      const p = caretRef.current === 'end' ? draft.length : caretRef.current;
      ta.setSelectionRange(p, p);
      caretRef.current = null;
    } else if (draftCaretRef.current != null) {
      ta.setSelectionRange(draftCaretRef.current, draftCaretRef.current);
      draftCaretRef.current = null;
    }
  }, [focus, draft]);

  if (!note) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: '#5b6170' }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></svg>
        <div style={{ fontSize: '14px' }}>No note open</div>
        <div onClick={onNewNote} style={{ fontSize: '13px', color: 'var(--acc)', border: '1px solid color-mix(in oklab, var(--acc) 40%, transparent)', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer' }}>
          Create a note
        </div>
      </div>
    );
  }

  /* ── edit operations ── */

  const replaceBlockLines = (draftText) => {
    const L = linesOf(doc);
    const b = blocks[focus.idx];
    const mid = draftText === '' ? [] : draftText.split('\n');
    return [...L.slice(0, b.line0), ...mid, ...L.slice(b.line1)].join('\n');
  };

  const insertVirtualLines = (draftText) => {
    const L = linesOf(doc);
    const at = Math.min(focus.anchorLine, L.length);
    const before = L.slice(0, at);
    const after = L.slice(at);
    while (before.length && before[before.length - 1].trim() === '') before.pop();
    while (after.length && after[0].trim() === '') after.shift();
    const mid = draftText.split('\n');
    const out = [...before, ...(before.length ? [''] : []), ...mid, ...(after.length ? [''] : []), ...after];
    return { newDoc: out.join('\n'), line0: before.length + (before.length ? 1 : 0) };
  };

  const commitBlur = () => {
    if (!focus) return;
    setSlash(null);
    if (focus.virtual) {
      if (draft.trim() === '') { setFocus(null); return; }
      commitDoc(insertVirtualLines(draft).newDoc, null);
    } else {
      commitDoc(replaceBlockLines(draft), null);
    }
  };

  const focusBlockDirect = (b, pos) => {
    const idx = blocks.indexOf(b);
    if (idx === -1) return;
    setSlash(null);
    setFocus({ idx, virtual: false, anchorLine: null });
    setDraft(srcOf(b));
    caretRef.current = pos;
  };

  /** Commit the current draft (if any), then focus target block `t` (from the current parse). */
  const navTo = (t, pos) => {
    if (!focus) { focusBlockDirect(t, pos); return; }
    if (focus.virtual) {
      if (draft.trim() === '') { setFocus(null); focusBlockDirect(t, pos); return; }
      const { newDoc } = insertVirtualLines(draft);
      const delta = linesOf(newDoc).length - linesOf(doc).length;
      commitDoc(newDoc, { line: t.line0 + (t.line0 >= focus.anchorLine ? delta : 0), pos });
      return;
    }
    const b = blocks[focus.idx];
    if (t === b) return;
    const newDoc = replaceBlockLines(draft);
    const delta = linesOf(newDoc).length - linesOf(doc).length;
    commitDoc(newDoc, { line: t.line0 + (t.line0 >= b.line1 ? delta : 0), pos });
  };

  /** Split the focused block at `head|tail`, focusing the tail (virtual if empty). */
  const splitCommit = (head, tail) => {
    const L = linesOf(doc);
    let before, after;
    if (focus.virtual) {
      const at = Math.min(focus.anchorLine, L.length);
      before = L.slice(0, at);
      after = L.slice(at);
    } else {
      const b = blocks[focus.idx];
      before = L.slice(0, b.line0);
      after = L.slice(b.line1);
    }
    while (before.length && before[before.length - 1].trim() === '') before.pop();
    while (after.length && after[0].trim() === '') after.shift();
    const headLines = head === '' ? [] : head.split('\n');
    const tailLines = tail === '' ? [] : tail.split('\n');
    const seg = [...before];
    if (seg.length && headLines.length) seg.push('');
    seg.push(...headLines);
    if (seg.length) seg.push('');
    const anchor = seg.length;
    seg.push(...tailLines);
    if (tailLines.length && after.length) seg.push('');
    seg.push(...after);
    commitDoc(seg.join('\n'), { line: anchor, pos: 0, virtual: tailLines.length === 0 });
  };

  const insertInDraft = (ta, text) => {
    const c = ta.selectionStart;
    draftCaretRef.current = c + text.length;
    setDraft(draft.slice(0, c) + text + draft.slice(ta.selectionEnd));
  };

  /** Remove a sketch block: drop its fence from the doc and its scene from the vault. */
  const deleteSketchBlock = (b) => {
    if (!window.confirm(`Delete ${b.id}.sketch? The drawing will be lost.`)) return;
    if (focus) { setFocus(null); setSlash(null); }
    const L = linesOf(doc);
    onDocChange([...L.slice(0, b.line0), ...L.slice(b.line1)].join('\n'));
    setSketchData(b.id, null);
  };

  const appendAtEnd = () => {
    const endLine = 1e9;
    if (focus) {
      if (focus.virtual && draft.trim() === '') { taRef.current && taRef.current.focus(); return; }
      const newDoc = focus.virtual ? insertVirtualLines(draft).newDoc : replaceBlockLines(draft);
      commitDoc(newDoc, { line: endLine, pos: 0, virtual: true });
    } else {
      commitDoc(doc, { line: endLine, pos: 0, virtual: true });
    }
  };

  /* ── slash menu ── */

  const filtered = slash
    ? SLASH_COMMANDS.filter(c => c.id.startsWith(slash.query.toLowerCase()) || c.label.toLowerCase().includes(slash.query.toLowerCase()))
    : [];
  const menuIx = Math.min(selIx, Math.max(0, filtered.length - 1));

  const detectSlash = (ta) => {
    const caret = ta.selectionStart;
    const m = ta.value.slice(0, caret).match(/(^|\n)\/([a-zA-Z0-9]*)$/);
    if (m) {
      const start = caret - m[2].length - 1;
      const pos = caretPos(ta);
      setSlash(prev => {
        if (!prev || prev.start !== start) setSelIx(0);
        return { start, query: m[2], x: pos.x, y: pos.y };
      });
    } else {
      setSlash(null);
    }
  };

  const applyCommand = (cmd) => {
    const ta = taRef.current;
    if (!ta || !slash) return;
    const caret = ta.selectionStart;
    const snippet = cmd.sketch ? '```sketch ' + onCreateSketch() + '\n```\n' : cmd.snippet;
    if (cmd.commitBlock) {
      // whole-block inserts (sketch, divider) commit instantly so they render
      // right away, with the caret moving to a fresh block underneath
      const newSrc = (draft.slice(0, slash.start) + snippet + draft.slice(caret)).replace(/\n+$/, '');
      setSlash(null);
      splitCommit(newSrc, '');
      return;
    }
    draftCaretRef.current = slash.start + (cmd.caretOffset ?? snippet.length);
    setSlash(null);
    setDraft(draft.slice(0, slash.start) + snippet + draft.slice(caret));
  };

  /* ── textarea key handling ── */

  const onTaKeyDown = (e) => {
    const ta = e.currentTarget;

    if (slash && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelIx((menuIx + 1) % filtered.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelIx((menuIx - 1 + filtered.length) % filtered.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyCommand(filtered[menuIx]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSlash(null); return; }
    } else if (slash && e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation(); setSlash(null); return;
    }

    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); commitBlur(); return; }

    if (e.key === 'Enter' && !e.shiftKey) {
      const caret = ta.selectionStart;
      const lineStart = draft.lastIndexOf('\n', caret - 1) + 1;
      const lineEndIx = draft.indexOf('\n', caret);
      const curLine = draft.slice(lineStart, lineEndIx === -1 ? draft.length : lineEndIx);
      const lm = curLine.match(/^(\s*)([-*]\s+\[[ xX]\]\s+|[-*]\s+|(\d+)\.\s+|>\s+)(.*)$/);
      if (lm) {
        e.preventDefault();
        if (lm[4].trim() === '') {
          // Enter on an empty item exits the list: drop the marker line, start a new block
          const head = draft.slice(0, lineStart).replace(/\n+$/, '');
          const tail = draft.slice(lineEndIx === -1 ? draft.length : lineEndIx + 1);
          splitCommit(head, tail.replace(/^\n+/, ''));
          return;
        }
        let marker;
        if (/\[[ xX]\]/.test(lm[2])) marker = lm[1] + lm[2].replace(/\[[xX]\]/, '[ ]');
        else if (lm[3]) marker = lm[1] + (parseInt(lm[3], 10) + 1) + '. ';
        else marker = lm[1] + lm[2];
        insertInDraft(ta, '\n' + marker);
        return;
      }
      e.preventDefault();
      const head = draft.slice(0, caret).replace(/\n+$/, '');
      const tail = draft.slice(caret).replace(/^\n+/, '');
      splitCommit(head, tail);
      return;
    }

    if (e.key === 'Backspace' && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      if (focus.virtual) {
        if (draft === '') {
          e.preventDefault();
          const prev = blocks[focus.idx - 1];
          setFocus(null);
          if (prev) focusBlockDirect(prev, 'end');
        }
        return;
      }
      const idx = focus.idx;
      if (idx === 0) return;
      e.preventDefault();
      const prev = blocks[idx - 1];
      const b = blocks[idx];
      const mergeable = !['sketch', 'code', 'hr', 'table'].includes(prev.t);
      if (draft === '' || !mergeable) {
        // delete the (possibly empty) block, or bail out of merging into a fence
        if (draft !== '' && !mergeable) return;
        commitDoc(replaceBlockLines(''), { line: prev.line0, pos: 'end' });
        return;
      }
      const prevSrc = srcOf(prev);
      const L = linesOf(doc);
      const merged = prevSrc + draft;
      const newDoc = [...L.slice(0, prev.line0), ...merged.split('\n'), ...L.slice(b.line1)].join('\n');
      commitDoc(newDoc, { line: prev.line0, pos: prevSrc.length });
      return;
    }

    if (e.key === 'ArrowUp' && draft.lastIndexOf('\n', ta.selectionStart - 1) === -1) {
      const t = blocks[focus.idx - 1];
      if (t) { e.preventDefault(); navTo(t, 'end'); }
      return;
    }
    if (e.key === 'ArrowDown' && draft.indexOf('\n', ta.selectionEnd) === -1) {
      const t = focus.virtual ? blocks[focus.idx] : blocks[focus.idx + 1];
      if (t) { e.preventDefault(); navTo(t, 0); }
    }
  };

  /* ── render ── */

  const tags = extractTags(doc);
  const mentions = findMentions(note.name, files, docs, note.id);

  const editStyleFor = (b) => {
    const base = {
      fontFamily: 'inherit', color: pal.body, fontSize: '15.5px', lineHeight: 1.75, margin: '0 0 22px',
    };
    if (!b) return base;
    if (b.t === 'h1') return { ...base, fontSize: '27px', fontWeight: 700, lineHeight: 1.4, fontFamily: pal.headFont, color: pal.ink, margin: '0 0 12px' };
    if (b.t === 'h2') return { ...base, fontSize: '22px', fontWeight: 600, lineHeight: 1.4, fontFamily: pal.headFont, color: pal.ink, margin: '0 0 12px' };
    if (b.t === 'h3') return { ...base, fontSize: '17.5px', fontWeight: 600, lineHeight: 1.5, fontFamily: pal.headFont, color: pal.ink, margin: '0 0 10px' };
    if (b.t === 'code' || b.t === 'sketch') return { ...base, fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '13px', lineHeight: 1.6 };
    return base;
  };

  const editorNode = (b) => (
    <div key="editor" style={{ position: 'relative' }}>
      <textarea
        ref={taRef}
        className="blk-ta"
        rows={1}
        value={draft}
        spellCheck={spell}
        placeholder={focus && focus.virtual ? 'Type "/" for blocks, or just write…' : ''}
        onChange={(e) => { setDraft(e.target.value); detectSlash(e.target); }}
        onKeyDown={onTaKeyDown}
        onKeyUp={(e) => { if (slash && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) detectSlash(e.target); }}
        onClick={(e) => { if (slash) detectSlash(e.target); }}
        onBlur={() => setTimeout(() => {
          const ae = document.activeElement;
          if (ae !== taRef.current && !(ae && ae.closest && ae.closest('.slash-menu'))) commitBlur();
        }, 90)}
        style={editStyleFor(b)}
      />
      {slash && filtered.length > 0 && (
        <div className="slash-menu" style={{
          position: 'absolute', top: slash.y + 'px', left: `min(${slash.x}px, calc(100% - 250px))`,
          width: '250px', maxHeight: '272px', overflowY: 'auto', zIndex: 30,
          background: '#1e2025', border: '1px solid #2c2f37', borderRadius: '10px',
          boxShadow: '0 16px 44px rgba(0,0,0,.55)', padding: '5px', animation: 'popIn .1s ease-out',
        }}>
          <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: '#5b6170', padding: '5px 9px 4px' }}>Blocks</div>
          {filtered.map((c, i) => (
            <div
              key={c.id}
              onMouseDown={(e) => { e.preventDefault(); applyCommand(c); }}
              onMouseEnter={() => setSelIx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 9px',
                borderRadius: '7px', cursor: 'pointer', fontSize: '13px',
                background: i === menuIx ? '#26292f' : 'transparent',
                color: i === menuIx ? '#dadde5' : '#c3c7d1',
              }}
            >
              <span style={{ width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1c21', border: '1px solid #2c2f37', fontSize: '11px', fontWeight: 600, color: '#8b90a0', fontFamily: 'ui-monospace, Consolas, monospace' }}>{c.glyph}</span>
              <span style={{ flex: 1 }}>{c.label}</span>
              <span style={{ fontSize: '10.5px', color: '#5b6170', fontFamily: 'ui-monospace, Consolas, monospace' }}>/{c.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const items = [];
  blocks.forEach((b, i) => {
    if (focus && !focus.virtual && focus.idx === i) {
      items.push(editorNode(b));
      return;
    }
    if (b.t === 'sketch') {
      items.push(
        <SketchCanvas
          key={b.id}
          sketchId={b.id}
          grid={grid}
          paper={paper}
          data={sketches[b.id]}
          onChange={(d) => setSketchData(b.id, d)}
          onDelete={() => deleteSketchBlock(b)}
        />,
      );
      return;
    }
    items.push(
      <div
        key={b.t + '-' + b.line0}
        onMouseDown={(e) => {
          if (e.target.closest('a, [data-cb]')) return;
          e.preventDefault();
          navTo(b, 'end');
        }}
        style={{ cursor: 'text' }}
      >
        <RenderedBlock b={b} pal={pal} doc={doc} onDocChange={onDocChange} onWiki={onWiki} />
      </div>,
    );
  });
  if (focus && focus.virtual) {
    items.splice(Math.min(focus.idx, items.length), 0, editorNode(null));
  }

  const toolCls = paper ? 'hv-tool-paper' : 'hv-tool';
  const iconBtn = { width: '26px', height: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: pal.muted };

  // on paper, the accent gets inked-down so amber stays readable on cream
  const sheetVars = paper ? { '--acc': `color-mix(in oklab, ${accent} 62%, #3d2f05)` } : {};

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div
        key={note.id}
        style={paper ? {
          maxWidth: '820px', margin: '26px auto 90px', padding: '42px 52px 26px',
          background: '#f6f2e7', borderRadius: '18px', position: 'relative', overflow: 'hidden',
          boxShadow: '0 30px 70px -32px rgba(0,0,0,.65), 0 2px 8px rgba(0,0,0,.35)',
          ...sheetVars,
        } : { maxWidth: '700px', margin: '0 auto', padding: '36px 40px 26px' }}
      >
        {paper && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.38, mixBlendMode: 'multiply', backgroundImage: NOISE }} />}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: pal.faint }}>
              {crumb} <span style={{ margin: '0 4px' }}>/</span> <span style={{ color: pal.muted }}>{note.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onMouseDown={(e) => e.preventDefault()}>
              <div className={toolCls} title="Insert sketch block" onClick={onInsertSketch} style={iconBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 14l2.5-3 2 2.4L15.5 9l2.5 5" /></svg>
              </div>
              <div
                className={toolCls}
                title="Download note (.md)"
                onClick={() => {
                  const blob = new Blob([doc], { type: 'text/markdown' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = note.name.replace(/[\\/:*?"<>|]/g, '-') + '.md';
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                style={iconBtn}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></svg>
              </div>
              <div className={paper ? 'hv-danger-paper' : 'hv-danger'} title="Delete note" onClick={onDelete} style={iconBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></svg>
              </div>
            </div>
          </div>

          <h1
            contentEditable
            suppressContentEditableWarning
            spellCheck={spell}
            onBlur={(e) => onRename(note.id, e.currentTarget.textContent)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            style={{ fontSize: '37px', fontWeight: 700, margin: '0 0 10px', letterSpacing: '-.015em', outline: 'none', fontFamily: pal.headFont, color: pal.ink }}
          >{note.name}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '26px', fontSize: '12.5px', flexWrap: 'wrap' }}>
            {tags.map(tag => (
              <span key={tag} style={{ background: 'color-mix(in oklab, var(--acc) 14%, transparent)', color: 'var(--acc)', padding: '2px 8px', borderRadius: '99px' }}>{tag}</span>
            ))}
            <span style={{ color: pal.faint }}>{fmtEdited(note.mtime)}</span>
          </div>

          {items}

          <div
            style={{ minHeight: blocks.length ? '120px' : '40vh', cursor: 'text' }}
            onMouseDown={(e) => { e.preventDefault(); appendAtEnd(); }}
          />

          {mentions.length > 0 && (
            <div style={{ borderTop: `1px solid ${pal.border}`, paddingTop: '16px', paddingBottom: '20px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: pal.faint, marginBottom: '10px' }}>
                Linked mentions · {mentions.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mentions.map(m => (
                  <div
                    key={m.id}
                    className="hv-card"
                    onClick={() => onOpen(m.id)}
                    style={{ background: pal.card, border: `1px solid ${pal.border}`, borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', fontSize: '13.5px' }}
                  >
                    <span style={{ color: 'var(--acc)', fontWeight: 500 }}>{m.name}</span>
                    <span style={{ color: pal.muted }}> — {m.excerpt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
