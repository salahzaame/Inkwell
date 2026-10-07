import './helpers/dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Editor } from '@tiptap/core';
import { matchBlockMath, matchInlineMath, renderMath } from '../src/math.js';
import { parseBlocks } from '../src/blocks.js';
import { noteExtensions } from '../src/editor/note-schema.js';

const editorFor = (markdown) => new Editor({ extensions: noteExtensions(), content: markdown, contentType: 'markdown' });
const roundTrip = (markdown) => {
  const editor = editorFor(markdown);
  const out = editor.getMarkdown();
  editor.destroy();
  return out;
};
const nodesOf = (markdown) => {
  const editor = editorFor(markdown);
  const types = [];
  editor.state.doc.descendants(n => { types.push(n.type.name); });
  editor.destroy();
  return types;
};

test('inline math follows Pandoc: formulas yes, prices no', () => {
  assert.deepEqual(matchInlineMath('$E = mc^2$ is famous'), ['$E = mc^2$', 'E = mc^2']);
  assert.deepEqual(matchInlineMath(String.raw`$\alpha_{t} \in \mathbb{R}$`), [String.raw`$\alpha_{t} \in \mathbb{R}$`, String.raw`\alpha_{t} \in \mathbb{R}`]);
  assert.equal(matchInlineMath('$5 and $10'), null, 'closing $ after a space');
  assert.equal(matchInlineMath('$ x$'), null, 'opening $ before a space');
  assert.equal(matchInlineMath('$5$0'), null, 'closing $ before a digit');
  assert.equal(matchInlineMath('$$x$$'), null, 'display math is not inline');
});

test('display math is found on one line or across lines', () => {
  assert.deepEqual(matchBlockMath('$$x^2$$\nnext'), { raw: '$$x^2$$\n', latex: 'x^2', oneLine: true });
  assert.deepEqual(matchBlockMath('$$\nW = W_0 + BA\n$$\n'), { raw: '$$\nW = W_0 + BA\n$$\n', latex: 'W = W_0 + BA', oneLine: false });
  assert.equal(matchBlockMath('$$x$$ and more words'), null);
});

test('a formula KaTeX cannot parse renders as visible source, never throws', () => {
  assert.match(renderMath(String.raw`\frac{1`), /katex-error/);
  assert.match(renderMath('x^2', true), /katex-display/);
});

test('the classic view parses display math as its own block', () => {
  const blocks = parseBlocks('Intro line\n$$\n\\sum_i x_i\n$$\nAfter.\n\n$$y = 1$$');
  assert.deepEqual(blocks.map(({ line0, line1, ...b }) => b), [
    { t: 'p', text: 'Intro line' },
    { t: 'math', tex: '\\sum_i x_i' },
    { t: 'p', text: 'After.' },
    { t: 'math', tex: 'y = 1' },
  ]);
});

const MATH_NOTE = String.raw`## LoRA

The update is $\Delta W = BA$ with rank $r \ll d$, between $5 and $10 per run.

$$
h = W_0 x + \Delta W x = W_0 x + BAx
$$

$$\mathcal{L}(\theta) = -\sum_t \log p_\theta(y_t)$$

Code stays code: ` + '`$not math$`.';

test('formulas are written back byte for byte in the rich editor', () => {
  assert.equal(roundTrip(MATH_NOTE), MATH_NOTE);
});

test('formulas become math nodes; prices and code stay text', () => {
  const types = nodesOf(MATH_NOTE);
  assert.equal(types.filter(t => t === 'inlineMath').length, 2);
  assert.equal(types.filter(t => t === 'blockMath').length, 2);
});

test('literal dollars in text are escaped so they never reopen as a formula', () => {
  const editor = editorFor('placeholder');
  editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'the $a$ variable' }] }] });
  const saved = editor.getMarkdown();
  editor.destroy();
  assert.equal(saved, String.raw`the \$a$ variable`);
  assert.deepEqual(nodesOf(saved).filter(t => t === 'inlineMath'), []);
  assert.equal(roundTrip(saved), saved);
});
