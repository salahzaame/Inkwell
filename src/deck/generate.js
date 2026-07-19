// Deck generation: the note goes in, a validated json-render spec comes out.
// catalog.prompt() teaches the model the JSONL patch format + component contract;
// we add slide-design rules and the note's content + available assets.
import { createSpecStreamCompiler, validateSpec, autoFixSpec } from '@json-render/core';
import { completeChat } from '../assistant.js';
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

  // provider chain (OpenRouter with the user's key → free cloud → ollama),
  // with one automatic retry — free gateways are occasionally flaky
  let raw = '';
  let lastErr = null;
  for (let attempt = 0; attempt < 2 && !raw; attempt++) {
    try {
      const { text, finishReason } = await completeChat({
        maxTokens: 4000, // default caps are far too small for a whole deck
        settings,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      if (finishReason === 'length') throw new Error('The deck came back cut off — try again.');
      raw = text;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!raw) throw lastErr ?? new Error('Deck generation failed — try again.');

  let spec = compileReply(raw);
  const fixed = autoFixSpec(spec);
  if (fixed?.spec) spec = fixed.spec;

  const { valid } = validateSpec(spec) || {};
  if (!spec?.root || !spec?.elements) throw new Error('The generated deck was malformed — try again.');

  // drop anything outside the catalog so the renderer never sees unknown types
  const known = new Set(deckCatalog.componentNames || []);
  for (const [key, el] of Object.entries(spec.elements)) {
    if (!known.has(el?.type)) delete spec.elements[key];
  }
  for (const el of Object.values(spec.elements)) {
    if (el.children) el.children = el.children.filter(k => spec.elements[k] !== undefined);
  }
  if (!spec.elements[spec.root]) throw new Error('The generated deck was malformed — try again.');
  if (deckSlideKeys(spec).length === 0) throw new Error('The generated deck had no slides — try again.');
  if (!valid) console.warn('deck spec generated with validation warnings');
  return spec;
}
