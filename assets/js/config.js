/* =========================================================
   rateio2you — CONFIGURAÇÃO DO SUPABASE
   ---------------------------------------------------------
   É SÓ AQUI que você troca as duas chaves.
   Veja o passo a passo no arquivo GUIA-PASSO-A-PASSO.md.
   ========================================================= */

window.LOJA_CONFIG = {
  // Endereço base do projeto (SEM "/rest/v1/" e SEM barra no final).
  SUPABASE_URL: "https://bbholsatdjnxyvfpjbxn.supabase.co",

  // Chave pública "anon" (pode ficar no navegador; é protegida pelo RLS).
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaG9sc2F0ZGpueHl2ZnBqYnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyMDM2MjYsImV4cCI6MjEwOTc3OTYyNn0.Vrw1rFm9u_YYnNMAfFJDlQA-qL6IXIKOEcxuUnxcTiU",

  // Endereço da API do PIX. Deixe vazio quando o site estiver na Vercel:
  // o próprio site chama /api/pix/create no mesmo domínio.
  PIX_API_BASE: "",

  // Nome do bucket de imagens criado pelo SQL.
  STORAGE_BUCKET: "product-images",

  // Nome que aparece na aba do navegador enquanto carrega.
  LOADING_LABEL: "rateio2you",
};
