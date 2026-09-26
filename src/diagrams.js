// Mermaid diagram blocks in notes.
//
// A ```mermaid fence renders as a diagram instead of plain code. The rendering
// itself lives in MermaidDiagram.jsx; this module holds the document surgery so
// it stays testable without a DOM.

export const MERMAID_SNIPPET = '```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```\n';

export function isMermaidBlock(block) {
  return !!block && block.t === 'code' && block.lang === 'mermaid' && String(block.text || '').trim() !== '';
}

/**
 * Swap a block's source lines for a ```sketch fence, so a rendered diagram can
 * become a hand-editable Excalidraw scene in place.
 * Uses the block's half-open [line0, line1) range, same as every other editor edit.
 */
export function replaceBlockWithSketchFence(doc, block, sketchId) {
  const lines = String(doc ?? '').split('\n');
  return [
    ...lines.slice(0, block.line0),
    '```sketch ' + sketchId,
    '```',
    ...lines.slice(block.line1),
  ].join('\n');
}

/**
 * Mermaid throws on malformed input, and its messages are long and stack-ish.
 * Keep the first meaningful line so the note can show something useful.
 */
export function diagramErrorMessage(error) {
  // ?? not || — an Error with an empty message must not fall through to
  // stringifying the Error itself, which yields a useless bare "Error"
  const raw = String(error?.message ?? error ?? '').trim();
  const first = raw.split('\n').map(s => s.trim()).find(Boolean) || 'Could not render this diagram.';
  return first.length > 160 ? first.slice(0, 159) + '…' : first;
}
