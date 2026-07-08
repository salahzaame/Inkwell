import { useEffect, useRef, useState } from 'react';
import { fmtEdited } from '../data.js';
import { parseBlocks, Inline, toggleTaskInDoc, extractTags, findMentions } from '../markdown.jsx';
import SketchCanvas from './SketchCanvas.jsx';

const P_STYLE = { fontSize: '15.5px', lineHeight: 1.75, color: '#c3c7d1', margin: '0 0 22px' };
const H2_STYLE = { fontSize: '21px', fontWeight: 600, margin: '0 0 12px', letterSpacing: '-.01em' };
const H3_STYLE = { fontSize: '17px', fontWeight: 600, margin: '0 0 10px', letterSpacing: '-.01em' };
const CELL = { border: '1px solid #2c2f37', padding: '7px 12px', textAlign: 'left' };

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
  { id: 'divider', label: 'Divider', glyph: '—', snippet: '---\n\n' },
  { id: 'sketch', label: 'Sketch (Excalidraw)', glyph: '✎', sketch: true },
];

/** Pixel position of the textarea caret, via the hidden-mirror technique. */
function caretPos(ta) {
  const s = getComputedStyle(ta);
  const d = document.createElement('div');
  d.style.cssText = `position:absolute;visibility:hidden;top:0;left:0;white-space:pre-wrap;word-wrap:break-word;width:${ta.clientWidth}px;`
    + `font-family:${s.fontFamily};font-size:${s.fontSize};line-height:${s.lineHeight};letter-spacing:${s.letterSpacing};`;
  d.textContent = ta.value.slice(0, ta.selectionStart);
  const m = document.createElement('span');
  m.textContent = '​';
  d.appendChild(m);
  ta.parentElement.appendChild(d);
  const pos = { x: m.offsetLeft, y: m.offsetTop + m.offsetHeight + 6 };
  d.remove();
  return pos;
}

function iconBtn(active) {
  return {
    width: '26px', height: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
    color: active ? 'var(--acc)' : '#8b90a0',
    background: active ? 'color-mix(in oklab, var(--acc) 14%, transparent)' : 'transparent',
  };
}

function Blocks({ blocks, doc, onDocChange, onWiki, grid, sketches, setSketchData }) {
  const toggleTask = (ix) => onDocChange(toggleTaskInDoc(doc, ix));

  return blocks.map((b, i) => {
    if (b.t === 'h1') return <h2 key={i} style={{ ...H2_STYLE, fontSize: '25px' }}><Inline text={b.text} onWiki={onWiki} /></h2>;
    if (b.t === 'h2') return <h2 key={i} style={H2_STYLE}><Inline text={b.text} onWiki={onWiki} /></h2>;
    if (b.t === 'h3') return <h3 key={i} style={H3_STYLE}><Inline text={b.text} onWiki={onWiki} /></h3>;
    if (b.t === 'hr') return <div key={i} style={{ borderTop: '1px solid #2c2f37', margin: '22px 0' }} />;
    if (b.t === 'p') return <p key={i} style={P_STYLE}><Inline text={b.text} onWiki={onWiki} /></p>;
    if (b.t === 'quote') {
      return (
        <blockquote key={i} style={{ ...P_STYLE, margin: '0 0 22px', padding: '2px 0 2px 14px', borderLeft: '2.5px solid color-mix(in oklab, var(--acc) 55%, transparent)', color: '#9aa0af' }}>
          <Inline text={b.text} onWiki={onWiki} />
        </blockquote>
      );
    }
    if (b.t === 'code') {
      return (
        <pre key={i} style={{ background: '#1a1c21', border: '1px solid #2c2f37', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', lineHeight: 1.6, color: '#c3c7d1', overflowX: 'auto', margin: '0 0 22px' }}>
          {b.text}
        </pre>
      );
    }
    if (b.t === 'table') {
      return (
        <div key={i} style={{ overflowX: 'auto', margin: '0 0 22px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '14px', lineHeight: 1.6 }}>
            <thead>
              <tr>
                {b.header.map((c, j) => (
                  <th key={j} style={{ ...CELL, background: '#1a1c21', fontWeight: 600, color: '#dadde5' }}><Inline text={c} onWiki={onWiki} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, k) => (
                <tr key={k}>
                  {b.header.map((_, j) => (
                    <td key={j} style={{ ...CELL, color: '#c3c7d1' }}><Inline text={r[j] ?? ''} onWiki={onWiki} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (b.t === 'sketch') {
      return (
        <SketchCanvas
          key={b.id}
          sketchId={b.id}
          grid={grid}
          data={sketches[b.id]}
          onChange={(d) => setSketchData(b.id, d)}
        />
      );
    }
    if (b.t === 'list') {
      return (
        <div key={i} style={{ margin: '0 0 22px' }}>
          {b.items.map((it, j) => it.task ? (
            <div key={j} onClick={() => toggleTask(it.taskIx)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '5px 0', cursor: 'pointer', fontSize: '15.5px', lineHeight: 1.6 }}>
              <span style={{
                width: '17px', height: '17px', borderRadius: '5px', flexShrink: 0, marginTop: '3px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: it.done ? 'none' : '1.5px solid #4a4f5c',
                background: it.done ? 'var(--acc)' : 'transparent',
              }}>
                {it.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#17181c" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>}
              </span>
              <span style={{ color: it.done ? '#5b6170' : '#c3c7d1', textDecoration: it.done ? 'line-through' : 'none' }}>
                <Inline text={it.text} onWiki={onWiki} />
              </span>
            </div>
          ) : (
            <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '3px 0', fontSize: '15.5px', lineHeight: 1.6, color: '#c3c7d1' }}>
              <span style={{ color: 'var(--acc)', flexShrink: 0, fontSize: b.ordered ? '13px' : '15.5px' }}>{b.ordered ? (j + 1) + '.' : '•'}</span>
              <span><Inline text={it.text} onWiki={onWiki} /></span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  });
}

export default function Editor({
  note, crumb, doc, files, docs,
  editMode, setEditMode, onDocChange, onWiki, onOpen, onRename, onDelete, onInsertSketch, onCreateSketch, onNewNote,
  spell, grid, sketches, setSketchData,
}) {
  const taRef = useRef(null);
  const pendingCaret = useRef(null);
  const [slash, setSlash] = useState(null); // { start, query, x, y }
  const [selIx, setSelIx] = useState(0);

  useEffect(() => {
    const el = taRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.max(280, el.scrollHeight) + 'px'; }
  }, [doc, editMode, note && note.id]);

  useEffect(() => {
    if (pendingCaret.current != null && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [doc]);

  useEffect(() => { setSlash(null); }, [note && note.id, editMode]);

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

  const tags = extractTags(doc);
  const mentions = findMentions(note.name, files, docs, note.id);
  const blocks = parseBlocks(doc);

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
    const before = doc.slice(0, slash.start);
    const after = doc.slice(caret);
    pendingCaret.current = before.length + (cmd.caretOffset ?? snippet.length);
    setSlash(null);
    onDocChange(before + snippet + after);
  };

  const onTaKeyDown = (e) => {
    if (!slash || filtered.length === 0) {
      if (slash && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSlash(null); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelIx((menuIx + 1) % filtered.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelIx((menuIx - 1 + filtered.length) % filtered.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyCommand(filtered[menuIx]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSlash(null); }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div key={note.id} style={{ maxWidth: '700px', margin: '0 auto', padding: '36px 40px 120px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: '#5b6170' }}>
            {crumb} <span style={{ margin: '0 4px' }}>/</span> <span style={{ color: '#8b90a0' }}>{note.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <div className="hv-tool" title={editMode ? 'Preview' : 'Edit markdown'} onClick={() => setEditMode(!editMode)} style={iconBtn(editMode)}>
              {editMode
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.6" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l3.5-1L20 6.5a2.12 2.12 0 0 0-3-3L3.5 17z" /></svg>}
            </div>
            <div className="hv-tool" title="Insert sketch block" onClick={onInsertSketch} style={iconBtn(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 14l2.5-3 2 2.4L15.5 9l2.5 5" /></svg>
            </div>
            <div
              className="hv-tool"
              title="Download note (.md)"
              onClick={() => {
                const blob = new Blob([doc], { type: 'text/markdown' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = note.name.replace(/[\\/:*?"<>|]/g, '-') + '.md';
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              style={iconBtn(false)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></svg>
            </div>
            <div className="hv-danger" title="Delete note" onClick={onDelete} style={{ ...iconBtn(false), color: '#5b6170' }}>
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
          style={{ fontSize: '34px', fontWeight: 700, margin: '0 0 10px', letterSpacing: '-.02em', outline: 'none' }}
        >{note.name}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '26px', fontSize: '12.5px', flexWrap: 'wrap' }}>
          {tags.map(tag => (
            <span key={tag} style={{ background: 'color-mix(in oklab, var(--acc) 14%, transparent)', color: 'var(--acc)', padding: '2px 8px', borderRadius: '99px' }}>{tag}</span>
          ))}
          <span style={{ color: '#5b6170' }}>{fmtEdited(note.mtime)}</span>
        </div>

        {editMode ? (
          <div style={{ position: 'relative' }}>
            <textarea
              ref={taRef}
              value={doc}
              spellCheck={spell}
              onChange={(e) => { onDocChange(e.target.value); detectSlash(e.target); }}
              onKeyDown={onTaKeyDown}
              onKeyUp={(e) => { if (slash && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) detectSlash(e.target); }}
              onClick={(e) => { if (slash) detectSlash(e.target); }}
              onBlur={() => setTimeout(() => setSlash(null), 150)}
              placeholder={'Write markdown — type "/" for blocks…\n\n# Heading\n**bold** · *italic* · `code` · [[Wikilink]] · #tag\n- [ ] task'}
              style={{
                width: '100%', minHeight: '280px', resize: 'none', background: 'transparent',
                border: 'none', outline: 'none', color: '#c3c7d1',
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                fontSize: '13.5px', lineHeight: 1.7, padding: 0,
              }}
            />
            {slash && filtered.length > 0 && (
              <div style={{
                position: 'absolute', top: slash.y + 'px', left: `min(${slash.x}px, calc(100% - 250px))`,
                width: '250px', maxHeight: '272px', overflowY: 'auto', zIndex: 20,
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
                    <span style={{
                      width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#1a1c21', border: '1px solid #2c2f37',
                      fontSize: '11px', fontWeight: 600, color: '#8b90a0',
                      fontFamily: 'ui-monospace, Consolas, monospace',
                    }}>{c.glyph}</span>
                    <span style={{ flex: 1 }}>{c.label}</span>
                    <span style={{ fontSize: '10.5px', color: '#5b6170', fontFamily: 'ui-monospace, Consolas, monospace' }}>/{c.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {blocks.length === 0 && (
              <p style={{ ...P_STYLE, color: '#5b6170' }}>
                Nothing here yet — hit the <span style={{ color: '#8b90a0' }}>✎ edit</span> button above to start writing.
              </p>
            )}
            <Blocks
              blocks={blocks} doc={doc} onDocChange={onDocChange} onWiki={onWiki}
              grid={grid} sketches={sketches} setSketchData={setSketchData}
            />
            {mentions.length > 0 && (
              <div style={{ marginTop: '44px', borderTop: '1px solid #2c2f37', paddingTop: '16px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: '#5b6170', marginBottom: '10px' }}>
                  Linked mentions · {mentions.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {mentions.map(m => (
                    <div
                      key={m.id}
                      className="hv-card"
                      onClick={() => onOpen(m.id)}
                      style={{ background: '#1a1c21', border: '1px solid #2c2f37', borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', fontSize: '13.5px' }}
                    >
                      <span style={{ color: 'var(--acc)', fontWeight: 500 }}>{m.name}</span>
                      <span style={{ color: '#8b90a0' }}> — {m.excerpt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
