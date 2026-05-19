// Vercel Serverless Function — proxy para o Google Apps Script
// Resolve o bloqueio de CORS: browser → /api/sync → Apps Script

const GS_URL = 'https://script.google.com/macros/s/AKfycbznR9zgoEBROt-slQmlIV3mCcADjdKTZU-LwlVgRvEztA4MI4VcYiLujoZIY9ouH1Vf/exec';
const MAX_BODY = 300_000; // 300 KB

export default async function handler(req, res) {
  // Apenas o domínio do próprio app pode chamar este endpoint
  const origin = req.headers.origin || '';
  const allowed = origin.endsWith('.vercel.app') || origin === '';
  if (!allowed) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let gsRes;

    if (req.method === 'GET') {
      gsRes = await fetch(GS_URL + '?action=read');

    } else if (req.method === 'POST') {
      // req.body pode vir como string (text/plain) ou objeto (se Vercel parseou)
      const bodyStr = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

      if (bodyStr.length > MAX_BODY) {
        return res.status(413).json({ ok: false, error: 'Payload muito grande' });
      }

      gsRes = await fetch(GS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr,
      });

    } else {
      return res.status(405).json({ ok: false, error: 'Método não permitido' });
    }

    const text = await gsRes.text();
    try {
      return res.status(200).json(JSON.parse(text));
    } catch (_) {
      console.error('Resposta inesperada do Apps Script:', text.slice(0, 400));
      return res.status(502).json({ ok: false, error: 'Resposta inválida do backend' });
    }

  } catch (err) {
    console.error('Erro no proxy:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
