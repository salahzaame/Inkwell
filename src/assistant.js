// Inkwell's assistant backend — free providers only.
// 1. Ollama (http://localhost:11434) when it's running with a model pulled: private, on-device.
// 2. Pollinations.ai — keyless, no-signup, free OpenAI-compatible endpoint — as the zero-setup fallback.

const OLLAMA = 'http://localhost:11434';

function systemPrompt(vault) {
  return [
    "You are the assistant built into Inkwell, a local-first markdown note-taking app with embedded Excalidraw sketches.",
    'You are a research collaborator, not a generic chatbot. Use the workspace below: notes, literature records, reading status, highlights, and any active presentation deck.',
    'Answer questions about the user\'s vault using the notes below. Be concise (1-4 sentences unless asked for more), plain text only — no markdown headings.',
    'The section marked OPEN NOTE is the note the user is looking at right now — when they say "this note", that is the one they mean. Never ask which note; use the open one.',
    'For explicit draft or rewrite requests, return complete markdown only; that format overrides the default plain-text response style.',
    'When you reference a note, call it by its exact name in double brackets, e.g. [[Weekly Sync]].',
    'If the user asks you to write or draft content, produce clean markdown they can paste into a note. Do not invent papers, quotations, statistics, or citations that are not in the workspace.',
    'When asked to explain, match the requested level (plain-language or technical) and tie the explanation back to the open note, active slide, or relevant paper when possible.',
    '',
    vault,
  ].join('\n');
}

/** Compact plain-text dump of the vault: active note in full, others truncated. */
function deckDescendants(deck, key, seen = new Set()) {
  if (!key || seen.has(key) || !deck?.elements?.[key]) return [];
  seen.add(key);
  const item = deck.elements[key];
  return [item, ...(item.children || []).flatMap(child => deckDescendants(deck, child, seen))];
}

export function buildDeckContext(deck, selectedSlide) {
  if (!deck?.root || !deck.elements?.[deck.root]) return '';
  const root = deck.elements[deck.root];
  const slideKeys = (root.children || []).filter(key => deck.elements[key]?.type === 'Slide');
  if (!slideKeys.length) return '';
  const lines = ['', `ACTIVE PRESENTATION (${root.props?.title || 'Untitled deck'} · ${slideKeys.length} slides):`];
  slideKeys.slice(0, 12).forEach((key, index) => {
    const slide = deck.elements[key];
    const items = deckDescendants(deck, key).slice(1).map(item => {
      const props = item.props || {};
      const content = props.text || props.value || (props.items ? props.items.join(' · ') : '') || props.id || '';
      return `${item.type}${content ? `: ${String(content).slice(0, 220)}` : ''}`;
    });
    const notes = slide.props?.speakerNotes ? ` · Speaker notes: ${String(slide.props.speakerNotes).slice(0, 300)}` : '';
    lines.push(`--- SLIDE ${index + 1}${key === selectedSlide ? ' (SELECTED)' : ''} · ${slide.props?.layout || 'content'}${slide.props?.eyebrow ? ` · ${slide.props.eyebrow}` : ''}${notes} ---`, ...items.slice(0, 12));
  });
  return lines.join('\n');
}

export function buildVaultContext(files, docs, activeId, { references = [], highlights = {}, deck = null, selectedSlide = null } = {}) {
  const notes = files.filter(f => !f.folder);
  const parts = [`VAULT (${notes.length} notes):`];
  const active = notes.find(n => n.id === activeId);
  if (active) {
    parts.push(`--- OPEN NOTE: ${active.name} ---`, (docs[active.id] || '(empty)').slice(0, 4000));
  }
  for (const n of notes) {
    if (active && n.id === active.id) continue;
    parts.push(`--- ${n.name} ---`, (docs[n.id] || '(empty)').slice(0, 600));
  }
  const research = [];
  if (references.length) {
    research.push('', `RESEARCH LIBRARY (${references.length} papers):`);
    for (const ref of references.slice(0, 20)) {
      const paperId = ref.citationKey || ref.url || (ref.title ? 'local:' + ref.title : null);
      const paperHighlights = highlights[paperId] || [];
      research.push(
        `--- ${ref.title || 'Untitled paper'} ---`,
        `Status: ${ref.status || 'toread'}${ref.year ? ` · ${ref.year}` : ''}${ref.citationKey ? ` · [@${ref.citationKey}]` : ''}`,
        ref.abstract ? `Abstract: ${ref.abstract.slice(0, 500)}` : '',
        paperHighlights.length ? `Highlights: ${paperHighlights.slice(0, 3).map(h => h.text).join(' | ').slice(0, 900)}` : '',
      );
    }
  }
  return [...parts, ...research, buildDeckContext(deck, selectedSlide)].join('\n').slice(0, 12000);
}

async function askOllama(messages) {
  const tags = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(1500) }).then(r => r.json());
  const models = tags.models || [];
  const model = (models.find(m => /llama/i.test(m.name)) ?? models[0])?.name;
  if (!model) throw new Error('ollama has no models pulled');
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error('ollama HTTP ' + res.status);
  const j = await res.json();
  const text = (j.message?.content || '').trim();
  if (!text) throw new Error('ollama empty reply');
  return { text, provider: model.replace(/:latest$/, '') + ' · on-device', local: true };
}

async function askPollinations(messages, maxTokens) {
  // routed through the dev server's /api/llm proxy (see vite.config.js)
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error('pollinations HTTP ' + res.status);
  const j = await res.json();
  const text = (j.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('pollinations empty reply');
  return { text, provider: 'pollinations · free cloud', local: false, finishReason: j.choices?.[0]?.finish_reason };
}

// Gemma is a plain instruction model (no hidden reasoning budget), so it
// answers without exhausting max_tokens the way gpt-oss's reasoning did.
// The 26b-a4b (mixture-of-experts) free tier is far less rate-limited upstream
// than 31b; both are the same Gemma 4 family. Override in Settings if desired.
export const OPENROUTER_DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';

async function askOpenRouter(messages, maxTokens, { key, model }) {
  // OpenRouter allows browser calls with the user's own key (kept in settings)
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + key,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Inkwell',
    },
    body: JSON.stringify({ model: model || OPENROUTER_DEFAULT_MODEL, messages, ...(maxTokens ? { max_tokens: maxTokens } : {}) }),
    signal: AbortSignal.timeout(90000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(j?.error?.message || ('openrouter HTTP ' + res.status));
    err.status = res.status;
    err.rateLimited = res.status === 429;
    throw err;
  }
  const text = (j.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('openrouter empty reply');
  const shortModel = (model || OPENROUTER_DEFAULT_MODEL).split('/').pop().replace(/:free$/, '');
  return { text, provider: shortModel + ' · openrouter', local: false, finishReason: j.choices?.[0]?.finish_reason };
}

/**
 * OpenRouter completion with backoff on transient upstream rate limits (429).
 * Used by deck generation, which needs a capable model and can't fall back to
 * the keyless gateway. Throws if no key is set or all retries are exhausted.
 */
export async function openRouterComplete({ messages, maxTokens, settings, tries = 3 }) {
  if (!settings?.openrouterKey) {
    const e = new Error('Add a free OpenRouter key in Settings → Assistant providers to design decks.');
    e.noKey = true;
    throw e;
  }
  const opts = { key: settings.openrouterKey, model: settings.openrouterModel };
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await askOpenRouter(messages, maxTokens, opts);
    } catch (e) {
      lastErr = e;
      if (!e.rateLimited || i === tries - 1) break;
      await new Promise(r => setTimeout(r, 4000 * (i + 1))); // 4s, 8s backoff
    }
  }
  if (lastErr?.rateLimited) throw new Error('The free model is busy right now (rate-limited upstream). Wait a moment and try again.');
  throw lastErr;
}

function providerChain({ preferLocal, settings, maxTokens }) {
  const chain = [];
  const or = settings?.openrouterKey
    ? (messages) => askOpenRouter(messages, maxTokens, { key: settings.openrouterKey, model: settings.openrouterModel })
    : null;
  const poll = (messages) => askPollinations(messages, maxTokens);
  const oll = (messages) => askOllama(messages);
  if (preferLocal) chain.push(oll);
  if (or) chain.push(or);
  chain.push(poll);
  if (!preferLocal) chain.push(oll);
  return chain;
}

/** One-shot completion through the provider chain (OpenRouter → pollinations → ollama). */
export async function completeChat({ messages, maxTokens, settings }) {
  let lastErr;
  for (const ask of providerChain({ preferLocal: false, settings, maxTokens })) {
    try { return await ask(messages); } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('no model provider available');
}

/**
 * Ask for structured note edits instead of prose. Returns { text, provider } where
 * text is the raw JSON payload — parsing and validation happen in assistant-edits.js.
 */
export async function proposeNoteEdits({ request, vault, editPrompt, preferLocal, settings }) {
  const messages = [
    { role: 'system', content: systemPrompt(vault) + '\n\n' + editPrompt },
    { role: 'user', content: request },
  ];
  let lastErr;
  for (const ask of providerChain({ preferLocal, settings })) {
    try { return await ask(messages); } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('no assistant provider available');
}

/**
 * history: [{ role: 'u'|'a', text }] — most recent last.
 * Returns { text, provider, local }; throws only if every provider fails.
 */
export async function askAssistant({ history, vault, preferLocal, settings }) {
  const messages = [
    { role: 'system', content: systemPrompt(vault) },
    ...history.slice(-10).map(m => ({ role: m.role === 'u' ? 'user' : 'assistant', content: m.text })),
  ];
  let lastErr;
  for (const ask of providerChain({ preferLocal, settings })) {
    try { return await ask(messages); } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('no assistant provider available');
}
