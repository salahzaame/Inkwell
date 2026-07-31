import JSZip from 'jszip';

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const MAX_SLIDES = 120;

function decodeXml(value = '') {
  return String(value)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Extract visible text runs from a PPTX slide XML part, preserving run order. */
export function extractPptxSlideText(xml = '') {
  const entries = [];
  for (const match of String(xml).matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)) {
    const text = decodeXml(match[1]).replace(/\s+/g, ' ').trim();
    if (text) entries.push(text);
  }
  return entries;
}

/** Turn imported slide text into Inkwell's fully editable deck schema. */
export function deckFromPptxText(slides = [], { title = 'Imported presentation', theme = 'midnight' } = {}) {
  const usable = slides.map(lines => Array.isArray(lines) ? lines.filter(Boolean) : []).filter(lines => lines.length).slice(0, MAX_SLIDES);
  if (!usable.length) throw new Error('This PPTX has no readable slide text to import.');
  const root = 'deck';
  const elements = { [root]: { type: 'Deck', props: { title, theme }, children: [] } };
  usable.forEach((lines, index) => {
    const suffix = `import-${index + 1}`;
    const slideKey = `slide-${suffix}`;
    const titleSlide = index === 0;
    const body = lines.slice(1, 7);
    const titleKey = `${titleSlide ? 'title' : 'heading'}-${suffix}`;
    const children = [titleKey];
    elements[titleKey] = titleSlide
      ? { type: 'Title', props: { text: lines[0], subtitle: body.join(' · ') || null }, children: [] }
      : { type: 'Heading', props: { text: lines[0] }, children: [] };
    if (!titleSlide && body.length) {
      const bodyKey = `body-${suffix}`;
      if (body.length > 1) {
        elements[bodyKey] = { type: 'Bullets', props: { items: body, numbered: null }, children: [] };
      } else {
        elements[bodyKey] = { type: 'Text', props: { text: body[0], dim: null }, children: [] };
      }
      children.push(bodyKey);
    }
    elements[slideKey] = { type: 'Slide', props: { layout: titleSlide ? 'title' : 'content', eyebrow: null, speakerNotes: null }, children };
    elements[root].children.push(slideKey);
  });
  return { root, elements };
}

/** Read a local PPTX archive without uploading it, then create an editable deck. */
export async function importPptxDeck(file, options = {}) {
  if (!file || !/\.pptx$/i.test(file.name || '')) throw new Error('Choose a .pptx presentation file.');
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a PPTX smaller than 25 MB for local import.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => Number(left.match(/slide(\d+)\.xml/i)?.[1]) - Number(right.match(/slide(\d+)\.xml/i)?.[1]));
  if (!slideNames.length) throw new Error('This file does not contain readable PPTX slides.');
  const slides = await Promise.all(slideNames.slice(0, MAX_SLIDES).map(async name => extractPptxSlideText(await zip.files[name].async('string'))));
  const fallbackTitle = String(file.name).replace(/\.pptx$/i, '').replace(/[-_]+/g, ' ').trim() || 'Imported presentation';
  return deckFromPptxText(slides, { ...options, title: options.title || fallbackTitle });
}
