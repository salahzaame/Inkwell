import SketchSnapshot from './SketchSnapshot.jsx';
import { deckCitationLabel, referenceForCitation } from '../deck/references.js';

function textChange(event, key, onChange) {
  onChange(key, { text: event.currentTarget.textContent || '' });
}

function CanvasBlock({ deck, blockKey, selectedKey, onSelect, onChange, images, sketches, references }) {
  const block = deck.elements?.[blockKey];
  if (!block) return null;
  const props = block.props || {};
  const selected = selectedKey === blockKey;
  const select = (event) => { event.stopPropagation(); onSelect(blockKey); };
  const editableText = (className, tag = 'div') => {
    const Tag = tag;
    return <Tag className={className} contentEditable suppressContentEditableWarning onClick={select} onBlur={(event) => textChange(event, blockKey, onChange)}>{props.text || ''}</Tag>;
  };
  const wrap = (child) => <div className={'slide-canvas-block' + (selected ? ' selected' : '')} onClick={select}>{child}</div>;

  if (block.type === 'Columns') return wrap(<div className="deck-columns">{(block.children || []).map(key => <CanvasBlock key={key} deck={deck} blockKey={key} selectedKey={selectedKey} onSelect={onSelect} onChange={onChange} images={images} sketches={sketches} references={references} />)}</div>);
  if (block.type === 'Column') return <div className="deck-column">{(block.children || []).map(key => <CanvasBlock key={key} deck={deck} blockKey={key} selectedKey={selectedKey} onSelect={onSelect} onChange={onChange} images={images} sketches={sketches} references={references} />)}</div>;
  if (block.type === 'Title') return wrap(<div className="deck-title"><div className="deck-title-rule" />{editableText('', 'h1')}{props.subtitle && <p contentEditable suppressContentEditableWarning onClick={select} onBlur={(event) => onChange(blockKey, { subtitle: event.currentTarget.textContent || null })}>{props.subtitle}</p>}</div>);
  if (block.type === 'Heading') return wrap(editableText('deck-heading', 'h2'));
  if (block.type === 'Text') return wrap(editableText('deck-text' + (props.dim ? ' dim' : ''), 'p'));
  if (block.type === 'Quote') return wrap(<blockquote className="deck-quote">{editableText('', 'p')}{props.cite && <cite contentEditable suppressContentEditableWarning onClick={select} onBlur={(event) => onChange(blockKey, { cite: event.currentTarget.textContent || null })}>{props.cite}</cite>}</blockquote>);
  if (block.type === 'Stat') return wrap(<div className="deck-stat"><div className="deck-stat-value" contentEditable suppressContentEditableWarning onClick={select} onBlur={(event) => onChange(blockKey, { value: event.currentTarget.textContent || '' })}>{props.value || ''}</div><div className="deck-stat-label" contentEditable suppressContentEditableWarning onClick={select} onBlur={(event) => onChange(blockKey, { label: event.currentTarget.textContent || '' })}>{props.label || ''}</div></div>);
  if (block.type === 'Bullets') return wrap(<ul className={'deck-bullets' + (props.numbered ? ' numbered' : '')}>{(props.items || []).map((item, index) => <li key={index}><span className="deck-bullet-mark">{props.numbered ? index + 1 : ''}</span><span contentEditable suppressContentEditableWarning onClick={select} onBlur={(event) => { const items = [...(props.items || [])]; items[index] = event.currentTarget.textContent || ''; onChange(blockKey, { items: items.filter(Boolean) }); }}>{item}</span></li>)}</ul>);
  if (block.type === 'NoteImage') return wrap(<figure className={'deck-image' + (props.fit === 'cover' ? ' cover' : '')}>{images?.[props.id] ? <img src={images[props.id]} alt={props.caption || 'slide graphic'} /> : <div className="deck-missing">image unavailable</div>}{props.caption && <figcaption>{props.caption}</figcaption>}</figure>);
  if (block.type === 'Sketch') return wrap(sketches?.[props.id] ? <SketchSnapshot data={sketches[props.id]} dark={false} style={{ width: '100%', minHeight: 0, flex: 1 }} /> : <div className="deck-missing">sketch unavailable</div>);
  if (block.type === 'Citation') return wrap(<div className="deck-citation">{props.label || deckCitationLabel(referenceForCitation(references, props.citationKey), props.citationKey)}</div>);
  return null;
}

/** A direct-manipulation surface for the selected slide. */
export default function InteractiveSlideCanvas({ deck, slideKey, theme, selectedKey, onSelect, onChange, images, sketches, references }) {
  const slide = deck?.elements?.[slideKey];
  if (!slide) return null;
  return (
    <div className="slide-canvas-frame">
      <div className={'deck-slide slide-canvas' + (theme.light ? ' light' : '')} style={{ fontSize: '10px', background: theme.background, color: theme.ink, borderColor: theme.border, '--acc': theme.accent || 'var(--acc)' }} onClick={() => onSelect(null)}>
        <div className={'deck-slide-inner layout-' + (slide.props?.layout || 'content')}>
          {slide.props?.eyebrow && <div className="deck-eyebrow">{slide.props.eyebrow}</div>}
          {(slide.children || []).map(key => <CanvasBlock key={key} deck={deck} blockKey={key} selectedKey={selectedKey} onSelect={onSelect} onChange={onChange} images={images} sketches={sketches} references={references} />)}
        </div>
      </div>
    </div>
  );
}
