/* =========================================================
   POST /api/pix/register-webhook
   ---------------------------------------------------------
   Registra a URL do webhook no Banco Inter.
   Protegido por ADMIN_TOKEN (variável de ambiente da Vercel).
   Envie o cabeçalho:  x-admin-token: SEU_ADMIN_TOKEN
   ========================================================= */

import { registerInterWebhook, interConfigured, interMissingEnv } from "../../lib/inter.js";
import { handleOptions, parseBody, fail, ok } from "../../lib/http.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return fail(res, 405, "Use POST.");
  }

  const expected = String(process.env.ADMIN_TOKEN || "").trim();
  const header = String(req.headers["x-admin-token"] || "");
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!expected || (header !== expected && bearer !== expected)) {
    return fail(res, 401, "Acesso restrito. Informe o ADMIN_TOKEN.");
  }

  if (!interConfigured()) {
    return fail(res, 503, "A integração com o Banco Inter ainda não está configurada.", {
      code: "PIX_NOT_CONFIGURED",
      missing: interMissingEnv(),
    });
  }

  try {
    const body = parseBody(req);
    const site = String(process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const token = String(process.env.INTER_WEBHOOK_TOKEN || "").trim();
    const fallback = site
      ? `${site}/api/pix/webhook${token ? `?token=${encodeURIComponent(token)}` : ""}`
      : "";
    const webhookUrl = String(body.webhookUrl || fallback).trim();

    if (!/^https:\/\//i.test(webhookUrl)) {
      return fail(res, 400, "Informe uma URL HTTPS pública para o webhook.");
    }

    await registerInterWebhook(webhookUrl);
    return ok(res, { webhookUrl });
  } catch (err) {
    console.error("[pix/register-webhook]", err);
    return fail(res, err.status || 500, err.message || "Não foi possível registrar o webhook.", {
      code: err.code || "WEBHOOK_ERROR",
    });
  }
}
