/* Utilitários HTTP compartilhados pelas funções da Vercel. */

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.PUBLIC_SITE_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
}

export function handleOptions(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.status(204).end();
    return true;
  }
  return false;
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

export function fail(res, status, message, extra = {}) {
  setCors(res);
  return res.status(status).json({ ok: false, message, ...extra });
}

export function ok(res, payload) {
  setCors(res);
  return res.status(200).json({ ok: true, ...payload });
}
