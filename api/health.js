/* =========================================================
   GET /api/health
   ---------------------------------------------------------
   Mostra (sem revelar segredos) se a API do Pix está pronta.
   O painel admin usa este endereço no botão "Testar API Pix".
   ========================================================= */

import { interInfo } from "../../lib/inter.js";
import { requireServerEnv } from "../../lib/supabase.js";
import { handleOptions, ok } from "../../lib/http.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const missingServer = requireServerEnv();
  const inter = interInfo();

  return ok(res, {
    configured: inter.configured && missingServer.length === 0,
    inter,
    supabaseServerConfigured: missingServer.length === 0,
    missing: missingServer,
    environment: inter.environment,
    site: String(process.env.PUBLIC_SITE_URL || ""),
    time: new Date().toISOString(),
  });
}
