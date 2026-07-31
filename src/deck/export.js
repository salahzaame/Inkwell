/**
 * Build a portable, dependency-free HTML rendition of an Inkwell deck.
 * The app's editable JSON spec stays intact inside the exported file, while
 * the small renderer below makes the file useful in any modern browser.
 */
export function deckExportFileName(noteName = 'Inkwell deck') {
  const stem = String(noteName).trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').slice(0, 72) || 'Inkwell deck';
  return `${stem}.html`;
}

function jsonForHtml(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function buildDeckExportHtml({ deck, noteName, images = {}, references = [], sketchSvgs = {}, exportedAt = new Date().toISOString() }) {
  const payload = jsonForHtml({ deck, noteName, images, references, sketchSvgs, exportedAt });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${String(noteName || 'Inkwell deck').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <style>
    :root { color-scheme: dark; background: #141518; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; } body { margin: 0; background: #141518; }
    .masthead { color: #e8eaf0; display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem 1.25rem; }
    .masthead h1 { font-size: 1.1rem; margin: 0; letter-spacing: -.02em; } .masthead p { margin: 0; color: #9ea4b1; font-size: .78rem; }
    .slides { display: grid; gap: 2rem; padding: 0 1.5rem 2rem; max-width: 1200px; margin: 0 auto; }
    .slide { aspect-ratio: 16 / 9; padding: clamp(1.5rem, 4vw, 4.5rem); border: 1px solid var(--border); background: var(--background); color: var(--ink); display: flex; flex-direction: column; justify-content: center; gap: clamp(.7rem, 1.5vw, 1.6rem); overflow: hidden; page-break-after: always; break-after: page; }
    .slide.layout-title, .slide.layout-end, .slide.layout-statement { text-align: center; align-items: center; } .slide.layout-statement { justify-content: center; }
    .eyebrow { color: var(--accent); font-size: clamp(.6rem, 1.1vw, 1rem); text-transform: uppercase; letter-spacing: .16em; font-weight: 700; }
    .title-rule { width: 2.8rem; height: .22rem; background: var(--accent); margin-bottom: .3rem; } .deck-title { max-width: 88%; } .deck-title h2 { margin: 0; font-size: clamp(2.1rem, 6.7vw, 6.5rem); line-height: .96; letter-spacing: -.055em; } .deck-title p { margin: 1.2rem 0 0; color: color-mix(in srgb, var(--ink) 62%, transparent); font-size: clamp(.9rem, 1.6vw, 1.35rem); }
    .heading { margin: 0; font-size: clamp(1.6rem, 4.4vw, 4.4rem); letter-spacing: -.045em; line-height: 1.02; } .text { margin: 0; max-width: 48em; font-size: clamp(.9rem, 1.65vw, 1.55rem); line-height: 1.52; } .text.dim { opacity: .62; }
    .bullets { margin: 0; padding: 0; display: grid; gap: clamp(.45rem, 1vw, 1rem); list-style: none; font-size: clamp(.9rem, 1.75vw, 1.65rem); } .bullets li { display: flex; gap: .8em; align-items: baseline; line-height: 1.35; } .bullet { width: .46em; height: .46em; border-radius: 50%; background: var(--accent); flex: 0 0 auto; } .numbered .bullet { background: transparent; width: 1.2em; height: auto; color: var(--accent); font-weight: 700; }
    .quote { margin: 0; border-left: .25rem solid var(--accent); padding-left: 1.2rem; max-width: 44em; } .quote p { margin: 0; font-size: clamp(1.25rem, 2.6vw, 2.8rem); letter-spacing: -.035em; line-height: 1.16; } .quote cite { display: block; margin-top: 1rem; font-size: clamp(.75rem, 1.2vw, 1.1rem); font-style: normal; opacity: .64; }
    .stat { display: grid; gap: .35rem; } .stat-value { color: var(--accent); font-size: clamp(3rem, 9vw, 9rem); font-weight: 750; line-height: .87; letter-spacing: -.075em; } .stat-label { font-size: clamp(.8rem, 1.4vw, 1.25rem); opacity: .7; } .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: clamp(1rem, 3vw, 3rem); width: 100%; } .column { min-width: 0; display: grid; align-content: center; gap: clamp(.7rem, 1.6vw, 1.4rem); } .image, .sketch { margin: 0; min-height: 0; max-height: 100%; } .image img, .sketch img { width: 100%; height: auto; max-height: 47vh; object-fit: contain; display: block; } .image.cover { overflow: hidden; height: 100%; } .image.cover img { height: 100%; max-height: none; object-fit: cover; } .image figcaption { margin-top: .55rem; color: color-mix(in srgb, var(--ink) 64%, transparent); font-size: .75rem; } .citation { align-self: flex-start; border-top: 1px solid color-mix(in srgb, var(--ink) 28%, transparent); padding-top: .55rem; color: var(--accent); font-size: clamp(.6rem, 1vw, .85rem); line-height: 1.35; } .layout-title .citation, .layout-end .citation, .layout-statement .citation { align-self: center; } .missing { opacity: .55; font-size: .9rem; border: 1px dashed color-mix(in srgb, var(--ink) 35%, transparent); padding: 1rem; }
    @media print { @page { size: landscape; margin: 0; } :root, body { background: white; } .masthead { display: none; } .slides { display: block; padding: 0; max-width: none; } .slide { width: 100vw; height: 100vh; min-height: 0; border: 0; } }
  </style>
</head>
<body>
  <header class="masthead"><h1 id="deck-name">Inkwell deck</h1><p>Exported from Inkwell · use your browser’s Print command to save as PDF</p></header>
  <main class="slides" id="slides"></main>
  <script id="inkwell-deck-data" type="application/json">${payload}</script>
  <script>
    (() => {
      const payload = JSON.parse(document.getElementById('inkwell-deck-data').textContent);
      const elements = payload.deck?.elements || {}; const themeId = elements[payload.deck?.root]?.props?.theme || 'midnight';
      const themes = { midnight: { background: '#141518', ink: '#e8eaf0', border: '#2c2f37', accent: '#b7f36b' }, paper: { background: '#f4f1e9', ink: '#26221a', border: '#ddd6c4', accent: '#347c68' }, seagrass: { background: '#102a2a', ink: '#e7f3ed', border: '#28504b', accent: '#65d6b4' } };
      const theme = themes[themeId] || themes.midnight; document.title = payload.noteName || 'Inkwell deck'; document.getElementById('deck-name').textContent = payload.noteName || 'Inkwell deck';
      const make = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; };
      const render = (key) => { const item = elements[key]; if (!item) return make('div', 'missing', 'A deck block is unavailable.'); const p = item.props || {}; const children = (item.children || []).map(render); let el;
        if (item.type === 'Title') { el = make('section', 'deck-title'); el.append(make('div', 'title-rule'), make('h2', '', p.text || 'Untitled')); if (p.subtitle) el.append(make('p', '', p.subtitle)); }
        else if (item.type === 'Heading') el = make('h2', 'heading', p.text || 'Untitled');
        else if (item.type === 'Text') el = make('p', 'text' + (p.dim ? ' dim' : ''), p.text || '');
        else if (item.type === 'Bullets') { el = make('ul', 'bullets' + (p.numbered ? ' numbered' : '')); (p.items || []).forEach((text, index) => { const li = make('li'); li.append(make('span', 'bullet', p.numbered ? String(index + 1) : ''), make('span', '', text)); el.append(li); }); }
        else if (item.type === 'Quote') { el = make('blockquote', 'quote'); el.append(make('p', '', '“' + (p.text || '') + '”')); if (p.cite) el.append(make('cite', '', '— ' + p.cite)); }
        else if (item.type === 'Stat') { el = make('section', 'stat'); el.append(make('div', 'stat-value', p.value || ''), make('div', 'stat-label', p.label || '')); }
        else if (item.type === 'Citation') { const reference = (payload.references || []).find(ref => ref.citationKey === p.citationKey); const rawAuthor = String(reference?.authors?.[0] || '').trim(); const author = rawAuthor.includes(',') ? rawAuthor.split(',')[0].trim() : (rawAuthor.split(/\s+/).pop() || p.citationKey || 'Source'); const suffix = reference?.authors?.length > 1 ? ' et al.' : ''; el = make('div', 'citation', p.label || author + suffix + ' (' + (reference?.year || 'n.d.') + ')'); }
        else if (item.type === 'Columns') { el = make('div', 'columns'); children.forEach(child => el.append(child)); }
        else if (item.type === 'Column') { el = make('div', 'column'); children.forEach(child => el.append(child)); }
        else if (item.type === 'NoteImage' || item.type === 'Sketch') { const source = item.type === 'NoteImage' ? payload.images[p.id] : payload.sketchSvgs[p.id]; el = make('figure', (item.type === 'NoteImage' ? 'image' : 'sketch') + (p.fit === 'cover' ? ' cover' : '')); if (source) { const image = make('img'); image.src = source; image.alt = p.caption || item.type; el.append(image); if (p.caption) el.append(make('figcaption', '', p.caption)); } else el.append(make('div', 'missing', item.type === 'Sketch' ? 'Sketch was unavailable during export.' : 'Image was unavailable during export.')); }
        else { el = make('div'); children.forEach(child => el.append(child)); } return el;
      };
      const root = elements[payload.deck?.root]; const slideKeys = (root?.children || []).filter(key => elements[key]?.type === 'Slide'); const output = document.getElementById('slides');
      slideKeys.forEach(key => { const item = elements[key]; const slide = make('article', 'slide layout-' + (item.props?.layout || 'content')); slide.style.setProperty('--background', theme.background); slide.style.setProperty('--ink', theme.ink); slide.style.setProperty('--border', theme.border); slide.style.setProperty('--accent', theme.accent); if (item.props?.eyebrow) slide.append(make('div', 'eyebrow', item.props.eyebrow)); (item.children || []).map(render).forEach(child => slide.append(child)); output.append(slide); });
    })();
  </script>
</body>
</html>`;
}

export function downloadDeckExport(html, filename) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
