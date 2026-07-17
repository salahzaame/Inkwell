// Inkwell's hand-drawn icon set — every stroke is slightly wobbly on purpose,
// echoing the Excalidraw / handwritten DNA of the landing page.

export const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)'/%3E%3C/svg%3E\")";

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const Quill = ({ s = 17, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M3.1 21 C4.3 20.6 5.4 20.3 6.5 20 C10.9 15.6 15.4 11.1 19.9 6.6 C20.9 5.5 20.8 4.4 19.9 3.6 C19 2.8 17.9 2.9 17 3.7 C12.5 8.2 8 12.7 3.6 17.2 C3.4 18.4 3.3 19.7 3.1 21 Z" />
    <path d="M13.9 5.6 C15.4 7 16.9 8.5 18.3 10" />
  </svg>
);

export const InkPage = ({ s = 14, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M6.3 3.5 C9.1 3.3 11.9 3.3 14.6 3.4 C16.1 4.9 17.5 6.4 18.9 8 C19 12.1 18.9 16.3 18.7 20.4 C14.6 20.7 10.5 20.7 6.4 20.5 C6.1 14.8 6.1 9.1 6.3 3.5 Z" />
    <path d="M14.5 3.5 C14.6 5 14.7 6.4 14.8 7.9 C16.2 8.1 17.5 8.1 18.9 8" />
  </svg>
);

export const InkFolder = ({ s = 14, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M3.4 7.3 C3.3 6.2 4 5.3 5.1 5.3 C6.4 5.2 7.7 5.2 9 5.3 C9.7 5.9 10.3 6.6 11 7.2 C13.6 7.2 16.2 7.1 18.8 7.2 C19.9 7.2 20.7 8 20.6 9.1 C20.6 11.6 20.5 14.2 20.4 16.7 C20.4 17.8 19.5 18.7 18.4 18.7 C14 18.8 9.6 18.8 5.2 18.7 C4.1 18.7 3.4 17.9 3.4 16.8 C3.3 13.6 3.3 10.4 3.4 7.3 Z" />
  </svg>
);

export const InkSearch = ({ s = 16, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M4.3 10.5 C3.7 6.9 6.7 3.8 10.3 4.1 C13.9 4.4 16.3 7.4 15.7 10.9 C15.1 14.3 11.7 16.4 8.4 15.5 C5.9 14.8 4.6 12.8 4.3 10.5 Z" />
    <path d="M15 15.3 C16.5 16.7 18.2 18.4 19.8 20.1" />
  </svg>
);

export const InkGraph = ({ s = 16, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M4.4 6.1 C4.5 4.9 5.5 4.1 6.6 4.3 C7.7 4.5 8.3 5.5 8 6.6 C7.7 7.7 6.6 8.3 5.6 7.9 C4.8 7.6 4.4 6.9 4.4 6.1 Z" />
    <path d="M16.1 8 C16.2 6.9 17.2 6.1 18.3 6.3 C19.3 6.5 19.9 7.4 19.7 8.5 C19.4 9.6 18.4 10.2 17.4 9.8 C16.6 9.5 16.1 8.8 16.1 8 Z" />
    <path d="M10.1 18 C10.2 16.9 11.2 16.1 12.3 16.3 C13.3 16.5 13.9 17.4 13.7 18.5 C13.4 19.6 12.4 20.2 11.4 19.8 C10.6 19.5 10.1 18.8 10.1 18 Z" />
    <path d="M8.6 6.4 C11 6.8 13.4 7.2 15.6 7.7 M6.9 8.4 C8.4 11.2 9.9 13.9 11.2 15.9 M17.1 10.3 C15.7 12.4 14.3 14.4 13.1 16.1" />
  </svg>
);

export const InkSlides = ({ s = 16, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M3.6 4.7 C9.2 4.4 14.8 4.4 20.4 4.6 C20.5 8.3 20.5 12 20.3 15.7 C14.7 16 9.1 16 3.5 15.8 C3.4 12.1 3.4 8.4 3.6 4.7 Z" />
    <path d="M12 16.1 C12 17.1 12 18.1 12 19.1 M8.2 21 C10.7 20.8 13.3 20.8 15.8 21" />
  </svg>
);

export const InkSpark = ({ s = 16, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M11.6 3.6 C12.2 5.6 12.8 7.4 13.5 8.4 C14.6 9.1 16.5 9.7 18.9 10.2 C16.6 11 14.7 11.7 13.6 12.4 C12.9 13.6 12.3 15.5 11.7 17.6 C11 15.5 10.4 13.6 9.7 12.4 C8.6 11.7 6.7 11 4.3 10.2 C6.7 9.6 8.6 9 9.7 8.3 C10.4 7.3 11 5.6 11.6 3.6 Z" />
    <path d="M18.4 15.4 C18.7 16.3 19 17.1 19.4 17.6 M17.1 18.9 C17.9 18.7 18.7 18.6 19.6 18.6" />
  </svg>
);

export const InkSliders = ({ s = 16, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M4 7.2 C9.3 7 14.7 7 20 7.1 M4 12.1 C9.3 11.9 14.7 11.9 20 12 M4 16.9 C9.3 16.8 14.7 16.8 20 16.9" />
    <circle cx="9.2" cy="7.1" r="1.9" fill="#141419" />
    <circle cx="15.3" cy="12" r="1.9" fill="#141419" />
    <circle cx="7.1" cy="16.9" r="1.9" fill="#141419" />
  </svg>
);

export const InkPlus = ({ s = 13, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} strokeWidth="2" {...rest}>
    <path d="M12 5.3 C12 9.7 12 14.2 12.1 18.6 M5.4 11.9 C9.8 11.9 14.3 12 18.7 12.1" />
  </svg>
);

export const InkTrash = ({ s = 12, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} {...rest}>
    <path d="M4.6 7.1 C9.5 6.9 14.5 6.9 19.4 7.1 M9.3 6.9 C9.3 5.9 9.3 5 9.4 4.1 C11.1 4 12.9 4 14.6 4.1 C14.7 5 14.7 5.9 14.7 6.9 M6.7 7.3 C7 11.6 7.3 15.9 7.7 20.1 C10.6 20.4 13.4 20.4 16.3 20.1 C16.7 15.9 17 11.6 17.3 7.3" />
  </svg>
);

export const InkClose = ({ s = 9, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} strokeWidth="2.3" {...rest}>
    <path d="M6.2 6.5 C10.1 10.3 13.9 14.1 17.7 17.9 M17.6 6.3 C13.8 10.2 10 14 6.3 17.8" />
  </svg>
);

export const InkChevron = ({ s = 9, open = false, ...rest }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" {...P} strokeWidth="2.4" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }} {...rest}>
    <path d="M9.3 5.6 C11.5 7.7 13.6 9.9 15.6 12 C13.5 14.1 11.4 16.2 9.2 18.3" />
  </svg>
);

/** Rough amber "ink ring" scribbled around active rail icons. */
export const InkRing = ({ tilt = 0, style }) => (
  <svg viewBox="0 0 36 36" style={{ position: 'absolute', inset: 0, transform: `rotate(${tilt}deg)`, ...style }}>
    <path
      d="M18 3.6 C26.2 2.7 33 9.3 32.3 17.6 C31.6 25.9 24.6 32.6 16.4 31.5 C8.9 30.4 3.4 24.2 4.2 16.2 C5 8.9 10.6 4.4 18 3.6 Z"
      fill="color-mix(in oklab, var(--acc) 13%, transparent)"
      stroke="var(--acc)" strokeWidth="1.2" strokeLinecap="round" opacity=".95"
    />
  </svg>
);

/** Hand-drawn underline squiggle (same gesture as the landing hero). */
export const Squiggle = ({ style }) => (
  <svg viewBox="0 0 100 6" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: '-2px', width: '100%', height: '5px', overflow: 'visible', ...style }}>
    <path d="M2 4 C20 1.5 45 5 60 3 C75 1.5 88 4.5 98 2.5" stroke="var(--acc)" strokeWidth="1.7" fill="none" strokeLinecap="round" />
  </svg>
);
