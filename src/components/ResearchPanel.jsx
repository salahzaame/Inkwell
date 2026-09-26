import { useRef, useState } from 'react';
import { paperIdOf } from '../highlights.js';
import { findDuplicateCandidates, libraryBibtex, parseBibtex } from '../references.js';
import { buildOpenAlexWorksUrl } from '../openalex.js';

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

function downloadLibraryBibtex(references) {
  const content = libraryBibtex(references);
  const blob = new Blob([content], { type: 'application/x-bibtex;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'inkwell-library.bib';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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

function QueueCard({ refItem, hlCount, isContinue, onOpenPaper, onSetStatus, onSetTags, onOpenNote, onCopyKey }) {
  const pid = paperIdOf(refItem);
  const status = refItem.status || 'toread';
  const [tagDraft, setTagDraft] = useState('');
  const tags = refItem.tags || [];
  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, '');
    if (!tag || tags.some(item => item.toLowerCase() === tag.toLowerCase())) return;
    onSetTags(pid, [...tags, tag]);
    setTagDraft('');
  };
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
      {(tags.length > 0 || onSetTags) && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
          {tags.map(tag => (
            <span key={tag} style={{ fontSize: '10.5px', color: 'var(--acc)', background: 'color-mix(in oklab, var(--acc) 10%, transparent)', borderRadius: '99px', padding: '2px 7px' }}>#{tag}</span>
          ))}
          <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="add tag" aria-label={`Add tag to ${refItem.title}`} style={{ width: '58px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line-2)', outline: 'none', color: 'var(--ink-2)', fontSize: '10.5px', padding: '2px 1px' }} />
        </div>
      )}
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
  savedSearches = [], onSaveSearch, onRemoveSavedSearch,
  onImportReference, onImportBibtex, onOpenPaper, onSetStatus, onSetTags, onOpenNote, onLocalPdf, onCreateSynthesis, onCreateEvidenceMatrix, onAskAssistant, onClose,
}) {
  const [tab, setTab] = useState(references.length > 0 ? 'queue' : 'search');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [bibtexOpen, setBibtexOpen] = useState(false);
  const [bibtexText, setBibtexText] = useState('');
  const [bibtexError, setBibtexError] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [searchSort, setSearchSort] = useState('relevance');
  const fileRef = useRef(null);

  const hlCount = (ref) => (highlights[paperIdOf(ref)] || []).length;
  const inLibrary = (work) => references.some(r => paperIdOf(r) === paperIdOf(work));

  const runSearch = async (value) => {
    const q = value.trim();
    if (!q) return;
    setLoading(true);
    setExpandedIndex(null);
    try {
      const res = await fetch(buildOpenAlexWorksUrl(q, { openAccessOnly, fromYear, toYear, sort: searchSort }));
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();

      const works = (data.results || []).map(w => {
        const title = w.title || 'Untitled Paper';
        const year = w.publication_year || null;
        const doi = w.doi || '';
        const url = w.primary_location?.landing_page_url || w.id || '';
        // every PDF source OpenAlex knows, open-access copies first — the reader
        // walks this list so one blocked publisher doesn't kill the paper
        const pdfCandidates = [];
        const addPdf = (u) => { if (u && !pdfCandidates.includes(u)) pdfCandidates.push(u); };
        addPdf(w.best_oa_location?.pdf_url);
        addPdf(w.primary_location?.pdf_url);
        for (const loc of w.locations || []) addPdf(loc?.pdf_url);
        addPdf(w.open_access?.oa_url);
        const pdfUrl = pdfCandidates[0] || '';
        const authors = (w.authorships || []).map(a => a.author?.display_name).filter(Boolean);
        const abstract = reconstructAbstract(w.abstract_inverted_index);
        const citedBy = w.cited_by_count || 0;
        const venue = w.primary_location?.source?.display_name || '';
        const isOpenAccess = Boolean(w.open_access?.is_oa || w.best_oa_location?.is_oa || w.best_oa_location?.pdf_url);
        const isRetracted = Boolean(w.is_retracted);
        const citationKey = generateCitationKey(authors, year);

        const authorList = authors.length > 0 ? authors.join(' and ') : 'Unknown Authors';
        const journal = venue;
        const bibtex = `@article{${citationKey},
  title={${title}},
  author={${authorList}},
  year={${year || 'n.d.'}},
  journal={${journal}},
  url={${url}},
  doi={${doi}}
}`;

        return { id: w.id, title, year, doi, url, pdfUrl, pdfCandidates, authors, abstract, citedBy, citationKey, bibtex, venue, isOpenAccess, isRetracted };
      });
      setResults(works);
    } catch (err) {
      console.error(err);
      alert('Could not retrieve papers. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    runSearch(query);
  };

  const runSavedSearch = (search) => {
    setQuery(search);
    runSearch(search);
  };

  const copyKey = (ref) => navigator.clipboard.writeText(`[@${ref.citationKey}]`);

  const handleBibtexImport = () => {
    const records = parseBibtex(bibtexText);
    if (!records.length) {
      setBibtexError('No valid BibTeX entries found. Paste one or more @article / @inproceedings records.');
      return;
    }
    const fresh = records.filter(ref => !inLibrary(ref));
    if (fresh.length) onImportBibtex?.(fresh);
    setBibtexText('');
    setBibtexError(fresh.length ? '' : 'Those citations are already in your library.');
    if (fresh.length) setBibtexOpen(false);
  };

  /* queue grouping: reading first (most recent on top), then to-read, then done */
  const allTags = [...new Set(references.flatMap(ref => ref.tags || []))].sort((a, b) => a.localeCompare(b));
  const withStatus = references
    .filter(ref => !tagFilter || (ref.tags || []).some(tag => tag.toLowerCase() === tagFilter.toLowerCase()))
    .map(r => ({ ...r, status: r.status || 'toread' }));
  const reading = withStatus.filter(r => r.status === 'reading').sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  const toread = withStatus.filter(r => r.status === 'toread').sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  const done = withStatus.filter(r => r.status === 'done').sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  const totalHighlights = references.reduce((total, ref) => total + hlCount(ref), 0);
  const duplicateCandidates = findDuplicateCandidates(references);
  const cleanQuery = query.trim();
  const queryAlreadySaved = savedSearches.some(search => search.toLocaleLowerCase() === cleanQuery.toLocaleLowerCase());

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
            <button role="tab" aria-selected={tab === 'synthesis'} className={tab === 'synthesis' ? 'on' : ''} onClick={() => setTab('synthesis')}>
              Synthesis
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

          <div style={{ padding: '0 14px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '6px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--ink-3)', fontSize: '10.5px' }}>From
                <input inputMode="numeric" value={fromYear} onChange={(event) => setFromYear(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="year" aria-label="Published from year" style={{ minWidth: 0, flex: 1, background: 'var(--bg-canvas)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', borderRadius: '5px', padding: '4px 6px', outline: 'none', fontSize: '11px' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--ink-3)', fontSize: '10.5px' }}>To
                <input inputMode="numeric" value={toYear} onChange={(event) => setToYear(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="year" aria-label="Published to year" style={{ minWidth: 0, flex: 1, background: 'var(--bg-canvas)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', borderRadius: '5px', padding: '4px 6px', outline: 'none', fontSize: '11px' }} />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button type="button" aria-pressed={openAccessOnly} onClick={() => setOpenAccessOnly(value => !value)} style={{ border: openAccessOnly ? '1px solid var(--acc)' : '1px solid var(--line-2)', background: openAccessOnly ? 'color-mix(in oklab, var(--acc) 10%, transparent)' : 'var(--bg-canvas)', color: openAccessOnly ? 'var(--acc)' : 'var(--ink-2)', borderRadius: '99px', cursor: 'pointer', padding: '4px 8px', fontSize: '10.5px', fontWeight: 700 }}>Open access only</button>
              <select value={searchSort} onChange={(event) => setSearchSort(event.target.value)} aria-label="Rank research results" style={{ marginLeft: 'auto', background: 'var(--bg-canvas)', border: '1px solid var(--line-2)', color: 'var(--ink-2)', borderRadius: '5px', padding: '4px 6px', outline: 'none', fontSize: '10.5px' }}>
                <option value="relevance">Best match</option><option value="recent">Most recent</option><option value="cited">Most cited</option>
              </select>
            </div>
          </div>

          <div style={{ padding: '0 14px 8px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {cleanQuery && (
              <button type="button" disabled={queryAlreadySaved} onClick={() => onSaveSearch?.(cleanQuery)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: queryAlreadySaved ? 'var(--ink-3)' : 'var(--acc)', cursor: queryAlreadySaved ? 'default' : 'pointer', padding: '1px 0', fontSize: '11px', fontWeight: 600 }}>
                {queryAlreadySaved ? '✓ Search saved' : '+ Save this search'}
              </button>
            )}
            {savedSearches.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--ink-3)', fontSize: '10px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginRight: '1px' }}>Saved</span>
                {savedSearches.map(search => (
                  <span key={search} style={{ display: 'inline-flex', alignItems: 'center', maxWidth: '100%', border: '1px solid var(--line-2)', borderRadius: '99px', background: 'var(--bg-canvas)', overflow: 'hidden' }}>
                    <button type="button" onClick={() => runSavedSearch(search)} title={`Search OpenAlex for ${search}`} style={{ border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', maxWidth: '184px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '3px 2px 3px 7px', fontSize: '10.5px' }}>{search}</button>
                    <button type="button" onClick={() => onRemoveSavedSearch?.(search)} aria-label={`Remove saved search ${search}`} title="Remove saved search" style={{ border: 'none', borderLeft: '1px solid var(--line-2)', background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', padding: '2px 6px 3px', fontSize: '12px', lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '0 14px 8px' }}>
            <button type="button" className="hv-btn" onClick={() => { setBibtexOpen(v => !v); setBibtexError(''); }} style={{ ...smallBtn, padding: '4px 0', background: 'transparent', color: 'var(--ink-2)' }}>
              {bibtexOpen ? 'Hide BibTeX import' : 'Import BibTeX'}
            </button>
            {bibtexOpen && (
              <div style={{ marginTop: '7px', padding: '10px', border: '1px solid var(--line-2)', borderRadius: '8px', background: 'var(--bg-canvas)' }}>
                <textarea value={bibtexText} onChange={(e) => setBibtexText(e.target.value)} placeholder={'@article{doe2024,\n  title={...},\n  author={Doe, Jane},\n  year={2024}\n}'} style={{ boxSizing: 'border-box', width: '100%', minHeight: '110px', resize: 'vertical', background: 'var(--bg-deep)', color: 'var(--ink-1)', border: '1px solid var(--line-2)', borderRadius: '6px', padding: '8px', outline: 'none', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', lineHeight: 1.45 }} />
                {bibtexError && <div style={{ marginTop: '7px', color: 'var(--ink-2)', fontSize: '11.5px' }}>{bibtexError}</div>}
                <button type="button" onClick={handleBibtexImport} style={{ ...smallBtn, marginTop: '8px', background: 'var(--acc)', color: '#17181c' }}>Add to library</button>
              </div>
            )}
          </div>

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

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '1px' }}>
                    {work.isOpenAccess && <span style={{ color: '#65d6b4', fontSize: '10px', fontWeight: 700, border: '1px solid color-mix(in oklab, #65d6b4 42%, transparent)', borderRadius: '99px', padding: '2px 6px' }}>Open access</span>}
                    {work.venue && <span title={work.venue} style={{ color: 'var(--ink-3)', fontSize: '10px', border: '1px solid var(--line-2)', borderRadius: '99px', padding: '2px 6px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{work.venue}</span>}
                    {work.isRetracted && <span style={{ color: '#f58a8a', fontSize: '10px', fontWeight: 700, border: '1px solid color-mix(in oklab, #f58a8a 42%, transparent)', borderRadius: '99px', padding: '2px 6px' }}>Retracted</span>}
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
                      <button className="hv-btn" type="button" onClick={() => onOpenPaper(work)} style={smallBtn}>
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
      {tab === 'synthesis' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-canvas)', border: '1px solid var(--line-2)' }}>
            <div style={{ color: 'var(--acc)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Research pulse</div>
            <div style={{ fontSize: '18px', lineHeight: 1.25, fontWeight: 700, marginTop: '5px' }}>
              {references.length ? `${references.length} papers in your working set` : 'Start a working set'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', marginTop: '14px' }}>
              {[['Reading', reading.length], ['Finished', done.length], ['Highlights', totalHighlights]].map(([label, value]) => (
                <div key={label} style={{ padding: '9px 7px', borderRadius: '7px', background: 'var(--bg-raise)', textAlign: 'center' }}>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink-1)' }}>{value}</div>
                  <div style={{ fontSize: '10px', color: 'var(--ink-3)', marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {references.length === 0 ? (
            <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--ink-3)', fontSize: '12.5px', lineHeight: 1.65 }}>
              Save papers from Search first. Inkwell will turn their metadata and highlights into a working literature map.
            </div>
          ) : (
            <>
              <div style={{ marginTop: '18px', fontSize: '12px', lineHeight: 1.55, color: 'var(--ink-2)' }}>
                Create one editable note that groups every paper by reading status, captures saved highlights with citation keys, and gives the assistant a clean basis for synthesis.
              </div>
              <button type="button" className="hv-bright" onClick={onCreateSynthesis} style={{ ...smallBtn, width: '100%', justifyContent: 'center', marginTop: '13px', background: 'var(--acc)', color: '#17181c' }}>
                Create literature map
              </button>
              <button type="button" className="hv-btn" onClick={onCreateEvidenceMatrix} style={{ ...smallBtn, width: '100%', justifyContent: 'center', marginTop: '8px', color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>
                Create evidence matrix
              </button>
              <button type="button" className="hv-btn" onClick={() => onAskAssistant?.('Compare the papers in my research library. Identify agreements, disagreements, and the most useful next reading or writing step.')} style={{ ...smallBtn, width: '100%', justifyContent: 'center', marginTop: '8px', color: 'var(--acc)', border: '1px solid color-mix(in oklab, var(--acc) 38%, transparent)' }}>
                Ask assistant to compare papers
              </button>
              <div style={{ marginTop: '20px', paddingTop: '13px', borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '8px' }}>Ready for synthesis</div>
                {[...done, ...reading].slice(0, 5).map(ref => (
                  <div key={paperIdOf(ref)} style={{ padding: '9px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div className="q-title" onClick={() => onOpenNote(ref)}>{ref.title}</div>
                    <div className="q-meta">{hlCount(ref)} saved highlight{hlCount(ref) === 1 ? '' : 's'} · [@{ref.citationKey}]</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 16px' }}>
          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px 0 10px' }}>
              <button type="button" onClick={() => setTagFilter('')} style={{ border: tagFilter ? '1px solid var(--line-2)' : '1px solid var(--acc)', borderRadius: '99px', background: 'transparent', color: tagFilter ? 'var(--ink-2)' : 'var(--acc)', cursor: 'pointer', padding: '4px 9px', fontSize: '11px' }}>All</button>
              {allTags.map(tag => (
                <button key={tag} type="button" onClick={() => setTagFilter(tag)} style={{ border: tagFilter === tag ? '1px solid var(--acc)' : '1px solid var(--line-2)', borderRadius: '99px', background: 'transparent', color: tagFilter === tag ? 'var(--acc)' : 'var(--ink-2)', cursor: 'pointer', padding: '4px 9px', fontSize: '11px' }}>#{tag}</button>
              ))}
            </div>
          )}
          {duplicateCandidates.length > 0 && (
            <section style={{ margin: '4px 0 12px', border: '1px solid color-mix(in oklab, #e5b86a 42%, var(--line-2))', borderRadius: '9px', background: 'color-mix(in oklab, #e5b86a 7%, var(--bg-canvas))', overflow: 'hidden' }}>
              <button type="button" onClick={() => setDuplicatesOpen(open => !open)} aria-expanded={duplicatesOpen} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', border: 'none', background: 'transparent', color: 'var(--ink-1)', cursor: 'pointer', textAlign: 'left' }}>
                <span aria-hidden="true" style={{ width: '17px', height: '17px', borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#17181c', background: '#e5b86a', fontSize: '11px', fontWeight: 800 }}>!</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 700 }}>Review possible duplicates</span>
                  <span style={{ display: 'block', marginTop: '1px', color: 'var(--ink-3)', fontSize: '10.5px' }}>{duplicateCandidates.length} pair{duplicateCandidates.length === 1 ? '' : 's'} found locally · nothing is merged automatically</span>
                </span>
                <span aria-hidden="true" style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{duplicatesOpen ? '−' : '+'}</span>
              </button>
              {duplicatesOpen && (
                <div style={{ borderTop: '1px solid color-mix(in oklab, #e5b86a 26%, var(--line-2))', padding: '3px 10px 9px' }}>
                  {duplicateCandidates.slice(0, 5).map((candidate, index) => (
                    <div key={`${paperIdOf(candidate.left)}-${paperIdOf(candidate.right)}`} style={{ padding: '9px 0', borderBottom: index === Math.min(duplicateCandidates.length, 5) - 1 ? 'none' : '1px solid var(--line-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                        <span style={{ color: '#d7a54d', fontSize: '10px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' }}>{candidate.reason}</span>
                        <span style={{ color: 'var(--ink-3)', fontSize: '10px' }}>{Math.round(candidate.confidence * 100)}% match</span>
                      </div>
                      <button type="button" onClick={() => onOpenNote(candidate.left)} style={{ display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: 'none', padding: 0, background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', textAlign: 'left', fontSize: '11px' }}>{candidate.left.title}</button>
                      <button type="button" onClick={() => onOpenNote(candidate.right)} style={{ display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: 'none', padding: 0, marginTop: '3px', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', textAlign: 'left', fontSize: '11px' }}>{candidate.right.title}</button>
                    </div>
                  ))}
                  {duplicateCandidates.length > 5 && <div style={{ marginTop: '8px', color: 'var(--ink-3)', fontSize: '10.5px' }}>Showing the first 5 pairs.</div>}
                </div>
              )}
            </section>
          )}
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
                        onOpenPaper={onOpenPaper} onSetStatus={onSetStatus} onSetTags={onSetTags} onOpenNote={onOpenNote} onCopyKey={copyKey} />
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
                        onOpenPaper={onOpenPaper} onSetStatus={onSetStatus} onSetTags={onSetTags} onOpenNote={onOpenNote} onCopyKey={copyKey} />
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
                        onOpenPaper={onOpenPaper} onSetStatus={onSetStatus} onSetTags={onSetTags} onOpenNote={onOpenNote} onCopyKey={copyKey} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onLocalPdf(f); e.target.value = ''; }}
            />
            <button className="hv-btn" onClick={() => fileRef.current?.click()} style={{ ...smallBtn, fontWeight: 500, color: 'var(--ink-2)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              Read a local PDF
            </button>
            <button className="hv-btn" type="button" disabled={!references.length} onClick={() => downloadLibraryBibtex(references)} style={{ ...smallBtn, fontWeight: 500, color: references.length ? 'var(--ink-2)' : 'var(--ink-3)', opacity: references.length ? 1 : .5, cursor: references.length ? 'pointer' : 'default' }}>
              Export .bib
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
