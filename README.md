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
