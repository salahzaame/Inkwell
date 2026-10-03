// The rich note body: notes edited as formatted text, Notion-style, with the
// markdown underneath kept as the stored format (see src/editor/note-schema.js).
//
// Selecting text raises a small toolbar (text style, bold, italic, code, link,
// link-to-note). "/" opens the block menu, "[[" links a note, "[@" cites a paper.
// Sketches, diagrams and images are the same components the classic editor used,
// mounted as node views.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { CellSelection, TableMap, selectedRect } from '@tiptap/pm/tables';
import Suggestion from '@tiptap/suggestion';
import CodeBlock from '@tiptap/extension-code-block';
import { Placeholder } from '@tiptap/extensions';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { Citation, NoteBlockMath, NoteImage, NoteInlineMath, Sketch, Wikilink, noteExtensions } from '../editor/note-schema.js';
import { renderMath } from '../math.js';
import { MERMAID_SNIPPET, diagramErrorMessage } from '../diagrams.js';
import SketchCanvas from './SketchCanvas.jsx';
import MermaidDiagram from './MermaidDiagram.jsx';

// Node views render through TipTap's portals, inside this provider's tree.
const NoteCtx = createContext(null);

/* ── node views ── */

function WikilinkView({ node }) {
  const { onWiki } = useContext(NoteCtx);
  return (
    <NodeViewWrapper
      as="span" className="ink-wiki" data-wiki={node.attrs.name} title={`Open ${node.attrs.name}`}
      onClick={(e) => { e.preventDefault(); onWiki?.(node.attrs.name); }}
    >{node.attrs.name}</NodeViewWrapper>
  );
}

function CitationView({ node }) {
  const { references } = useContext(NoteCtx);
  const ref = references?.find(r => r.citationKey === node.attrs.key);
  return (
    <NodeViewWrapper as="span" className={'ink-cite' + (ref ? '' : ' is-missing')} title={ref ? `${ref.title}${ref.year ? ` (${ref.year})` : ''}` : 'Not in your research library'}>
      @{node.attrs.key}
    </NodeViewWrapper>
  );
}

function ImageView({ node, deleteNode }) {
  const { images, setImageData } = useContext(NoteCtx);
  const { src, alt } = node.attrs;
  const url = src.startsWith('img:') ? images?.[src.slice(4)] : src;
  const remove = () => {
    if (!window.confirm('Remove this image from the note?')) return;
    deleteNode();
    if (src.startsWith('img:')) setImageData?.(src.slice(4), null);
  };
  return (
    <NodeViewWrapper as="figure" className="note-figure ink-figure" contentEditable={false} data-drag-handle>
      {url ? <img src={url} alt={alt || 'note image'} draggable={false} /> : <div className="ink-figure-missing">image missing from this vault</div>}
      {alt && <figcaption>{alt}</figcaption>}
      <span className="note-figure-del" title="Remove image" onMouseDown={(e) => e.preventDefault()} onClick={remove}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </span>
    </NodeViewWrapper>
  );
}

function SketchView({ node, deleteNode }) {
  const { sketches, setSketchData, grid, paper } = useContext(NoteCtx);
  const id = node.attrs.id;
  return (
    <NodeViewWrapper className="ink-sketch" contentEditable={false}>
      <SketchCanvas
        sketchId={id} grid={grid} paper={paper} data={sketches?.[id]}
        onChange={(d) => setSketchData(id, d)}
        onDelete={() => {
          if (!window.confirm(`Delete ${id}.sketch? The drawing will be lost.`)) return;
          deleteNode();
          setSketchData(id, null);
        }}
      />
    </NodeViewWrapper>
  );
}

/** Code blocks; a ```mermaid block shows its diagram, with the source one click away. */
function CodeBlockView({ node, editor, getPos }) {
  const { pal, onCreateSketch, setSketchData } = useContext(NoteCtx);
  const [editing, setEditing] = useState(!node.textContent.trim());
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState(null);
  if (node.attrs.language !== 'mermaid') {
    return <NodeViewWrapper as="pre" className="ink-code"><NodeViewContent as="code" /></NodeViewWrapper>;
  }
  // hand the laid-out diagram to Excalidraw for free-form editing, in place
  const convert = async () => {
    setConverting(true);
    setError(null);
    try {
      const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');
      const { elements, files } = await parseMermaidToExcalidraw(node.textContent.trim());
      const scene = { elements: convertToExcalidrawElements(elements), files: files ?? {} };
      if (!scene.elements.length) throw new Error('That diagram produced no shapes.');
      const id = onCreateSketch();
      setSketchData(id, scene);
      const pos = getPos();
      editor.chain().insertContentAt({ from: pos, to: pos + node.nodeSize }, { type: 'sketch', attrs: { id } }).run();
    } catch (e) {
      setError(diagramErrorMessage(e));
      setConverting(false);
    }
  };
  return (
    <NodeViewWrapper className="ink-mermaid">
      <div contentEditable={false}>
        {node.textContent.trim() ? (
          <MermaidDiagram
            text={node.textContent} pal={pal} converting={converting} onConvertToSketch={convert}
            onSourceToggle={() => setEditing(v => !v)} sourceLabel={editing ? 'Done editing' : 'Edit source'}
          />
        ) : <div className="ink-mermaid-error">Empty diagram — write its Mermaid source below.</div>}
        {error && <div className="ink-mermaid-error">Couldn’t turn that diagram into a sketch — {error}</div>}
      </div>
      {/* always mounted: it is the node's editable content */}
      <pre className="ink-code" style={{ display: editing || !node.textContent.trim() ? 'block' : 'none' }}><NodeViewContent as="code" /></pre>
    </NodeViewWrapper>
  );
}

/**
 * A formula, $x$ inline or $$x$$ as a block: rendered by KaTeX, its LaTeX one
 * click away. A new, empty formula opens straight into its source.
 */
function MathNodeView({ node, updateAttributes, deleteNode, editor, getPos, extension }) {
  const display = extension.name === 'blockMath';
  const [draft, setDraft] = useState(null); // null while showing the rendered formula
  const editing = draft !== null || !node.attrs.latex;
  const source = draft ?? node.attrs.latex;
  // Enter commits and refocuses the editor, which blurs the box: commit once
  const closed = useRef(false);
  if (editing) closed.current = false;

  const commit = () => {
    if (closed.current) return;
    closed.current = true;
    const latex = source.trim();
    setDraft(null);
    if (!latex) { deleteNode(); return; }
    if (latex !== node.attrs.latex) updateAttributes({ latex });
    // caret just after the formula, so writing carries on where it stood
    const after = getPos() + node.nodeSize;
    editor.chain().focus().setTextSelection(Math.min(after, editor.state.doc.content.size)).run();
  };
  const cancel = () => {
    if (closed.current) return;
    closed.current = true;
    setDraft(null);
    if (!node.attrs.latex) deleteNode();
    else editor.commands.focus();
  };

  return (
    <NodeViewWrapper as={display ? 'div' : 'span'} className={display ? 'ink-math-node is-block' : 'ink-math-node'} contentEditable={false}>
      {editing ? (
        <span className="ink-math-edit">
          <textarea
            autoFocus
            rows={display ? Math.max(2, source.split('\n').length) : 1}
            value={source}
            placeholder={display ? 'LaTeX, e.g. W = W_0 + BA' : 'LaTeX, e.g. x^2'}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              // Enter finishes; Shift+Enter breaks a line in a display formula
              if (e.key === 'Enter' && !(display && e.shiftKey)) { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            }}
          />
          {source.trim() && <span className="ink-math-preview" dangerouslySetInnerHTML={{ __html: renderMath(source, display) }} />}
        </span>
      ) : (
        <span
          className="ink-math-render" title="Click to edit the formula"
          // mousedown, not click: ProseMirror redraws the node between press and
          // release, and the browser then never fires a click on it
          onMouseDown={(e) => { if (!editor.isEditable || e.button !== 0) return; e.preventDefault(); setDraft(node.attrs.latex); }}
          dangerouslySetInnerHTML={{ __html: renderMath(node.attrs.latex, display) }}
        />
      )}
    </NodeViewWrapper>
  );
}

// the source box takes its own keys, and a press on the formula opens it:
// ProseMirror must not act on either as well
const ownKeys = {
  stopEvent: ({ event }) => /^(INPUT|TEXTAREA)$/.test(event.target?.tagName)
    || (event.type === 'mousedown' && !!event.target?.closest?.('.ink-math-render')),
};

/* ── #tags: styled where they stand, still plain text in the markdown ── */

const TagHighlight = Extension.create({
  name: 'tagHighlight',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('tagHighlight'),
      props: {
        decorations(state) {
          const decos = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'codeBlock') return false;
            if (!node.isText || node.marks.some(m => m.type.name === 'code')) return undefined;
            for (const m of node.text.matchAll(/(^|\s)(#[\w][\w/-]*)/g)) {
              const from = pos + m.index + m[1].length;
              decos.push(Decoration.inline(from, from + m[2].length, { class: 'ink-tag' }));
            }
            return undefined;
          });
          return DecorationSet.create(state.doc, decos);
        },
      },
    })];
  },
});

/* ── suggestion menus: "/", "[[" and "[@" ── */

/**
 * A suggestion menu whose items and rendering live in React. `bridge` is a
 * stable object the component fills in, so the editor (created once) always
 * reaches the current menu state.
 */
/**
 * Menus open after any character, as in Notion — TipTap's default demands a
 * space first, so "words./" did nothing. Not inside code, and not straight
 * after ":" or "/", so typing a URL or a path never raises one.
 */
function allowMenuAt({ state, range }) {
  const $at = state.doc.resolve(range.from);
  if ($at.parent.type.spec.code || $at.marks().some(m => m.type.name === 'code')) return false;
  const before = range.from > $at.start() ? state.doc.textBetween(range.from - 1, range.from) : '';
  return !/[:/]/.test(before);
}

function suggestionMenu(name, char, bridge) {
  return Extension.create({
    name,
    addProseMirrorPlugins() {
      return [Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey(name),
        char,
        allowedPrefixes: null,
        allow: allowMenuAt,
        allowSpaces: name !== 'slashMenu',
        items: ({ query }) => bridge.items(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: (p) => bridge.open(p),
          onUpdate: (p) => bridge.open(p),
          onKeyDown: ({ event }) => bridge.keydown(event),
          onExit: () => bridge.close(),
        }),
      })];
    },
  });
}

function useMenuBridge() {
  const [menu, setMenu] = useState(null); // { items, command, rect }
  const [active, setActive] = useState(0);
  const live = useRef({ menu: null, active: 0 });
  live.current = { menu, active };
  const bridge = useRef(null);
  if (!bridge.current) {
    bridge.current = {
      items: () => [],
      open: (p) => {
        setMenu({ items: p.items, command: p.command, rect: p.clientRect?.() });
        if (live.current.menu?.items !== p.items) setActive(0);
      },
      close: () => setMenu(null),
      keydown: (event) => {
        const { menu: m, active: a } = live.current;
        if (!m || !m.items.length) return false;
        if (event.key === 'ArrowDown') { setActive((a + 1) % m.items.length); return true; }
        if (event.key === 'ArrowUp') { setActive((a - 1 + m.items.length) % m.items.length); return true; }
        if (event.key === 'Enter' || event.key === 'Tab') { m.command(m.items[a]); return true; }
        if (event.key === 'Escape') { setMenu(null); return true; }
        return false;
      },
    };
  }
  return { bridge: bridge.current, menu, active, setActive };
}

function SuggestionPopup({ title, menu, active, setActive, render }) {
  const listRef = useRef(null);
  // Only a pointer that actually moves may take the highlight. A menu opening
  // under a resting pointer counts as "hover" to the browser, which would steal
  // the highlight from the keyboard: "[[Week" + Enter would link the wrong note.
  const pointer = useRef(null);
  const onPointerMove = (i) => (e) => {
    const at = `${e.screenX},${e.screenY}`;
    if (pointer.current !== null && pointer.current !== at) setActive(i);
    pointer.current = at;
  };
  if (!menu) pointer.current = null;
  // arrow keys move past the visible part of a long menu: follow them
  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active, menu]);
  if (!menu || !menu.items.length || !menu.rect) return null;

  // below the caret when it fits, else above; never taller than the room there
  const GAP = 6, EDGE = 12, IDEAL = 320;
  const r = menu.rect;
  const below = window.innerHeight - r.bottom - GAP - EDGE;
  const above = r.top - GAP - EDGE;
  const up = below < Math.min(IDEAL, 220) && above > below;
  const style = {
    position: 'fixed',
    left: Math.max(EDGE, Math.min(r.left, window.innerWidth - 280 - EDGE)),
    maxHeight: Math.max(120, Math.min(IDEAL, up ? above : below)),
    ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
  };

  // portalled to <body>: the paper sheet clips its overflow
  return createPortal(
    <div className="ink-menu" style={style} ref={listRef}>
      <div className="ink-menu-title">{title}</div>
      {menu.items.map((item, i) => (
        <div
          key={item.id} className={'ink-menu-item' + (i === active ? ' is-active' : '')}
          onMouseDown={(e) => { e.preventDefault(); menu.command(item); }}
          onMouseMove={onPointerMove(i)}
        >{render(item)}</div>
      ))}
    </div>,
    document.body,
  );
}

const MERMAID_BODY = MERMAID_SNIPPET.replace(/^```mermaid\n/, '').replace(/\n```\n*$/, '');

/**
 * Remove the typed "/query", and if the line still has text, open an empty line
 * under its block for the new one — as Notion does. Converting the line itself
 * would turn a whole written sentence into a heading or a code block.
 */
function clearSlash(editor, range) {
  editor.chain().focus().deleteRange(range).run();
  const { $from } = editor.state.selection;
  if ($from.parent.content.size === 0) return;
  const after = $from.after(1); // after the top-level block: a list, quote or paragraph
  editor.chain().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).run();
}

const block = (fn) => (editor, range) => {
  clearSlash(editor, range);
  fn(editor.chain().focus()).run();
};

function slashItems({ onCreateSketch, onPickImage }) {
  return [
    { id: 'text', label: 'Text', glyph: 'Aa', run: block(c => c.setParagraph()) },
    { id: 'h1', label: 'Heading 1', glyph: 'H1', run: block(c => c.setHeading({ level: 1 })) },
    { id: 'h2', label: 'Heading 2', glyph: 'H2', run: block(c => c.setHeading({ level: 2 })) },
    { id: 'h3', label: 'Heading 3', glyph: 'H3', run: block(c => c.setHeading({ level: 3 })) },
    { id: 'bullet', label: 'Bulleted list', glyph: '•', run: block(c => c.toggleBulletList()) },
    { id: 'number', label: 'Numbered list', glyph: '1.', run: block(c => c.toggleOrderedList()) },
    { id: 'todo', label: 'To-do list', glyph: '☑', run: block(c => c.toggleTaskList()) },
    { id: 'table', label: 'Table', glyph: '⊞', run: block(c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })) },
    { id: 'quote', label: 'Quote', glyph: '❝', run: block(c => c.toggleBlockquote()) },
    { id: 'code', label: 'Code block', glyph: '</>', run: block(c => c.setCodeBlock()) },
    { id: 'math', label: 'Formula (LaTeX)', glyph: '∑', run: block(c => c.insertContent({ type: 'blockMath', attrs: { latex: '' } })) },
    { id: 'diagram', label: 'Diagram (Mermaid)', glyph: '◈', run: block(c => c.insertContent({ type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: MERMAID_BODY }] })) },
    { id: 'divider', label: 'Divider', glyph: '—', run: block(c => c.setHorizontalRule()) },
    { id: 'sketch', label: 'Sketch (Excalidraw)', glyph: '✎', run: block(c => c.insertContent({ type: 'sketch', attrs: { id: onCreateSketch() } })) },
    { id: 'image', label: 'Image (or just paste one)', glyph: '▣', run: (editor, range) => { clearSlash(editor, range); onPickImage(); } },
  ];
}

const insertNode = (type, attrs) => (editor, range) => editor.chain().focus().deleteRange(range).insertContent([{ type, attrs }, { type: 'text', text: ' ' }]).run();

/* ── the selection toolbar ── */

const TEXT_STYLES = [
  { id: 'p', label: 'Text', isActive: e => e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList') && !e.isActive('taskList') && !e.isActive('blockquote'), run: c => c.clearNodes() },
  { id: 'h1', label: 'Heading 1', isActive: e => e.isActive('heading', { level: 1 }), run: c => c.toggleHeading({ level: 1 }) },
  { id: 'h2', label: 'Heading 2', isActive: e => e.isActive('heading', { level: 2 }), run: c => c.toggleHeading({ level: 2 }) },
  { id: 'h3', label: 'Heading 3', isActive: e => e.isActive('heading', { level: 3 }), run: c => c.toggleHeading({ level: 3 }) },
  { id: 'ul', label: 'Bulleted list', isActive: e => e.isActive('bulletList'), run: c => c.toggleBulletList() },
  { id: 'ol', label: 'Numbered list', isActive: e => e.isActive('orderedList'), run: c => c.toggleOrderedList() },
  { id: 'todo', label: 'To-do list', isActive: e => e.isActive('taskList'), run: c => c.toggleTaskList() },
  { id: 'quote', label: 'Quote', isActive: e => e.isActive('blockquote'), run: c => c.toggleBlockquote() },
];

function SelectionToolbar({ editor }) {
  const [panel, setPanel] = useState(null); // null | 'style' | 'link'
  const [href, setHref] = useState('');
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'), code: e.isActive('code'), link: e.isActive('link'),
      style: (TEXT_STYLES.find(s => s.id !== 'p' && s.isActive(e)) ?? TEXT_STYLES[0]).label,
    }),
  });
  const keep = (e) => e.preventDefault(); // never steal the selection
  const run = (fn) => { fn(editor.chain().focus()).run(); setPanel(null); };

  const openLink = () => { setHref(editor.getAttributes('link').href || ''); setPanel(p => (p === 'link' ? null : 'link')); };
  const applyLink = () => {
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    (url ? chain.setLink({ href: /^[a-z][\w+.-]*:/i.test(url) ? url : `https://${url}` }) : chain.unsetLink()).run();
    setPanel(null);
  };
  // turn the selected words into a link to the note of that name
  const linkNote = () => {
    const { from, to } = editor.state.selection;
    const name = editor.state.doc.textBetween(from, to, ' ').trim().replace(/[[\]\n]/g, '');
    if (!name) return;
    editor.chain().focus().insertContentAt({ from, to }, { type: 'wikilink', attrs: { name } }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="selectionToolbar"
      options={{ placement: 'top', offset: 8 }}
      // whole cells selected is a table operation: the table toolbar handles it
      shouldShow={({ editor: e, state: s }) => !s.selection.empty && !s.selection.node && !(s.selection instanceof CellSelection) && !e.isActive('codeBlock')}
      className="ink-bubble"
    >
      <div className="ink-bubble-row" onMouseDown={keep}>
        <button type="button" className="ink-bubble-btn ink-bubble-style" onClick={() => setPanel(p => (p === 'style' ? null : 'style'))} title="Turn into">
          {state.style} <span aria-hidden="true">▾</span>
        </button>
        <span className="ink-bubble-sep" />
        <button type="button" className={'ink-bubble-btn' + (state.bold ? ' is-on' : '')} onClick={() => run(c => c.toggleBold())} title="Bold (Ctrl+B)" aria-pressed={state.bold}><b>B</b></button>
        <button type="button" className={'ink-bubble-btn' + (state.italic ? ' is-on' : '')} onClick={() => run(c => c.toggleItalic())} title="Italic (Ctrl+I)" aria-pressed={state.italic}><i>I</i></button>
        <button type="button" className={'ink-bubble-btn' + (state.code ? ' is-on' : '')} onClick={() => run(c => c.toggleCode())} title="Inline code (Ctrl+E)" aria-pressed={state.code}><span className="ink-mono">&lt;/&gt;</span></button>
        <span className="ink-bubble-sep" />
        <button type="button" className={'ink-bubble-btn' + (state.link ? ' is-on' : '')} onClick={openLink} title="Link" aria-pressed={state.link}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
        </button>
        <button type="button" className="ink-bubble-btn" onClick={linkNote} title="Link to a note with this name">[[ ]]</button>
      </div>
      {panel === 'style' && (
        <div className="ink-bubble-panel" onMouseDown={keep}>
          {TEXT_STYLES.map(s => (
            <button key={s.id} type="button" className={'ink-bubble-item' + (state.style === s.label ? ' is-on' : '')} onClick={() => run(s.run)}>{s.label}</button>
          ))}
        </div>
      )}
      {panel === 'link' && (
        <div className="ink-bubble-panel ink-bubble-link">
          <input
            autoFocus value={href} placeholder="Paste a link, or leave empty to remove"
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
              if (e.key === 'Escape') { e.preventDefault(); setPanel(null); editor.commands.focus(); }
            }}
          />
          <button type="button" className="ink-bubble-btn" onMouseDown={keep} onClick={applyLink}>Apply</button>
        </div>
      )}
    </BubbleMenu>
  );
}

/* ── the table toolbar: shown above a table while the caret is in it ── */

/**
 * Run a table command, then put the caret where the reader expects it: in the
 * new cell after an insert, and in the same column (or row) after a delete.
 * Left to itself the table library keeps the caret in the old cell on insert
 * and jumps to the first column on delete, so the next click hits the wrong one.
 * `target(rect)` names the destination [row, col] from the pre-command rect.
 */
function tableCommand(editor, command, target) {
  const before = selectedRect(editor.state);
  const tablePos = before.tableStart - 1; // rows and columns change inside it; it stays put
  if (!command(editor.chain().focus()).run() || !target) return;
  const { state } = editor;
  const table = state.doc.nodeAt(tablePos);
  if (table?.type.name !== 'table') return; // the last row or column went, and the table with it
  const map = TableMap.get(table);
  const [row, col] = target(before);
  const cell = map.map[Math.min(row, map.height - 1) * map.width + Math.min(col, map.width - 1)];
  editor.view.dispatch(state.tr.setSelection(Selection.near(state.doc.resolve(tablePos + 1 + cell + 1))));
}

const TABLE_ACTIONS = [
  { id: 'row-above', text: '+ Row ↑', label: 'Add a row above', run: c => c.addRowBefore(), target: r => [r.top, r.left] },
  { id: 'row-below', text: '+ Row ↓', label: 'Add a row below', run: c => c.addRowAfter(), target: r => [r.bottom, r.left] },
  { id: 'col-left', text: '+ Column ←', label: 'Add a column to the left', run: c => c.addColumnBefore(), target: r => [r.top, r.left] },
  { id: 'col-right', text: '+ Column →', label: 'Add a column to the right', run: c => c.addColumnAfter(), target: r => [r.top, r.right] },
  { sep: true },
  { id: 'del-row', text: '− Row', label: 'Delete this row', danger: true, run: c => c.deleteRow(), target: r => [r.top, r.left] },
  { id: 'del-col', text: '− Column', label: 'Delete this column', danger: true, run: c => c.deleteColumn(), target: r => [r.top, r.left] },
  { id: 'del-table', text: 'Delete table', label: 'Delete the whole table (Ctrl+Z undoes it)', danger: true, run: c => c.deleteTable() },
];

/** The <table> the caret is in, for anchoring the toolbar above it. */
function tableAtSelection(editor) {
  const { node } = editor.view.domAtPos(editor.state.selection.from);
  return (node.nodeType === 1 ? node : node.parentElement)?.closest('table') ?? null;
}

function TableToolbar({ editor }) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableToolbar"
      options={{ placement: 'top-start', offset: 6 }}
      shouldShow={({ editor: e, state: s }) => e.isEditable && e.isActive('table') && (s.selection.empty || s.selection instanceof CellSelection)}
      getReferencedVirtualElement={() => {
        const table = tableAtSelection(editor);
        return table ? { getBoundingClientRect: () => table.getBoundingClientRect(), getClientRects: () => table.getClientRects() } : null;
      }}
      className="ink-bubble ink-table-bar"
    >
      <div className="ink-bubble-row" role="toolbar" aria-label="Table" onMouseDown={(e) => e.preventDefault()}>
        {TABLE_ACTIONS.map((a, i) => (a.sep ? <span key={i} className="ink-bubble-sep" /> : (
          <button
            key={a.id} type="button" title={a.label} aria-label={a.label}
            className={'ink-bubble-btn' + (a.danger ? ' is-danger' : '')}
            onClick={() => tableCommand(editor, a.run, a.target)}
          >{a.text}</button>
        )))}
      </div>
    </BubbleMenu>
  );
}

/* ── the body ── */

export default function NoteBody({
  doc, onDocChange, pal, paper, spell, grid, placeholder,
  onWiki, noteNames = [], references = [],
  images, setImageData, sketches, setSketchData, onCreateSketch,
  onImageFiles, onPickImage, apiRef,
}) {
  const lastEmitted = useRef(doc);
  // latest props for callbacks the editor captured when it was created
  const props = useRef({});
  props.current = { onDocChange, onImageFiles, onPickImage, onCreateSketch, noteNames, references, spell };

  const slash = useMenuBridge();
  const wiki = useMenuBridge();
  const cite = useMenuBridge();
  slash.bridge.items = (q) => {
    const all = slashItems({ onCreateSketch: () => props.current.onCreateSketch(), onPickImage: () => props.current.onPickImage?.() });
    const s = q.toLowerCase();
    return all.filter(c => c.id.startsWith(s) || c.label.toLowerCase().includes(s));
  };
  wiki.bridge.items = (q) => {
    const s = q.trim().toLowerCase();
    const hits = props.current.noteNames.filter(n => n.toLowerCase().includes(s)).slice(0, 8)
      .map(n => ({ id: n, label: n, run: insertNode('wikilink', { name: n }) }));
    if (s && !props.current.noteNames.some(n => n.toLowerCase() === s)) {
      hits.push({ id: '+new', label: q.trim(), isNew: true, run: insertNode('wikilink', { name: q.trim() }) });
    }
    return hits;
  };
  cite.bridge.items = (q) => {
    const s = q.toLowerCase();
    return props.current.references
      .filter(r => r.citationKey && (r.citationKey.toLowerCase().includes(s) || (r.title || '').toLowerCase().includes(s)))
      .slice(0, 8)
      .map(r => ({ id: r.citationKey, ref: r, run: insertNode('citation', { key: r.citationKey }) }));
  };

  const editor = useEditor({
    extensions: noteExtensions({
      wikilink: Wikilink.extend({ addNodeView: () => ReactNodeViewRenderer(WikilinkView) }),
      citation: Citation.extend({ addNodeView: () => ReactNodeViewRenderer(CitationView) }),
      noteImage: NoteImage.extend({ addNodeView: () => ReactNodeViewRenderer(ImageView) }),
      // Excalidraw owns every event inside its canvas
      sketch: Sketch.extend({ addNodeView: () => ReactNodeViewRenderer(SketchView, { stopEvent: () => true }) }),
      codeBlock: CodeBlock.extend({ addNodeView: () => ReactNodeViewRenderer(CodeBlockView) }),
      inlineMath: NoteInlineMath.extend({ addNodeView: () => ReactNodeViewRenderer(MathNodeView, ownKeys) }),
      blockMath: NoteBlockMath.extend({ addNodeView: () => ReactNodeViewRenderer(MathNodeView, ownKeys) }),
      extra: [
        Placeholder.configure({ placeholder: placeholder || 'Type "/" for blocks, or just write…' }),
        TagHighlight,
        suggestionMenu('slashMenu', '/', slash.bridge),
        suggestionMenu('wikiMenu', '[[', wiki.bridge),
        suggestionMenu('citeMenu', '[@', cite.bridge),
      ],
    }),
    content: doc,
    contentType: 'markdown',
    autofocus: doc.trim() === '' ? 'end' : false,
    editorProps: {
      // a function, so a changed spellcheck setting applies on the next update
      attributes: () => ({ class: 'ink-prose-editor', spellcheck: String(!!props.current.spell) }),
      handlePaste: (view, event) => {
        const file = [...(event.clipboardData?.items || [])].find(it => it.type.startsWith('image/'))?.getAsFile();
        if (!file || !props.current.onImageFiles) return false;
        event.preventDefault();
        props.current.onImageFiles([file]);
        return true;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved || !event.dataTransfer?.files?.length || !props.current.onImageFiles) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (at) view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(at.pos))));
        event.preventDefault();
        props.current.onImageFiles(event.dataTransfer.files);
        return true;
      },
      handleClick: (view, pos, event) => {
        const a = event.target.closest?.('a[href]');
        if (!a) return false;
        const href = a.getAttribute('href');
        if (href.startsWith('hl://')) {
          // backlink to a PDF highlight — jump to it instead of navigating
          window.dispatchEvent(new CustomEvent('inkwell:jump-hl', { detail: { id: href.slice(5) } }));
          return true;
        }
        window.open(href, '_blank', 'noopener,noreferrer');
        return true;
      },
    },
    onUpdate: ({ editor: e }) => {
      const md = e.getMarkdown();
      // the empty paragraph TipTap keeps after a final list or table is not an
      // edit: opening a note must never mark it changed
      if (md.trimEnd() === lastEmitted.current.trimEnd()) return;
      lastEmitted.current = md;
      props.current.onDocChange(md);
    },
  }, []);

  // changes made outside the editor (the assistant, bibliography, sketch button)
  useEffect(() => {
    if (!editor || doc === lastEmitted.current) return;
    lastEmitted.current = doc;
    editor.commands.setContent(doc, { contentType: 'markdown', emitUpdate: false });
  }, [doc, editor]);

  useEffect(() => {
    if (!apiRef || !editor) return undefined;
    apiRef.current = {
      insertImage: (id, alt = '') => editor.chain().focus().insertContent({ type: 'noteImage', attrs: { src: `img:${id}`, alt } }).run(),
      insertSketch: (id) => editor.chain().focus().insertContent({ type: 'sketch', attrs: { id } }).run(),
      focusEnd: () => editor.chain().focus('end').run(),
    };
    return () => { apiRef.current = null; };
  }, [apiRef, editor]);

  const edVars = {
    '--ed-ink': pal.ink, '--ed-body': pal.body, '--ed-muted': pal.muted, '--ed-border': pal.border,
    '--ed-card': pal.card, '--ed-code-bg': pal.codeBg, '--ed-head-font': pal.headFont,
  };

  return (
    <NoteCtx.Provider value={{ onWiki, references, images, setImageData, sketches, setSketchData, grid, paper, pal, onCreateSketch }}>
      <div className={'ink-prose' + (paper ? ' is-paper' : '')} style={edVars}>
        <EditorContent editor={editor} />
        {editor && <SelectionToolbar editor={editor} />}
        {editor && <TableToolbar editor={editor} />}
        <SuggestionPopup
          title="Blocks" {...slash}
          render={c => (<><span className="ink-menu-glyph">{c.glyph}</span><span className="ink-menu-label">{c.label}</span><span className="ink-menu-hint">/{c.id}</span></>)}
        />
        <SuggestionPopup
          title="Link a note" {...wiki}
          render={n => (<span className="ink-menu-label">{n.isNew ? <>New note <b>{n.label}</b></> : n.label}</span>)}
        />
        <SuggestionPopup
          title="Citations" {...cite}
          render={r => (
            <span className="ink-menu-cite">
              <span><b>@{r.ref.citationKey}</b> <span className="ink-menu-hint">{r.ref.year}</span></span>
              <span className="ink-menu-sub">{r.ref.title}</span>
            </span>
          )}
        />
      </div>
    </NoteCtx.Provider>
  );
}
