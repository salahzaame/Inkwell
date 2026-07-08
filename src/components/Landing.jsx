import { useEffect } from 'react';
import '../landing.css';

const Quill = ({ s = 17, stroke = 'var(--amber)' }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{ stroke, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
    <path d="M3 21l3.5-1L20 6.5a2.12 2.12 0 0 0-3-3L3.5 17z" /><path d="M14 5.5l4.5 4.5" />
  </svg>
);

const FEATURES = [
  {
    wide: true,
    accent: true,
    title: 'A real drawing board in every note',
    body: 'Not a picture you paste in — a full Excalidraw canvas that lives inside the note. Diagram a system, annotate a screenshot, or just doodle in the margin. Pop it full-screen when an idea needs room. No mode switch, no second app.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M7 15l3.5-4 2.5 3 2-2.5L18 15" /><circle cx="8.5" cy="8.5" r="1.2" /></svg>
    ),
  },
  {
    title: 'Markdown, minus the friction',
    body: <>Type <code>/</code> for headings, tables, to-dos, quotes and dividers. It reads like plain text and renders like a document.</>,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h10M4 17h13" /></svg>,
  },
  {
    title: 'Links that draw a map',
    body: <>Connect notes with <code>[[wikilinks]]</code> and watch them assemble into a graph you can actually explore.</>,
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="8" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M8.2 7l7.4.8M7 8.1l4 7.8M16.8 10l-3.6 6" /></svg>,
  },
  {
    title: 'Slides in one click',
    body: 'Inkwell drafts a deck from your headings and sketches. Pick a theme, then present full-screen or export.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v3M8 21h8" /></svg>,
  },
  {
    title: 'Yours, on your machine',
    body: 'Local-first. Notes live in your browser, not on our servers. Export the whole vault — or a single note as .md — anytime.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>,
  },
  {
    title: 'A free assistant that reads your vault',
    body: 'Ask about your notes and get grounded answers — on-device with Ollama, or a free cloud model. No key, no bill.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6z" /></svg>,
  },
];

/** A little hand-drawn wobble diagram, echoing the app's sketch aesthetic. */
function MiniSketch({ dark }) {
  const ink = dark ? '#26221a' : '#26221a';
  return (
    <svg viewBox="0 0 300 150" width="100%" style={{ display: 'block' }}>
      <defs>
        <filter id="lp-wob" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" />
        </filter>
      </defs>
      <g style={{ filter: 'url(#lp-wob)' }} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="18" y="52" width="82" height="46" rx="8" stroke={ink} strokeWidth="2.2" />
        <text x="34" y="80" fontFamily="'Gochi Hand', cursive" fontSize="17" fill={ink}>idea</text>
        <path d="M104 75 L150 75 M142 70l9 5-9 5" stroke="#c2410c" strokeWidth="2.2" />
        <ellipse cx="205" cy="75" rx="50" ry="30" stroke="#0c8599" strokeWidth="2.2" />
        <text x="176" y="80" fontFamily="'Gochi Hand', cursive" fontSize="17" fill="#0c8599">sketch</text>
        <path d="M150 34c22 -12 55 -10 74 6" stroke="#b5892a" strokeWidth="2" />
        <text x="150" y="26" fontFamily="'Gochi Hand', cursive" fontSize="14" fill="#b5892a">think it through</text>
      </g>
    </svg>
  );
}

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.14 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing({ onEnter }) {
  useReveal();
  const enter = (e) => { e.preventDefault(); onEnter(); };

  return (
    <div className="lp">
      <div className="grain" />

      {/* ── nav ── */}
      <nav className="lp-nav">
        <div className="lp-brand">
          <span className="lp-brand-badge"><Quill /></span>
          Inkwell
        </div>
        <div className="lp-navlinks">
          <a className="lp-hide-sm" href="#features">Features</a>
          <a className="lp-hide-sm" href="#draw">Drawing</a>
          <a className="lp-hide-sm" href="https://github.com/salahzaame/Inkwell" target="_blank" rel="noreferrer">GitHub</a>
          <a className="btn btn-primary" href="#app" onClick={enter}>Open Inkwell</a>
        </div>
      </nav>

      {/* ── hero ── */}
      <header className="lp-section hero">
        <div className="lp-wrap hero-grid">
          <div>
            <span className="eyebrow">Local-first notebook</span>
            <h1>
              Write it down.<br />
              then <span className="draw">draw it out
                <svg viewBox="0 0 200 12" preserveAspectRatio="none"><path d="M2 8c40-7 100-9 196-3" fill="none" stroke="var(--amber)" strokeWidth="3.4" strokeLinecap="round" /></svg>
              </span>.
            </h1>
            <p className="hero-sub">
              Inkwell is a markdown notebook with a real drawing board inside every note. Structure your thinking in text — then sketch the parts words can't hold.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary btn-lg" href="#app" onClick={enter}>
                Open Inkwell
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
              <a className="btn btn-ghost btn-lg" href="#draw">See the idea</a>
            </div>
            <div className="hero-note">Free · no account · opens instantly in your browser</div>
          </div>

          <div className="hero-visual reveal">
            <div className="note-card glass">
              <div className="note-crumb">Field notes / Tide pool survey</div>
              <div className="note-title">Tide pool survey</div>
              <p className="note-line">Low tide at 6:40. Counted anemones along the <b>north shelf</b> — far denser than the south.</p>
              <div className="note-task"><span className="note-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#17181c" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg></span> map the shelf gradient</div>
              <div className="note-sketch"><MiniSketch /></div>
            </div>
            <div className="hero-annot">
              <span className="hand">yes — actually draw, right in the note ✎</span>
            </div>
          </div>
        </div>
      </header>

      {/* trust line */}
      <div className="lp-wrap" style={{ padding: '0 clamp(18px,5vw,54px) 20px' }}>
        <div className="marquee reveal">
          <span>Markdown</span><span className="dot" />
          <span>Excalidraw canvas</span><span className="dot" />
          <span>Wikilinks &amp; graph</span><span className="dot" />
          <span>Slides</span><span className="dot" />
          <span>Free AI assistant</span><span className="dot" />
          <span>100% local</span>
        </div>
      </div>

      {/* ── features ── */}
      <section className="lp-section" id="features">
        <div className="lp-wrap">
          <div className="sec-head reveal">
            <span className="eyebrow">One place for both</span>
            <h2>Everything a thought needs — words and pictures.</h2>
            <p>Most apps make you choose: a text editor <em>or</em> a whiteboard. Inkwell puts them on the same page, so your notes can be as messy or as structured as the idea demands.</p>
          </div>
          <div className="feat-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className={'feat-card glass reveal' + (f.wide ? ' wide' : '')} style={{ transitionDelay: (i % 3) * 60 + 'ms' }}>
                <div className="feat-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── the drawing story (paper) ── */}
      <section className="lp-section paper" id="draw">
        <div className="lp-wrap paper-grid">
          <div className="reveal">
            <span className="eyebrow">Why drawing</span>
            <h2>Some ideas don't fit<br />in a <span className="hand">text box.</span></h2>
            <p className="paper-lead">
              A flowchart, a floor plan, the shape of an argument — some things are faster to draw than to describe. Inkwell treats sketching as first-class, not an attachment. Grab a pen, block out shapes, connect them with arrows, and it saves right alongside your words.
            </p>
            <span className="paper-annot">← messy is allowed. that's the point.</span>
          </div>
          <div className="reveal">
            <div className="sketchbook">
              <div className="sketchbook-cap">✎ how-it-connects.sketch</div>
              <MiniSketch dark />
            </div>
          </div>
        </div>
      </section>

      {/* ── privacy strip ── */}
      <section className="lp-section privacy">
        <div className="lp-wrap reveal">
          <span className="eyebrow">Private by default</span>
          <div className="big">Your notebook stays <em>on your device</em>. No account, no sync you didn't ask for.</div>
          <span className="hand">no cloud. no sign-up. just you and a blank page.</span>
        </div>
      </section>

      {/* ── final CTA ── */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-wrap">
          <div className="cta-card glass reveal">
            <h2>Open a <span className="hand">blank page.</span></h2>
            <p>No setup, no account. Your first note is already waiting — start typing, or start drawing.</p>
            <div className="cta-actions">
              <a className="btn btn-primary btn-lg" href="#app" onClick={enter}>
                Open Inkwell
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </a>
              <a className="btn btn-ghost btn-lg" href="https://github.com/salahzaame/Inkwell" target="_blank" rel="noreferrer">View source</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="lp-footer">
        <div className="lp-brand" style={{ fontSize: '15px' }}>
          <span className="lp-brand-badge" style={{ width: 26, height: 26 }}><Quill s={14} /></span>
          Inkwell
        </div>
        <div>Write it down, then draw it out.</div>
        <div><a href="https://github.com/salahzaame/Inkwell" target="_blank" rel="noreferrer">GitHub</a></div>
      </footer>
    </div>
  );
}
