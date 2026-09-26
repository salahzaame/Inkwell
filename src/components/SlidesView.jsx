import { Component, useEffect, useState } from 'react';
import { Renderer } from '@json-render/react';
import { exportToSvg } from '@excalidraw/excalidraw';
import { monthYear } from '../data.js';
import SketchSnapshot from './SketchSnapshot.jsx';
import { DECK_THEMES, deckRegistry, DeckAssets, DeckProviders, deckSlideKeys, getDeckTheme, slideSpec } from '../deck/registry.jsx';
import { buildDeckExportHtml, deckExportFileName, downloadDeckExport } from '../deck/export.js';
import { canMoveDeckElement, moveDeckElement } from '../deck/mutate.js';
import { appendDeckReferencesSlide, deckCitationKeys } from '../deck/references.js';
import { addImageBlock, addTwoColumnFrame } from '../deck/compose.js';
import InteractiveSlideCanvas from './InteractiveSlideCanvas.jsx';

/** One bad slide should never take down the whole view. */
export class SlideBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: '12px', opacity: .5 }}>this slide failed to render</div>;
    }
    return this.props.children;
  }
}

function editableDescendants(spec, key, seen = new Set()) {
  if (!key || seen.has(key) || !spec?.elements?.[key]) return [];
  seen.add(key);
  const element = spec.elements[key];
  return [key, ...(element.children || []).flatMap(child => editableDescendants(spec, child, seen))];
}

function cloneDeck(spec) {
  return JSON.parse(JSON.stringify(spec));
}

function svgDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
}

const editorButton = {
  border: '1px solid var(--line-2)', background: 'var(--bg-canvas)', color: 'var(--ink-2)',
  borderRadius: '6px', cursor: 'pointer', padding: '6px 9px', fontSize: '11.5px', fontWeight: 600,
};

const editorLabel = {
  display: 'grid', gap: '5px', color: 'var(--ink-3)', fontSize: '10.5px', fontWeight: 700,
  letterSpacing: '.06em', textTransform: 'uppercase',
};

const editorInput = {
  boxSizing: 'border-box', width: '100%', background: 'var(--bg-canvas)', border: '1px solid var(--line-2)',
  borderRadius: '6px', color: 'var(--ink-1)', outline: 'none', padding: '7px 8px', font: 'inherit',
  fontSize: '12.5px', lineHeight: 1.45,
};

export default function SlidesView({
  noteName, slides, template, importNote, sketches, images, references = [],
  deck, deckBusy, onGenerateDeck, onClearDeck, onUpdateDeck,
  onTemplate, onPresent, onSelectSlide, onImportDeck, onImportSlideImage, onEditOutline,
}) {
  const light = template === 'light';
  const thBg = light ? '#f4f1e9' : '#141518';
  const thInk = light ? '#26221a' : '#e8eaf0';
  const thSub = light ? '#8a8272' : '#5b6170';
  const box = {
    aspectRatio: '16/9', background: thBg, border: '1px solid ' + (light ? '#e0dbcd' : '#2c2f37'),
    borderRadius: '8px', padding: '16px 18px', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', gap: '7px', overflow: 'hidden',
  };
  const small = { fontSize: '12px', fontWeight: 600, color: thInk };
  const line = (w) => ({ height: '6px', borderRadius: '3px', background: light ? '#dcd6c6' : '#26292f', width: w, flexShrink: 0 });
  const chip = (on) => ({
    fontSize: '12.5px', padding: '6px 14px', borderRadius: '99px', cursor: 'pointer',
    border: on ? '1px solid var(--acc)' : '1px solid var(--line-2)',
    color: on ? 'var(--acc)' : 'var(--ink-2)',
    background: on ? 'color-mix(in oklab, var(--acc) 10%, transparent)' : 'transparent',
  });
  const caption = { fontSize: '11.5px', color: 'var(--ink-3)' };
  const LINE_WIDTHS = ['82%', '64%', '74%', '58%', '68%'];

  const slideKeys = deck ? deckSlideKeys(deck) : [];
  const hasContent = deck ? slideKeys.length > 0 : slides.length > 0;
  const activeDeckTheme = getDeckTheme(deck?.elements?.[deck?.root]?.props?.theme || (template === 'light' ? 'paper' : 'midnight'));
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [referencesStyle, setReferencesStyle] = useState('apa');
  const [sourcesError, setSourcesError] = useState('');
  const [addingMedia, setAddingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [selectedBlock, setSelectedBlock] = useState(null);

  const chooseSlide = (key) => {
    setSelectedSlide(key);
    onSelectSlide?.(key);
  };

  useEffect(() => {
    if (deck && (!selectedSlide || !slideKeys.includes(selectedSlide))) chooseSlide(slideKeys[0] || null);
    if (!deck) chooseSlide(null);
  }, [deck, selectedSlide, slideKeys.join('|'), onSelectSlide]);

  useEffect(() => {
    if (!deck || !selectedSlide) { setSelectedBlock(null); return; }
    const blocks = editableDescendants(deck, selectedSlide).slice(1);
    setSelectedBlock(current => blocks.includes(current) ? current : (blocks[0] || null));
  }, [deck, selectedSlide]);

  const mutateDeck = (mutator) => onUpdateDeck?.((current) => {
    const next = cloneDeck(current);
    mutator(next);
    return next;
  });

  const updateProps = (key, props) => mutateDeck(next => {
    next.elements[key] = { ...next.elements[key], props: { ...next.elements[key].props, ...props } };
  });

  const parentOf = (spec, childKey) => Object.entries(spec.elements || {}).find(([, item]) => (item.children || []).includes(childKey))?.[0] || null;
  const insertAtSelection = (next, key) => {
    const parentKey = selectedBlock ? parentOf(next, selectedBlock) : null;
    const parent = next.elements[parentKey] || next.elements[selectedSlide];
    if (!parent) return;
    const children = [...(parent.children || [])];
    const index = selectedBlock && parentKey ? children.indexOf(selectedBlock) : children.length - 1;
    children.splice(index + 1, 0, key);
    parent.children = children;
  };

  const setDeckTheme = (theme) => mutateDeck(next => {
    next.elements[next.root] = { ...next.elements[next.root], props: { ...next.elements[next.root].props, theme } };
  });

  const addSlide = () => {
    const suffix = `manual-${Date.now().toString(36)}`;
    const slideKey = `slide-${suffix}`;
    const headingKey = `heading-${suffix}`;
    const bulletsKey = `bullets-${suffix}`;
    mutateDeck(next => {
      next.elements[slideKey] = { type: 'Slide', props: { layout: 'content', eyebrow: 'New section' }, children: [headingKey, bulletsKey] };
      next.elements[headingKey] = { type: 'Heading', props: { text: 'New slide' }, children: [] };
      next.elements[bulletsKey] = { type: 'Bullets', props: { items: ['Add a concise point'], numbered: null }, children: [] };
      next.elements[next.root].children.push(slideKey);
    });
    chooseSlide(slideKey);
  };

  const addAssetToSlide = (type, id) => {
    if (!selectedSlide) return;
    let addedKey = null;
    mutateDeck(next => {
      if (type === 'NoteImage') {
        addedKey = addImageBlock(next, selectedSlide, id);
        const children = next.elements[selectedSlide].children || [];
        next.elements[selectedSlide].children = children.filter(key => key !== addedKey);
        insertAtSelection(next, addedKey);
      }
      else {
        const key = `${type.toLowerCase()}-${Date.now().toString(36)}`;
        next.elements[key] = { type, props: { id }, children: [] };
        insertAtSelection(next, key);
        addedKey = key;
      }
    });
    if (addedKey) setSelectedBlock(addedKey);
  };

  const addTwoColumns = () => {
    if (!selectedSlide) return;
    let addedKey = null;
    mutateDeck(next => {
      addedKey = addTwoColumnFrame(next, selectedSlide);
      const children = next.elements[selectedSlide].children || [];
      next.elements[selectedSlide].children = children.filter(key => key !== addedKey);
      insertAtSelection(next, addedKey);
    });
    if (addedKey) setSelectedBlock(addedKey);
  };

  const addUploadedImage = async (file) => {
    if (!file || addingMedia || !onImportSlideImage || !selectedSlide) return;
    setAddingMedia(true);
    setMediaError('');
    try {
      const imageId = await onImportSlideImage(file);
      if (imageId) addAssetToSlide('NoteImage', imageId);
    } catch (error) {
      setMediaError(error?.message || 'This image could not be added to the slide.');
    } finally {
      setAddingMedia(false);
    }
  };

  const addContentBlock = (type) => {
    if (!selectedSlide) return;
    const key = `${type.toLowerCase()}-${Date.now().toString(36)}`;
    const props = {
      Heading: { text: 'New heading' },
      Text: { text: 'Add a concise explanation for this slide.', dim: null },
      Quote: { text: 'Add a supporting quotation.', cite: null },
      Stat: { value: '0%', label: 'Describe this metric' },
      Bullets: { items: ['Add a concise point'], numbered: null },
      Citation: { citationKey: '', label: null },
    }[type];
    mutateDeck(next => {
      next.elements[key] = { type, props, children: [] };
      insertAtSelection(next, key);
    });
    setSelectedBlock(key);
  };

  const addCitationToSlide = (citationKey) => {
    if (!selectedSlide || !citationKey) return;
    const key = `citation-${Date.now().toString(36)}`;
    mutateDeck(next => {
      next.elements[key] = { type: 'Citation', props: { citationKey, label: null }, children: [] };
      insertAtSelection(next, key);
    });
    setSelectedBlock(key);
  };

  const moveSlide = (direction) => {
    const ix = slideKeys.indexOf(selectedSlide);
    const target = ix + direction;
    if (ix < 0 || target < 0 || target >= slideKeys.length) return;
    mutateDeck(next => {
      const children = next.elements[next.root].children;
      [children[ix], children[target]] = [children[target], children[ix]];
    });
  };

  const duplicateSlide = () => {
    if (!selectedSlide) return;
    const suffix = `copy-${Date.now().toString(36)}`;
    const duplicateKey = `${selectedSlide}-${suffix}`;
    mutateDeck(next => {
      const source = cloneDeck(next).elements;
      const copyNode = (oldKey) => {
        const old = source[oldKey];
        const newKey = `${oldKey}-${suffix}`;
        next.elements[newKey] = { ...old, props: { ...old.props }, children: (old.children || []).map(copyNode) };
        return newKey;
      };
      copyNode(selectedSlide);
      const children = next.elements[next.root].children;
      children.splice(children.indexOf(selectedSlide) + 1, 0, duplicateKey);
    });
    chooseSlide(duplicateKey);
  };

  const deleteSlide = () => {
    if (!selectedSlide || slideKeys.length < 2) return;
    const formerIndex = slideKeys.indexOf(selectedSlide);
    mutateDeck(next => {
      const remove = editableDescendants(next, selectedSlide);
      next.elements[next.root].children = next.elements[next.root].children.filter(k => k !== selectedSlide);
      remove.forEach(k => delete next.elements[k]);
    });
    chooseSlide(slideKeys[formerIndex + 1] || slideKeys[formerIndex - 1] || null);
  };

  const removeElement = (key) => mutateDeck(next => {
    const keys = editableDescendants(next, key);
    for (const element of Object.values(next.elements)) {
      element.children = (element.children || []).filter(child => child !== key);
    }
    keys.forEach(item => delete next.elements[item]);
  });

  const moveElement = (key, direction) => mutateDeck(next => {
    moveDeckElement(next, key, direction);
  });

  const exportDeck = async () => {
    if (!deck || exporting) return;
    setExporting(true);
    try {
      const sketchIds = [...new Set(Object.values(deck.elements)
        .filter(item => item?.type === 'Sketch' && item.props?.id)
        .map(item => item.props.id))];
      const entries = await Promise.all(sketchIds.map(async (id) => {
        const data = sketches?.[id];
        if (!data) return [id, null];
        try {
          const svg = await exportToSvg({
            elements: (data.elements || []).filter(element => !element.isDeleted),
            files: data.files || null,
            appState: { exportBackground: false, exportWithDarkMode: !activeDeckTheme.light },
            exportPadding: 16,
          });
          return [id, svgDataUri(new XMLSerializer().serializeToString(svg))];
        } catch {
          return [id, null];
        }
      }));
      const sketchSvgs = Object.fromEntries(entries.filter(([, value]) => value));
      const html = buildDeckExportHtml({ deck, noteName, images: images || {}, references, sketchSvgs });
      downloadDeckExport(html, deckExportFileName(noteName));
    } catch {
      alert('The deck could not be exported. Try again after the slide assets finish loading.');
    } finally {
      setExporting(false);
    }
  };

  const importDeckFile = async (file) => {
    if (!file || importing || !onImportDeck) return;
    setImporting(true);
    setImportError('');
    try {
      await onImportDeck(file);
    } catch (error) {
      setImportError(error?.message || 'This PPTX could not be imported.');
    } finally {
      setImporting(false);
    }
  };

  const addSourcesSlide = () => {
    let slideKey = null;
    mutateDeck(next => { slideKey = appendDeckReferencesSlide(next, references, referencesStyle); });
    if (!slideKey) { setSourcesError('Add at least one linked citation block before creating a sources slide.'); return; }
    setSourcesError('');
    chooseSlide(slideKey);
  };

  const selectedElement = deck?.elements?.[selectedSlide];
  const selectedBlockElement = deck?.elements?.[selectedBlock];
  const editable = selectedSlide ? editableDescendants(deck, selectedSlide)
    .map(key => ({ key, element: deck.elements[key] }))
    .filter(({ element }) => ['Title', 'Heading', 'Bullets', 'Text', 'Quote', 'Stat', 'NoteImage', 'Sketch', 'Citation', 'Columns'].includes(element.type)) : [];

  const aiBtn = {
    display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600, fontSize: '13px',
    padding: '8px 15px', borderRadius: '8px', cursor: deckBusy ? 'default' : 'pointer',
    border: '1px solid color-mix(in oklab, var(--acc) 45%, transparent)',
    color: 'var(--acc)', background: 'color-mix(in oklab, var(--acc) 9%, transparent)',
    opacity: deckBusy ? .7 : 1,
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      <div style={{ maxWidth: deck ? '1320px' : '860px', margin: '0 auto', padding: '28px 32px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '6px', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '6px' }}>Presentation from</div>
            <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noteName}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <div onClick={deckBusy ? undefined : onGenerateDeck} style={aiBtn} title="Let the assistant design a full deck from this note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6zM19 15l.9 2.4 2.4.9-2.4.9L19 21.5l-.9-2.3-2.4-.9 2.4-.9z" /></svg>
              {deckBusy ? 'Designing your deck…' : (deck ? 'Regenerate AI deck' : 'Design deck with AI')}
            </div>
            {!deck && hasContent && (
              <button type="button" onClick={onEditOutline} style={{ border: '1px solid var(--acc)', background: 'var(--acc)', color: '#17181c', fontWeight: 700, fontSize: '13.5px', padding: '9px 15px', borderRadius: '8px', cursor: 'pointer' }} title="Turn this local heading outline into an editable deck">
                Edit slides
              </button>
            )}
            {hasContent && (
              <div className="hv-bright" onClick={onPresent} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--acc)', color: '#17181c', fontWeight: 600, fontSize: '13.5px', padding: '9px 18px', borderRadius: '8px', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z" /></svg>
                Present
              </div>
            )}
            {deck && (
              <button type="button" onClick={exportDeck} disabled={exporting} style={{ ...editorButton, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? .7 : 1 }} title="Download a standalone deck you can share or print to PDF">
                {exporting ? 'Preparing export…' : 'Export HTML'}
              </button>
            )}
          </div>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--ink-2)', marginBottom: '22px' }}>
          {!deck && <button type="button" onClick={onEditOutline} style={{ border: 0, background: 'transparent', color: 'var(--acc)', cursor: 'pointer', padding: '0 4px 0 0', marginRight: '4px', font: 'inherit', fontWeight: 700 }}>Preview only — Edit slides</button>}
          {deck
            ? <>{slideKeys.length} slides designed by the assistant · <span onClick={onClearDeck} style={{ color: 'var(--acc)', cursor: 'pointer' }}>switch back to the heading outline</span></>
            : `${slides.length} ${slides.length === 1 ? 'slide' : 'slides'} drafted from your headings — or let the assistant design a full deck.`}
        </div>

        {deck && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {Object.entries(DECK_THEMES).map(([id, theme]) => (
              <button key={id} type="button" onClick={() => setDeckTheme(id)} style={{ ...chip(deck?.elements?.[deck.root]?.props?.theme === id || (!deck?.elements?.[deck.root]?.props?.theme && id === 'midnight')), background: theme.background, color: theme.ink }}>
                {theme.label}
              </button>
            ))}
          </div>
        )}
        {!deck && <div style={{ display: 'flex', gap: '8px', marginBottom: '26px' }}>
          <div onClick={() => onTemplate('dark')} style={chip(template === 'dark')}>Dark minimal</div>
          <div onClick={() => onTemplate('light')} style={chip(light)}>Paper light</div>
          {!deck && <div onClick={() => onTemplate('import')} style={chip(template === 'import')}>Import .pptx outline…</div>}
        </div>}
        {importNote && !deck && (
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); importDeckFile(event.dataTransfer.files?.[0]); }} style={{ border: '1px dashed #3a3e48', borderRadius: '10px', padding: '18px', textAlign: 'center', color: 'var(--ink-2)', fontSize: '13px', marginBottom: '26px' }}>
            <div>Drop a <b>.pptx</b> here to turn its slide text into an editable Inkwell deck.</div>
            <div style={{ color: 'var(--ink-3)', fontSize: '11.5px', lineHeight: 1.5, marginTop: '5px' }}>Keeps slide order and text locally; charts, images, and animations are not imported.</div>
            <label style={{ display: 'inline-flex', marginTop: '11px', cursor: importing ? 'default' : 'pointer', color: 'var(--acc)', fontWeight: 700, fontSize: '12px', opacity: importing ? .6 : 1 }}>
              <input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" disabled={importing} onChange={(event) => { importDeckFile(event.target.files?.[0]); event.target.value = ''; }} style={{ display: 'none' }} />
              {importing ? 'Importing locally…' : 'Choose a PPTX'}
            </label>
            {importError && <div role="alert" style={{ color: '#f58a8a', fontSize: '11.5px', marginTop: '9px' }}>{importError}</div>}
          </div>
        )}

        {deck ? (
          /* ── AI deck thumbnails ── */
          <DeckAssets.Provider value={{ sketches, images: images || {}, references, light: activeDeckTheme.light }}>
            <DeckProviders>
              <div className="deck-studio">
                <aside className="deck-filmstrip" aria-label="Slide navigator">
                  <div className="deck-pane-heading"><span>Slides</span><button type="button" onClick={addSlide} title="Add slide">+</button></div>
                  <div className="deck-filmstrip-list">
                    {slideKeys.map((key, index) => (
                      <button key={key} type="button" className={'deck-filmstrip-item' + (selectedSlide === key ? ' selected' : '')} onClick={() => chooseSlide(key)}>
                        <span className="deck-filmstrip-number">{index + 1}</span>
                        <span className={'deck-slide deck-filmstrip-preview' + (activeDeckTheme.light ? ' light' : '')} style={{ fontSize: '2.2px', background: activeDeckTheme.background, color: activeDeckTheme.ink, borderColor: activeDeckTheme.border, '--acc': activeDeckTheme.accent || 'var(--acc)' }}>
                          <SlideBoundary><Renderer spec={slideSpec(deck, key)} registry={deckRegistry} /></SlideBoundary>
                        </span>
                      </button>
                    ))}
                  </div>
                </aside>
                <main className="deck-stage">
                  <div className="deck-stage-topbar">
                    <span>Slide {slideKeys.indexOf(selectedSlide) + 1} of {slideKeys.length}</span>
                    <span>{selectedBlockElement ? `${selectedBlockElement.type} selected` : 'Select a block'}</span>
                  </div>
                  <InteractiveSlideCanvas
                    deck={deck} slideKey={selectedSlide} theme={activeDeckTheme} selectedKey={selectedBlock}
                    onSelect={setSelectedBlock} onChange={updateProps} images={images || {}} sketches={sketches || {}} references={references}
                  />
                  <div className="deck-stage-toolbar" aria-label="Add content">
                    <button type="button" onClick={() => addContentBlock('Text')}>Text</button>
                    <button type="button" onClick={() => addContentBlock('Heading')}>Heading</button>
                    <button type="button" onClick={() => addContentBlock('Quote')}>Quote</button>
                    <button type="button" onClick={addTwoColumns}>Columns</button>
                    <label>
                      <input type="file" accept="image/*" disabled={addingMedia} onChange={(event) => { addUploadedImage(event.target.files?.[0]); event.target.value = ''; }} />
                      {addingMedia ? 'Adding…' : 'Graphic'}
                    </label>
                  </div>
                  {mediaError && <div role="alert" className="deck-stage-error">{mediaError}</div>}
                </main>
                <aside className="deck-inspector">
                  <div className="deck-pane-heading"><span>Inspector</span></div>
                  <div className="deck-inspector-section">
                    <label>Slide layout
                      <select value={selectedElement?.props?.layout || 'content'} onChange={(event) => updateProps(selectedSlide, { layout: event.target.value })}>
                        <option value="title">Title</option><option value="content">Content</option><option value="statement">Statement</option><option value="end">End</option>
                      </select>
                    </label>
                    <div className="deck-inspector-actions">
                      <button type="button" onClick={() => moveSlide(-1)} disabled={slideKeys.indexOf(selectedSlide) === 0}>←</button>
                      <button type="button" onClick={() => moveSlide(1)} disabled={slideKeys.indexOf(selectedSlide) === slideKeys.length - 1}>→</button>
                      <button type="button" onClick={duplicateSlide}>Duplicate</button>
                    </div>
                  </div>
                  {selectedBlockElement ? (
                    <div className="deck-inspector-section">
                      <div className="deck-inspector-label">Selected block</div>
                      <strong>{selectedBlockElement.type}</strong>
                      <p>Type directly on the canvas, or use these actions.</p>
                      <div className="deck-inspector-actions">
                        <button type="button" onClick={() => moveElement(selectedBlock, -1)} disabled={!canMoveDeckElement(deck, selectedBlock, -1)}>Move up</button>
                        <button type="button" onClick={() => moveElement(selectedBlock, 1)} disabled={!canMoveDeckElement(deck, selectedBlock, 1)}>Move down</button>
                        <button type="button" className="danger" onClick={() => removeElement(selectedBlock)}>Delete</button>
                      </div>
                      {selectedBlockElement.type === 'NoteImage' && <label>Caption
                        <input value={selectedBlockElement.props?.caption || ''} placeholder="Add a caption" onChange={(event) => updateProps(selectedBlock, { caption: event.target.value || null })} />
                      </label>}
                    </div>
                  ) : <div className="deck-inspector-empty">Click an element on the slide to edit or rearrange it.</div>}
                  <details className="deck-inspector-more"><summary>More controls</summary><button type="button" onClick={deleteSlide} disabled={slideKeys.length < 2}>Delete slide</button><button type="button" onClick={addSourcesSlide} disabled={!deckCitationKeys(deck).length}>Add sources slide</button></details>
                </aside>
              </div>
              <div className="deck-legacy-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '18px' }}>
                {slideKeys.map((key, i) => (
                  <div key={key} onClick={() => chooseSlide(key)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}>
                    <div className={'deck-slide' + (activeDeckTheme.light ? ' light' : '')} style={{ fontSize: '4px', background: activeDeckTheme.background, color: activeDeckTheme.ink, borderColor: activeDeckTheme.border, '--acc': activeDeckTheme.accent || 'var(--acc)', outline: selectedSlide === key ? '2px solid var(--acc)' : '2px solid transparent', outlineOffset: '3px', transition: 'outline-color .15s' }}>
                      <SlideBoundary>
                        <Renderer spec={slideSpec(deck, key)} registry={deckRegistry} />
                      </SlideBoundary>
                    </div>
                    <div style={caption}>{i + 1} · {deck.elements[key]?.props?.eyebrow || deck.elements[key]?.props?.layout}</div>
                  </div>
                ))}
              </div>
              {selectedElement && (
                <section className="deck-legacy-workbench" style={{ marginTop: '30px', padding: '18px', border: '1px solid var(--line-2)', borderRadius: '10px', background: 'var(--bg-raise)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                    <div>
                      <div style={{ color: 'var(--acc)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Slide workbench</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '3px' }}>Edit slide {slideKeys.indexOf(selectedSlide) + 1}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => moveSlide(-1)} disabled={slideKeys.indexOf(selectedSlide) === 0} style={editorButton}>Move back</button>
                      <button type="button" onClick={() => moveSlide(1)} disabled={slideKeys.indexOf(selectedSlide) === slideKeys.length - 1} style={editorButton}>Move forward</button>
                      <button type="button" onClick={duplicateSlide} style={editorButton}>Duplicate</button>
                      <button type="button" onClick={deleteSlide} disabled={slideKeys.length < 2} style={{ ...editorButton, color: '#f58a8a' }}>Delete</button>
                    </div>
                  </div>
                  <div style={{ padding: '12px', border: '1px solid color-mix(in oklab, var(--acc) 32%, var(--line-2))', borderRadius: '10px', background: 'var(--bg-deep)', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '9px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ color: 'var(--acc)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Direct canvas</div>
                        <div style={{ color: 'var(--ink-2)', fontSize: '12px', marginTop: '3px' }}>Click a block to select it. Type directly into text, then add after the selected block.</div>
                      </div>
                      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => addContentBlock('Text')} style={{ ...editorButton, color: 'var(--acc)' }}>+ Text</button>
                        <label style={{ ...editorButton, color: 'var(--acc)', cursor: addingMedia ? 'wait' : 'pointer', opacity: addingMedia ? .65 : 1 }}>
                          <input type="file" accept="image/*" disabled={addingMedia} onChange={(event) => { addUploadedImage(event.target.files?.[0]); event.target.value = ''; }} style={{ display: 'none' }} />
                          + Graphic
                        </label>
                      </div>
                    </div>
                    <InteractiveSlideCanvas
                      deck={deck} slideKey={selectedSlide} theme={activeDeckTheme} selectedKey={selectedBlock}
                      onSelect={setSelectedBlock} onChange={updateProps} images={images || {}} sketches={sketches || {}} references={references}
                    />
                    <div style={{ color: 'var(--ink-3)', fontSize: '11px', marginTop: '8px' }}>{selectedBlock ? `Selected: ${deck.elements[selectedBlock]?.type || 'block'} · new content is inserted after it.` : 'Select a block to choose where new content goes.'}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, .7fr) minmax(160px, 1fr)', gap: '12px', marginBottom: '12px' }}>
                    <label style={editorLabel}>Layout
                      <select value={selectedElement.props?.layout || 'content'} onChange={(e) => updateProps(selectedSlide, { layout: e.target.value })} style={editorInput}>
                        <option value="title">Title</option><option value="content">Content</option><option value="statement">Statement</option><option value="end">End</option>
                      </select>
                    </label>
                    <label style={editorLabel}>Section label
                      <input value={selectedElement.props?.eyebrow || ''} placeholder="Optional section label" onChange={(e) => updateProps(selectedSlide, { eyebrow: e.target.value || null })} style={editorInput} />
                    </label>
                  </div>
                  <label style={{ ...editorLabel, marginBottom: '12px' }}>Speaker notes
                    <textarea value={selectedElement.props?.speakerNotes || ''} placeholder="Private presenter cue — reveal it in presentation mode" onChange={(e) => updateProps(selectedSlide, { speakerNotes: e.target.value || null })} style={{ ...editorInput, minHeight: '66px', resize: 'vertical' }} />
                  </label>
                  <div style={{ padding: '12px', border: '1px solid color-mix(in oklab, var(--acc) 30%, var(--line-2))', borderRadius: '8px', background: 'linear-gradient(135deg, color-mix(in oklab, var(--acc) 7%, var(--bg-canvas)), var(--bg-canvas))', marginBottom: '12px' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--acc)', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: '5px' }}>Build this slide</div>
                    <div style={{ color: 'var(--ink-2)', fontSize: '12px', lineHeight: 1.45, marginBottom: '9px' }}>Start from a composition, then edit every piece below.</div>
                    <button type="button" onClick={addTwoColumns} style={{ ...editorButton, color: 'var(--acc)', background: 'var(--bg-raise)' }}>+ Two-column comparison</button>
                  </div>
                  <div style={{ padding: '11px', border: '1px solid var(--line-2)', borderRadius: '8px', background: 'var(--bg-canvas)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Deck sources</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <select aria-label="Sources slide citation style" value={referencesStyle} onChange={(event) => setReferencesStyle(event.target.value)} style={{ ...editorInput, width: 'auto', padding: '5px 7px', fontSize: '11.5px' }}>
                        <option value="apa">APA 7</option><option value="ieee">IEEE</option><option value="chicago">Chicago</option>
                      </select>
                      <button type="button" onClick={addSourcesSlide} disabled={!deckCitationKeys(deck).length} style={{ ...editorButton, color: 'var(--acc)', opacity: deckCitationKeys(deck).length ? 1 : .5 }}>+ Add sources slide</button>
                      <span style={{ color: 'var(--ink-3)', fontSize: '11px' }}>{deckCitationKeys(deck).length} linked source{deckCitationKeys(deck).length === 1 ? '' : 's'}</span>
                    </div>
                    {sourcesError && <div role="alert" style={{ color: '#f58a8a', fontSize: '11.5px', marginTop: '8px' }}>{sourcesError}</div>}
                  </div>
                  <div style={{ padding: '11px', border: '1px solid var(--line-2)', borderRadius: '8px', background: 'var(--bg-canvas)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '5px' }}>Media</div>
                    <div style={{ color: 'var(--ink-2)', fontSize: '12px', lineHeight: 1.45, marginBottom: '9px' }}>Bring in an image just for this deck, or reuse a note asset.</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                      <label style={{ ...editorButton, color: 'var(--acc)', cursor: addingMedia ? 'wait' : 'pointer', opacity: addingMedia ? .65 : 1 }}>
                        <input type="file" accept="image/*" disabled={addingMedia} onChange={(event) => { addUploadedImage(event.target.files?.[0]); event.target.value = ''; }} style={{ display: 'none' }} />
                        {addingMedia ? 'Adding image…' : '+ Upload image'}
                      </label>
                      {Object.keys(images || {}).slice(0, 8).map(id => (
                        <button key={id} type="button" onClick={() => addAssetToSlide('NoteImage', id)} style={editorButton}>+ Image {id.slice(0, 12)}</button>
                      ))}
                      {Object.keys(sketches || {}).slice(0, 8).map(id => (
                        <button key={id} type="button" onClick={() => addAssetToSlide('Sketch', id)} style={editorButton}>+ Sketch {id.slice(0, 12)}</button>
                      ))}
                    </div>
                    {mediaError && <div role="alert" style={{ color: '#f58a8a', fontSize: '11.5px', marginTop: '8px' }}>{mediaError}</div>}
                  </div>
                  {references.some(reference => reference.citationKey) && (
                    <div style={{ padding: '11px', border: '1px solid var(--line-2)', borderRadius: '8px', background: 'var(--bg-canvas)', marginBottom: '12px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Cite research library</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                        {references.filter(reference => reference.citationKey).slice(0, 8).map(reference => (
                          <button key={reference.citationKey} type="button" title={reference.title} onClick={() => addCitationToSlide(reference.citationKey)} style={editorButton}>+ [@{reference.citationKey}]</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '11px', border: '1px solid var(--line-2)', borderRadius: '8px', background: 'var(--bg-canvas)', marginBottom: '12px' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '8px' }}>Add content block</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                      {['Heading', 'Text', 'Bullets', 'Quote', 'Stat', 'Citation'].map(type => (
                        <button key={type} type="button" onClick={() => addContentBlock(type)} style={editorButton}>+ {type === 'Stat' ? 'Metric' : type}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
                    {editable.map(({ key, element }) => (
                      <div key={key} style={{ padding: '11px', border: '1px solid var(--line-2)', borderRadius: '8px', background: 'var(--bg-canvas)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '10.5px', color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '7px' }}>
                          <span>{element.type}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '7px', letterSpacing: 0 }}>
                            <button type="button" title="Move block earlier" aria-label={`Move ${element.type} earlier`} onClick={() => moveElement(key, -1)} disabled={!canMoveDeckElement(deck, key, -1)} style={{ border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', padding: 0, fontSize: '12px', opacity: canMoveDeckElement(deck, key, -1) ? 1 : .35 }}>↑</button>
                            <button type="button" title="Move block later" aria-label={`Move ${element.type} later`} onClick={() => moveElement(key, 1)} disabled={!canMoveDeckElement(deck, key, 1)} style={{ border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', padding: 0, fontSize: '12px', opacity: canMoveDeckElement(deck, key, 1) ? 1 : .35 }}>↓</button>
                            <button type="button" onClick={() => removeElement(key)} style={{ border: 'none', background: 'transparent', color: '#f58a8a', cursor: 'pointer', padding: 0, fontSize: '10.5px', fontWeight: 700, letterSpacing: 0 }}>Remove</button>
                          </span>
                        </div>
                        {element.type === 'Columns' ? (
                          <div style={{ color: 'var(--ink-2)', fontSize: '12px', lineHeight: 1.45 }}>Two editable columns. Use the cards below to refine each heading and paragraph, or remove this group to clear the whole composition.</div>
                        ) : element.type === 'NoteImage' ? (
                          <div style={{ display: 'grid', gap: '7px' }}>
                            <input value={element.props?.caption || ''} placeholder="Optional image caption" onChange={(e) => updateProps(key, { caption: e.target.value || null })} style={editorInput} />
                            <label style={editorLabel}>Image framing
                              <select value={element.props?.fit || 'contain'} onChange={(e) => updateProps(key, { fit: e.target.value })} style={editorInput}>
                                <option value="contain">Show full image</option><option value="cover">Crop to fill frame</option>
                              </select>
                            </label>
                          </div>
                        ) : element.type === 'Citation' ? (
                          <div style={{ display: 'grid', gap: '7px' }}>
                            <input value={element.props?.citationKey || ''} placeholder="Citation key, e.g. smith2024" onChange={(e) => updateProps(key, { citationKey: e.target.value.trim() })} style={editorInput} />
                            <input value={element.props?.label || ''} placeholder="Optional display label" onChange={(e) => updateProps(key, { label: e.target.value || null })} style={editorInput} />
                          </div>
                        ) : element.type === 'Sketch' ? (
                          <div style={{ color: 'var(--ink-2)', fontSize: '12px' }}>This sketch stays linked to its source note.</div>
                        ) : element.type === 'Bullets' ? (
                          <textarea value={(element.props?.items || []).join('\n')} onChange={(e) => updateProps(key, { items: e.target.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 6) || ['Add a concise point'] })} style={{ ...editorInput, minHeight: '92px', resize: 'vertical' }} />
                        ) : element.type === 'Stat' ? (
                          <div style={{ display: 'grid', gap: '7px' }}><input value={element.props?.value || ''} placeholder="Value" onChange={(e) => updateProps(key, { value: e.target.value })} style={editorInput} /><input value={element.props?.label || ''} placeholder="Label" onChange={(e) => updateProps(key, { label: e.target.value })} style={editorInput} /></div>
                        ) : element.type === 'Title' ? (
                          <div style={{ display: 'grid', gap: '7px' }}>
                            <textarea value={element.props?.text || ''} onChange={(e) => updateProps(key, { text: e.target.value })} style={{ ...editorInput, minHeight: '54px', resize: 'vertical' }} />
                            <input value={element.props?.subtitle || ''} placeholder="Optional subtitle" onChange={(e) => updateProps(key, { subtitle: e.target.value || null })} style={editorInput} />
                          </div>
                        ) : element.type === 'Quote' ? (
                          <div style={{ display: 'grid', gap: '7px' }}>
                            <textarea value={element.props?.text || ''} onChange={(e) => updateProps(key, { text: e.target.value })} style={{ ...editorInput, minHeight: '78px', resize: 'vertical' }} />
                            <input value={element.props?.cite || ''} placeholder="Citation or attribution" onChange={(e) => updateProps(key, { cite: e.target.value || null })} style={editorInput} />
                          </div>
                        ) : (
                          <textarea value={element.props?.text || ''} onChange={(e) => updateProps(key, { text: e.target.value })} style={{ ...editorInput, minHeight: element.type === 'Text' || element.type === 'Quote' ? '78px' : '42px', resize: 'vertical' }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ color: 'var(--ink-3)', fontSize: '11.5px', marginTop: '12px' }}>Select a thumbnail, then refine its words and structure. Changes are saved with this note.</div>
                </section>
              )}
              <button type="button" className="deck-legacy-add" onClick={addSlide} style={{ ...editorButton, marginTop: '16px', color: 'var(--acc)' }}>+ Add slide</button>
            </DeckProviders>
          </DeckAssets.Provider>
        ) : (
          /* ── heading-outline thumbnails ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '18px' }}>
            {slides.map((s, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {s.type === 'title' && (
                  <div style={box}>
                    <div style={{ width: '26px', height: '3px', borderRadius: '2px', background: 'var(--acc)' }} />
                    <div style={{ fontSize: '15px', fontWeight: 700, color: thInk, letterSpacing: '-.01em' }}>{s.title}</div>
                    <div style={{ fontSize: '10.5px', color: thSub }}>{s.sub} · {monthYear()}</div>
                  </div>
                )}
                {s.type === 'sketch' && (
                  <div style={box}>
                    <div style={small}>{s.title}</div>
                    <SketchSnapshot data={sketches[s.sketch]} dark={!light} style={{ width: '100%', height: '70px' }} />
                  </div>
                )}
                {s.type === 'bullets' && (
                  <div style={box}>
                    <div style={small}>{s.title}</div>
                    {(s.bullets.length ? s.bullets : ['']).slice(0, 4).map((_, j) => (
                      <div key={j} style={line(LINE_WIDTHS[j % LINE_WIDTHS.length])} />
                    ))}
                  </div>
                )}
                <div style={caption}>
                  {i + 1} · {s.type === 'title' ? 'Title' : s.title}{s.type === 'sketch' ? ' — your sketch' : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasContent && !deckBusy && (
          <div style={{ color: 'var(--ink-3)', fontSize: '13.5px' }}>Open a note first — slides are drafted from its headings, or designed by the assistant.</div>
        )}
      </div>
    </div>
  );
}
