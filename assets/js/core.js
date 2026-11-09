/* =========================================================
   rateio2you — núcleo compartilhado (versão Supabase)
   ========================================================= */

let db = R2Y.empty();
let booted = false;
let tickTimer = null;
let pixPollTimer = null;
let pixPoll = null;
let reloadTimer = null;

/* ---------------- configurações dinâmicas (painel admin) ---------------- */

const settings = () => db.settings || R2Y.defaultSettings();
const siteName = () => settings().siteName || "rateio2you";
const brandMark = () => settings().brandMark || "2";
const brandLogo = () => settings().brandLogo || "";

function brandMarkHTML() {
  const logo = brandLogo();
  if (logo) {
    return `<span class="brand-mark brand-mark-logo"><img src="${esc(logo)}" alt="${esc(siteName())}"></span>`;
  }
  return `<span class="brand-mark">${esc(brandMark())}</span>`;
}

function brandNameHTML() {
  const raw = String(siteName());
  const mark = String(settings().brandHighlight || "");
  const index = mark ? raw.indexOf(mark) : -1;
  if (index < 0) return esc(raw);
  return `${esc(raw.slice(0, index))}<span>${esc(mark)}</span>${esc(raw.slice(index + mark.length))}`;
}

const unitLabel = (plural = false) =>
  plural
    ? settings().unitLabelPlural || "unidades"
    : settings().unitLabel || "unidade";

const boxSize = () => Math.max(1, Number(settings().boxSize) || 10);
const sinalEnabled = () => settings().sinalEnabled !== false;
const sinalPerUnit = () => (sinalEnabled() ? Number(settings().sinalPorVial) || 0 : 0);

const regionShipping = (region) =>
  settings().shippingEnabled === false
    ? 0
    : Number((settings().shipping || {})[region] || 0);

const pixConfig = () => ({
  key: settings().pixKey || R2Y.PIX.key,
  merchant: settings().pixMerchant || R2Y.PIX.merchant,
  city: settings().pixCity || R2Y.PIX.city,
});

const isAdmin = () => {
  const user = currentUser();
  return !!(user && user.role === "admin");
};

function tokens(text) {
  return String(text == null ? "" : text)
    .replace(/\{site\}/g, siteName())
    .replace(/\{sinal\}/g, fmt(sinalPerUnit()))
    .replace(/\{unidadePlural\}/g, unitLabel(true))
    .replace(/\{unidade\}/g, unitLabel(false))
    .replace(/\{caixa\}/g, String(boxSize()));
}

const ui = {
  selectedLotId: null,
  orderQty: {},
  search: "",
  filter: "todos",
  calc: { mg: 10, ml: 2, dose: 0.25, syringe: 100 },
  cartQty: {},
  pendingEmail: "",
  addressFormOpen: false,
  bidError: {},
  lastPath: "",
};

const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
const toastRoot = document.getElementById("toasts");

const NAV = [
  { id: "pedido", label: "Fazer pedido" },
  { id: "calculadora", label: "Calculadora" },
  { id: "pedidos", label: "Meus pedidos" },
  { id: "leilao", label: "Leilão" },
  { id: "pronta-entrega", label: "Pronta entrega" },
  { id: "conta", label: "Minha conta" },
  { id: "guia", label: "Guia de compra" },
];

const STATUS = {
  aguardando_sinal: { label: "Aguardando sinal", cls: "pill-yellow" },
  aguardando_pagamento: { label: "Aguardando Pix", cls: "pill-yellow" },
  aguardando_confirmacao: { label: "Aguardando conferência", cls: "pill-yellow" },
  sinal_pago: { label: "Sinal pago", cls: "pill-mist" },
  saldo_liberado: { label: "Saldo liberado", cls: "pill-coral" },
  pago: { label: "Pago", cls: "pill-sage" },
  enviado: { label: "Enviado", cls: "pill-sage" },
  entregue: { label: "Entregue", cls: "pill-olive" },
  cancelado: { label: "Cancelado", cls: "pill-gray" },
};

const svg = (paths, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>'),
  arrow: svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', 16),
  arrowDown: svg('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>', 16),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 16),
  check: svg('<path d="m5 12 4 4L19 6"/>', 14),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>', 16),
  lock: svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', 17),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', 17),
  eye: svg('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>', 17),
  box: svg('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>', 17),
  truck: svg('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>', 17),
  pix: svg('<path d="m12 3 4.5 4.5a2 2 0 0 1 0 2.8L12 15 7.5 10.3a2 2 0 0 1 0-2.8L12 3Z"/><path d="m12 21 4.5-4.5a2 2 0 0 0 0-2.8L12 9l-4.5 4.7a2 2 0 0 0 0 2.8L12 21Z"/>', 17),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 16),
  shield: svg('<path d="m12 3 7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/>', 17),
  pin: svg('<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>', 17),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', 16),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/>', 15),
  chevron: svg('<path d="m6 9 6 6 6-6"/>', 15),
  bag: svg('<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', 18),
  gavel: svg('<path d="m14 4 6 6-3 3-6-6 3-3ZM3 21l7-7M8 12l4 4M4 16l4 4"/>', 18),
  calc: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>', 18),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', 18),
  spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>', 16),
  alert: svg('<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.5v.5"/>', 16),
  trash: svg('<path d="M4 7h16M9 7V5h6v2M6 7l1 14h10l1-14"/>', 14),
  home: svg('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>', 17),
  card: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>', 17),
};

/* ---------------- helpers ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (v) =>
  String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (v, digits = 2) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const fmtCountdown = (ms, short = false) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (short) return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (d > 0) return `${d}d ${h}h`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const currentUser = () => db.me || null;
const saveDB = () => persistCart(currentUser());
const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function cartStorageKey(user) {
  return `rateio2you_cart_${user ? user.id : "anon"}`;
}

function persistCart(user) {
  if (!user) return;
  try {
    localStorage.setItem(cartStorageKey(user), JSON.stringify(db.carts[user.id] || []));
  } catch (e) {
    /* armazenamento cheio ou bloqueado */
  }
}

const mainAddress = (u) => {
  if (!u || !u.addresses || !u.addresses.length) return null;
  return u.addresses.find((a) => a.principal) || u.addresses[0];
};

const regionForUser = (u) => {
  const addr = mainAddress(u);
  if (!addr || !addr.state) return null;
  return R2Y.ESTADOS[addr.state] || null;
};

const shippingForUser = (u) => {
  const region = regionForUser(u);
  return region ? regionShipping(region) : 0;
};

const statusPill = (status) => {
  const s = STATUS[status] || { label: status, cls: "pill-gray" };
  return `<span class="pill ${s.cls}">${esc(s.label)}</span>`;
};

const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

function nextOrderId() {
  const year = new Date().getFullYear();
  let id;
  do {
    const stamp = Date.now().toString(36).slice(-4).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    id = `R2Y-${year}-${stamp}${rand}`;
  } while (db.orders.some((o) => o.id === id));
  return id;
}

function currentLot() {
  const open = db.lots.filter((l) => l.open && l.active !== false);
  return open.find((l) => l.id === ui.selectedLotId) || open[0] || null;
}

function productsForLot(lotId) {
  return db.products.filter((p) => p.lotId === lotId);
}

function cartForUser(u) {
  if (!u) return [];
  if (!db.carts[u.id]) {
    try {
      const raw = localStorage.getItem(cartStorageKey(u));
      db.carts[u.id] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(db.carts[u.id])) db.carts[u.id] = [];
    } catch (e) {
      db.carts[u.id] = [];
    }
  }
  return db.carts[u.id];
}

function cartCount(u) {
  return cartForUser(u).reduce((sum, i) => sum + i.qty, 0);
}

function cartTotal(u) {
  return cartForUser(u).reduce((sum, item) => {
    const s = db.stock.find((x) => x.id === item.stockId);
    return sum + (s ? s.price * item.qty : 0);
  }, 0);
}

function vialSVG(tone = "#5580d7", label = "") {
  const text = String(label || "").replace(/[<>&"]/g, "").slice(0, 7);
  return `<svg viewBox="0 0 60 84" role="img" aria-hidden="true">
    <rect x="24" y="2" width="12" height="8" rx="1" fill="#203461"/>
    <rect x="22" y="9" width="16" height="6" rx="1" fill="#2b5ab7"/>
    <rect x="14" y="16" width="32" height="64" rx="4" fill="#e4ebf4" stroke="#b0bdcf" stroke-width="1.2"/>
    <path d="M14 50h32v23a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V50Z" fill="${tone}" opacity=".55"/>
    <rect x="19" y="31" width="22" height="18" rx="1" fill="#f8fafc" opacity=".94"/>
    <text x="30" y="43.4" text-anchor="middle" font-family="Sora, Manrope, Arial, sans-serif" font-weight="600" font-size="5.6" letter-spacing=".2" fill="#243a6d">${esc(text)}</text>
    <line x1="23" y1="46.4" x2="37" y2="46.4" stroke="#5580d7" stroke-width=".5"/>
    <rect x="17" y="19" width="4" height="58" rx="2" fill="#ffffff" opacity=".5"/>
  </svg>`;
}

function productImageHTML(item, opts = {}) {
  const source = item && item.image;
  if (source) {
    return `<img src="${esc(source)}" alt="${esc((item && item.name) || opts.alt || "")}" loading="lazy">`;
  }
  const label = opts.label || (item && (item.specs || item.mg)) || "";
  return vialSVG(opts.tone || "#5580d7", label);
}

/* ---------------- toast / modal ---------------- */

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="t-ico">${type === "success" ? "✓" : "!"}</span><span>${esc(message)}</span>`;
  toastRoot.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .25s ease";
    setTimeout(() => el.remove(), 260);
  }, 3800);
}

function openModal({ title, subtitle = "", body = "", foot = "", wide = false, xwide = false }) {
  modalRoot.innerHTML = `
    <div class="overlay">
      <div class="modal ${xwide ? "xwide" : wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-head">
          <div>
            <h3>${esc(title)}</h3>
            ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
          </div>
          <button class="modal-close" type="button" data-close aria-label="Fechar">${ICONS.x}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
      </div>
    </div>`;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  stopPixPolling();
  modalRoot.innerHTML = "";
  document.body.style.overflow = "";
}

function confirmDialog({ title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", danger = false, onConfirm }) {
  openModal({
    title,
    body: `<p style="font-size:14.5px;line-height:1.65;color:var(--ink-soft)">${message}</p>`,
    foot: `<button class="btn btn-ghost" data-close type="button">${esc(cancelLabel)}</button>
           <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="confirm-action" type="button">${esc(confirmLabel)}</button>`,
  });
  $("#confirm-action").addEventListener("click", () => {
    closeModal();
    onConfirm();
  });
}

function copyText(text) {
  const done = () => toast("Código Pix copiado.", "success");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    done();
  } catch (e) {
    toast("Não foi possível copiar automaticamente. Selecione o código manualmente.", "error");
  }
  ta.remove();
}

/* ---------------- Pix ---------------- */

function stopPixPolling() {
  if (pixPollTimer) {
    clearInterval(pixPollTimer);
    pixPollTimer = null;
  }
  pixPoll = null;
}

function setPixStatus(text, kind = "info") {
  const el = document.getElementById("pix-status");
  if (!el) return;
  el.className = `pix-status ${kind}`;
  el.innerHTML = text;
}

async function refreshAfterPayment() {
  try {
    const snapshot = await Store.loadSnapshot();
    db = snapshot;
    if (currentUser()) cartForUser(currentUser());
    applyTheme();
  } catch (e) {
    console.warn(e);
  }
  if (booted) renderRoute();
}

function openPixModal({
  amount,
  txid,
  description,
  code,
  manual = false,
  orderId = "",
  kind = "total",
  expiresAt = "",
  confirmLabel = "Já fiz o Pix",
  onPaid,
}) {
  const qr = Pix.qrSvg(code, 184);
  const deadline = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 30 * 60 * 1000;

  openModal({
    title: manual ? "Pagamento via Pix (chave manual)" : "Pagamento via Pix · Banco Inter",
    subtitle: description || "Escaneie o QR Code ou use o código copia e cola.",
    body: `
      <div class="pix-total">
        <div class="k">Valor a pagar</div>
        <div class="v">${fmt(amount)}</div>
        <div class="timer">Cobrança expira em <strong data-deadline="${deadline}" data-mode="short">30:00</strong></div>
      </div>
      <div class="pix-qr">${qr || '<span style="font-size:12.5px;color:#888888">QR indisponível — use o código copia e cola</span>'}</div>
      <p class="pix-hint">Pix · ${esc(pixConfig().key || settings().pixMerchant || "Banco Inter")}</p>
      <div class="pix-code-label"><span>Código copia e cola</span><span>${esc(txid)}</span></div>
      <div class="pix-code" id="pix-code">${esc(code)}</div>
      <div class="pix-status ${manual ? "warn" : "info"}" id="pix-status">
        ${
          manual
            ? "A confirmação automática está desligada. Depois de pagar, clique em “Já fiz o Pix”. O organizador confere o recebimento no painel."
            : "Aguardando o banco confirmar o pagamento. Esta tela verifica sozinha a cada 5 segundos."
        }
      </div>`,
    foot: `<button class="btn btn-ghost" data-close type="button">Fechar</button>
           <button class="btn btn-primary" id="pix-copy" type="button">${ICONS.copy} Copiar código</button>
           <button class="btn btn-accent" id="pix-verify" type="button">${esc(confirmLabel)}</button>`,
  });

  $("#pix-copy").addEventListener("click", () => copyText(code));

  const verify = async (silent = false) => {
    if (manual) {
      const ok = onPaid ? await onPaid() : true;
      if (ok !== false) {
        stopPixPolling();
        closeModal();
        toast("Aviso de pagamento registrado. O organizador vai conferir o recebimento.", "success");
        await refreshAfterPayment();
      }
      return;
    }

    const btn = document.getElementById("pix-verify");
    if (btn && !silent) {
      btn.disabled = true;
      btn.textContent = "Verificando...";
    }
    try {
      const res = await Store.pixStatus(orderId, kind, txid);
      if (res.ok && res.paid) {
        stopPixPolling();
        closeModal();
        toast("Pagamento confirmado! Pedido atualizado.", "success");
        await refreshAfterPayment();
        return;
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Já paguei · verificar";
      }
      if (!silent) {
        setPixStatus(
          res.status === "ATIVA"
            ? "O banco ainda não recebeu este Pix. Se você acabou de pagar, aguarde alguns segundos e clique novamente."
            : "Ainda não identificamos o pagamento. Aguarde alguns segundos e tente outra vez.",
          "warn"
        );
      }
    } catch (e) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Já paguei · verificar";
      }
      if (!silent) setPixStatus(e.message || "Não foi possível consultar o pagamento agora.", "warn");
    }
  };

  $("#pix-verify").addEventListener("click", () => verify(false));

  if (!manual) {
    pixPoll = { orderId, kind, txid };
    pixPollTimer = setInterval(() => {
      if (!document.getElementById("pix-status")) {
        stopPixPolling();
        return;
      }
      verify(true);
    }, 5000);
  }

  startTicker();
}

/* ---------------- ticker ---------------- */

function startTicker() {
  if (tickTimer) clearInterval(tickTimer);
  const tick = () => {
    const now = Date.now();
    $$("[data-deadline]").forEach((el) => {
      const end = Number(el.dataset.deadline);
      if (!end) return;
      const diff = end - now;
      if (diff <= 0) {
        el.classList.add("expired");
        el.textContent = el.dataset.mode === "short" ? "00:00" : "Encerrado";
      } else {
        el.textContent = fmtCountdown(diff, el.dataset.mode === "short");
      }
    });
  };
  tick();
  tickTimer = setInterval(tick, 1000);
}

/* ---------------- layout ---------------- */

function routeId() {
  const raw = location.hash.replace(/^#\/?/, "").trim();
  return raw || "";
}

function go(path) {
  const target = `#/${path.replace(/^#\/?/, "")}`;
  if (location.hash === target) {
    window.renderRoute();
  } else {
    location.hash = target;
  }
}

function headerHTML() {
  const u = currentUser();
  const active = routeId();
  const s = settings();
  return `
    <div class="announce">
      <div class="container announce-inner">
        <span>${esc(s.announceLeft)}</span>
        <span class="announce-right">${esc(s.announceRight)} <span class="announce-dot"></span> <a href="#/guia">Como funciona</a></span>
      </div>
    </div>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="#/pedido">
          ${brandMarkHTML()}
          <span>
            <span class="brand-name">${brandNameHTML()}</span>
            <span class="brand-sub">${esc(s.brandSub)}</span>
          </span>
        </a>
        <div class="nav-wrap">
          <nav class="main-nav" aria-label="Navegação principal">
            ${NAV.map(
              (n) => `<a href="#/${n.id}" class="${active === n.id ? "active" : ""}">${esc(n.label)}</a>`
            ).join("")}
            ${u && u.role === "admin" ? `<a href="admin.html">Painel</a>` : ""}
          </nav>
        </div>
        <div class="user-pill">
          <span class="avatar" title="${esc(u ? u.name : "")}">${esc(initials(u ? u.name : ""))}</span>
          <button class="btn btn-ghost btn-sm" id="logout-btn" type="button">Sair</button>
        </div>
      </div>
    </header>`;
}

function footerHTML() {
  const s = settings();
  return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-inner">
          <div>
            <div class="footer-brand">
              ${brandMarkHTML()}
              <span class="brand-name">${brandNameHTML()}</span>
            </div>
            <p class="footer-tagline">${esc(s.footerTagline)}</p>
          </div>
          <div class="footer-links">
            <div class="footer-col">
              <div class="k">Participar</div>
              <a href="#/pedido">Fazer pedido</a>
              <a href="#/pedidos">Meus pedidos</a>
              <a href="#/guia">Guia de compra</a>
            </div>
            <div class="footer-col">
              <div class="k">Ferramentas</div>
              <a href="#/calculadora">Calculadora U-100</a>
              <a href="#/leilao">Leilão</a>
              <a href="#/pronta-entrega">Pronta entrega</a>
            </div>
            <div class="footer-col">
              <div class="k">Documentos</div>
              <a href="#/privacidade">Política de Privacidade</a>
              <a href="#/termos">Termos de Serviço</a>
              <a href="#/conta">Minha conta</a>
              <a href="admin.html">Painel do organizador</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>${esc(s.footerNote)}</span>
          <span class="demo-dot">${esc(s.footerDemo)}</span>
        </div>
      </div>
    </footer>`;
}

function shell(content) {
  return `${headerHTML()}<main class="page-main">${content}</main>${footerHTML()}`;
}

/* ---------------- tema / inicialização ---------------- */

function shade(hex, percent) {
  const raw = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return hex;
  const num = parseInt(raw, 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function applyTheme() {
  const s = settings();
  const primary = s.storePrimary || "#2b211b";
  const accent = s.storeAccent || "#a65b3c";
  const root = document.documentElement;
  root.style.setProperty("--olive", primary);
  root.style.setProperty("--olive-deep", shade(primary, -12));
  root.style.setProperty("--olive-dark", shade(primary, -22));
  root.style.setProperty("--yellow", accent);
  const title = s.pageTitle || `${s.siteName || "rateio2you"} — compras coletivas`;
  if (document.title.indexOf(" · ") === -1) document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta && s.metaDescription) meta.setAttribute("content", s.metaDescription);
}

function loadingHTML() {
  return `<div class="boot-screen">
    <div class="boot-mark">${esc((window.LOJA_CONFIG && window.LOJA_CONFIG.LOADING_LABEL) || "rateio2you")}</div>
    <div class="boot-spinner" aria-hidden="true"></div>
    <p>Conectando à loja...</p>
  </div>`;
}

function configErrorHTML(error) {
  const isSetup = error && (error.name === "SetupError" || /config\.js|tabelas|Supabase/i.test(error.message || ""));
  return `<div class="boot-error">
    <div class="boot-error-card">
      <span class="tag">${ICONS.alert} Configuração necessária</span>
      <h1>Falta conectar o banco de dados</h1>
      <p class="lead">${esc(error ? error.message : "Não foi possível carregar a loja.")}</p>
      <div class="callout" style="text-align:left">
        <span class="ico">1</span>
        <span>Abra o arquivo <code>assets/js/config.js</code> e cole a <strong>URL</strong> e a <code>anon key</code> do seu projeto Supabase.</span>
      </div>
      <div class="callout" style="text-align:left;margin-top:10px">
        <span class="ico">2</span>
        <span>No Supabase, abra o <strong>SQL Editor</strong> e execute os arquivos <code>supabase/01-schema.sql</code>, <code>02-storage.sql</code> e <code>03-seed.sql</code>.</span>
      </div>
      <div class="callout" style="text-align:left;margin-top:10px">
        <span class="ico">3</span>
        <span>Recarregue esta página. O guia completo está em <code>GUIA-PASSO-A-PASSO.md</code>.</span>
      </div>
      ${isSetup ? "" : `<pre class="boot-error-detail">${esc(error && error.stack ? error.stack : "")}</pre>`}
      <button class="btn btn-primary" type="button" onclick="location.reload()">Recarregar</button>
      <a class="btn btn-ghost" href="admin.html">Abrir painel admin</a>
    </div>
  </div>`;
}

function showConfigError(error) {
  console.error("[rateio2you] falha ao iniciar:", error);
  app.innerHTML = configErrorHTML(error);
  document.body.dataset.route = "setup";
}

async function loadEverything() {
  db = await Store.loadSnapshot();
  if (currentUser()) cartForUser(currentUser());
  applyTheme();
}

let reloadInFlight = false;
async function reloadFromCloud() {
  if (reloadInFlight || !booted) return;
  reloadInFlight = true;
  try {
    const snapshot = await Store.loadSnapshot();
    db = snapshot;
    if (currentUser()) cartForUser(currentUser());
    applyTheme();
    const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    const modalOpen = !!modalRoot.innerHTML;
    if (!typing && !modalOpen) renderRoute();
  } catch (e) {
    console.warn("[rateio2you] realtime:", e.message);
  } finally {
    reloadInFlight = false;
  }
}

function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(reloadFromCloud, 550);
}

async function boot() {
  if (!app) return;
  app.innerHTML = loadingHTML();
  try {
    Store.init();
    // Se o organizador ligou a aprovação automática, o banco libera o
    // próprio cadastro pendente antes de carregarmos a loja.
    await Store.autoApproveMe();
    await loadEverything();
    Store.subscribe(scheduleReload);
    booted = true;
    renderRoute();
  } catch (e) {
    showConfigError(e);
  }
}

/* ---------------- delegate: modal + logout ---------------- */

modalRoot.addEventListener("click", (e) => {
  if (e.target.classList.contains("overlay") || e.target.closest("[data-close]")) {
    closeModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalRoot && modalRoot.innerHTML) closeModal();
});
