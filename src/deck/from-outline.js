/** Convert the local heading preview into the same editable schema as AI/PPTX decks. */
export function deckFromOutlineSlides(slides = [], { title = 'Untitled presentation', theme = 'midnight' } = {}) {
  const source = Array.isArray(slides) ? slides : [];
  const root = 'deck';
  const elements = { [root]: { type: 'Deck', props: { title, theme }, children: [] } };

  source.forEach((slide, index) => {
    const suffix = `outline-${index + 1}`;
    const slideKey = `slide-${suffix}`;
    const titleSlide = slide?.type === 'title' || index === 0;
    const heading = String(slide?.title || (titleSlide ? title : 'New slide')).trim() || 'New slide';
    const children = [];
    if (titleSlide) {
      const titleKey = `title-${suffix}`;
      elements[titleKey] = { type: 'Title', props: { text: heading, subtitle: slide?.sub || null }, children: [] };
      children.push(titleKey);
    } else {
      const headingKey = `heading-${suffix}`;
      elements[headingKey] = { type: 'Heading', props: { text: heading }, children: [] };
      children.push(headingKey);
      if (slide?.type === 'sketch' && slide.sketch) {
        const sketchKey = `sketch-${suffix}`;
        elements[sketchKey] = { type: 'Sketch', props: { id: slide.sketch }, children: [] };
        children.push(sketchKey);
      } else {
        const items = Array.isArray(slide?.bullets) ? slide.bullets.map(item => String(item).trim()).filter(Boolean).slice(0, 6) : [];
        const bodyKey = `body-${suffix}`;
        elements[bodyKey] = items.length > 1
          ? { type: 'Bullets', props: { items, numbered: null }, children: [] }
          : { type: 'Text', props: { text: items[0] || 'Add the key point for this slide.', dim: null }, children: [] };
        children.push(bodyKey);
      }
    }
    elements[slideKey] = { type: 'Slide', props: { layout: titleSlide ? 'title' : 'content', eyebrow: null, speakerNotes: null }, children };
    elements[root].children.push(slideKey);
  });

  if (!elements[root].children.length) {
    const slideKey = 'slide-outline-1';
    elements['title-outline-1'] = { type: 'Title', props: { text: title, subtitle: null }, children: [] };
    elements[slideKey] = { type: 'Slide', props: { layout: 'title', eyebrow: null, speakerNotes: null }, children: ['title-outline-1'] };
    elements[root].children.push(slideKey);
  }
  return { root, elements };
}
