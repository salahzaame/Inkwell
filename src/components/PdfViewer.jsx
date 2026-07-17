import { useState, useEffect } from 'react';

const loadPdfjs = () => {
  return new Promise((resolve, reject) => {
    if (window['pdfjs-dist/build/pdf']) {
      resolve(window['pdfjs-dist/build/pdf']);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjs = window['pdfjs-dist/build/pdf'];
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjs);
    };
    script.onerror = (e) => reject(new Error('Failed to load PDF.js: ' + e.message));
    document.head.appendChild(script);
  });
};

export default function PdfViewer({ pdfUrl, title, citationKey, onSendToAi, onClose, layout = 'split', onLayoutChange }) {
  const [extracting, setExtracting] = useState(false);
  const [localFileUrl, setLocalFileUrl] = useState(null);

  useEffect(() => {
    return () => {
      if (localFileUrl) {
        URL.revokeObjectURL(localFileUrl);
      }
    };
  }, [localFileUrl]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (localFileUrl) {
        URL.revokeObjectURL(localFileUrl);
      }
      const url = URL.createObjectURL(file);
      setLocalFileUrl(url);
    }
  };

  const handleSummarize = async () => {
    const src = localFileUrl || pdfUrl;
    if (!src) return;
    setExtracting(true);
    try {
      const pdfjs = await loadPdfjs();
      let fetchSrc = src;
      // Use proxy if it's an external url to avoid CORS download issues
      if (typeof src === 'string' && src.startsWith('http') && !src.includes(window.location.host)) {
        fetchSrc = `/api/pdf?url=${encodeURIComponent(src)}`;
      }
      
      const loadingTask = pdfjs.getDocument(fetchSrc);
      const pdf = await loadingTask.promise;
      
      let extractedText = '';
      const maxPages = Math.min(pdf.numPages, 6); // Extract first 6 pages to stay within token limits
      
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += `\n[Page ${i}]\n` + pageText;
      }

      if (!extractedText.trim()) {
        throw new Error('No readable text found in the PDF. It might be scanned.');
      }

      const paperTitle = title || 'this PDF';
      const prompt = `I have loaded the research paper: "${paperTitle}". Here is the extracted text of the first ${maxPages} pages:\n\n${extractedText.slice(0, 7000)}\n\nCan you summarize the main goals, methodology, and key findings of this paper?`;
      
      onSendToAi(prompt);
    } catch (err) {
      console.error(err);
      alert(`Text extraction failed: ${err.message}. If the model is active, you can still chat with it.`);
    } finally {
      setExtracting(false);
    }
  };

  const displayUrl = localFileUrl || (pdfUrl ? (pdfUrl.startsWith('http') ? `/api/pdf?url=${encodeURIComponent(pdfUrl)}` : pdfUrl) : null);

  const headerBtn = {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
    background: '#22242b',
    color: '#dadde5',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background .15s'
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#17181c', borderRight: '1px solid #23252b' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#191b1f', borderBottom: '1px solid #23252b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2.2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
          <span style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#dadde5' }}>
            {title || 'Local PDF Reader'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {displayUrl && onLayoutChange && (
            <div style={{ display: 'flex', background: '#22242b', padding: '2px', borderRadius: '8px', border: '1px solid #2c2f37', marginRight: '4px' }} onMouseDown={e => e.stopPropagation()}>
              {['split', 'pdf', 'editor'].map((mode) => {
                const active = layout === mode;
                const label = mode === 'split' ? 'Split' : (mode === 'pdf' ? 'PDF' : 'Note');
                return (
                  <div
                    key={mode}
                    onClick={() => onLayoutChange(mode)}
                    style={{
                      padding: '4px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                      color: active ? 'var(--acc)' : '#8b90a0',
                      background: active ? '#1a1c21' : 'transparent',
                      transition: 'all .15s ease'
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          )}

          {displayUrl && (
            <button 
              className="hv-btn" 
              onClick={handleSummarize} 
              disabled={extracting}
              style={{ ...headerBtn, background: 'color-mix(in oklab, var(--acc) 14%, transparent)', color: 'var(--acc)' }}
            >
              {extracting ? (
                <>Extracting text...</>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.4L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.6z" /></svg>
                  AI Summarize
                </>
              )}
            </button>
          )}

          {citationKey && (
            <button 
              className="hv-btn" 
              onClick={() => {
                navigator.clipboard.writeText(`[@${citationKey}]`);
                alert('Citation key copied to clipboard!');
              }} 
              style={headerBtn}
              title="Copy citation key"
            >
              Copy CiteKey
            </button>
          )}

          <div 
            className="hv-item" 
            onClick={onClose} 
            style={{ width: '26px', height: '26px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b90a0', cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </div>
        </div>
      </div>

      {/* Reader area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e2025' }}>
        {displayUrl ? (
          <iframe
            src={displayUrl}
            title={title || 'PDF Reader'}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: '#8b90a0', padding: '20px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 12 15 15" /></svg>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>No PDF Loaded</div>
            <div style={{ fontSize: '12px', color: '#5b6170', textAlign: 'center', maxWidth: '280px', lineHeight: 1.5 }}>
              Choose an open-access paper from the Research panel on the left, or upload a local PDF file to read it side-by-side.
            </div>
            
            <label style={{ ...headerBtn, background: 'var(--acc)', color: '#17181c', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', marginTop: '6px' }}>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              Upload local PDF
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
