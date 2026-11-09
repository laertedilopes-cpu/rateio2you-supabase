/* =========================================================
   rateio2you — dados base, enums e configurações padrão
   A partir desta versão os dados reais vêm do Supabase.
   Este arquivo só guarda os valores padrão e a estrutura.
   ========================================================= */

const R2Y = (() => {
  const PIX = {
    // Usada apenas no modo manual (quando a API do Inter não está ligada).
    key: "",
    merchant: "RATEIO2YOU",
    city: "SAO PAULO",
    sinalPorVial: 20,
  };

  const REGIOES = {
    Sudeste: 39.9,
    Sul: 49.9,
    "Centro-Oeste": 59.9,
    Nordeste: 69.9,
    Norte: 79.9,
  };

  const ESTADOS = {
    AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
    AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
    DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
    ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
    PR: "Sul", RS: "Sul", SC: "Sul",
  };

  const defaultSettings = () => ({
    /* Identidade do site */
    siteName: "rateio2you",
    brandMark: "2",
    brandLogo: "",
    brandHighlight: "2",
    brandSub: "Compras coletivas · China → Brasil",
    pageTitle: "rateio2you — compras coletivas",
    metaDescription:
      "rateio2you — organização de compras coletivas para membros aprovados. Catálogo por lote, caixas de 10 unidades, sinal e pagamento via Pix.",
    contactEmail: "",
    contactWhatsapp: "",
    contactInstagram: "",

    /* Faixa superior e rodapé */
    announceLeft: "Compras coletivas privadas · envio para todo o Brasil",
    announceRight: "Pagamento exclusivo via Pix",
    footerTagline:
      "Organização de compras coletivas para membros aprovados. Um único Pix para cada etapa da reserva.",
    footerNote: "rateio2you · uso restrito ao grupo · valores em BRL",
    footerDemo: "Pagamento protegido via Pix · Banco Inter",

    /* Login e cadastro */
    authTag: "Grupo fechado · acesso aprovado",
    authHeadline1: "Compre junto.",
    authHeadline2: "Pague menos.",
    authLead:
      "Um só lugar para organizar reservas, fechar caixas de {caixa} unidades e pagar tudo com Pix — do sinal ao saldo final.",
    authBenefits: [
      "Catálogo por lote e caixa compartilhada",
      "Sinal de {sinal} por {unidade}, descontado do total",
      "Frete calculado pela região do seu CEP",
      "Acompanhamento do envio e da entrega",
    ],
    loginTitle: "Entrar no grupo",
    loginLead: "Use o e-mail cadastrado no rateio e sua senha de acesso.",
    signupTitle: "Criar conta",
    signupLead: "Seu cadastro é salvo na nuvem. O organizador libera o acesso depois da conferência dos dados.",
    autoApproveUsers: false,

    /* Guia e documentos */
    guideTitle: "Do cadastro à entrega, sem surpresa",
    guideLead:
      "Entenda como o {site} organiza reservas, caixas de {caixa} unidades, sinal e saldo final — e o que esperar em cada etapa.",
    privacyTitle: "Política de Privacidade",
    privacyUpdated: "Última atualização: novembro de 2026",
    privacyIntro:
      "Esta política explica como o {site} trata os dados pessoais dos participantes do grupo fechado de compras coletivas, em conformidade com a Lei nº 13.709/2018 (LGPD).",
    termsTitle: "Termos de Serviço",
    termsUpdated: "Última atualização: novembro de 2026",
    termsIntro:
      "Estes termos regulam o uso do {site}, ferramenta de organização de compras coletivas destinada aos membros aprovados do grupo.",

    /* Pagamento / sinal / caixa */
    pixProvider: "inter", // "inter" = API automática | "manual" = chave Pix digitada
    pixKey: "",
    pixMerchant: PIX.merchant,
    pixCity: PIX.city,
    sinalEnabled: true,
    sinalPorVial: 20,
    boxSize: 10,
    unitLabel: "unidade",
    unitLabelPlural: "unidades",
    specsLabel: "Modelo",

    /* Frete */
    shippingEnabled: true,
    shipping: { ...REGIOES },

    /* Aparência */
    storePrimary: "#2b211b",
    storeAccent: "#a65b3c",
    bannerImage: "",
    bannerTitle: "",
    bannerSubtitle: "",

    /* Controle interno */
    demoMode: false,
  });

  const empty = () => ({
    version: 3,
    settings: defaultSettings(),
    users: [],
    lots: [],
    products: [],
    stock: [],
    auctions: [],
    orders: [],
    bids: [],
    carts: {},
    payments: [],
    me: null,
  });

  function normalize(db) {
    db.version = 3;
    const base = defaultSettings();
    const incoming = db.settings || {};
    db.settings = {
      ...base,
      ...incoming,
      shipping: { ...base.shipping, ...(incoming.shipping || {}) },
      authBenefits:
        Array.isArray(incoming.authBenefits) && incoming.authBenefits.length
          ? incoming.authBenefits
          : base.authBenefits,
    };
    ["users", "lots", "products", "stock", "auctions", "orders", "bids", "payments"].forEach((key) => {
      if (!Array.isArray(db[key])) db[key] = [];
    });
    if (!db.carts || typeof db.carts !== "object") db.carts = {};
    if (!db.me) db.me = null;
    return db;
  }

  return {
    PIX,
    REGIOES,
    ESTADOS,
    defaultSettings,
    empty,
    normalize,
  };
})();
