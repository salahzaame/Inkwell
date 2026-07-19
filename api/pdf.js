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
        // publishers routinely reject non-browser agents with an HTML block page
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `The source PDF could not be loaded (${upstream.status}).` });
      return;
    }

    // trust the bytes, not the content-type header — some hosts label PDFs as
    // text/html and others send an HTML paywall page labelled as a PDF
    const file = Buffer.from(await upstream.arrayBuffer());
    if (file.length < 5 || file.subarray(0, 5).toString('latin1') !== '%PDF-') {
      res.status(415).json({ error: 'The source sent a web page instead of the PDF (usually a paywall or bot check).' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(file);
  } catch (error) {
    res.status(502).json({ error: 'Inkwell could not reach that PDF source.', detail: String(error) });
  }
}
