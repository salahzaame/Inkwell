// React implementations for the slide catalog. Everything is sized in `em`
// inside .deck-slide, so the same components render as tiny thumbnails or a
// fullscreen presentation just by changing the container font-size.
import { createContext, useContext } from 'react';
import { defineRegistry, StateProvider, VisibilityProvider, ActionProvider } from '@json-render/react';
import { deckCatalog } from './catalog.js';
import SketchSnapshot from '../components/SketchSnapshot.jsx';

/** Vault assets + theme the deck components need at render time. */
export const DeckAssets = createContext({ sketches: {}, images: {}, light: false });

/** Every context the json-render Renderer requires, in one wrapper. */
export function DeckProviders({ children }) {
  return (
    <StateProvider initialState={{}}>
      <VisibilityProvider>
        <ActionProvider handlers={{}}>
          {children}
        </ActionProvider>
      </VisibilityProvider>
    </StateProvider>
  );
}

export const { registry: deckRegistry } = defineRegistry(deckCatalog, {
  components: {
    Deck: ({ children }) => <>{children}</>,

    Slide: ({ props, children }) => (
      <div className={`deck-slide-inner layout-${props.layout}`}>
        {props.eyebrow && <div className="deck-eyebrow">{props.eyebrow}</div>}
        {children}
      </div>
    ),

    Title: ({ props }) => (
      <div className="deck-title">
        <div className="deck-title-rule" />
        <h1>{props.text}</h1>
        {props.subtitle && <p>{props.subtitle}</p>}
      </div>
    ),

    Heading: ({ props }) => <h2 className="deck-heading">{props.text}</h2>,

    Bullets: ({ props }) => (
      <ul className={'deck-bullets' + (props.numbered ? ' numbered' : '')}>
        {props.items.map((it, i) => (
          <li key={i}>
            <span className="deck-bullet-mark">{props.numbered ? i + 1 : ''}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    ),

    Text: ({ props }) => <p className={'deck-text' + (props.dim ? ' dim' : '')}>{props.text}</p>,

    Quote: ({ props }) => (
      <blockquote className="deck-quote">
        <p>“{props.text}”</p>
        {props.cite && <cite>— {props.cite}</cite>}
      </blockquote>
    ),

    Stat: ({ props }) => (
      <div className="deck-stat">
        <div className="deck-stat-value">{props.value}</div>
        <div className="deck-stat-label">{props.label}</div>
      </div>
    ),

    Columns: ({ children }) => <div className="deck-columns">{children}</div>,

    Sketch: ({ props }) => {
      const { sketches, light } = useContext(DeckAssets);
      const data = sketches[props.id];
      if (!data) return <div className="deck-missing">sketch “{props.id}” not found</div>;
      return <SketchSnapshot data={data} dark={!light} style={{ width: '100%', height: '100%', minHeight: 0, flex: 1 }} />;
    },

    NoteImage: ({ props }) => {
      const { images } = useContext(DeckAssets);
      const src = images[props.id];
      if (!src) return <div className="deck-missing">image “{props.id}” not found</div>;
      return (
        <figure className="deck-image">
          <img src={src} alt={props.caption || 'figure'} />
          {props.caption && <figcaption>{props.caption}</figcaption>}
        </figure>
      );
    },
  },
});

/** Keys of the deck's slides, in presentation order. */
export function deckSlideKeys(spec) {
  if (!spec?.root || !spec.elements?.[spec.root]) return [];
  return (spec.elements[spec.root].children || []).filter(k => spec.elements[k]?.type === 'Slide');
}

/** A sub-spec that renders just one slide of the deck. */
export function slideSpec(spec, slideKey) {
  return { root: slideKey, elements: spec.elements };
}
