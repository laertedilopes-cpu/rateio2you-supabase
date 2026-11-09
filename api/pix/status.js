/* =========================================================
   POST /api/pix/status
   ---------------------------------------------------------
   Consulta a cobrança no Banco Inter e, quando o status for
   CONCLUIDA, confirma o pagamento no banco (RPC atômica).
   O site chama esta rota a cada 5 segundos enquanto o modal
   de Pix está aberto.
   ========================================================= */

import { requireUser } from "../../lib/auth.js";
import { supabaseAdmin, requireServerEnv } from "../../lib/supabase.js";
import { getInterCob, interConfigured, interMissingEnv } from "../../lib/inter.js";
import { handleOptions, parseBody, fail, ok } from "../../lib/http.js";

function paidAtFrom(cob) {
  const pix = Array.isArray(cob && cob.pix) ? cob.pix : [];
  const first = pix.find((p) => p && p.horario);
  const date = first ? new Date(first.horario) : new Date();
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "POST") {
    return fail(res, 405, "Use POST para consultar o pagamento.");
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
    const txid = String(body.txid || "").trim();

    if (!orderId || !txid) return fail(res, 400, "Informe o pedido e a cobrança.");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id,user_id,status")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return fail(res, 404, "Pedido não encontrado para este usuário.");

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("txid", txid)
      .eq("order_id", orderId)
      .eq("kind", kind)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return fail(res, 404, "Cobrança Pix não encontrada.");

    if (payment.status === "pago") {
      return ok(res, { paid: true, status: "CONCLUIDA", paidAt: payment.paid_at });
    }

    if (payment.provider === "manual") {
      return ok(res, { paid: false, status: "PENDENTE", manual: true });
    }

    const cob = await getInterCob(txid);
    const status = String((cob && cob.status) || "ATIVA").toUpperCase();

    if (status === "CONCLUIDA") {
      const paidAt = paidAtFrom(cob);
      const { error: rpcError } = await supabaseAdmin.rpc("confirm_pix_payment", {
        p_txid: txid,
        p_paid_at: paidAt,
      });
      if (rpcError) throw rpcError;
      return ok(res, { paid: true, status, paidAt });
    }

    if (status === "REMOVIDA_PELO_USUARIO_RECEBEDOR" || status === "REMOVIDA_PELO_PSP") {
      await supabaseAdmin.from("payments").update({ status: "cancelado" }).eq("id", payment.id);
    }

    return ok(res, { paid: false, status });
  } catch (err) {
    console.error("[pix/status]", err);
    return fail(res, err.status || 500, err.message || "Não foi possível consultar o pagamento.", {
      code: err.code || "PIX_STATUS_ERROR",
    });
  }
}
