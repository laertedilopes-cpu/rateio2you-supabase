/* =========================================================
   POST /api/pix/create
   ---------------------------------------------------------
   Chamado pelo site quando o cliente clica em "Gerar Pix".
   Valida o usuário logado, confere o pedido e cria a cobrança
   no Banco Inter. O certificado e o client secret ficam só aqui.
   ========================================================= */

import { requireUser } from "../../lib/auth.js";
import { supabaseAdmin, requireServerEnv } from "../../lib/supabase.js";
import { createInterCob, interConfigured, interMissingEnv } from "../../lib/inter.js";
import { handleOptions, parseBody, fail, ok } from "../../lib/http.js";

const KINDS = ["sinal", "total", "saldo"];

function newTxid() {
  const random = Math.random().toString(36).slice(2, 10);
  return `r2y${Date.now().toString(36)}${random}`.slice(0, 35);
}

function amountFor(order, kind) {
  if (kind === "sinal") return Number(order.sinal || 0);
  if (kind === "saldo") return Number(order.balance || 0);
  return Number(order.total || 0);
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return fail(res, 405, "Use POST para gerar a cobrança Pix.");
  }

  const missingServer = requireServerEnv();
  if (missingServer.length) {
    return fail(res, 500, "O servidor ainda não foi configurado.", {
      code: "SERVER_NOT_CONFIGURED",
      missing: missingServer,
    });
  }

  if (!interConfigured()) {
    return fail(res, 503, "A integração com o Banco Inter ainda não está configurada.", {
      code: "PIX_NOT_CONFIGURED",
      missing: interMissingEnv(),
    });
  }

  try {
    const user = await requireUser(req);
    const body = parseBody(req);
    const orderId = String(body.orderId || "").trim();
    const kind = String(body.kind || "total").trim();

    if (!orderId) return fail(res, 400, "Informe o pedido.");
    if (!KINDS.includes(kind)) return fail(res, 400, "Tipo de pagamento inválido.");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return fail(res, 404, "Pedido não encontrado para este usuário.");

    if (["pago", "entregue"].includes(order.status)) {
      return fail(res, 409, "Este pedido já está pago.");
    }

    const amount = amountFor(order, kind);
    if (!amount || amount <= 0) {
      return fail(res, 400, "Este pagamento não está disponível para o pedido.");
    }

    // Reaproveita uma cobrança pendente e ainda válida.
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .eq("kind", kind)
      .eq("status", "pendente")
      .eq("provider", "inter")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.copia_cola) {
      const expired = existing.expires_at && new Date(existing.expires_at).getTime() <= Date.now();
      if (!expired) {
        return ok(res, {
          txid: existing.txid,
          copiaECola: existing.copia_cola,
          amount: Number(existing.amount || amount),
          expiresAt: existing.expires_at,
          status: "ATIVA",
          reused: true,
        });
      }
      await supabaseAdmin
        .from("payments")
        .update({ status: "expirado" })
        .eq("id", existing.id);
    }

    const txid = existing && !existing.copia_cola ? existing.txid : newTxid();
    const description = `Pedido ${orderId} - ${order.lot_title || "rateio2you"}`;

    let paymentId = existing && !existing.copia_cola ? existing.id : "";
    if (!paymentId) {
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .insert({
          order_id: orderId,
          txid,
          kind,
          amount,
          status: "pendente",
          provider: "inter",
        })
        .select("id")
        .single();
      if (paymentError) throw paymentError;
      paymentId = payment.id;
    }

    let cob;
    try {
      cob = await createInterCob({ txid, amount, description });
    } catch (err) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "cancelado" })
        .eq("id", paymentId);
      throw err;
    }

    await supabaseAdmin
      .from("payments")
      .update({
        copia_cola: cob.copiaECola,
        expires_at: cob.expiresAt,
        status: "pendente",
      })
      .eq("id", paymentId);

    await supabaseAdmin
      .from("orders")
      .update({
        pix_txid: txid,
        pix_copia_cola: cob.copiaECola,
        pix_expires_at: cob.expiresAt,
      })
      .eq("id", orderId);

    return ok(res, {
      txid,
      copiaECola: cob.copiaECola,
      amount,
      expiresAt: cob.expiresAt,
      status: cob.status,
    });
  } catch (err) {
    console.error("[pix/create]", err);
    return fail(res, err.status || 500, err.message || "Não foi possível gerar o Pix.", {
      code: err.code || "PIX_CREATE_ERROR",
    });
  }
}
