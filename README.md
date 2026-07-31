# Inkwell

A local-first markdown note-taking app with drawing integration — UI from the
Claude Design prototype `Inkwell.dc.html` (kept in `design_import/`), with real
note-taking and drawing logic behind it.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:5173.

## Notes (markdown, live editing)

- Every note is a markdown document, persisted to `localStorage`.
- **Live block editing** (Notion-style): the page is always rendered — click
  any block to edit it in place; it commits and re-renders when you leave it.
  Enter splits blocks (and continues lists), Backspace at the start merges,
  arrow keys move between blocks.
- **The paper page**: notes render on a warm, grainy paper sheet with serif
  ink headings — Inkwell's signature look (toggleable in Settings).
- **Slash commands**: type `/` at the start of a line to open the block menu —
  `/h1`–`/h3`, `/bullet`, `/number`, `/todo`, `/table`, `/quote`, `/code`,
  `/divider`, `/sketch`. Arrow keys + Enter or click to insert.
- Supported syntax: `#`–`###` headings, paragraphs, `- ` / `1. ` lists,
  `- [ ]` task checkboxes (toggleable right in the page), `| a | b |` tables,
  `> ` quotes, `---` rules, code fences, `**bold**`, `*italic*`, `` `code` ``,
  `[text](url)` links, `[[Wikilinks]]` (rendered as plain colored links, no
  brackets), and `#tags`.
- **Create** notes with the `+` button, or by clicking a `[[wikilink]]` to a
  note that doesn't exist yet (Obsidian-style).
- **Rename** by editing the title — wikilinks across the vault are rewritten.
- **Delete** from the trash icon on file-tree rows (hover) or the editor header.
- **Linked mentions** under each note are computed from real backlinks.
- The graph view is built from actual wikilinks and tags (force layout), and
  the slides view drafts slides from the active note's `##` headings.

## Sketches (real Excalidraw)

Each sketch block embeds the open-source [Excalidraw](https://github.com/excalidraw/excalidraw)
editor (MIT). Add one anywhere with the toolbar button or a fence:

    ```sketch my-drawing
    ```

- Full Excalidraw feature set: selection, multi-select, move/resize/rotate,
  freedraw, shapes, arrows with bindings, text, images, undo/redo, zoom, and
  all its keyboard shortcuts.
- **Full-screen mode** per sketch (expand icon or Esc to exit); the drawing is
  automatically re-fit into view when the canvas changes size.
- Scenes are stored per fence id in the vault (`localStorage`), and sketches
  from the pre-Excalidraw format are migrated automatically.
- Slide thumbnails and present mode render scenes with Excalidraw's
  `exportToSvg` — dark slides use its dark-mode export, light slides the
  canonical ink colors, so contrast is always right.
- The canvas grid can be toggled in Settings.

## Assistant (free LLMs only)

The assistant panel answers questions about your vault with real model calls —
no paid APIs, no API keys:

1. **Ollama** (`localhost:11434`) is preferred when the "Local assistant"
   setting is on and a model is pulled (`ollama pull llama3.2`) — private,
   fully on-device.
2. Otherwise it falls back to **Pollinations.ai**, a keyless free endpoint,
   routed through a tiny dev-server proxy (`/api/llm` in `vite.config.js`).

Your open note is sent in full as context (other notes truncated); the badge in
the panel header shows which provider answered, and `[[note names]]` in replies
are clickable. If neither provider is reachable, the assistant says so instead
of failing silently.

The assistant is workspace-aware: it receives the open note, other vault notes,
the reading queue, paper metadata, saved highlights, and the active presentation
outline. When a slide is selected, it is identified in the context, including
speaker notes. Replies can be inserted into the open note, saved as a separate
draft, or explicitly added as an editable block on the selected slide, so
research assistance becomes part of the vault rather than a disposable chat.
Quick prompts can explain the open work in plain language or at a technical
level. In the PDF reader, select a passage to highlight it, or send that exact
passage to the assistant for a grounded simple or technical explanation.

## Research companion roadmap

Inkwell already supports paper discovery via OpenAlex, a local/imported PDF
reader, highlight-to-literature-note capture, citation autocomplete, APA/IEEE/
Chicago bibliography generation, tagged reading queues, duplicate review, saved
searches, grounded literature maps and evidence matrices, AI deck generation,
editable slides, linked library citations in slides, presentation mode, and
standalone HTML deck export (which can be printed to PDF). Local `.pptx`
outline import preserves slide order and turns readable slide text into editable
Inkwell deck blocks. Decks can also turn their linked citations into an editable
APA, IEEE, or Chicago sources slide. The next increments are:

- richer paper triage (collections); current search supports open-access,
  publication-window, relevance/recent/citation ranking, and venue/retraction cues;
- richer reference-library workflows (collections, source-quality checks, and saved searches);
- a deeper slide canvas (image placement, collaborative review, reusable themes,
  and additional export formats); and
- explicit assistant tools for proposing and applying safe changes across notes,
  research records, and decks with a visible review step.

## Saving your notes

The vault lives in the browser's `localStorage` (per device, per browser):

- **Settings → Export vault (.json)** downloads everything — notes, sketches,
  settings. **Import vault…** restores it (on another device, after clearing
  the browser, or on the deployed site).
- The **download button in the editor header** saves the open note as a plain
  `.md` file you can open anywhere (Obsidian included).

## Deploying (free)

Vercel's free Hobby tier fits best — the app is static except the assistant's
`/api/llm` proxy, which deploys automatically as the serverless function in
`api/llm.js`:

```
npm i -g vercel
vercel login
vercel          # from this folder; accept the detected Vite defaults
```

`vercel --prod` publishes to the production URL. Cloudflare Pages also works
(port `api/llm.js` to a Pages Function); GitHub Pages does not (static-only —
the assistant's cloud fallback would break).

Note: on a deployed site, the "Local assistant" (Ollama) tier requires visitors
to run Ollama with relaxed CORS (`OLLAMA_ORIGINS=<site origin>`); the free
cloud fallback works out of the box.

## Stack

Vite + React 19 + `@excalidraw/excalidraw`. The markdown engine
(`src/markdown.jsx`) is a small custom parser so wikilinks, tags, tasks, and
sketch fences render exactly like the design.
