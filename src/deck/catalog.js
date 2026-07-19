// The slide-component catalog: the contract between Inkwell and the AI.
// The model may only compose these components, so a generated deck can never
// contain anything the renderer doesn't know how to draw.
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

export const deckCatalog = defineCatalog(schema, {
  components: {
    Deck: {
      props: z.object({
        title: z.string(),
      }),
      description: 'The presentation root. Its children are Slide elements in order.',
    },
    Slide: {
      props: z.object({
        layout: z.enum(['title', 'content', 'statement', 'end']),
        eyebrow: z.string().nullable(),
      }),
      description: 'One 16:9 slide. layout "title" opens the deck, "content" is a standard slide, "statement" centers one big idea, "end" closes. eyebrow is a small label above the content (e.g. "Methodology").',
    },
    Title: {
      props: z.object({
        text: z.string(),
        subtitle: z.string().nullable(),
      }),
      description: 'Large display title, used on title/end slides.',
    },
    Heading: {
      props: z.object({
        text: z.string(),
      }),
      description: 'Slide heading for content slides.',
    },
    Bullets: {
      props: z.object({
        items: z.array(z.string()).min(1).max(6),
        numbered: z.boolean().nullable(),
      }),
      description: 'A list of short points (max ~12 words each, max 6 items).',
    },
    Text: {
      props: z.object({
        text: z.string(),
        dim: z.boolean().nullable(),
      }),
      description: 'A short paragraph. Use sparingly — slides are not documents.',
    },
    Quote: {
      props: z.object({
        text: z.string(),
        cite: z.string().nullable(),
      }),
      description: 'A pull-quote with optional attribution (e.g. a paper citation).',
    },
    Stat: {
      props: z.object({
        value: z.string(),
        label: z.string(),
      }),
      description: 'One big number/result with a small label, e.g. value "94.2%", label "accuracy on held-out set".',
    },
    Columns: {
      props: z.object({}),
      description: 'Lays its children out side by side in equal columns (use 2-3 children).',
    },
    Sketch: {
      props: z.object({
        id: z.string(),
      }),
      description: 'Embeds one of the note\'s existing Excalidraw sketches by id. Only use ids listed as available.',
    },
    NoteImage: {
      props: z.object({
        id: z.string(),
        caption: z.string().nullable(),
      }),
      description: 'Embeds one of the note\'s existing images by id. Only use ids listed as available.',
    },
  },
  actions: {},
});
