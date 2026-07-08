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

export default defineConfig({
  plugins: [react(), assistantProxy()],
  server: { port: 5173 },
  // required by @excalidraw/excalidraw (it branches on this at build time)
  define: { 'process.env.IS_PREACT': JSON.stringify('false') },
});
