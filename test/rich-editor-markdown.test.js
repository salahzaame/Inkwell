import './helpers/dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Editor } from '@tiptap/core';
import { noteExtensions } from '../src/editor/note-schema.js';
import { parseBlocks } from '../src/blocks.js';

const roundTrip = (markdown) => {
  const editor = new Editor({ extensions: noteExtensions(), content: markdown, contentType: 'markdown' });
  const out = editor.getMarkdown();
  editor.destroy();
  return out;
};

// What Inkwell itself reads from a note: block types and their text, with the
// cosmetic differences a serializer may introduce (table padding) normalised.
const meaning = (markdown) => parseBlocks(markdown).map(({ line0, line1, ...b }) => b);

const NOTE = `## Methods

- **Authors:** Gemma Team, Thomas
- Second with *italic* and \`code\`
- A [link](https://example.org) and [[Weekly Sync]] wiki

1. first
2. second

- [ ] open task
- [x] done task

> A quoted line with #tag and [@smith2020]

| Column 1 | Column 2 |
| --- | --- |
| a | b |

\`\`\`sketch sk-abc123
\`\`\`

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

![a caption](img:im-xyz)

See [highlight](hl://h-123) for the quote, per [@doe-2021].

---

Plain paragraph
continued on next line.`;

test('a note using every Inkwell construct means the same after a round trip', () => {
  assert.deepEqual(meaning(roundTrip(NOTE)), meaning(NOTE));
});

test('wikilinks, citations, images and sketches are written back byte for byte', () => {
  const out = roundTrip(NOTE);
  for (const exact of ['[[Weekly Sync]]', '[@smith2020]', '[@doe-2021]', '![a caption](img:im-xyz)', '```sketch sk-abc123\n```', '[highlight](hl://h-123)', '#tag']) {
    assert.ok(out.includes(exact), `lost ${exact}\n---\n${out}`);
  }
  assert.ok(!out.includes('\\['), `escaped a bracket\n---\n${out}`);
});

test('a second round trip changes nothing (the format is stable)', () => {
  const once = roundTrip(NOTE);
  assert.equal(roundTrip(once), once);
});

test('an image in the middle of a sentence is kept, not dropped', () => {
  const md = 'Before ![inline](https://x.org/a.png) after.';
  assert.ok(roundTrip(md).includes('![inline](https://x.org/a.png)'));
});

test('an empty note stays empty', () => {
  assert.equal(roundTrip(''), '');
});
