// LaTeX math in notes: `$x^2$` inline, `$$ ... $$` on lines of their own for a
// display formula. One grammar, shared by the rich editor's tokenizer, the
// classic renderer and the block parser, so a formula never renders in one view
// and shows as raw dollars in the other.
//
// The inline rule is Pandoc's, so prices are left alone: the opening $ must be
// followed by a non-space, the closing $ preceded by one and not followed by a
// digit. "between $5 and $10" stays text; "$E = mc^2$" is math.

import katex from 'katex';

const INLINE_BODY = String.raw`\$(?!\$)(?=\S)((?:\\.|[^$\\\n])+?)(?<=\S)\$(?!\d)`;

/** Inline math at the very start of `src`: [raw, latex] or null. */
export function matchInlineMath(src) {
  const m = new RegExp('^' + INLINE_BODY).exec(src);
  return m ? [m[0], m[1]] : null;
}

/** A global regex for inline math anywhere in a line (for the classic renderer). */
export const INLINE_MATH_SOURCE = String.raw`(?<![\\$])` + INLINE_BODY;

// $$ on its own line, the formula, $$ again; or the whole formula on one line.
const BLOCK_MULTI = /^\$\$[ \t]*\n([\s\S]*?)\n[ \t]*\$\$[ \t]*(?:\n|$)/;
const BLOCK_ONE_LINE = /^\$\$(?!\$)([^\n]*?[^\n$])\$\$[ \t]*(?:\n|$)/;

/** Display math at the very start of `src`: { raw, latex, oneLine } or null. */
export function matchBlockMath(src) {
  let m = BLOCK_ONE_LINE.exec(src);
  if (m) return { raw: m[0], latex: m[1].trim(), oneLine: true };
  m = BLOCK_MULTI.exec(src);
  if (m) return { raw: m[0], latex: m[1].trim(), oneLine: false };
  return null;
}

/** Markdown for a display formula, in the form it was written. */
export function blockMathMarkdown(latex, oneLine = false) {
  return oneLine ? `$$${latex}$$` : `$$\n${latex}\n$$`;
}

/**
 * KaTeX HTML for a formula. Never throws: a formula KaTeX cannot parse renders
 * as its source in red, so a typo stays visible and fixable rather than vanishing.
 */
export function renderMath(latex, displayMode = false) {
  return katex.renderToString(latex || '', { displayMode, throwOnError: false, output: 'htmlAndMathml' });
}
