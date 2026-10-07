// The rich editor's schema: TipTap's standard nodes plus Inkwell's own syntax.
//
// Notes are stored as markdown, and that stays the source of truth: the AI
// assistant, wikilinks, backlinks, slides, bibliography and export all read it.
// So every node here must survive markdown -> editor -> markdown without loss.
// TipTap's markdown support knows CommonMark + GFM; out of the box it deletes
// `![alt](img:id)` images and escapes `[[wikilinks]]` and `[@citations]` into
// dead text. The nodes below teach it Inkwell's syntax, byte for byte:
//
//   [[Note name]]            wikilink   inline atom, opens the note on click
//   [@citekey]               citation   inline atom, feeds the bibliography
//   ![caption](img:id)       noteImage  block, bytes live in the vault
//   ```sketch id ```         sketch     block atom, an Excalidraw scene
//   $x^2$                    inlineMath inline atom, KaTeX (grammar in src/math.js)
//   $$ ... $$                blockMath  block atom, a display formula
//
// Kept free of JSX and React so `node --test` can round-trip real notes; the
// editor component attaches its node views with `.extend({ addNodeView })`.

import { Extension, InputRule, Node, mergeAttributes, nodePasteRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics';
import { INLINE_MATH_SOURCE, blockMathMarkdown, matchBlockMath, matchInlineMath } from '../math.js';

/**
 * Replace the whole typed match with an inline atom. TipTap's nodeInputRule
 * replaces only the first capture group, which would leave the brackets of
 * `[[Name]]` behind as text around the link.
 */
const atomInputRule = (find, type, getAttributes) => new InputRule({
  find,
  handler: ({ state, range, match }) => {
    state.tr.replaceWith(range.from, range.to, type.create(getAttributes(match)));
  },
});

export const Wikilink = Node.create({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ name: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-wiki]', getAttrs: el => ({ name: el.getAttribute('data-wiki') }) }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-wiki': node.attrs.name, class: 'ink-wiki' }), node.attrs.name],
  renderText: ({ node }) => `[[${node.attrs.name}]]`,
  // typed or pasted [[Name]] becomes a link, not text the serializer would escape
  addInputRules() {
    return [atomInputRule(/\[\[([^\]\n]+)\]\]$/, this.type, m => ({ name: m[1].trim() }))];
  },
  addPasteRules() {
    return [nodePasteRule({ find: /\[\[([^\]\n]+)\]\]/g, type: this.type, getAttributes: m => ({ name: m[1].trim() }) })];
  },
  markdownTokenName: 'wikilink',
  markdownTokenizer: {
    name: 'wikilink',
    level: 'inline',
    start: src => src.indexOf('[['),
    tokenize(src) {
      const m = /^\[\[([^\]\n]+)\]\]/.exec(src);
      if (m) return { type: 'wikilink', raw: m[0], name: m[1].trim() };
      return undefined;
    },
  },
  parseMarkdown: (token, h) => h.createNode('wikilink', { name: token.name }),
  renderMarkdown: node => `[[${node.attrs?.name ?? ''}]]`,
});

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ key: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-cite]', getAttrs: el => ({ key: el.getAttribute('data-cite') }) }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-cite': node.attrs.key, class: 'ink-cite' }), `@${node.attrs.key}`],
  renderText: ({ node }) => `[@${node.attrs.key}]`,
  addInputRules() {
    return [atomInputRule(/\[@([a-zA-Z0-9_-]+)\]$/, this.type, m => ({ key: m[1] }))];
  },
  addPasteRules() {
    return [nodePasteRule({ find: /\[@([a-zA-Z0-9_-]+)\]/g, type: this.type, getAttributes: m => ({ key: m[1] }) })];
  },
  markdownTokenName: 'citation',
  markdownTokenizer: {
    name: 'citation',
    level: 'inline',
    start: src => src.indexOf('[@'),
    tokenize(src) {
      // the same key grammar bibliography.js cites from
      const m = /^\[@([a-zA-Z0-9_-]+)\]/.exec(src);
      if (m) return { type: 'citation', raw: m[0], key: m[1] };
      return undefined;
    },
  },
  parseMarkdown: (token, h) => h.createNode('citation', { key: token.key }),
  renderMarkdown: node => `[@${node.attrs?.key ?? ''}]`,
});

// An image on a line of its own, the only way Inkwell writes one. Block-level so
// it can carry a caption and a remove control like the classic editor's figure.
const IMAGE_LINE = /^!\[([^\]\n]*)\]\((\S+?)\)[ \t]*(?:\n|$)/;

export const NoteImage = Node.create({
  name: 'noteImage',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({ src: { default: '' }, alt: { default: '' } }),
  parseHTML: () => [{ tag: 'figure[data-note-image]', getAttrs: el => ({ src: el.getAttribute('data-src'), alt: el.getAttribute('data-alt') || '' }) }],
  renderHTML: ({ node }) => ['figure', { 'data-note-image': '', 'data-src': node.attrs.src, 'data-alt': node.attrs.alt }],
  markdownTokenName: 'noteImage',
  markdownTokenizer: {
    name: 'noteImage',
    level: 'block',
    start: src => src.search(/^!\[/m),
    tokenize(src) {
      const m = IMAGE_LINE.exec(src);
      if (m) return { type: 'noteImage', raw: m[0], alt: m[1], src: m[2] };
      return undefined;
    },
  },
  parseMarkdown: (token, h) => h.createNode('noteImage', { src: token.src, alt: token.alt }),
  renderMarkdown: node => `![${node.attrs?.alt ?? ''}](${node.attrs?.src ?? ''})`,
});

// ```sketch <id>  ...  ``` — the body is ignored, as parseBlocks ignores it.
const SKETCH_FENCE = /^```sketch[ \t]+(\S+)[^\n]*\n(?:(?!```)[^\n]*\n)*```[ \t]*(?:\n|$)/;

export const Sketch = Node.create({
  name: 'sketch',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({ id: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-sketch]', getAttrs: el => ({ id: el.getAttribute('data-sketch') }) }],
  renderHTML: ({ node }) => ['div', { 'data-sketch': node.attrs.id }],
  markdownTokenName: 'sketch',
  markdownTokenizer: {
    name: 'sketch',
    level: 'block',
    start: src => src.search(/^```sketch/m),
    tokenize(src) {
      const m = SKETCH_FENCE.exec(src);
      if (m) return { type: 'sketch', raw: m[0], id: m[1] };
      return undefined;
    },
  },
  parseMarkdown: (token, h) => h.createNode('sketch', { id: token.id }),
  renderMarkdown: node => '```sketch ' + (node.attrs?.id ?? '') + '\n```',
});

// An inline image in the middle of a sentence, which Inkwell never writes but a
// pasted or imported note might hold. Kept verbatim rather than silently dropped.
export const InlineImage = Node.create({
  name: 'inlineImage',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({ src: { default: '' }, alt: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-inline-image]', getAttrs: el => ({ src: el.getAttribute('data-src'), alt: el.getAttribute('data-alt') || '' }) }],
  renderHTML: ({ node }) => ['span', { 'data-inline-image': '', 'data-src': node.attrs.src, 'data-alt': node.attrs.alt, class: 'ink-raw' }, `![${node.attrs.alt}](${node.attrs.src})`],
  markdownTokenName: 'image',
  parseMarkdown: (token, h) => h.createNode('inlineImage', { src: token.href, alt: token.text || '' }),
  renderMarkdown: node => `![${node.attrs?.alt ?? ''}](${node.attrs?.src ?? ''})`,
});

// TipTap's math nodes, with Inkwell's grammar in place of their own: theirs
// reads "$5 and $10" as a formula and rewrites a one-line $$x$$ over three lines.
export const NoteInlineMath = InlineMath.extend({
  markdownTokenizer: {
    name: 'inlineMath',
    level: 'inline',
    start: src => src.indexOf('$'),
    tokenize(src) {
      const m = matchInlineMath(src);
      if (m) return { type: 'inlineMath', raw: m[0], latex: m[1] };
      return undefined;
    },
  },
  renderMarkdown: node => `$${node.attrs?.latex ?? ''}$`,
  // typing the closing $ of "$x^2$" makes the formula, as it would read back
  addInputRules() {
    return [
      ...(this.parent?.() ?? []),
      new InputRule({
        find: new RegExp(INLINE_MATH_SOURCE + '$'),
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, this.type.create({ latex: match[1] }));
        },
      }),
    ];
  },
});

export const NoteBlockMath = BlockMath.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // how the source wrote it, so the round trip keeps $$x$$ on one line
      oneLine: { default: false, rendered: false },
    };
  },
  markdownTokenizer: {
    name: 'blockMath',
    level: 'block',
    start: src => src.search(/^\$\$/m),
    tokenize(src) {
      const m = matchBlockMath(src);
      if (m) return { type: 'blockMath', ...m };
      return undefined;
    },
  },
  parseMarkdown: (token, h) => h.createNode('blockMath', { latex: token.latex, oneLine: token.oneLine }),
  renderMarkdown: node => blockMathMarkdown(node.attrs?.latex ?? '', node.attrs?.oneLine),
});

/** Backslash the opening $ of anything in plain text that would read back as math. */
export const escapeMathDollars = text => text.replace(new RegExp(INLINE_MATH_SOURCE, 'g'), m => '\\' + m);

// Text the reader typed as "$a$" (or loaded as "\$a$") is not a formula, and
// must not become one when the note is saved and reopened. TipTap's serializer
// escapes * _ ` [ ] ~ in text but not $, so add it, only where it matters.
const MathSafeText = Extension.create({
  name: 'mathSafeText',
  // before, not on, create: TipTap emits create on a timer, after a first save
  onBeforeCreate() {
    const manager = this.editor.markdown;
    if (!manager?.escapeMarkdownSyntax) return;
    const escape = manager.escapeMarkdownSyntax.bind(manager);
    manager.escapeMarkdownSyntax = text => escapeMathDollars(escape(text));
  },
});

/**
 * Every extension the note editor uses. `overrides` swaps in node-view-bearing
 * versions from the React component, by name, without changing the schema.
 */
export function noteExtensions(overrides = {}) {
  const pick = (ext) => overrides[ext.name] ?? ext;
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // no markdown of their own that Inkwell's renderers (slides, AI context,
      // backlinks) understand, so they would surface as raw syntax elsewhere
      underline: false,
      strike: false,
      link: { openOnClick: false, autolink: true, protocols: ['hl'] },
      codeBlock: overrides.codeBlock ? false : undefined,
    }),
    ...(overrides.codeBlock ? [overrides.codeBlock] : []),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    pick(Wikilink),
    pick(Citation),
    pick(NoteImage),
    pick(Sketch),
    pick(NoteInlineMath),
    pick(NoteBlockMath),
    InlineImage,
    Markdown,
    MathSafeText,
    ...(overrides.extra ?? []),
  ];
}
