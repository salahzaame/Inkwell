// Structured note edits the assistant can propose, and the user approves.
//
// The assistant never writes to the vault directly. It returns a JSON payload of
// typed proposals; those are validated here, checked against the real vault, and
// shown as review cards. Only an explicit Apply mutates anything.

import { z } from 'zod';
import { uniqueVaultName } from './vault.js';

const NoteName = z.string().trim().min(1).max(120);

const Proposal = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_note'), name: NoteName, markdown: z.string() }),
  z.object({ type: z.literal('append_to_note'), note: NoteName, markdown: z.string().trim().min(1) }),
  z.object({ type: z.literal('replace_note'), note: NoteName, markdown: z.string().trim().min(1) }),
  z.object({ type: z.literal('replace_text'), note: NoteName, find: z.string().min(1), replace: z.string() }),
  z.object({ type: z.literal('rename_note'), note: NoteName, newName: NoteName }),
]);

export const PROPOSAL_TYPES = ['create_note', 'append_to_note', 'replace_note', 'replace_text', 'rename_note'];

/** Instructions appended to the system prompt when the user asks for changes. */
export const EDIT_TOOLS_PROMPT = [
  'The user has asked you to CHANGE their vault. Do not describe the changes in prose — propose them as data.',
  'Reply with a single JSON object and nothing else. No commentary before or after, no markdown fences.',
  'Shape: {"summary": "<one short sentence>", "proposals": [ ... ]}',
  'Each proposal is one of:',
  '  {"type":"create_note","name":"<note name>","markdown":"<full note body>"}',
  '  {"type":"append_to_note","note":"<existing note name>","markdown":"<markdown to add at the end>"}',
  '  {"type":"replace_note","note":"<existing note name>","markdown":"<complete replacement body>"}',
  '  {"type":"replace_text","note":"<existing note name>","find":"<exact text already in the note>","replace":"<new text>"}',
  '  {"type":"rename_note","note":"<existing note name>","newName":"<new name>"}',
  'Rules: "note" must exactly match a note name in the workspace above. For replace_text, "find" must be copied',
  'character-for-character from that note, and long enough to appear only once. Prefer replace_text for small edits',
  'and append_to_note for additions; only use replace_note when rewriting the whole note. Propose at most 8 changes.',
  'Do not invent papers, quotations, statistics, or citations that are not already in the workspace.',
].join('\n');

/** Pull the first plausible JSON object out of a reply that may be fenced or padded with prose. */
export function extractJsonObject(text = '') {
  const source = String(text);
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) candidates.push(fenced[1].trim());
  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(source.slice(first, last + 1));
  candidates.push(source.trim());
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* try the next candidate */ }
  }
  return null;
}

/**
 * Parse a raw assistant reply into proposals.
 * Malformed entries are dropped rather than failing the whole batch, so one bad
 * item from a weak model does not throw away the good ones.
 */
export function parseEditProposals(text = '') {
  const payload = extractJsonObject(text);
  if (!payload) return { summary: '', proposals: [], skipped: 0, ok: false };
  const list = Array.isArray(payload.proposals) ? payload.proposals : [];
  const proposals = [];
  let skipped = 0;
  for (const raw of list.slice(0, 8)) {
    const result = Proposal.safeParse(raw);
    if (result.success) proposals.push(result.data);
    else skipped += 1;
  }
  return {
    summary: typeof payload.summary === 'string' ? payload.summary.trim() : '',
    proposals,
    skipped,
    ok: proposals.length > 0,
  };
}

const notesOnly = (files = []) => files.filter(f => !f.folder);

function findNote(files, name) {
  const wanted = String(name || '').trim().toLowerCase();
  return notesOnly(files).find(f => String(f.name || '').trim().toLowerCase() === wanted) || null;
}

/**
 * Check a proposal against the live vault before showing it as applicable.
 * Returns { ok, reason, note, before, after } — `reason` explains why it cannot apply.
 */
export function resolveProposal(proposal, { files = [], docs = {} } = {}) {
  if (proposal.type === 'create_note') {
    const clash = findNote(files, proposal.name);
    return {
      ok: true,
      note: null,
      before: '',
      after: proposal.markdown,
      warning: clash ? `A note named "${proposal.name}" already exists — this will be created alongside it.` : '',
    };
  }

  const note = findNote(files, proposal.note);
  if (!note) return { ok: false, reason: `No note named "${proposal.note}" in this vault.` };
  const doc = docs[note.id] ?? '';

  if (proposal.type === 'append_to_note') {
    return { ok: true, note, before: doc, after: appendMarkdown(doc, proposal.markdown) };
  }
  if (proposal.type === 'replace_note') {
    return { ok: true, note, before: doc, after: proposal.markdown.trim() + '\n' };
  }
  if (proposal.type === 'replace_text') {
    const at = doc.indexOf(proposal.find);
    if (at === -1) return { ok: false, reason: 'That exact text is not in the note — it may have changed since the suggestion.', note };
    const occurrences = doc.split(proposal.find).length - 1;
    return {
      ok: true,
      note,
      before: doc,
      after: doc.slice(0, at) + proposal.replace + doc.slice(at + proposal.find.length),
      warning: occurrences > 1 ? `That text appears ${occurrences} times — only the first will change.` : '',
    };
  }
  if (proposal.type === 'rename_note') {
    const clash = findNote(files, proposal.newName);
    if (clash && clash.id !== note.id) return { ok: false, reason: `A note named "${proposal.newName}" already exists.`, note };
    return { ok: true, note, before: note.name, after: proposal.newName };
  }
  return { ok: false, reason: 'Unsupported change type.' };
}

function appendMarkdown(doc, markdown) {
  const body = markdown.trim();
  if (!doc.trim()) return body + '\n';
  return doc.replace(/\s*$/, '') + '\n\n' + body + '\n';
}

/** Short human label for the review card. */
export function describeProposal(proposal) {
  switch (proposal.type) {
    case 'create_note': return `Create note “${proposal.name}”`;
    case 'append_to_note': return `Add to “${proposal.note}”`;
    case 'replace_note': return `Rewrite “${proposal.note}”`;
    case 'replace_text': return `Edit text in “${proposal.note}”`;
    case 'rename_note': return `Rename “${proposal.note}” → “${proposal.newName}”`;
    default: return 'Change';
  }
}

/**
 * Apply one proposal to a { files, docs } snapshot. Pure — returns a new snapshot.
 * Returns { files, docs, openId, applied:false, reason } when it cannot apply.
 */
export function applyProposal(proposal, { files = [], docs = {} } = {}, { newId } = {}) {
  const resolved = resolveProposal(proposal, { files, docs });
  if (!resolved.ok) return { files, docs, openId: null, applied: false, reason: resolved.reason };

  if (proposal.type === 'create_note') {
    const id = (newId ? newId() : 'ai-' + Date.now().toString(36));
    const name = uniqueVaultName(files, proposal.name, null);
    return {
      files: [...files, { id, name, top: true, mtime: Date.now() }],
      docs: { ...docs, [id]: proposal.markdown.trim() + '\n' },
      openId: id,
      applied: true,
    };
  }

  const note = resolved.note;
  if (proposal.type === 'rename_note') {
    return {
      files: files.map(f => (f.id === note.id ? { ...f, name: proposal.newName, mtime: Date.now() } : f)),
      docs,
      openId: note.id,
      applied: true,
    };
  }

  return {
    files: files.map(f => (f.id === note.id ? { ...f, mtime: Date.now() } : f)),
    docs: { ...docs, [note.id]: resolved.after },
    openId: note.id,
    applied: true,
  };
}

/** Heuristic: does this message read as a request to change the vault? */
export function looksLikeEditRequest(text = '') {
  return /\b(add|append|insert|create|make|write|rewrite|revise|edit|change|update|fix|rename|reword|tidy|clean up|turn .* into|split|merge)\b/i
    .test(String(text));
}
