import { useState } from 'react';

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

export default function ResearchPanel({ references, onImportReference, onOpenPdf, onClose }) {
  const [tab, setTab] = useState('search'); // 'search' | 'references'
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);

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

        // Generate BibTeX snippet
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

  const copyToClipboard = (text, message = 'Copied!') => {
    navigator.clipboard.writeText(text);
    alert(message);
  };

  const cardStyle = {
    background: '#1e2025',
    border: '1px solid #2c2f37',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    animation: 'fadeUp .2s ease-out'
  };

  const btnStyle = {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '11.5px',
    cursor: 'pointer',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: '#22242b',
    color: '#dadde5',
    transition: 'background .15s'
  };

  return (
    <div style={{ width: '350px', background: '#191b1f', borderRight: '1px solid #23252b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #23252b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-15A2.5 2.5 0 0 1 6.5 2M20 4v18" /><path d="M6 6h10M6 10h10" /></svg>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Research Library</span>
        </div>
        <div className="hv-item" onClick={onClose} style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b90a0', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #23252b', padding: '4px 8px', gap: '4px' }}>
        <div 
          onClick={() => setTab('search')}
          style={{
            flex: 1, textAlign: 'center', fontSize: '12px', padding: '6px 0', cursor: 'pointer', borderRadius: '6px',
            color: tab === 'search' ? 'var(--acc)' : '#8b90a0',
            background: tab === 'search' ? 'color-mix(in oklab, var(--acc) 12%, transparent)' : 'transparent',
            fontWeight: tab === 'search' ? 600 : 400
          }}
        >
          Search Papers
        </div>
        <div 
          onClick={() => setTab('references')}
          style={{
            flex: 1, textAlign: 'center', fontSize: '12px', padding: '6px 0', cursor: 'pointer', borderRadius: '6px',
            color: tab === 'references' ? 'var(--acc)' : '#8b90a0',
            background: tab === 'references' ? 'color-mix(in oklab, var(--acc) 12%, transparent)' : 'transparent',
            fontWeight: tab === 'references' ? 600 : 400
          }}
        >
          Reference Vault ({references.length})
        </div>
      </div>

      {/* Search Tab View */}
      {tab === 'search' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <form onSubmit={handleSearch} style={{ padding: '12px 14px 8px', display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: '#1e2025', border: '1px solid #2c2f37', borderRadius: '8px', padding: '6px 10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b90a0" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search arXiv, DOIs, fields..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#dadde5', fontSize: '12.5px', minWidth: 0 }}
              />
            </div>
            <button className="hv-bright" type="submit" style={{ ...btnStyle, background: 'var(--acc)', color: '#17181c', border: 'none', padding: '6px 12px' }}>
              Search
            </button>
          </form>

          {/* Results List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 14px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px', color: '#8b90a0' }}>
                <span style={{ fontSize: '13px' }}>Searching OpenAlex database...</span>
              </div>
            ) : results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#5b6170', fontSize: '12.5px' }}>
                Type a topic or author to begin searching.
              </div>
            ) : (
              results.map((work, idx) => (
                <div key={work.id || idx} style={cardStyle}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e7e9ef', lineHeight: 1.4 }}>
                    {work.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8b90a0' }}>
                    {work.authors.slice(0, 3).join(', ')}{work.authors.length > 3 ? ' et al.' : ''} · {work.year}
                  </div>
                  {work.citedBy > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--acc)' }}>
                      Cited by {work.citedBy} papers
                    </div>
                  )}

                  {expandedIndex === idx && work.abstract && (
                    <div style={{ fontSize: '11.5px', color: '#b0b5c1', background: '#16181d', padding: '8px 10px', borderRadius: '6px', marginTop: '4px', lineHeight: 1.4, maxHeight: '120px', overflowY: 'auto' }}>
                      <strong>Abstract:</strong> {work.abstract}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {work.abstract && (
                      <button className="hv-btn" type="button" onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)} style={btnStyle}>
                        {expandedIndex === idx ? 'Hide Abstract' : 'Show Abstract'}
                      </button>
                    )}
                    <button className="hv-btn" type="button" onClick={() => onImportReference(work)} style={{ ...btnStyle, background: 'color-mix(in oklab, var(--acc) 14%, transparent)', color: 'var(--acc)' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                      Import Note
                    </button>
                    {work.pdfUrl && (
                      <button className="hv-btn" type="button" onClick={() => onOpenPdf(work.pdfUrl, work.title, work.citationKey)} style={{ ...btnStyle, background: '#2c2f37' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                        Read Paper
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* References Tab View */}
      {tab === 'references' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
          {references.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#5b6170', fontSize: '12.5px' }}>
              No references imported yet. Import them from search results.
            </div>
          ) : (
            references.map((ref, idx) => (
              <div key={ref.id || idx} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--acc)', background: 'color-mix(in oklab, var(--acc) 12%, transparent)', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start' }}>
                    @{ref.citationKey}
                  </span>
                  {ref.pdfUrl && (
                    <span 
                      onClick={() => onOpenPdf(ref.pdfUrl, ref.title, ref.citationKey)}
                      title="Read PDF"
                      style={{ cursor: 'pointer', color: '#8b90a0', display: 'flex', alignItems: 'center' }}
                      className="hv-fade"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12.5px', color: '#e7e9ef', fontWeight: 550, marginTop: '4px', lineHeight: 1.3 }}>
                  {ref.title}
                </div>
                <div style={{ fontSize: '10.5px', color: '#8b90a0' }}>
                  {ref.authors?.slice(0, 3).join(', ')}{ref.authors?.length > 3 ? ' et al.' : ''} · {ref.year}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <button className="hv-btn" type="button" onClick={() => copyToClipboard(`[@${ref.citationKey}]`, 'Citation key copied!')} style={btnStyle}>
                    Copy CiteKey
                  </button>
                  <button className="hv-btn" type="button" onClick={() => copyToClipboard(ref.bibtex, 'BibTeX copied to clipboard!')} style={btnStyle}>
                    Copy BibTeX
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
