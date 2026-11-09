/* =========================================================
   Banco Inter — API Pix (mTLS)
   ---------------------------------------------------------
   Estas funções rodam SOMENTE no servidor (Vercel). O certificado
   e o client secret nunca vão para o navegador.
   ========================================================= */

import https from "node:https";

const PROD = "https://cdpj.partners.bancointer.com.br";
const SANDBOX = "https://cdpj-sandbox.partners.bancointer.com.br";

let tokenCache = { value: "", expiresAt: 0 };

function env(name) {
  return String(process.env[name] || "").trim();
}

function baseUrl() {
  if (env("INTER_API_BASE")) return env("INTER_API_BASE").replace(/\/$/, "");
  const sandbox = /sandbox|teste|homolog/i.test(env("INTER_ENV"));
  return sandbox ? SANDBOX : PROD;
}

function decodePem(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("BEGIN ")) return raw;
  const buf = Buffer.from(raw, "base64");
  const text = buf.toString("utf8");
  return text.includes("BEGIN ") ? text : buf;
}

function tlsOptions() {
  const pfx = env("INTER_PFX_B64");
  if (pfx) {
    return {
      pfx: Buffer.from(pfx, "base64"),
      passphrase: env("INTER_PFX_PASSWORD") || undefined,
    };
  }
  return {
    cert: decodePem(env("INTER_CERT_B64")),
    key: decodePem(env("INTER_KEY_B64")),
  };
}

export function interMissingEnv() {
  const missing = [];
  if (!env("INTER_CLIENT_ID")) missing.push("INTER_CLIENT_ID");
  if (!env("INTER_CLIENT_SECRET")) missing.push("INTER_CLIENT_SECRET");
  if (!env("INTER_PIX_KEY")) missing.push("INTER_PIX_KEY");
  if (!env("INTER_PFX_B64") && (!env("INTER_CERT_B64") || !env("INTER_KEY_B64"))) {
    missing.push("INTER_CERT_B64/INTER_KEY_B64 (ou INTER_PFX_B64)");
  }
  return missing;
}

export function interConfigured() {
  return interMissingEnv().length === 0;
}

function describeError(data, status) {
  const detail = data && (data.detail || data.title || data.message || data.error_description || data.error);
  if (detail) return `${detail}${status ? ` (HTTP ${status})` : ""}`;
  return `A API do Banco Inter respondeu HTTP ${status}.`;
}

function request(method, path, body, token, isForm = false) {
  if (!interConfigured()) {
    const err = new Error("A integração com o Banco Inter não está configurada na Vercel.");
    err.code = "PIX_NOT_CONFIGURED";
    err.status = 503;
    throw err;
  }

  const target = baseUrl();
  const url = new URL(target + path);
  const payload = body == null ? null : isForm ? String(body) : JSON.stringify(body);
  const headers = {
    Accept: "application/json",
    "User-Agent": "rateio2you/1.0",
  };
  if (payload) {
    headers["Content-Type"] = isForm ? "application/x-www-form-urlencoded" : "application/json";
    headers["Content-Length"] = Buffer.byteLength(payload);
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers,
        ...tlsOptions(),
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = { raw: text };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
            return;
          }
          const err = new Error(describeError(data, res.statusCode));
          err.status = res.statusCode;
          err.data = data;
          if (res.statusCode === 401) err.code = "INTER_UNAUTHORIZED";
          reject(err);
        });
      }
    );

    req.setTimeout(30000, () => req.destroy(new Error("Tempo esgotado ao falar com o Banco Inter.")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function getInterToken(force = false) {
  if (!force && tokenCache.value && tokenCache.expiresAt > Date.now() + 30000) {
    return tokenCache.value;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env("INTER_CLIENT_ID"),
    client_secret: env("INTER_CLIENT_SECRET"),
  });
  if (env("INTER_SCOPES")) body.set("scope", env("INTER_SCOPES"));

  const data = await request("POST", "/oauth/v2/token", body.toString(), null, true);
  if (!data || !data.access_token) {
    throw new Error("O Banco Inter não devolveu o token de acesso. Confira o client id, o secret e o certificado.");
  }
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(30, Number(data.expires_in) || 3600) * 1000,
  };
  return tokenCache.value;
}

function normalizeCob(cob) {
  const expiracao = Number((cob && cob.calendario && cob.calendario.expiracao) || 3600);
  return {
    txid: cob.txid,
    status: cob.status || "ATIVA",
    copiaECola: cob.pixCopiaECola || "",
    expiresAt: new Date(Date.now() + expiracao * 1000).toISOString(),
    locationId: cob.loc && cob.loc.id ? String(cob.loc.id) : "",
    raw: cob,
  };
}

/* Faz a chamada com o token em cache e, se o Inter responder 401,
   renova o token uma única vez e repete. */
async function authed(method, path, body) {
  const token = await getInterToken();
  try {
    return await request(method, path, body, token);
  } catch (err) {
    if (err.status !== 401) throw err;
    const fresh = await getInterToken(true);
    return request(method, path, body, fresh);
  }
}

export async function createInterCob({ txid, amount, description }) {
  const payload = {
    calendario: { expiracao: 3600 },
    valor: { original: Number(amount).toFixed(2) },
    chave: env("INTER_PIX_KEY"),
    solicitacaoPagador: String(description || "Pedido rateio2you").slice(0, 140),
  };
  const cob = await authed("PUT", `/pix/v2/cob/${encodeURIComponent(txid)}`, payload);
  return normalizeCob(cob);
}

export async function getInterCob(txid) {
  return authed("GET", `/pix/v2/cob/${encodeURIComponent(txid)}`, null);
}

export async function registerInterWebhook(webhookUrl) {
  const key = encodeURIComponent(env("INTER_PIX_KEY"));
  return authed("PUT", `/pix/v2/webhook/${key}`, { webhookUrl });
}

export function interInfo() {
  return {
    configured: interConfigured(),
    environment: /sandbox|teste|homolog/i.test(env("INTER_ENV")) ? "sandbox" : "producao",
    missing: interMissingEnv(),
  };
}
