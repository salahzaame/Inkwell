// Server-side PDF relay for deployed Inkwell. Some open-access hosts block
// browser cross-origin embeds, so the reader loads them through this same-origin
// endpoint instead.
const blockedHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function safePdfUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || blockedHosts.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const source = safePdfUrl(req.query?.url);
  if (!source) {
    res.status(400).json({ error: 'Please provide a valid public PDF URL.' });
    return;
  }

  try {
    const upstream = await fetch(source, {
      headers: {
        Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.5',
        'User-Agent': 'Inkwell PDF Reader/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `The source PDF could not be loaded (${upstream.status}).` });
      return;
    }

    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    if (!/pdf|octet-stream/i.test(contentType)) {
      res.status(415).json({ error: 'That link did not return a PDF file.' });
      return;
    }

    const file = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(file);
  } catch (error) {
    res.status(502).json({ error: 'Inkwell could not reach that PDF source.', detail: String(error) });
  }
}
