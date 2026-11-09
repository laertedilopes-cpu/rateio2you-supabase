/* =========================================================
   POST /api/pix/webhook?token=SEU_TOKEN
   ---------------------------------------------------------
   O Banco Inter chama esta URL quando um Pix é recebido.
   Confere o token da URL e confirma cada cobrança no banco.
   Configure a URL no painel do Inter ou use register-webhook.
   ========================================================= */

import { supabaseAdmin, requireServerEnv } from "../../lib/supabase.js";
import { handleOptions, parseBody, fail, ok } from "../../lib/http.js";

function tokenFrom(req) {
  const query = req.query || {};
  const fromQuery = Array.isArray(query.token) ? query.token[0] : query.token;
  const header = String(req.headers["x-webhook-token"] || "");
  const auth = String(req.headers.authorization || "");
  const fromAuth = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return String(fromQuery || header || fromAuth || "").trim();
}

function pixList(body) {
  if (!body) return [];
  if (Array.isArray(body.pix)) return body.pix;
  if (body.pix && typeof body.pix === "object") return [body.pix];
  if (Array.isArray(body)) return body;
  return [];
}

function paidAtFrom(item) {
  const date = item && item.horario ? new Date(item.horario) : new Date();
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return fail(res, 405, "Use POST.");
  }

  const expected = String(process.env.INTER_WEBHOOK_TOKEN || "").trim();
  if (expected && tokenFrom(req) !== expected) {
    return fail(res, 401, "Token do webhook inválido.");
  }

  const missingServer = requireServerEnv();
  if (missingServer.length) {
    return fail(res, 500, "O servidor ainda não foi configurado.", {
      code: "SERVER_NOT_CONFIGURED",
      missing: missingServer,
    });
  }

  try {
    const body = parseBody(req);
    const list = pixList(body);

    if (!list.length) {
      // O Inter às vezes envia apenas um "ping" de validação da URL.
      return ok(res, { received: 0 });
    }

    const results = [];
    for (const item of list) {
      const txid = String((item && item.txid) || "").trim();
      if (!txid) continue;
      try {
        const { error } = await supabaseAdmin.rpc("confirm_pix_payment", {
          p_txid: txid,
          p_paid_at: paidAtFrom(item),
        });
        if (error) throw error;
        results.push({ txid, confirmed: true });
      } catch (err) {
        // Cobrança desconhecida não deve fazer o Inter retentar para sempre.
        console.warn("[pix/webhook] txid não confirmado:", txid, err.message);
        results.push({ txid, confirmed: false });
      }
    }

    return ok(res, { received: list.length, results });
  } catch (err) {
    console.error("[pix/webhook]", err);
    return fail(res, 500, "Não foi possível processar o webhook.");
  }
}
