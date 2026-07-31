import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { deckFromPptxText, extractPptxSlideText, importPptxDeck } from '../src/deck/import-pptx.js';

test('extracts PPTX text runs in visible document order and decodes entities', () => {
  const xml = '<p:sld><a:t>Title &amp; context</a:t><a:t>First point</a:t><a:t>Second point</a:t></p:sld>';
  assert.deepEqual(extractPptxSlideText(xml), ['Title & context', 'First point', 'Second point']);
});

test('maps imported PPTX outline text to editable title, heading, and bullet blocks', () => {
  const deck = deckFromPptxText([
    ['Research update', 'May 2026'],
    ['Findings', 'Replicated result', 'Open uncertainty'],
  ], { title: 'Imported study', theme: 'paper' });
  assert.deepEqual(deck.elements.deck.children, ['slide-import-1', 'slide-import-2']);
  assert.equal(deck.elements['title-import-1'].type, 'Title');
  assert.equal(deck.elements['heading-import-2'].props.text, 'Findings');
  assert.deepEqual(deck.elements['body-import-2'].props.items, ['Replicated result', 'Open uncertainty']);
  assert.equal(deck.elements.deck.props.theme, 'paper');
});

test('imports slide XML from a local PPTX archive without a network request', async () => {
  const archive = new JSZip();
  archive.file('ppt/slides/slide1.xml', '<p:sld><a:t>Local deck</a:t><a:t>Private import</a:t></p:sld>');
  archive.file('ppt/slides/slide2.xml', '<p:sld><a:t>Result</a:t><a:t>Editable finding</a:t></p:sld>');
  const bytes = await archive.generateAsync({ type: 'uint8array' });
  const file = { name: 'local-deck.pptx', size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  const deck = await importPptxDeck(file, { theme: 'seagrass' });
  assert.equal(deck.elements.deck.props.title, 'local deck');
  assert.equal(deck.elements.deck.props.theme, 'seagrass');
  assert.equal(deck.elements['heading-import-2'].props.text, 'Result');
});
