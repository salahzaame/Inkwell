import { useRef, useState } from 'react';
import { paperIdOf } from '../highlights.js';

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const entries = Object.entries(invertedIndex);
  const words = [];
  for (const [word, positions] of entries) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(' ').trim();
}

function generateCitationKey(authors, year) {
  if (!authors || authors.length === 0) return 'key' + (year || 'nd');
  const firstAuthor = authors[0];
  const parts = firstAuthor.split(' ');
  const lastName = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${lastName}${year || 'nd'}`;
}

const STATUSES = [
  { id: 'toread', label: 'To read' },
  { id: 'reading', label: 'Reading' },
  { id: 'done', label: 'Done' },
];

function authorsLine(ref) {
  const a = ref.authors || [];
  return `${a.slice(0, 3).join(', ')}${a.length > 3 ? ' et al.' : ''}${ref.year ? ' · ' + ref.year : ''}`;
}

function QueueCard({ refItem, hlCount, isContinue, onOpenPaper, onSetStatus, onOpenNote, onCopyKey }) {
  const pid = paperIdOf(refItem);
  const status = refItem.status || 'toread';
  return (
    <div className={'queue-card' + (isContinue ? ' queue-continue' : '')}>
      {isContinue && (
        <div style={{ fontFamily: "'Gochi Hand', cursive", fontSize: '13px', color: 'var(--acc)' }}>
          pick up where you left off
        </div>
      )}
      <div
        className="q-title"
        onClick={() => (refItem.pdfUrl ? onOpenPaper(refItem) : onOpenNote(refItem))}
        title={refItem.pdfUrl ? 'Open the paper' : 'Open the note (no open-access PDF found)'}
      >
        {refItem.title}
      </div>
      <div className="q-meta">{authorsLine(refItem)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="Reading status">
          {STATUSES.map(s => (
            <button
              key={s.id}
              className={status === s.id ? 'on' : ''}
              onClick={() => onSetStatus(pid, s.id)}
            >{s.label}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {hlCount > 0 && (
          <span title={`${hlCount} highlight${hlCount === 1 ? '' : 's'}`} style={{ fontSize: '11px', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--marker-amber)', display: 'inline-block', opacity: .8 }} />
            {hlCount}
          </span>
        )}
        <button className="hv-item" onClick={() => onOpenNote(refItem)} title="Open literature note"
          style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: '4px', borderRadius: '5px', display: 'inline-flex' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></svg>
        </button>
        {refItem.citationKey && (
          <button className="hv-item" onClick={() => onCopyKey(refItem)} title={`Copy [@${refItem.citationKey}]`}
            style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: '4px 6px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 700 }}>
            @
          </button>
        )}
        {refItem.pdfUrl && (
          <button
            onClick={() => onOpenPaper(refItem)}
            style={{ border: 'none', background: 'color-mix(in oklab, var(--acc) 15%, transparent)', color: 'var(--acc)', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
            Read
          </button>
        )}
      </div>
    </div>
  );
}

export default function ResearchPanel({
  references, highlights = {},
  onImportReference, onOpenPaper, onSetStatus, onOpenNote, onLocalPdf, onClose,
}) {
  const [tab, setTab] = useState(references.length > 0 ? 'queue' : 'search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const fileRef = useRef(null);

  const hlCount = (ref) => (highlights[paperIdOf(ref)] || []).length;
  const inLibrary = (work) => references.some(r => paperIdOf(r) === paperIdOf(work));

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setExpandedIndex(null);
    try {
      const res = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=12`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();

      const works = (data.results || []).map(w => {
        const title = w.title || 'Untitled Paper';
        const year = w.publication_year || null;
        const doi = w.doi || '';
        const url = w.primary_location?.landing_page_url || w.id || '';
        const pdfUrl = w.primary_location?.pdf_url || '';
        const authors = (w.authorships || []).map(a => a.author?.display_name).filter(Boolean);
        const abstract = reconstructAbstract(w.abstract_inverted_index);
        const citedBy = w.cited_by_count || 0;
        const citationKey = generateCitationKey(authors, year);

        const authorList = authors.length > 0 ? authors.join(' and ') : 'Unknown Authors';
        const journal = w.primary_location?.source?.display_name || '';
        const bibtex = `@article{${citationKey},
  title={${title}},
  author={${authorList}},
  year={${year || 'n.d.'}},
  journal={${journal}},
  url={${url}},
  doi={${doi}}
}`;

        return { id: w.id, title, year, doi, url, pdfUrl, authors, abstract, citedBy, citationKey, bibtex };
      });
      setResults(works);
    } catch (err) {
      console.error(err);
      alert('Could not retrieve papers. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = (ref) => navigator.clipboard.writeText(`[@${ref.citationKey}]`);

  /* queue grouping: reading first (most recent on top), then to-read, then done */
  const withStatus = references.map(r => ({ ...r, status: r.status || 'toread' }));
  const reading = withStatus.filter(r => r.status === 'reading').sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  const toread = withStatus.filter(r => r.status === 'toread').sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const done = withStatus.filter(r => r.status === 'done').sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));

  const smallBtn = {
    padding: '5px 11px', borderRadius: '6px', border: 'none', fontSize: '11.5px', cursor: 'pointer',
    fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px',
    background: 'var(--bg-raise)', color: 'var(--ink-1)', transition: 'background .15s',
  };

  return (
    <div className="side-panel" style={{ width: '330px', borderRight: '1px solid var(--line)' }}>
      <div className="panel-header">
        <span className="panel-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2M20 4v18" /><path d="M6 6h10M6 10h10" /></svg>
          Research
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div className="seg" role="tablist" aria-label="Research panel tabs">
            <button role="tab" aria-selected={tab === 'queue'} className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>
              Queue{references.length > 0 ? ` · ${references.length}` : ''}
            </button>
            <button role="tab" aria-selected={tab === 'search'} className={tab === 'search' ? 'on' : ''} onClick={() => setTab('search')}>
              Search
            </button>
          </div>
          <div className="hv-item panel-close" onClick={onClose} title="Close panel">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </div>
        </div>
      </div>

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <form onSubmit={handleSearch} style={{ padding: '12px 14px 8px', display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-canvas)', border: '1px solid var(--line-2)', borderRadius: '8px', padding: '6px 10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search 250M papers on OpenAlex…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink-1)', fontSize: '12.5px', minWidth: 0 }}
              />
            </div>
            <button className="hv-bright" type="submit" style={{ ...smallBtn, background: 'var(--acc)', color: '#17181c' }}>
              Search
            </button>
          </form>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '8px', color: 'var(--ink-2)', fontSize: '12.5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--acc)', animation: 'blinkDot 1.2s infinite' }} />
                Searching OpenAlex…
              </div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 12px', color: 'var(--ink-3)', fontSize: '12.5px', lineHeight: 1.6 }}>
                Search a topic, an author, or a paper title.<br />Anything you save lands in your reading queue.
              </div>
            ) : (
              results.map((work, idx) => (
                <div key={work.id || idx} className="queue-card" style={{ animation: 'fadeUp .2s ease-out' }}>
                  <div className="q-title" style={{ cursor: 'default' }}>{work.title}</div>
                  <div className="q-meta">
                    {authorsLine(work)}{work.citedBy > 0 ? ` · cited ${work.citedBy}×` : ''}
                  </div>

                  {expandedIndex === idx && work.abstract && (
                    <div style={{ fontSize: '11.5px', color: 'var(--ink-2)', background: 'var(--bg-deep)', padding: '8px 10px', borderRadius: '6px', lineHeight: 1.5, maxHeight: '130px', overflowY: 'auto' }}>
                      {work.abstract}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                    {work.abstract && (
                      <button className="hv-btn" type="button" onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)} style={{ ...smallBtn, fontWeight: 500 }}>
                        {expandedIndex === idx ? 'Hide abstract' : 'Abstract'}
                      </button>
                    )}
                    <button
                      className="hv-btn" type="button"
                      disabled={inLibrary(work)}
                      onClick={() => onImportReference(work)}
                      style={{ ...smallBtn, background: inLibrary(work) ? 'transparent' : 'color-mix(in oklab, var(--acc) 14%, transparent)', color: inLibrary(work) ? 'var(--ink-3)' : 'var(--acc)', cursor: inLibrary(work) ? 'default' : 'pointer' }}
                    >
                      {inLibrary(work) ? '✓ In queue' : '+ Save to queue'}
                    </button>
                    {work.pdfUrl && (
                      <button className="hv-btn" type="button" onClick={() => { if (!inLibrary(work)) onImportReference(work); onOpenPaper(work); }} style={smallBtn}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                        Read now
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Reading queue tab ── */}
      {tab === 'queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 16px' }}>
          {withStatus.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--ink-3)', fontSize: '12.5px', lineHeight: 1.7 }}>
              Your reading queue is empty.<br />
              Find a paper in <b>Search</b> and save it, and it will wait for you here.
            </div>
          ) : (
            <>
              {reading.length > 0 && (
                <>
                  <div className="queue-section-label">reading now</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {reading.map((r, i) => (
                      <QueueCard key={paperIdOf(r)} refItem={r} hlCount={hlCount(r)} isContinue={i === 0}
                        onOpenPaper={onOpenPaper} onSetStatus={onSetStatus} onOpenNote={onOpenNote} onCopyKey={copyKey} />
                    ))}
                  </div>
                </>
              )}
              {toread.length > 0 && (
                <>
                  <div className="queue-section-label">up next</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {toread.map(r => (
                      <QueueCard key={paperIdOf(r)} refItem={r} hlCount={hlCount(r)}
                        onOpenPaper={onOpenPaper} onSetStatus={onSetStatus} onOpenNote={onOpenNote} onCopyKey={copyKey} />
                    ))}
                  </div>
                </>
              )}
              {done.length > 0 && (
                <>
                  <div className="queue-section-label">finished</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {done.map(r => (
                      <QueueCard key={paperIdOf(r)} refItem={r} hlCount={hlCount(r)}
                        onOpenPaper={onOpenPaper} onSetStatus={onSetStatus} onOpenNote={onOpenNote} onCopyKey={copyKey} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center' }}>
            <input
              ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onLocalPdf(f); e.target.value = ''; }}
            />
            <button className="hv-btn" onClick={() => fileRef.current?.click()} style={{ ...smallBtn, fontWeight: 500, color: 'var(--ink-2)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Read a local PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
