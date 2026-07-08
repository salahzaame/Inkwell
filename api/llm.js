// Vercel serverless function — same role as the dev-server proxy in vite.config.js:
// Pollinations' anonymous API serves server-side clients, so this function is the API client.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  try {
    const r = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(60000),
    });
    const text = await r.text();
    res.setHeader('content-type', 'application/json');
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
}
