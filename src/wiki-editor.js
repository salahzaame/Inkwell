const escapeHtml = (text = '') => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Render stored wikilinks as friendly, non-editable inline chips in rich text. */
export function wikilinkEditorHtml(source = '') {
  let last = 0;
  let html = '';
  for (const match of String(source).matchAll(/\[\[([^\]]+)\]\]/g)) {
    html += escapeHtml(source.slice(last, match.index));
    const name = match[1].trim();
    html += `<span class="note-wiki-chip" data-wiki="${escapeHtml(name)}" contenteditable="false">${escapeHtml(name)}</span>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(source.slice(last)).replace(/\n/g, '<br>');
}
