/**
 * Small, predictable building blocks for the manual slide composer. These
 * intentionally mutate a draft spec: SlidesView always supplies a cloned deck.
 */
function usableSlide(spec, slideKey) {
  return spec?.elements?.[slideKey]?.type === 'Slide' ? spec.elements[slideKey] : null;
}

function freeKey(elements, base) {
  let key = base;
  let number = 2;
  while (elements[key]) key = `${base}-${number++}`;
  return key;
}

/** Add a two-column argument frame, with independently editable content. */
export function addTwoColumnFrame(spec, slideKey, suffix = Date.now().toString(36)) {
  const slide = usableSlide(spec, slideKey);
  if (!slide) return null;
  const { elements } = spec;
  const columnsKey = freeKey(elements, `columns-${suffix}`);
  const leftKey = freeKey(elements, `column-left-${suffix}`);
  const rightKey = freeKey(elements, `column-right-${suffix}`);
  const leftHeadingKey = freeKey(elements, `column-left-heading-${suffix}`);
  const leftTextKey = freeKey(elements, `column-left-text-${suffix}`);
  const rightHeadingKey = freeKey(elements, `column-right-heading-${suffix}`);
  const rightTextKey = freeKey(elements, `column-right-text-${suffix}`);

  elements[columnsKey] = { type: 'Columns', props: {}, children: [leftKey, rightKey] };
  elements[leftKey] = { type: 'Column', props: {}, children: [leftHeadingKey, leftTextKey] };
  elements[rightKey] = { type: 'Column', props: {}, children: [rightHeadingKey, rightTextKey] };
  elements[leftHeadingKey] = { type: 'Heading', props: { text: 'First perspective' }, children: [] };
  elements[leftTextKey] = { type: 'Text', props: { text: 'Add the first side of the comparison.', dim: null }, children: [] };
  elements[rightHeadingKey] = { type: 'Heading', props: { text: 'Second perspective' }, children: [] };
  elements[rightTextKey] = { type: 'Text', props: { text: 'Add the second side of the comparison.', dim: null }, children: [] };
  slide.children = [...(slide.children || []), columnsKey];
  return columnsKey;
}

/** Attach a vault image to the active slide and return its editable block key. */
export function addImageBlock(spec, slideKey, imageId, suffix = Date.now().toString(36)) {
  const slide = usableSlide(spec, slideKey);
  if (!slide || !imageId) return null;
  const key = freeKey(spec.elements, `noteimage-${suffix}`);
  spec.elements[key] = { type: 'NoteImage', props: { id: imageId, caption: null, fit: 'contain' }, children: [] };
  slide.children = [...(slide.children || []), key];
  return key;
}
