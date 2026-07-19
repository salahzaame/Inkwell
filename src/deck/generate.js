// Deck generation: the note goes in, a validated json-render spec comes out.
// catalog.prompt() teaches the model the JSONL patch format + component contract;
// we add slide-design rules and the note's content + available assets.
import { createSpecStreamCompiler, validateSpec, autoFixSpec } from '@json-render/core';
import { openRouterComplete, completeChat } from '../assistant.js';
import { deckCatalog } from './catalog.js';
import { deckSlideKeys } from './registry.jsx';

// Hand-written compact contract: the auto-generated catalog.prompt() is ~15KB,
// which the free model gateway rejects with empty replies. The catalog itself
// remains the validation + rendering contract; this is its terse rendition.
const SYSTEM_PROMPT = `You are the presentation designer inside Inkwell, a research note-taking app. You turn a researcher's markdown note into a clean, confident slide deck.

OUTPUT FORMAT — JSONL, one RFC 6902 JSON patch per line, NO other text, no code fences:
{"op":"add","path":"/root","value":"deck"}
{"op":"add","path":"/elements/deck","value":{"type":"Deck","props":{"title":"..."},"children":["s1","s2"]}}
{"op":"add","path":"/elements/s1","value":{"type":"Slide","props":{"layout":"title","eyebrow":null},"children":["s1-title"]}}
{"op":"add","path":"/elements/s1-title","value":{"type":"Title","props":{"text":"...","subtitle":"..."},"children":[]}}

COMPONENTS (type — props):
- Deck — {title:string}. The root. children = Slide keys in order.
- Slide — {layout:"title"|"content"|"statement"|"end", eyebrow:string|null}. One 16:9 slide; eyebrow is a small section label like "Methodology".
- Title — {text:string, subtitle:string|null}. Big display title for title/end slides.
- Heading — {text:string}. Heading for content slides.
- Bullets — {items:string[] (1-6 short fragments), numbered:boolean|null}.
- Text — {text:string, dim:boolean|null}. One short paragraph; on "statement" slides it renders huge.
- Quote — {text:string, cite:string|null}. Pull-quote with attribution.
- Stat — {value:string, label:string}. One big number, e.g. value "28.4 BLEU", label "WMT14 EN-DE".
- Columns — {}. Children render side by side (2-3 children).
- Sketch — {id:string}. Embeds a note sketch. Only ids listed as available.
- NoteImage — {id:string, caption:string|null}. Embeds a note image. Only ids listed as available.

DESIGN RULES:
- 6 to 10 slides. Every element key is a short slug ("s3", "s3-bullets").
- Slide 1: layout "title" with a Title. Last slide: layout "end" with a Title (short takeaway).
- One idea per content slide: a Heading plus ONE of (Bullets, Columns of Stats, Quote, Sketch, NoteImage, Text).
- Bullets are fragments (max ~12 words), never sentences copied from the note.
- Use one "statement" slide for the most important claim, as a Text element.
- When the note has concrete numbers, put 2-3 Stat components inside a Columns.
- Set unused optional props to null. Every child key must be added as an element.`;

/** Repair the quirks free models produce: fragment-style JSON pointers
    ("#/elements/x"), a "#" bucket in the compiled result, and element props
    inlined at the top level instead of under "props". */
function normalizeSpec(spec) {
  if (spec['#'] && typeof spec['#'] === 'object') {
    for (const [k, v] of Object.entries(spec['#'])) {
      if (k === 'elements') spec.elements = { ...(spec.elements || {}), ...v };
      else if (spec[k] === undefined) spec[k] = v;
    }
    delete spec['#'];
  }
  const STRUCTURAL = new Set(['type', 'children', 'visible', 'props']);
  for (const el of Object.values(spec.elements || {})) {
    if (!el || typeof el !== 'object') continue;
    if (!el.props || typeof el.props !== 'object') {
      el.props = {};
      for (const [k, v] of Object.entries(el)) {
        if (!STRUCTURAL.has(k)) { el.props[k] = v; delete el[k]; }
      }
    }
    if (!Array.isArray(el.children)) el.children = [];
  }
  return spec;
}

/** Compile the model's reply — JSONL patches (native) or a whole JSON object (fallback). */
function compileReply(raw) {
  let t = raw.trim();
  const fence = t.match(/```(?:json\w*)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();

  if (t.startsWith('{') && /"op"\s*:/.test(t.slice(0, 200))) {
    const jsonl = t
      .replace(/"path"\s*:\s*"#\//g, '"path":"/')   // "#/elements/x" → "/elements/x"
      .replace(/\}\s*\{"op"/g, '}\n{"op"');          // resplit patches run together on one line
    const compiler = createSpecStreamCompiler();
    const { result } = compiler.push(jsonl + '\n');
    if (result?.root) {
      const spec = normalizeSpec(result);
      if (spec.elements) return spec;
    }
  }
  // fallback: a single JSON spec object
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The model returned no usable JSON.');
  const obj = JSON.parse(t.slice(start, end + 1));
  return normalizeSpec(obj.spec && obj.spec.root ? obj.spec : obj);
}

/**
 * Generate a deck spec for a note. Throws with a human-readable message on failure.
 * sketchIds / imageIds: assets from the note the model is allowed to embed.
 */
export async function generateDeckSpec({ noteName, doc, sketchIds = [], imageIds = [], settings }) {
  const system = SYSTEM_PROMPT;

  const assets = [
    sketchIds.length ? `Available Sketch ids: ${sketchIds.join(', ')}` : 'No sketches available.',
    imageIds.length ? `Available NoteImage ids: ${imageIds.join(', ')}` : 'No images available.',
  ].join('\n');

  const user = [
    `Create the deck for the note titled "${noteName}".`,
    assets,
    '',
    'NOTE CONTENT:',
    (doc || '').slice(0, 6000),
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];

  // Decks need a capable model. Prefer OpenRouter (with 429 backoff); only
  // fall back to the keyless gateway when no key is set, and treat its
  // reasoning-model empty replies as the "add a key" case rather than a crash.
  let raw = '';
  if (settings?.openrouterKey) {
    const { text, finishReason } = await openRouterComplete({ messages, maxTokens: 4000, settings });
    if (finishReason === 'length') throw new Error('The deck came back cut off — try again.');
    raw = text;
  } else {
    const { text, finishReason } = await completeChat({ messages, maxTokens: 4000, settings });
    if (finishReason === 'length' || !text) {
      throw new Error('The free model couldn\'t produce a deck. Add an OpenRouter key in Settings for reliable results.');
    }
    raw = text;
  }

  let spec = compileReply(raw);
  if (!spec?.root || !spec?.elements) throw new Error('The generated deck was malformed — try again.');

  // Sanitize structure BEFORE the library sees it: models routinely reference
  // child keys they never emit (e.g. a Slide pointing at a heading that got
  // truncated), and validateSpec/autoFixSpec throw when they follow one.
  sanitizeStructure(spec);

  // library best-effort pass — never let its internals kill a usable deck
  try {
    const fixed = autoFixSpec(spec);
    if (fixed?.spec?.root && fixed.spec.elements) { spec = fixed.spec; sanitizeStructure(spec); }
    const { valid } = validateSpec(spec) || {};
    if (!valid) console.warn('deck spec has validation warnings (rendering anyway)');
  } catch (e) {
    console.warn('json-render post-processing skipped:', e.message);
  }

  if (!spec.elements[spec.root]) throw new Error('The generated deck was malformed — try again.');
  if (deckSlideKeys(spec).length === 0) throw new Error('The generated deck had no slides — try again.');
  return spec;
}

/** Make a spec safe to traverse: known types only, no dangling child refs,
    no empty slides, and a Deck root whose children are real Slides. */
function sanitizeStructure(spec) {
  const known = new Set(deckCatalog.componentNames || []);
  // drop unknown/malformed elements
  for (const [key, el] of Object.entries(spec.elements)) {
    if (!el || typeof el !== 'object' || !known.has(el.type)) delete spec.elements[key];
  }
  // normalize + strip references to elements that don't exist
  for (const el of Object.values(spec.elements)) {
    if (!el.props || typeof el.props !== 'object') el.props = {};
    el.children = Array.isArray(el.children) ? el.children.filter(k => spec.elements[k]) : [];
  }
  // drop content slides that lost all their children to truncation
  for (const [key, el] of Object.entries(spec.elements)) {
    if (el.type === 'Slide' && el.children.length === 0 && el.props.layout !== 'title' && el.props.layout !== 'end') {
      delete spec.elements[key];
    }
  }
  // re-strip now-dangling refs (a deleted slide leaves the Deck pointing at it)
  for (const el of Object.values(spec.elements)) {
    el.children = el.children.filter(k => spec.elements[k]);
  }
}
