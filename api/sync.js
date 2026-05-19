// Vercel Serverless Function — proxy para o Google Apps Script
// Resolve o bloqueio de CORS: browser → /api/sync → Apps Script

const GS_URL = 'https://script.google.com/macros/s/AKfycbznR9zgoEBROt-slQmlIV3mCcADjdKTZU-LwlVgRvEztA4MI4VcYiLujoZIY9ouH1Vf/exec';
const MAX_BODY = 300_000; // 300 KB

// Habilita body parser do Vercel explicitamente para application/json
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '300kb',
    },
  },
};

export default async function handler(req, res) {
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
      // Vercel parseia application/json automaticamente → req.body é objeto
      // Garante que sempre enviamos uma string JSON válida ao Apps Script
      let bodyStr;
      if (typeof req.body === 'string') {
        bodyStr = req.body;
      } else if (req.body && typeof req.body === 'object') {
        bodyStr = JSON.stringify(req.body);
      } else {
        return res.status(400).json({ ok: false, error: 'Body inválido' });
      }

      if (bodyStr.length > MAX_BODY) {
        return res.status(413).json({ ok: false, error: 'Payload muito grande' });
      }

      console.log('Enviando para GS, tamanho:', bodyStr.length, 'chars');

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
