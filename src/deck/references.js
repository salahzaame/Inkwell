/** Compact, readable source labels for citations embedded in slides. */
import { formatReference } from '../bibliography.js';

function authorSurname(author = '') {
  const text = String(author).trim();
  if (!text) return '';
  if (text.includes(',')) return text.split(',')[0].trim();
  const words = text.split(/\s+/);
  return words[words.length - 1] || '';
}

export function deckCitationLabel(reference, citationKey = '') {
  if (!reference) return citationKey ? `[@${citationKey}]` : 'Source';
  const authors = Array.isArray(reference.authors) ? reference.authors.filter(Boolean) : [];
  const lead = authorSurname(authors[0]);
  const authorPart = lead ? `${lead}${authors.length > 1 ? ' et al.' : ''}` : (reference.citationKey || citationKey || 'Source');
  return `${authorPart} (${reference.year || 'n.d.'})`;
}

export function referenceForCitation(references = [], citationKey = '') {
  return references.find(reference => reference.citationKey === citationKey) || null;
}

/** Citation keys in first-appearance order, limited to elements reachable from the deck root. */
export function deckCitationKeys(deck) {
  const keys = [];
  const seenElements = new Set();
  const seenKeys = new Set();
  const visit = (key) => {
    if (!key || seenElements.has(key)) return;
    seenElements.add(key);
    const element = deck?.elements?.[key];
    if (!element) return;
    if (element.type === 'Citation' && element.props?.citationKey && !seenKeys.has(element.props.citationKey)) {
      seenKeys.add(element.props.citationKey);
      keys.push(element.props.citationKey);
    }
    (element.children || []).forEach(visit);
  };
  visit(deck?.root);
  return keys;
}

/** Add a fully editable reference slide to a cloned deck. Returns its key or null. */
export function appendDeckReferencesSlide(deck, references = [], style = 'apa') {
  const citationKeys = deckCitationKeys(deck);
  if (!citationKeys.length || !deck?.elements?.[deck.root]) return null;
  const lookup = new Map(references.map(reference => [reference.citationKey, reference]));
  const entries = citationKeys.map((key, index) => {
    const reference = lookup.get(key);
    return reference ? formatReference(reference, style, index + 1).replace(/\*/g, '') : `[@${key}] — reference details are missing from this vault.`;
  });
  let count = 1;
  let slideKey = 'references-slide';
  while (deck.elements[slideKey]) { count += 1; slideKey = `references-slide-${count}`; }
  const headingKey = `${slideKey}-heading`;
  const children = [headingKey];
  deck.elements[headingKey] = { type: 'Heading', props: { text: 'Sources' }, children: [] };
  entries.reduce((groups, entry, index) => {
    const group = Math.floor(index / 6);
    (groups[group] ||= []).push(entry);
    return groups;
  }, []).forEach((items, index) => {
    const key = `${slideKey}-list-${index + 1}`;
    deck.elements[key] = { type: 'Bullets', props: { items, numbered: style === 'ieee' }, children: [] };
    children.push(key);
  });
  deck.elements[slideKey] = { type: 'Slide', props: { layout: 'content', eyebrow: 'References', speakerNotes: null }, children };
  deck.elements[deck.root].children.push(slideKey);
  return slideKey;
}
