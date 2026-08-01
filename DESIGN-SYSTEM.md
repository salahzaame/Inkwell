# Inkwell — Design System

> **Status:** Reverse-engineered from the implementation (2026-08-01), not a pre-existing spec.
> Everything below is what the code actually does. Measured drift and known failures are
> included deliberately — they're part of the honest picture, not omissions.

---

## 1. Product context

**Inkwell** is a local-first research notebook, built for a working academic researcher who
spends hours a day reading papers and writing notes. Not a general note app.

- **Core loop:** find paper (OpenAlex) → read PDF → highlight → highlight becomes a literature note → notes link into arguments → arguments become slides.
- **Constraints:** local-first (vault in `localStorage`), free/open-source dependencies only, no accounts, no telemetry.
- **Design intent, stated:** *research-centred, visually calm, comfortable for long reading sessions.*
- **Platform:** desktop web (React 19 + Vite). Not currently designed for mobile.

**The design tension to review:** it must feel like a calm reading instrument, but it also
contains an AI assistant, a slide studio, a graph view, and a PDF reader. Today those
compete for the same screen.

---

## 2. Colour

### 2.1 Shell tokens (`:root` in `src/styles.css`)

The stated principle: *one grey ramp, one warm accent, paper-white PDF pages as the brightest thing on screen.*

| Token | Value | Role |
|---|---|---|
| `--bg-deep` | `#131418` | Icon rail, app frame |
| `--bg-panel` | `#191b1f` | Sidebars, chrome bars |
| `--bg-canvas` | `#1e2025` | Main working surface |
| `--bg-raise` | `#22242b` | Cards, hovers, inputs |
| `--bg-raise-2` | `#262932` | Raised-on-raised |
| `--line` | `#23252b` | Every hairline border |
| `--line-2` | `#2c2f37` | Interactive borders |
| `--ink-1` | `#e2e4ea` | Primary text |
| `--ink-2` | `#9aa0af` | Secondary text |
| `--ink-3` | `#5b6170` | Faint text, glyphs |
| `--ok` | `#34d399` | Success |
| `--danger` | `#f87171` | Destructive |
| `--marker-amber` | `#fbbf24` | PDF highlighter |
| `--marker-mint` | `#34d399` | PDF highlighter |
| `--marker-rose` | `#fb7185` | PDF highlighter |

### 2.2 Accent

`--acc` is **not** defined in `:root`. It's injected inline from user settings, defaulting to
**`#fbbf24`** (amber). Selectable: `#a78bfa` violet, `#5eead4` teal, `#fbbf24` amber, `#f472b6` pink.

Accent is used via `color-mix` throughout, e.g.:
- Tag chips — `color-mix(in oklab, var(--acc) 14%, transparent)` bg, `var(--acc)` text
- Focus/selection — `color-mix(in oklab, var(--acc) 30%, transparent)`
- Chip hover — border and text both go to `--acc`

**On the paper sheet the accent is deliberately darkened** so amber stays legible on cream:
`--acc: color-mix(in oklab, {accent} 62%, #3d2f05)`. This is a genuinely good detail.

### 2.3 The two editor palettes (`PAL` in `src/components/Editor.jsx`)

The note sheet toggles between "paper" (signature) and "dark". **These are a second, parallel
colour system that does not read from the shell tokens.**

| Role | `PAL.paper` | `PAL.dark` |
|---|---|---|
| `ink` (headings) | `#26221a` | `#e7e9ef` |
| `body` | `#3f3a2f` | `#c3c7d1` |
| `muted` | `#8a8272` | `#8b90a0` |
| `faint` | `#a49b86` | `#5b6170` |
| `border` | `#e0d9c6` | `#2c2f37` |
| `card` | `#fffdf7` | `#1a1c21` |
| `codeBg` | `#efe9d9` | `#16181d` |

Paper sheet: background `#f6f2e7`, `border-radius: 18px`, `padding: 42px 52px 26px`,
`max-width: 820px`, plus an SVG fractal-noise overlay at `opacity: .38`, `mix-blend-mode: multiply`.

### 2.4 Deck themes

Slides have their own theme enum: `midnight` | `paper` | `seagrass`. Dark slide base `#16171b`
on `#e8eaf0` text; `.deck-slide.light` is `#f4f1e9` on `#26221a`.

### 2.5 PDF reading themes

Three: default (white), `sepia` (`#f3ecdd` page, `sepia(.32)` filter), `night`
(`invert(.94) hue-rotate(180deg)`). Chrome is untouched by all three — only the page is filtered.

---

## 3. Typography

### 3.1 Families

| Family | Use | Weights |
|---|---|---|
| **Instrument Sans** | UI and body text | 400, 500, 600, 700 |
| **Fraunces** (serif) | Paper-sheet headings, deck headings, stat values | 500, 600, 700 (`opsz 9..144`) |
| **Gochi Hand** (handwriting) | Margin-note moments: PDF marker popover label, reading-queue section labels, split-pane tooltip | single |

Loaded from Google Fonts in `index.html` with `preconnect`. Fallbacks: `system-ui, sans-serif`
and `Georgia, serif`.

### 3.2 Actual sizes in use

Body copy is **15.5px / 1.75** — good, and the one place the reading intent shows.

Heading scale on the sheet: note title **37px/700/-.015em**, then **27 / 22 / 17.5px** for h1–h3.

Everything else is chrome, and it is small: the three most common sizes in the entire codebase
are **10.5px (36 uses), 11px (35), 12px (31)**.

> **Drift:** 26 distinct font sizes are hardcoded across `src/`. There is no type scale — sizes
> include 9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5…

### 3.3 Label voice

Panel headers and section labels share one treatment: **12px, weight 600, `letter-spacing: .4px`,
`text-transform: uppercase`, `--ink-2`**. Smaller variants use 10–10.5px with `.05–.08em` tracking.

---

## 4. Space, radius, motion

**Radius tokens exist** — `--r-s: 6px`, `--r-m: 8px`, `--r-l: 12px` — but **18 distinct radius
values are in use** (2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 26, 99, 999px). The
tokens are largely bypassed. `99px`/`999px` = pill.

**Spacing** has no scale either: gaps of 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18px, with 6/7/8
dominating. Block rhythm in the editor is a consistent `margin: 0 0 22px`.

**Motion** — five keyframes, all short and restrained:

| Name | Duration | Use |
|---|---|---|
| `fadeUp` | .2s | Message/blocks entering |
| `popIn` | .12s | Popovers, menus |
| `panelIn` | .16s | Side panels |
| `blinkDot` | 1.2s | Assistant typing |
| `floatY` | — | Landing page ornament |

`prefers-reduced-motion: reduce` is respected globally (clamps all animation/transition to `.01ms`).

---

## 5. Layout

### 5.1 Shell

```
┌────┬──────────────┬─────────────────────┬──────────────┐
│    │              │                     │              │
│rail│  files /     │   note sheet /      │  assistant   │
│~46 │  research    │   PDF reader        │   (chat)     │
│ px │  252px       │   486px             │   300px      │
└────┴──────────────┴─────────────────────┴──────────────┘
```

Measured at a 1084px viewport. **The note gets ~45% of width; the paper sheet inside it is
477px, giving roughly 48 characters per line** (comfortable measure is 60–75).

- **Icon rail:** 10 destinations — Files, Quick switcher, Graph, Slides, Research Library, Assistant, Zen focus, Settings (+2).
- **Panels:** all share `.side-panel` (44px header, same label voice, `panelIn` animation). This part is consistent.
- **Split workspace:** PDF ↔ note, draggable gutter styled as an "ink seam" (warm browns `#5d4e37`, a Gochi Hand tooltip), not an IDE divider.
- **Defaults on load:** files sidebar open, assistant open, research panel closed, view = editor.

### 5.2 Responsive

Only the deck studio and split workspace have breakpoints (920px, 760px, 650px). The main shell
does not respond. Mobile is out of scope today.

---

## 6. Components

| Component | Pattern |
|---|---|
| **Panel** | `.side-panel` + `.panel-header` (44px) + `.panel-title` (uppercase 12px) + `.panel-close` (24px) |
| **Segmented control** | `.seg` — pill group, active = `--acc` text on `--bg-panel` |
| **Chip** | `.hv-chip` — 11.5px, pill, `--line-2` border; hover turns border + text to `--acc` |
| **Card** | `.queue-card` — 12px radius, `--bg-raise`, hover lightens border to `#3a3e48` |
| **Note blocks** | Click-to-edit. Rendered block ↔ raw textarea swap, mapped by half-open `[line0, line1)` source ranges |
| **Table** | Rendered as real `<input>` cells, edited in place, written back to markdown |
| **Diagram** | ` ```mermaid ` fence → rendered SVG + "Edit as sketch" / "Show source"; falls back to source on parse error |
| **Sketch** | ` ```sketch <id> ` fence → embedded Excalidraw canvas, expandable to fullscreen |
| **Assistant proposal** | Review card with Apply / Dismiss per change; nothing writes until applied |
| **PDF highlight popover** | `.pdf-pop` — floating, three marker dots, Gochi Hand label |

### Interaction conventions

- **Hover** is the primary affordance — 12 `.hv-*` utility classes.
- **Destructive controls hide until row hover** (`.tree-del`, `.note-figure-del`).
- **Selection** is a quiet accent outline, never a second UI layer (stated principle in the slide canvas CSS).
- **Confirmation** via `window.confirm` for deletes and whole-note replacement.

---

## 7. Signature ideas worth protecting

These are the things that make it *not* a generic dark-mode app. A reviewer should preserve them:

1. **The paper sheet.** Warm cream page with fractal-noise texture, floating on dark chrome, Fraunces headings. It's the product's identity.
2. **Accent inking.** The accent darkens on paper so it stays legible — the system adapts rather than repeating itself.
3. **Handwriting as annotation voice.** Gochi Hand appears only where a human would scribble in a margin.
4. **The ink seam.** The PDF/note divider is styled as a deliberate object, not a UI chrome line.
5. **Paper is the brightest thing on screen.** The stated hierarchy rule, and it holds.

---

## 8. Known drift (measured, 2026-08-01)

| Issue | Measurement |
|---|---|
| Hardcoded colours outside the token system | **70 distinct hex values** across `src/*.js(x)` |
| Editor palettes diverge from shell tokens | `PAL.dark.ink` `#e7e9ef` ≠ `--ink-1` `#e2e4ea`; `PAL.dark.muted` `#8b90a0` ≠ `--ink-2` `#9aa0af` |
| Pre-paint background mismatch | `index.html` hardcodes `#17181c`; `--bg-deep` is `#131418` |
| Type scale | 26 distinct font sizes |
| Radius scale | 3 tokens defined, 18 values used |
| Spacing scale | 12 distinct gap values, no rhythm |
| Styling approach | Mostly inline styles; hover states need 12 `!important` classes to override them |

---

## 9. Known accessibility failures (measured on the live DOM)

**Keyboard — the most serious issue.** 133 elements render with `cursor: pointer`; **127 are not
reachable by keyboard.** The entire icon rail, every file-tree row, chips, and close buttons are
`<div onClick>` with no `tabindex`, `role`, or key handler. Only 22 tabbable nodes exist in the
whole app.

**Focus states.** 34 `:focus` rules exist, but all except two come from Excalidraw's bundled
stylesheet. Inkwell itself defines focus only for the split gutter and slide canvas.

**Contrast — 12 real failures at WCAG AA** (alpha-composited, so these are true):

| Text | Size | Ratio | Needs |
|---|---|---|---|
| Blockquote body text | 15.5px | **3.40** | 4.5 |
| Breadcrumb `/`, "edited …" | 12–12.5px | **2.47** | 4.5 |
| "Linked mentions · N" | 11.5px | **2.47** | 4.5 |
| `CITE` label | 9px | **2.64** | 4.5 |
| Word count, "Ctrl+K quick switcher" | 11.5px | **2.78** | 4.5 |
| Assistant footer disclaimer | 10.5px | **2.78** | 4.5 |

`--ink-3` (`#5b6170`) never passes AA on any surface in the system.

**Touch targets.** Smallest found: 18×18px ("Move to…" in the file tree). Several 20–23px controls.

---

## 10. Questions for the reviewer

1. **Spatial hierarchy.** The assistant is a permanently-open 300px panel, co-equal with the
   document, which is what makes the app read as "an AI app." How should an AI assistant sit in
   a tool whose job is sustained reading?
2. **Reading measure.** 48 characters per line in a long-session reading app — how much width
   should the sheet claim, and what gives way?
3. **Ten rail destinations** for what is essentially one activity (read → annotate → write →
   present). What's the right grouping?
4. **Two colour systems.** Should `PAL.paper`/`PAL.dark` be expressed as tokens, or is a separate
   "document" palette legitimately different from "chrome"?
5. **Density.** 10.5px is the most common size in the app. Is the chrome too quiet, or correctly
   recessive against the paper?
6. **Daily-use ritual.** There is no "today"/resume surface — the app opens on the first note in
   file order every time and does not persist the active note or open tabs. What should greet
   someone opening this every morning?

---

## Appendix — where things live

| Concern | File |
|---|---|
| Tokens, all shared CSS | `src/styles.css` |
| Editor palettes, note blocks, slash menu | `src/components/Editor.jsx` |
| Block parsing (`[line0, line1)` ranges) | `src/blocks.js` |
| Shell, layout, view routing | `src/App.jsx` |
| Assistant panel + proposal cards | `src/components/AIPanel.jsx` |
| Slide/deck styles | `src/styles.css` (`.deck-*`) |
| PDF reader | `src/styles.css` (`.pdf-*`), `src/components/PdfViewer.jsx` |
| Fonts | `index.html` |
