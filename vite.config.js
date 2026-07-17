import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Pollinations' anonymous API serves server-side clients but gates direct browser
// calls, so the dev server acts as the API client (standard BFF proxy).
function assistantProxy() {
  const handler = (req, res) => {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const r = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: AbortSignal.timeout(60000),
        });
        res.statusCode = r.status;
        res.setHeader('content-type', 'application/json');
        res.end(await r.text());
      } catch (e) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
  };
  return {
    name: 'assistant-proxy',
    configureServer(server) { server.middlewares.use('/api/llm', handler); },
    configurePreviewServer(server) { server.middlewares.use('/api/llm', handler); },
  };
}

function pdfProxy() {
  const handler = (req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const urlStr = parsedUrl.searchParams.get('url');
      if (!urlStr) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Missing url parameter');
        return;
      }

      fetch(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/pdf, */*'
        }
      })
      .then(async response => {
        if (!response.ok) {
          res.statusCode = response.status;
          res.setHeader('Content-Type', 'text/plain');
          res.end(`Failed to fetch PDF: ${response.statusText}`);
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/pdf');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

        const arrayBuffer = await response.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      })
      .catch(err => {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(err) }));
      });
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`Server Error: ${e.message}`);
    }
  };
  return {
    name: 'pdf-proxy',
    configureServer(server) { server.middlewares.use('/api/pdf', handler); },
    configurePreviewServer(server) { server.middlewares.use('/api/pdf', handler); },
  };
}

export default defineConfig({
  plugins: [react(), assistantProxy(), pdfProxy()],
  server: { port: 5173 },
  // required by @excalidraw/excalidraw (it branches on this at build time)
  define: { 'process.env.IS_PREACT': JSON.stringify('false') },
});
