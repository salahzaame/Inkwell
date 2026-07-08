// Inkwell's assistant backend — free providers only.
// 1. Ollama (http://localhost:11434) when it's running with a model pulled: private, on-device.
// 2. Pollinations.ai — keyless, no-signup, free OpenAI-compatible endpoint — as the zero-setup fallback.

const OLLAMA = 'http://localhost:11434';

function systemPrompt(vault) {
  return [
    "You are the assistant built into Inkwell, a local-first markdown note-taking app with embedded Excalidraw sketches.",
    'Answer questions about the user\'s vault using the notes below. Be concise (1-4 sentences unless asked for more), plain text only — no markdown headings.',
    'The section marked OPEN NOTE is the note the user is looking at right now — when they say "this note", that is the one they mean. Never ask which note; use the open one.',
    'When you reference a note, call it by its exact name in double brackets, e.g. [[Weekly Sync]].',
    'If the user asks you to write or draft content, produce markdown they can paste into a note.',
    '',
    vault,
  ].join('\n');
}

/** Compact plain-text dump of the vault: active note in full, others truncated. */
export function buildVaultContext(files, docs, activeId) {
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
  return parts.join('\n').slice(0, 9000);
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

async function askPollinations(messages) {
  // routed through the dev server's /api/llm proxy (see vite.config.js)
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error('pollinations HTTP ' + res.status);
  const j = await res.json();
  const text = (j.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('pollinations empty reply');
  return { text, provider: 'pollinations · free cloud', local: false };
}

/**
 * history: [{ role: 'u'|'a', text }] — most recent last.
 * Returns { text, provider, local }; throws only if every provider fails.
 */
export async function askAssistant({ history, vault, preferLocal }) {
  const messages = [
    { role: 'system', content: systemPrompt(vault) },
    ...history.slice(-10).map(m => ({ role: m.role === 'u' ? 'user' : 'assistant', content: m.text })),
  ];
  const chain = preferLocal ? [askOllama, askPollinations] : [askPollinations, askOllama];
  let lastErr;
  for (const ask of chain) {
    try { return await ask(messages); } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('no assistant provider available');
}
