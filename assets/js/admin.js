/* =========================================================
   rateio2you — painel administrativo (Supabase)
   ---------------------------------------------------------
   Página separada: admin.html
   Login com a mesma conta do Supabase Auth. Somente usuários
   com role = "admin" e status = "ativo" entram.
   ========================================================= */

(() => {
  const app = document.getElementById("admin-app");
  const modalRoot = document.getElementById("admin-modal");
  const toastRoot = document.getElementById("toasts");

  const state = {
    me: null,
    db: R2Y.empty(),
    loading: true,
    modalOpen: false,
    settingsDirty: false,
    orderFilter: "todos",
    orderSearch: "",
    customerSearch: "",
  };

  const STATUS = {
    aguardando_sinal: { label: "Aguardando sinal", cls: "warn" },
    aguardando_pagamento: { label: "Aguardando Pix", cls: "warn" },
    aguardando_confirmacao: { label: "Aguardando conferência", cls: "warn" },
    sinal_pago: { label: "Sinal pago", cls: "info" },
    saldo_liberado: { label: "Saldo liberado", cls: "info" },
    pago: { label: "Pago", cls: "ok" },
    enviado: { label: "Enviado", cls: "ok" },
    entregue: { label: "Entregue", cls: "ok" },
    cancelado: { label: "Cancelado", cls: "muted" },
  };

  const NAV = [
    { id: "visao", label: "Visão geral", icon: "◉" },
    { id: "pedidos", label: "Pedidos", icon: "▤" },
    { id: "produtos", label: "Produtos", icon: "▦" },
    { id: "lotes", label: "Lotes", icon: "▣" },
    { id: "estoque", label: "Pronta entrega", icon: "◫" },
    { id: "leiloes", label: "Leilões", icon: "⚑" },
    { id: "clientes", label: "Clientes", icon: "☺" },
    { id: "config", label: "Configurações", icon: "⚙" },
  ];

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

  const fmtDateTime = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const settings = () => state.db.settings || R2Y.defaultSettings();

  function toast(message, type = "success") {
    if (!toastRoot) return;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="t-ico">${type === "success" ? "✓" : "!"}</span><span>${esc(message)}</span>`;
    toastRoot.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity .25s ease";
      setTimeout(() => el.remove(), 260);
    }, 4200);
  }

  function openModal({ title, subtitle = "", body, footer = "", wide = true }) {
    modalRoot.innerHTML = `
      <div class="overlay">
        <div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-head">
            <div>
              <h3>${esc(title)}</h3>
              ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
            </div>
            <button class="modal-close" type="button" data-close aria-label="Fechar">×</button>
          </div>
          <div class="modal-body">${body}</div>
          ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
        </div>
      </div>`;
    document.body.style.overflow = "hidden";
    state.modalOpen = true;
  }

  function closeModal() {
    modalRoot.innerHTML = "";
    document.body.style.overflow = "";
    state.modalOpen = false;
  }

  function statusPill(status) {
    const s = STATUS[status] || { label: status || "—", cls: "muted" };
    return `<span class="admin-badge ${s.cls}">${esc(s.label)}</span>`;
  }

  function isPendingPayment(order) {
    return state.db.payments.some((p) => p.orderId === order.id && p.status === "pendente");
  }

  function paymentKindFor(order) {
    const pending = state.db.payments
      .filter((p) => p.orderId === order.id && p.status === "pendente")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (pending) return { kind: pending.kind, amount: pending.amount, payment: pending };
    if (order.status === "aguardando_sinal") return { kind: "sinal", amount: order.sinal, payment: null };
    if (order.status === "saldo_liberado") return { kind: "saldo", amount: order.balance, payment: null };
    return { kind: "total", amount: order.total, payment: null };
  }

  function toLocalInput(value) {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocalInput(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function applyTheme() {
    const s = settings();
    document.documentElement.style.setProperty("--olive", s.storePrimary || "#1d4ed8");
    document.documentElement.style.setProperty("--yellow", s.storeAccent || "#f7c948");
  }

  /* ---------------- boot / auth ---------------- */

  async function bootAdmin() {
    try {
      Store.init();
      await Store.autoApproveMe();
      const profile = await Store.me();
      if (profile && profile.role === "admin" && profile.status === "ativo") {
        state.me = profile;
        await load();
        startPanel();
        return;
      }
      if (profile) await Store.signOut();
      renderLogin(profile ? "Esta conta não tem permissão de administrador." : "");
    } catch (err) {
      renderSetupError(err);
    }
  }

  function renderSetupError(err) {
    const missing = err && (err.name === "SetupError" || /config\.js|tabelas|Supabase/i.test(err.message || ""));
    app.innerHTML = `
      <div class="admin-login">
        <div class="admin-login-card">
          <span class="admin-badge danger">Configuração necessária</span>
          <h1 style="margin-top:12px">O painel ainda não está conectado</h1>
          <p class="lead">${esc(err ? err.message : "Não foi possível abrir o painel.")}</p>
          <div class="admin-note">
            <strong>1.</strong> Preencha <code>assets/js/config.js</code> com a URL e a anon key do Supabase.<br>
            <strong>2.</strong> Rode os arquivos <code>supabase/01-schema.sql</code>, <code>02-storage.sql</code> e <code>03-seed.sql</code>.<br>
            <strong>3.</strong> Crie seu usuário no Supabase Auth e promova-o a administrador.
          </div>
          ${missing ? "" : `<pre style="margin-top:12px;font-size:11px;white-space:pre-wrap;color:#6b7a92">${esc(err && err.stack ? err.stack : "")}</pre>`}
          <button class="btn btn-primary btn-block" style="margin-top:14px" type="button" onclick="location.reload()">Recarregar</button>
          <a class="btn btn-ghost btn-block" style="margin-top:8px" href="index.html">Voltar para a loja</a>
        </div>
      </div>`;
  }

  function renderLogin(message = "") {
    const s = settings();
    app.innerHTML = `
      <div class="admin-login">
        <div class="admin-login-card">
          <a class="brand" href="index.html">
            <span class="brand-mark">${esc(s.brandMark || "2")}</span>
            <span>
              <span class="brand-name">${esc(s.siteName || "rateio2you")}</span>
              <span class="brand-sub">Painel do organizador</span>
            </span>
          </a>
          <h1>Entrar no painel</h1>
          <p class="lead">Use o e-mail e a senha da sua conta de administrador do Supabase.</p>
          ${message ? `<div class="form-error show" style="margin-bottom:12px">${esc(message)}</div>` : ""}
          <form id="admin-login-form" class="auth-form" novalidate>
            <div class="form-error" id="admin-login-error"></div>
            <label class="field">
              <span class="field-label">E-mail</span>
              <input class="input" id="admin-email" type="email" autocomplete="email" placeholder="voce@email.com" required>
            </label>
            <label class="field">
              <span class="field-label">Senha</span>
              <input class="input" id="admin-password" type="password" autocomplete="current-password" placeholder="Sua senha" required>
            </label>
            <button class="btn btn-primary btn-block btn-lg" id="admin-login-submit" type="submit" style="margin-top:6px">Entrar no painel</button>
          </form>
          <div class="admin-note" style="margin-top:16px">
            Primeiro acesso? Crie o usuário em <strong>Supabase → Authentication → Users</strong> e depois
            rode o comando SQL que promove o e-mail a administrador (veja o fim de <code>03-seed.sql</code>).
          </div>
          <a class="btn btn-ghost btn-block" style="margin-top:10px" href="index.html">Voltar para a loja</a>
        </div>
      </div>`;

    const form = $("#admin-login-form");
    const errorBox = $("#admin-login-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.classList.remove("show");
      const email = $("#admin-email").value.trim().toLowerCase();
      const password = $("#admin-password").value;
      if (!email || !password) {
        errorBox.textContent = "Informe e-mail e senha.";
        errorBox.classList.add("show");
        return;
      }
      const button = $("#admin-login-submit");
      button.disabled = true;
      button.textContent = "Entrando...";
      try {
        const profile = await Store.signIn(email, password);
        if (profile.role !== "admin") {
          await Store.signOut();
          throw new Error("Esta conta não tem permissão de administrador.");
        }
        state.me = profile;
        await load();
        startPanel();
        toast("Bem-vindo ao painel.");
      } catch (err) {
        errorBox.textContent = err.message || "Não foi possível entrar.";
        errorBox.classList.add("show");
        button.disabled = false;
        button.textContent = "Entrar no painel";
      }
    });
  }

  function startPanel() {
    applyTheme();
    document.title = "Painel do organizador · " + (settings().siteName || "rateio2you");
    Store.subscribe(scheduleReload);
    window.addEventListener("hashchange", renderView);
    if (!location.hash) location.hash = "#/visao";
    renderView();
  }

  async function load() {
    state.db = await Store.loadSnapshot({ admin: true });
    applyTheme();
  }

  let reloadTimer = null;
  function scheduleReload() {
    if (state.modalOpen || state.settingsDirty) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(async () => {
      if (state.modalOpen || state.settingsDirty) return;
      const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (typing) return;
      try {
        await load();
        renderView();
      } catch (err) {
        console.warn("[admin] realtime:", err.message);
      }
    }, 800);
  }

  async function refresh(render = true) {
    await load();
    if (render) renderView();
  }

  async function logout() {
    await Store.signOut();
    state.me = null;
    location.hash = "";
    renderLogin("");
    toast("Sessão encerrada.");
  }

  /* ---------------- shell / navegação ---------------- */

  function currentRoute() {
    const raw = location.hash.replace(/^#\/?/, "").trim();
    return NAV.some((n) => n.id === raw) ? raw : "visao";
  }

  function renderView() {
    if (!state.me) return;
    const route = currentRoute();
    const meta = NAV.find((n) => n.id === route) || NAV[0];

    app.innerHTML = `
      <div class="admin-shell">
        <aside class="admin-sidebar">
          <a class="brand" href="index.html">
            <span class="brand-mark">${esc(settings().brandMark || "2")}</span>
            <span>
              <span class="brand-name">${esc(settings().siteName || "rateio2you")}</span>
              <span class="brand-sub">Painel do organizador</span>
            </span>
          </a>
          <nav class="admin-nav" aria-label="Navegação do painel">
            ${NAV.map(
              (n) => `<a href="#/${n.id}" class="${n.id === route ? "active" : ""}">
                <span class="ico">${n.icon}</span>${esc(n.label)}
              </a>`
            ).join("")}
          </nav>
          <div class="admin-sidebar-foot">
            <a href="index.html" target="_blank" rel="noopener">Ver loja ↗</a>
            <button type="button" id="admin-logout">Sair da conta</button>
            <span>${esc(state.me.email)}</span>
          </div>
        </aside>

        <main class="admin-main">
          <header class="admin-topbar">
            <div>
              <h1>${esc(meta.label)}</h1>
              <div class="who">Atualizado em ${esc(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))} · alterações sincronizadas em tempo real</div>
            </div>
            <div class="admin-actions">
              <span class="admin-badge ok">● Online</span>
              <a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">Abrir loja</a>
            </div>
          </header>
          <section class="admin-content" id="admin-content">${viewFor(route)}</section>
        </main>
      </div>`;

    $("#admin-logout").addEventListener("click", logout);
    bindView(route);
  }

  function viewFor(route) {
    switch (route) {
      case "pedidos": return ordersView();
      case "produtos": return productsView();
      case "lotes": return lotsView();
      case "estoque": return stockView();
      case "leiloes": return auctionsView();
      case "clientes": return customersView();
      case "config": return settingsView();
      default: return dashboardView();
    }
  }

  function bindView(route) {
    switch (route) {
      case "pedidos": bindOrders(); break;
      case "produtos": bindProducts(); break;
      case "lotes": bindLots(); break;
      case "estoque": bindStock(); break;
      case "leiloes": bindAuctions(); break;
      case "clientes": bindCustomers(); break;
      case "config": bindSettings(); break;
    }
  }

  /* ---------------- visão geral ---------------- */

  function dashboardView() {
    const orders = state.db.orders;
    const clients = state.db.users.filter((u) => u.role !== "admin");
    const active = clients.filter((u) => u.status === "ativo").length;
    const pending = clients.filter((u) => u.status === "pendente").length;
    const paid = orders.filter((o) => o.status === "pago" || o.status === "entregue");
    const revenue = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const awaiting = orders.filter((o) =>
      ["aguardando_sinal", "aguardando_pagamento", "aguardando_confirmacao", "saldo_liberado"].includes(o.status)
    );
    const lowStock = state.db.stock.filter((s) => s.qty <= 2);

    return `
      <div class="admin-stats">
        <div class="admin-stat">
          <div class="k">Pedidos</div>
          <div class="v">${orders.length}</div>
          <div class="hint">${awaiting.length} aguardando alguma ação</div>
        </div>
        <div class="admin-stat">
          <div class="k">Receita paga</div>
          <div class="v" style="font-size:22px">${fmt(revenue)}</div>
          <div class="hint">${paid.length} pedidos quitados</div>
        </div>
        <div class="admin-stat">
          <div class="k">Clientes ativos</div>
          <div class="v">${active}</div>
          <div class="hint">${pending} cadastro(s) pendente(s)</div>
        </div>
        <div class="admin-stat">
          <div class="k">Produtos no catálogo</div>
          <div class="v">${state.db.products.length}</div>
          <div class="hint">${state.db.stock.length} item(ns) de pronta entrega</div>
        </div>
      </div>

      <div class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>Últimos pedidos</h2>
            <p>Os dados abaixo vêm do Supabase e atualizam sozinhos.</p>
          </div>
          <a class="btn btn-primary btn-sm" href="#/pedidos">Ver todos os pedidos</a>
        </div>
        ${ordersTable(orders.slice(0, 6), true)}
      </div>

      <div class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>Precisa de atenção</h2>
            <p>Cadastros pendentes e estoque acabando.</p>
          </div>
        </div>
        <div class="admin-panel-body" style="display:grid;gap:10px">
          ${
            pending
              ? `<div class="admin-note"><strong>${pending} cadastro(s) pendente(s).</strong> Abra <a href="#/clientes">Clientes</a> e aprove ou bloqueie.</div>`
              : `<div class="admin-note">Nenhum cadastro pendente.</div>`
          }
          ${
            lowStock.length
              ? `<div class="admin-note"><strong>Estoque baixo:</strong> ${lowStock.map((s) => `${esc(s.name)} (${s.qty})`).join(", ")}</div>`
              : `<div class="admin-note">Estoque de pronta entrega em nível saudável.</div>`
          }
        </div>
      </div>`;
  }

  /* ---------------- pedidos ---------------- */

  function filteredOrders() {
    const search = state.orderSearch.trim().toLowerCase();
    return state.db.orders.filter((o) => {
      if (state.orderFilter !== "todos" && o.status !== state.orderFilter) return false;
      if (!search) return true;
      const user = state.db.users.find((u) => u.id === o.userId);
      const hay = `${o.id} ${o.lotTitle} ${user ? user.name + " " + user.email : ""}`.toLowerCase();
      return hay.includes(search);
    });
  }

  function ordersView() {
    const orders = filteredOrders();
    return `
      <div class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>Pedidos em tempo real</h2>
            <p>Clique em “Detalhes” para ver itens, endereço, pagamentos e histórico.</p>
          </div>
          <div class="admin-filters">
            <input class="input" id="order-search" type="search" placeholder="Buscar por cliente ou pedido" value="${esc(state.orderSearch)}">
            <select class="input" id="order-filter">
              <option value="todos">Todos os status</option>
              ${Object.entries(STATUS).map(
                ([key, s]) => `<option value="${key}" ${state.orderFilter === key ? "selected" : ""}>${esc(s.label)}</option>`
              ).join("")}
            </select>
          </div>
        </div>
        ${ordersTable(orders, false)}
      </div>`;
  }

  function ordersTable(orders, compact) {
    return `<div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Status</th>
            ${compact ? "" : "<th>Data</th><th>Ações</th>"}
          </tr>
        </thead>
        <tbody>
          ${
            orders.length
              ? orders
                  .map((o) => {
                    const user = state.db.users.find((u) => u.id === o.userId) || {};
                    return `<tr>
                      <td>
                        <strong>${esc(o.id)}</strong><br>
                        <span style="font-size:12px;color:#6b7a92">${esc(o.lotTitle || "Pronta entrega")}</span>
                      </td>
                      <td>
                        ${esc(user.name || "Cliente")}<br>
                        <span style="font-size:12px;color:#6b7a92">${esc(user.email || "—")}</span>
                      </td>
                      <td><strong>${fmt(o.total)}</strong></td>
                      <td>${statusPill(o.status)}</td>
                      ${compact ? "" : `<td style="white-space:nowrap">${fmtDateTime(o.createdAt)}</td>`}
                      ${
                        compact
                          ? ""
                          : `<td>
                              <div class="admin-actions">
                                <button class="btn btn-ghost btn-sm" type="button" data-order-view="${esc(o.id)}">Detalhes</button>
                                ${
                                  (isPendingPayment(o) || o.status === "aguardando_confirmacao") &&
                                  !["pago", "entregue", "cancelado"].includes(o.status)
                                    ? `<button class="btn btn-primary btn-sm" type="button" data-order-confirm="${esc(o.id)}">Confirmar Pix</button>`
                                    : ""
                                }
                                ${
                                  o.status === "sinal_pago"
                                    ? `<button class="btn btn-soft btn-sm" type="button" data-order-release="${esc(o.id)}">Liberar saldo</button>`
                                    : ""
                                }
                              </div>
                            </td>`
                      }
                    </tr>`;
                  })
                  .join("")
              : `<tr class="empty-row"><td colspan="${compact ? 4 : 6}">Nenhum pedido encontrado.</td></tr>`
          }
        </tbody>
      </table>
    </div>`;
  }

  function bindOrders() {
    const search = $("#order-search");
    if (search) {
      search.addEventListener("input", () => {
        state.orderSearch = search.value;
        const list = filteredOrders();
        const panel = search.closest(".admin-panel");
        panel.querySelector(".admin-table-wrap").outerHTML = ordersTable(list, false);
        bindOrderButtons();
      });
      search.addEventListener("change", () => {
        state.orderSearch = search.value;
        renderOrdersBody();
      });
    }
    const filter = $("#order-filter");
    if (filter) {
      filter.addEventListener("change", () => {
        state.orderFilter = filter.value;
        renderOrdersBody();
      });
    }
    bindOrderButtons();
  }

  function renderOrdersBody() {
    const panel = $(".admin-panel");
    if (!panel) return;
    const wrap = panel.querySelector(".admin-table-wrap");
    const search = $("#order-search");
    const filterEl = $("#order-filter");
    if (search) state.orderSearch = search.value;
    if (filterEl) state.orderFilter = filterEl.value;
    if (wrap) wrap.outerHTML = ordersTable(filteredOrders(), false);
    bindOrderButtons();
  }

  function bindOrderButtons() {
    $$("[data-order-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const order = state.db.orders.find((o) => o.id === btn.dataset.orderView);
        if (order) orderDetailModal(order);
      });
    });
    $$("[data-order-confirm]").forEach((btn) => {
      btn.addEventListener("click", () => confirmOrderPayment(btn.dataset.orderConfirm));
    });
    $$("[data-order-release]").forEach((btn) => {
      btn.addEventListener("click", () => releaseBalance(btn.dataset.orderRelease));
    });
  }

  function orderDetailModal(order) {
    const user = state.db.users.find((u) => u.id === order.userId) || {};
    const addr = (user.addresses || []).find((a) => a.principal) || (user.addresses || [])[0];
    const payments = state.db.payments.filter((p) => p.orderId === order.id);
    const items = order.items || [];
    const pendingKind = paymentKindFor(order);

    const body = `
      <div class="admin-detail-grid" style="margin-bottom:14px">
        <div class="admin-detail"><div class="k">Pedido</div><div class="v"><strong>${esc(order.id)}</strong><br>${esc(order.lotTitle || "Pronta entrega")}</div></div>
        <div class="admin-detail"><div class="k">Status</div><div class="v">${statusPill(order.status)}<br><span style="font-size:12px;color:#6b7a92">Criado em ${fmtDateTime(order.createdAt)}</span></div></div>
        <div class="admin-detail"><div class="k">Cliente</div><div class="v">${esc(user.name || "—")}<br><span style="font-size:12px;color:#6b7a92">${esc(user.email || "—")} · ${esc(user.whatsapp || "sem WhatsApp")}</span></div></div>
        <div class="admin-detail"><div class="k">Endereço de entrega</div><div class="v">${esc(order.address || (addr ? `${addr.street}, ${addr.number} — ${addr.district}, ${addr.city}/${addr.state}` : "—"))}</div></div>
        <div class="admin-detail"><div class="k">Valores</div><div class="v">Total ${fmt(order.total)} · Sinal ${fmt(order.sinal)} · Saldo ${fmt(order.balance)}</div></div>
        <div class="admin-detail"><div class="k">Pagamento</div><div class="v">${esc(pendingKind.kind)} · ${fmt(pendingKind.amount)} ${pendingKind.payment ? `(${esc(pendingKind.payment.provider)})` : "(sem cobrança registrada)"}</div></div>
      </div>

      <div class="admin-section-title">Itens comprados</div>
      <div class="admin-order-items" style="margin-bottom:14px">
        ${items
          .map(
            (i) => `<div class="admin-order-item">
              <span>${esc(i.name)} ${esc(i.specs || "")} · <strong>${i.qty} × ${fmt(i.price)}</strong></span>
              <strong>${fmt(Number(i.price) * Number(i.qty))}</strong>
            </div>`
          )
          .join("") || `<div class="admin-order-item">Nenhum item registrado.</div>`}
      </div>

      <div class="admin-detail-grid" style="margin-bottom:14px">
        <div class="admin-detail">
          <div class="k">Dados do cliente</div>
          <div class="v">${esc(user.name || "—")}<br>${esc(user.email || "—")}<br>CPF: ${esc(user.cpf || "—")}<br>WhatsApp: ${esc(user.whatsapp || "—")}<br>Tel. 2: ${esc(user.phone2 || "—")}</div>
        </div>
        <div class="admin-detail">
          <div class="k">Pagamentos registrados</div>
          <div class="v">
            ${
              payments.length
                ? payments
                    .map(
                      (p) => `<div style="margin-bottom:4px">${esc(p.kind)} · ${fmt(p.amount)} · <strong>${esc(p.status)}</strong><br><span style="font-size:11px;color:#6b7a92">${esc(p.txid)}</span></div>`
                    )
                    .join("")
                : "Nenhuma cobrança registrada."
            }
          </div>
        </div>
      </div>

      <div class="admin-section-title">Histórico</div>
      <div class="admin-note" style="margin-bottom:14px;max-height:180px;overflow:auto">
        ${(order.events || [])
          .slice()
          .reverse()
          .map((ev) => `<div style="margin-bottom:6px"><strong>${fmtDateTime(ev.at)}</strong> — ${esc(ev.text)}</div>`)
          .join("") || "Sem histórico."}
      </div>

      <div class="admin-form-grid">
        <label class="field">
          <span class="field-label">Alterar status</span>
          <select class="input" id="detail-status">
            ${Object.entries(STATUS).map(
              ([key, s]) => `<option value="${key}" ${order.status === key ? "selected" : ""}>${esc(s.label)}</option>`
            ).join("")}
          </select>
        </label>
        <label class="field">
          <span class="field-label">Código de rastreio</span>
          <input class="input" id="detail-tracking" value="${esc(order.tracking || "")}" placeholder="Ex.: BR123456789">
        </label>
      </div>`;

    const footer = `
      <button class="btn btn-ghost" data-close type="button">Fechar</button>
      <button class="btn btn-ghost" type="button" id="detail-save">Salvar status/rastreio</button>
      ${
        order.status === "sinal_pago"
          ? `<button class="btn btn-soft" type="button" id="detail-release">Liberar saldo</button>`
          : ""
      }
      ${
        pendingKind.amount > 0 && !["pago", "entregue", "cancelado"].includes(order.status)
          ? `<button class="btn btn-primary" type="button" id="detail-confirm">Confirmar ${esc(pendingKind.kind)} ${fmt(pendingKind.amount)}</button>`
          : ""
      }
      <button class="btn btn-danger" type="button" id="detail-delete">Excluir pedido</button>`;

    openModal({
      title: `Pedido ${order.id}`,
      subtitle: order.lotTitle || "Pronta entrega",
      body,
      footer,
      wide: true,
    });

    $("#detail-save").addEventListener("click", async () => {
      const status = $("#detail-status").value;
      const tracking = $("#detail-tracking").value.trim();
      const events = [...(order.events || [])];
      events.push({ at: new Date().toISOString(), text: `Painel: status alterado para ${STATUS[status]?.label || status}.` });
      if (tracking && tracking !== order.tracking) {
        events.push({ at: new Date().toISOString(), text: `Código de rastreio atualizado: ${tracking}.` });
      }
      try {
        await Store.updateOrder(order.id, { status, tracking, events });
        closeModal();
        await refresh();
        toast("Pedido atualizado.");
      } catch (err) {
        toast(err.message || "Não foi possível salvar o pedido.", "error");
      }
    });

    const release = $("#detail-release");
    if (release) {
      release.addEventListener("click", async () => {
        closeModal();
        await releaseBalance(order.id);
      });
    }

    const confirm = $("#detail-confirm");
    if (confirm) {
      confirm.addEventListener("click", async () => {
        closeModal();
        await confirmOrderPayment(order.id);
      });
    }

    $("#detail-delete").addEventListener("click", async () => {
      if (!window.confirm(`Excluir definitivamente o pedido ${order.id}? Esta ação não pode ser desfeita.`)) return;
      try {
        await Store.deleteOrder(order.id);
        closeModal();
        await refresh();
        toast("Pedido excluído.");
      } catch (err) {
        toast(err.message || "Não foi possível excluir o pedido.", "error");
      }
    });
  }

  async function confirmOrderPayment(orderId) {
    const order = state.db.orders.find((o) => o.id === orderId);
    if (!order) return;
    const info = paymentKindFor(order);
    if (!info.amount || info.amount <= 0) {
      toast("Este pedido não tem valor pendente.", "error");
      return;
    }
    if (!window.confirm(`Confirmar o recebimento de ${fmt(info.amount)} (${info.kind}) do pedido ${order.id}?`)) return;
    try {
      await Store.adminConfirmPayment(order.id, info.kind, info.amount);
      await refresh();
      toast("Pagamento confirmado e pedido atualizado.");
    } catch (err) {
      toast(err.message || "Não foi possível confirmar o pagamento.", "error");
    }
  }

  async function releaseBalance(orderId) {
    const order = state.db.orders.find((o) => o.id === orderId);
    if (!order) return;
    if (!window.confirm(`Liberar o saldo de ${fmt(Math.max(0, order.total - order.sinal))} para o cliente pagar?`)) return;
    try {
      await Store.adminReleaseBalance(order.id);
      await refresh();
      toast("Saldo liberado. O cliente já pode pagar no site.");
    } catch (err) {
      toast(err.message || "Não foi possível liberar o saldo.", "error");
    }
  }

  /* ---------------- produtos ---------------- */

  function productsView() {
    return `
      <div class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>Produtos do catálogo</h2>
            <p>Alterações aparecem na loja na hora, sem recarregar a página do cliente.</p>
          </div>
          <button class="btn btn-primary btn-sm" type="button" id="new-product">+ Novo produto</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>Produto</th><th>Lote</th><th>Preço</th><th>Caixa</th><th>Estoque</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              ${
                state.db.products.length
                  ? state.db.products
                      .map((p) => {
                        const lot = state.db.lots.find((l) => l.id === p.lotId);
                        return `<tr>
                          <td>
                            <div class="admin-cell-main">
                              <div class="admin-thumb">${p.image ? `<img src="${esc(p.image)}" alt="">` : "▦"}</div>
                              <div><strong>${esc(p.name)}</strong><span>${esc(p.specs || p.sku || "")}</span></div>
                            </div>
                          </td>
                          <td>${esc(lot ? lot.title : "—")}</td>
                          <td><strong>${fmt(p.price)}</strong></td>
                          <td>${p.boxFilled}/${settings().boxSize || 10}</td>
                          <td>${p.stockQty || 0}</td>
                          <td>${p.active ? '<span class="admin-badge ok">Ativo</span>' : '<span class="admin-badge muted">Oculto</span>'}</td>
                          <td>
                            <div class="admin-actions">
                              <button class="btn btn-ghost btn-sm" type="button" data-product-edit="${esc(p.id)}">Editar</button>
                              <button class="btn btn-ghost btn-sm" type="button" data-product-del="${esc(p.id)}">Excluir</button>
                            </div>
                          </td>
                        </tr>`;
                      })
                      .join("")
                  : `<tr class="empty-row"><td colspan="7">Nenhum produto cadastrado.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function bindProducts() {
    $("#new-product").addEventListener("click", () => productModal(null));
    $$("[data-product-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const product = state.db.products.find((p) => p.id === btn.dataset.productEdit);
        if (product) productModal(product);
      });
    });
    $$("[data-product-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const product = state.db.products.find((p) => p.id === btn.dataset.productDel);
        if (!product) return;
        if (!window.confirm(`Excluir o produto "${product.name}"?`)) return;
        try {
          await Store.deleteProduct(product.id);
          await refresh();
          toast("Produto excluído.");
        } catch (err) {
          toast(err.message || "Não foi possível excluir o produto.", "error");
        }
      });
    });
  }

  function productModal(product) {
    const p = product || { active: true, boxFilled: 0, closedBoxes: 0, stockQty: 0, maxPerOrder: 10 };
    const body = `
      <form id="product-form" novalidate>
        <div class="admin-form-grid">
          <label class="field span-2">
            <span class="field-label">Nome do produto *</span>
            <input class="input" id="p-name" value="${esc(p.name || "")}" required>
          </label>
          <label class="field">
            <span class="field-label">Lote</span>
            <select class="input" id="p-lot">
              <option value="">Sem lote</option>
              ${state.db.lots.map(
                (l) => `<option value="${esc(l.id)}" ${p.lotId === l.id ? "selected" : ""}>${esc(l.title)}</option>`
              ).join("")}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Marca</span>
            <input class="input" id="p-brand" value="${esc(p.brand || "")}">
          </label>
          <label class="field">
            <span class="field-label">Modelo / especificações</span>
            <input class="input" id="p-specs" value="${esc(p.specs || "")}" placeholder="Ex.: 45 mm · GPS">
          </label>
          <label class="field">
            <span class="field-label">SKU / código</span>
            <input class="input" id="p-sku" value="${esc(p.sku || "")}">
          </label>
          <label class="field">
            <span class="field-label">Preço (R$) *</span>
            <input class="input" id="p-price" type="number" min="0" step="0.01" value="${Number(p.price) || 0}" required>
          </label>
          <label class="field">
            <span class="field-label">Estoque</span>
            <input class="input" id="p-stock" type="number" min="0" step="1" value="${Number(p.stockQty) || 0}">
          </label>
          <label class="field">
            <span class="field-label">Unidades já no box</span>
            <input class="input" id="p-box" type="number" min="0" step="1" value="${Number(p.boxFilled) || 0}">
          </label>
          <label class="field">
            <span class="field-label">Caixas fechadas</span>
            <input class="input" id="p-closed" type="number" min="0" step="1" value="${Number(p.closedBoxes) || 0}">
          </label>
          <label class="field">
            <span class="field-label">Máximo por pedido</span>
            <input class="input" id="p-max" type="number" min="0" step="1" value="${Number(p.maxPerOrder) || 0}">
          </label>
          <label class="field">
            <span class="field-label">Selo / destaque</span>
            <input class="input" id="p-tag" value="${esc(p.tag || "")}" placeholder="Ex.: Mais vendido">
          </label>
          <label class="field span-2">
            <span class="field-label">Descrição</span>
            <textarea class="input" id="p-description" rows="3">${esc(p.description || "")}</textarea>
          </label>
          <div class="field span-2">
            <span class="field-label">Imagem do produto</span>
            <div class="admin-image-preview">
              <img id="p-image-preview" src="${esc(p.image || "")}" alt="" style="${p.image ? "" : "display:none"}">
              <div class="meta" style="flex:1">
                <input class="input" id="p-image" value="${esc(p.image || "")}" placeholder="Cole uma URL ou envie um arquivo">
                <input type="file" id="p-file" accept="image/*" style="margin-top:8px;font-size:12px">
                <div id="p-upload-status" style="font-size:11.5px;color:#6b7a92;margin-top:4px">JPG, PNG, WEBP ou SVG · até 8 MB</div>
              </div>
            </div>
          </div>
          <label class="field">
            <span class="field-label">Ordem de exibição</span>
            <input class="input" id="p-sort" type="number" step="1" value="${Number(p.sortOrder) || 0}">
          </label>
          <label class="admin-toggle" style="align-self:end;padding-bottom:10px">
            <input type="checkbox" id="p-active" ${p.active !== false ? "checked" : ""}> Visível na loja
          </label>
        </div>
      </form>`;

    const footer = `
      <button class="btn btn-ghost" data-close type="button">Cancelar</button>
      <button class="btn btn-primary" type="button" id="p-save">${product ? "Salvar alterações" : "Criar produto"}</button>`;

    openModal({ title: product ? "Editar produto" : "Novo produto", body, footer });

    $("#p-image").addEventListener("input", () => {
      const img = $("#p-image-preview");
      const val = $("#p-image").value.trim();
      if (val) {
        img.src = val;
        img.style.display = "";
      } else {
        img.style.display = "none";
      }
    });

    $("#p-file").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const status = $("#p-upload-status");
      status.textContent = "Enviando imagem...";
      try {
        const url = await Store.uploadImage(file, "produtos");
        $("#p-image").value = url;
        $("#p-image-preview").src = url;
        $("#p-image-preview").style.display = "";
        status.textContent = "Imagem enviada com sucesso.";
      } catch (err) {
        status.textContent = err.message || "Falha no envio.";
        toast(err.message || "Não foi possível enviar a imagem.", "error");
      }
    });

    $("#p-save").addEventListener("click", async () => {
      const name = $("#p-name").value.trim();
      if (!name) return toast("Informe o nome do produto.", "error");
      const payload = {
        id: product ? product.id : "",
        name,
        lotId: $("#p-lot").value,
        brand: $("#p-brand").value.trim(),
        specs: $("#p-specs").value.trim(),
        sku: $("#p-sku").value.trim(),
        price: Number($("#p-price").value) || 0,
        stockQty: Number($("#p-stock").value) || 0,
        boxFilled: Number($("#p-box").value) || 0,
        closedBoxes: Number($("#p-closed").value) || 0,
        maxPerOrder: Number($("#p-max").value) || 0,
        tag: $("#p-tag").value.trim(),
        description: $("#p-description").value.trim(),
        image: $("#p-image").value.trim(),
        sortOrder: Number($("#p-sort").value) || 0,
        active: $("#p-active").checked,
      };
      const button = $("#p-save");
      button.disabled = true;
      button.textContent = "Salvando...";
      try {
        await Store.saveProduct(payload);
        closeModal();
        await refresh();
        toast("Produto salvo.");
      } catch (err) {
        button.disabled = false;
        button.textContent = product ? "Salvar alterações" : "Criar produto";
        toast(err.message || "Não foi possível salvar o produto.", "error");
      }
    });
  }

  /* ---------------- lotes ---------------- */

  function lotsView() {
    return `
      <div class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>Lotes de compra coletiva</h2>
            <p>Um lote aberto aparece na página “Fazer pedido” com o catálogo vinculado.</p>
          </div>
          <button class="btn btn-primary btn-sm" type="button" id="new-lot">+ Novo lote</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Lote</th><th>Fecha em</th><th>Produtos</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              ${
                state.db.lots.length
                  ? state.db.lots
                      .map((l) => {
                        const count = state.db.products.filter((p) => p.lotId === l.id).length;
                        return `<tr>
                          <td><div class="admin-cell-main"><div class="admin-thumb">${l.image ? `<img src="${esc(l.image)}" alt="">` : "▣"}</div><div><strong>${esc(l.title)}</strong><span>${esc(l.brand)} · ${esc(l.tag || "")}</span></div></div></td>
                          <td>${fmtDateTime(l.closesAt)}</td>
                          <td>${count}</td>
                          <td>${l.open ? '<span class="admin-badge ok">Aberto</span>' : '<span class="admin-badge muted">Fechado</span>'} ${l.active === false ? '<span class="admin-badge danger">Oculto</span>' : ""}</td>
                          <td><div class="admin-actions">
                            <button class="btn btn-ghost btn-sm" type="button" data-lot-edit="${esc(l.id)}">Editar</button>
                            <button class="btn btn-ghost btn-sm" type="button" data-lot-del="${esc(l.id)}">Excluir</button>
                          </div></td>
                        </tr>`;
                      })
                      .join("")
                  : `<tr class="empty-row"><td colspan="5">Nenhum lote cadastrado.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function bindLots() {
    $("#new-lot").addEventListener("click", () => lotModal(null));
    $$("[data-lot-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lot = state.db.lots.find((l) => l.id === btn.dataset.lotEdit);
        if (lot) lotModal(lot);
      });
    });
    $$("[data-lot-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const lot = state.db.lots.find((l) => l.id === btn.dataset.lotDel);
        if (!lot) return;
        if (!window.confirm(`Excluir o lote "${lot.title}" e todos os produtos dele?`)) return;
        try {
          await Store.deleteLot(lot.id);
          await refresh();
          toast("Lote excluído.");
        } catch (err) {
          toast(err.message || "Não foi possível excluir o lote.", "error");
        }
      });
    });
  }

  function lotModal(lot) {
    const l = lot || { open: true, active: true, accent: "#5580d7", monogram: "R2Y" };
    const body = `
      <form id="lot-form" novalidate>
        <div class="admin-form-grid">
          <label class="field span-2">
            <span class="field-label">Título do lote *</span>
            <input class="input" id="l-title" value="${esc(l.title || "")}" required>
          </label>
          <label class="field">
            <span class="field-label">Marca</span>
            <input class="input" id="l-brand" value="${esc(l.brand || "")}">
          </label>
          <label class="field">
            <span class="field-label">Monograma</span>
            <input class="input" id="l-monogram" maxlength="6" value="${esc(l.monogram || "R2Y")}">
          </label>
          <label class="field">
            <span class="field-label">Selo</span>
            <input class="input" id="l-tag" value="${esc(l.tag || "")}" placeholder="Ex.: Estoque EUA">
          </label>
          <label class="field">
            <span class="field-label">Cor do lote</span>
            <input class="input" id="l-accent" type="color" value="${esc(l.accent || "#5580d7")}" style="height:44px;padding:4px">
          </label>
          <label class="field span-2">
            <span class="field-label">Descrição</span>
            <textarea class="input" id="l-description" rows="2">${esc(l.description || "")}</textarea>
          </label>
          <label class="field span-2">
            <span class="field-label">Observação</span>
            <input class="input" id="l-note" value="${esc(l.note || "")}">
          </label>
          <label class="field">
            <span class="field-label">Fecha em</span>
            <input class="input" id="l-closes" type="datetime-local" value="${toLocalInput(l.closesAt)}">
          </label>
          <label class="field">
            <span class="field-label">Ordem</span>
            <input class="input" id="l-sort" type="number" step="1" value="${Number(l.sortOrder) || 0}">
          </label>
          <div class="field span-2">
            <span class="field-label">Imagem do lote</span>
            <div class="admin-image-preview">
              <img id="l-image-preview" src="${esc(l.image || "")}" alt="" style="${l.image ? "" : "display:none"}">
              <div class="meta" style="flex:1">
                <input class="input" id="l-image" value="${esc(l.image || "")}" placeholder="URL ou envie um arquivo">
                <input type="file" id="l-file" accept="image/*" style="margin-top:8px;font-size:12px">
              </div>
            </div>
          </div>
          <label class="admin-toggle"><input type="checkbox" id="l-open" ${l.open !== false ? "checked" : ""}> Lote aberto para pedidos</label>
          <label class="admin-toggle"><input type="checkbox" id="l-active" ${l.active !== false ? "checked" : ""}> Visível na loja</label>
        </div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-close type="button">Cancelar</button>
      <button class="btn btn-primary" type="button" id="l-save">${lot ? "Salvar alterações" : "Criar lote"}</button>`;
    openModal({ title: lot ? "Editar lote" : "Novo lote", body, footer });

    $("#l-image").addEventListener("input", () => {
      const img = $("#l-image-preview");
      const val = $("#l-image").value.trim();
      if (val) { img.src = val; img.style.display = ""; } else img.style.display = "none";
    });
    $("#l-file").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const url = await Store.uploadImage(file, "lotes");
        $("#l-image").value = url;
        $("#l-image-preview").src = url;
        $("#l-image-preview").style.display = "";
        toast("Imagem enviada.");
      } catch (err) {
        toast(err.message || "Não foi possível enviar a imagem.", "error");
      }
    });
    $("#l-save").addEventListener("click", async () => {
      const title = $("#l-title").value.trim();
      if (!title) return toast("Informe o título do lote.", "error");
      const payload = {
        id: lot ? lot.id : "",
        title,
        brand: $("#l-brand").value.trim(),
        monogram: $("#l-monogram").value.trim() || "R2Y",
        tag: $("#l-tag").value.trim(),
        accent: $("#l-accent").value,
        description: $("#l-description").value.trim(),
        note: $("#l-note").value.trim(),
        closesAt: fromLocalInput($("#l-closes").value),
        sortOrder: Number($("#l-sort").value) || 0,
        image: $("#l-image").value.trim(),
        open: $("#l-open").checked,
        active: $("#l-active").checked,
      };
      const button = $("#l-save");
      button.disabled = true;
      button.textContent = "Salvando...";
      try {
        await Store.saveLot(payload);
        closeModal();
        await refresh();
        toast("Lote salvo.");
      } catch (err) {
        button.disabled = false;
        button.textContent = lot ? "Salvar alterações" : "Criar lote";
        toast(err.message || "Não foi possível salvar o lote.", "error");
      }
    });
  }

  /* ---------------- pronta entrega ---------------- */

  function stockView() {
    return `
      <div class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>Pronta entrega</h2>
            <p>Itens com estoque maior que zero aparecem automaticamente na loja.</p>
          </div>
          <button class="btn btn-primary btn-sm" type="button" id="new-stock">+ Novo item</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Item</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              ${
                state.db.stock.length
                  ? state.db.stock
                      .map(
                        (s) => `<tr>
                          <td><div class="admin-cell-main"><div class="admin-thumb">${s.image ? `<img src="${esc(s.image)}" alt="">` : "◫"}</div><div><strong>${esc(s.name)}</strong><span>${esc(s.brand || s.lot || "")} · ${esc(s.specs || "")}</span></div></div></td>
                          <td><strong>${fmt(s.price)}</strong></td>
                          <td>${s.qty} ${s.qty <= 2 ? '<span class="admin-badge warn">baixo</span>' : ""}</td>
                          <td>${s.active ? '<span class="admin-badge ok">Ativo</span>' : '<span class="admin-badge muted">Oculto</span>'}</td>
                          <td><div class="admin-actions">
                            <button class="btn btn-ghost btn-sm" type="button" data-stock-edit="${esc(s.id)}">Editar</button>
                            <button class="btn btn-ghost btn-sm" type="button" data-stock-del="${esc(s.id)}">Excluir</button>
                          </div></td>
                        </tr>`
                      )
                      .join("")
                  : `<tr class="empty-row"><td colspan="5">Nenhum item cadastrado.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function bindStock() {
    $("#new-stock").addEventListener("click", () => stockModal(null));
    $$("[data-stock-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = state.db.stock.find((s) => s.id === btn.dataset.stockEdit);
        if (item) stockModal(item);
      });
    });
    $$("[data-stock-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = state.db.stock.find((s) => s.id === btn.dataset.stockDel);
        if (!item) return;
        if (!window.confirm(`Excluir "${item.name}" da pronta entrega?`)) return;
        try {
          await Store.deleteStockItem(item.id);
          await refresh();
          toast("Item excluído.");
        } catch (err) {
          toast(err.message || "Não foi possível excluir o item.", "error");
        }
      });
    });
  }

  function stockModal(item) {
    const s = item || { qty: 0, active: true };
    const body = `
      <form id="stock-form" novalidate>
        <div class="admin-form-grid">
          <label class="field span-2"><span class="field-label">Nome *</span><input class="input" id="s-name" value="${esc(s.name || "")}" required></label>
          <label class="field"><span class="field-label">Marca</span><input class="input" id="s-brand" value="${esc(s.brand || "")}"></label>
          <label class="field"><span class="field-label">Modelo / especificações</span><input class="input" id="s-specs" value="${esc(s.specs || "")}"></label>
          <label class="field"><span class="field-label">Preço (R$) *</span><input class="input" id="s-price" type="number" min="0" step="0.01" value="${Number(s.price) || 0}" required></label>
          <label class="field"><span class="field-label">Quantidade em estoque</span><input class="input" id="s-qty" type="number" min="0" step="1" value="${Number(s.qty) || 0}"></label>
          <label class="field"><span class="field-label">Origem / lote</span><input class="input" id="s-lot" value="${esc(s.lot || "")}"></label>
          <label class="field"><span class="field-label">Ordem</span><input class="input" id="s-sort" type="number" step="1" value="${Number(s.sortOrder) || 0}"></label>
          <label class="field span-2"><span class="field-label">Descrição</span><textarea class="input" id="s-description" rows="2">${esc(s.description || "")}</textarea></label>
          <div class="field span-2">
            <span class="field-label">Imagem</span>
            <div class="admin-image-preview">
              <img id="s-image-preview" src="${esc(s.image || "")}" alt="" style="${s.image ? "" : "display:none"}">
              <div class="meta" style="flex:1">
                <input class="input" id="s-image" value="${esc(s.image || "")}" placeholder="URL ou envie um arquivo">
                <input type="file" id="s-file" accept="image/*" style="margin-top:8px;font-size:12px">
              </div>
            </div>
          </div>
          <label class="admin-toggle"><input type="checkbox" id="s-active" ${s.active !== false ? "checked" : ""}> Visível na loja</label>
        </div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-close type="button">Cancelar</button>
      <button class="btn btn-primary" type="button" id="s-save">${item ? "Salvar alterações" : "Criar item"}</button>`;
    openModal({ title: item ? "Editar pronta entrega" : "Novo item de pronta entrega", body, footer });

    $("#s-image").addEventListener("input", () => {
      const img = $("#s-image-preview");
      const val = $("#s-image").value.trim();
      if (val) { img.src = val; img.style.display = ""; } else img.style.display = "none";
    });
    $("#s-file").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const url = await Store.uploadImage(file, "estoque");
        $("#s-image").value = url;
        $("#s-image-preview").src = url;
        $("#s-image-preview").style.display = "";
        toast("Imagem enviada.");
      } catch (err) {
        toast(err.message || "Não foi possível enviar a imagem.", "error");
      }
    });
    $("#s-save").addEventListener("click", async () => {
      const name = $("#s-name").value.trim();
      if (!name) return toast("Informe o nome do item.", "error");
      const payload = {
        id: item ? item.id : "",
        name,
        brand: $("#s-brand").value.trim(),
        specs: $("#s-specs").value.trim(),
        price: Number($("#s-price").value) || 0,
        qty: Number($("#s-qty").value) || 0,
        lot: $("#s-lot").value.trim(),
        sortOrder: Number($("#s-sort").value) || 0,
        description: $("#s-description").value.trim(),
        image: $("#s-image").value.trim(),
        active: $("#s-active").checked,
      };
      const button = $("#s-save");
      button.disabled = true;
      button.textContent = "Salvando...";
      try {
        await Store.saveStockItem(payload);
        closeModal();
        await refresh();
        toast("Item salvo.");
      } catch (err) {
        button.disabled = false;
        button.textContent = item ? "Salvar alterações" : "Criar item";
        toast(err.message || "Não foi possível salvar o item.", "error");
      }
    });
  }

  /* ---------------- leilões ---------------- */

  function auctionsView() {
    return `
      <div class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>Leilões</h2>
            <p>O maior lance válido leva o lote. O vencedor paga o arremate via Pix.</p>
          </div>
          <button class="btn btn-primary btn-sm" type="button" id="new-auction">+ Novo leilão</button>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Leilão</th><th>Lance inicial</th><th>Incremento</th><th>Termina</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              ${
                state.db.auctions.length
                  ? state.db.auctions
                      .map((a) => {
                        const ended = a.endsAt && new Date(a.endsAt).getTime() <= Date.now();
                        return `<tr>
                          <td><div class="admin-cell-main"><div class="admin-thumb">${a.image ? `<img src="${esc(a.image)}" alt="">` : "⚑"}</div><div><strong>${esc(a.title)}</strong><span>${esc(a.specs || "")}</span></div></div></td>
                          <td>${fmt(a.startBid)}</td>
                          <td>${fmt(a.increment)}</td>
                          <td>${fmtDateTime(a.endsAt)}</td>
                          <td>${a.paidAt ? '<span class="admin-badge ok">Pago</span>' : ended ? '<span class="admin-badge muted">Encerrado</span>' : '<span class="admin-badge info">Em andamento</span>'} ${a.active === false ? '<span class="admin-badge danger">Oculto</span>' : ""}</td>
                          <td><div class="admin-actions">
                            <button class="btn btn-ghost btn-sm" type="button" data-auction-edit="${esc(a.id)}">Editar</button>
                            <button class="btn btn-ghost btn-sm" type="button" data-auction-del="${esc(a.id)}">Excluir</button>
                          </div></td>
                        </tr>`;
                      })
                      .join("")
                  : `<tr class="empty-row"><td colspan="6">Nenhum leilão cadastrado.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function bindAuctions() {
    $("#new-auction").addEventListener("click", () => auctionModal(null));
    $$("[data-auction-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const auction = state.db.auctions.find((a) => a.id === btn.dataset.auctionEdit);
        if (auction) auctionModal(auction);
      });
    });
    $$("[data-auction-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const auction = state.db.auctions.find((a) => a.id === btn.dataset.auctionDel);
        if (!auction) return;
        if (!window.confirm(`Excluir o leilão "${auction.title}"?`)) return;
        try {
          await Store.deleteAuction(auction.id);
          await refresh();
          toast("Leilão excluído.");
        } catch (err) {
          toast(err.message || "Não foi possível excluir o leilão.", "error");
        }
      });
    });
  }

  function auctionModal(auction) {
    const a = auction || { startBid: 0, increment: 0, active: true };
    const body = `
      <form id="auction-form" novalidate>
        <div class="admin-form-grid">
          <label class="field span-2"><span class="field-label">Título *</span><input class="input" id="a-title" value="${esc(a.title || "")}" required></label>
          <label class="field span-2"><span class="field-label">Origem</span><input class="input" id="a-origin" value="${esc(a.origin || "")}" placeholder="Ex.: saldo não pago do lote"></label>
          <label class="field"><span class="field-label">Especificações</span><input class="input" id="a-specs" value="${esc(a.specs || "")}"></label>
          <label class="field"><span class="field-label">Lance inicial (R$)</span><input class="input" id="a-start" type="number" min="0" step="0.01" value="${Number(a.startBid) || 0}"></label>
          <label class="field"><span class="field-label">Incremento mínimo (R$)</span><input class="input" id="a-increment" type="number" min="0" step="0.01" value="${Number(a.increment) || 0}"></label>
          <label class="field"><span class="field-label">Termina em</span><input class="input" id="a-ends" type="datetime-local" value="${toLocalInput(a.endsAt)}"></label>
          <label class="field span-2"><span class="field-label">Descrição</span><textarea class="input" id="a-description" rows="2">${esc(a.description || "")}</textarea></label>
          <div class="field span-2">
            <span class="field-label">Imagem</span>
            <div class="admin-image-preview">
              <img id="a-image-preview" src="${esc(a.image || "")}" alt="" style="${a.image ? "" : "display:none"}">
              <div class="meta" style="flex:1"><input class="input" id="a-image" value="${esc(a.image || "")}" placeholder="URL ou envie um arquivo"><input type="file" id="a-file" accept="image/*" style="margin-top:8px;font-size:12px"></div>
            </div>
          </div>
          <label class="admin-toggle"><input type="checkbox" id="a-active" ${a.active !== false ? "checked" : ""}> Visível na loja</label>
        </div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-close type="button">Cancelar</button>
      <button class="btn btn-primary" type="button" id="a-save">${auction ? "Salvar alterações" : "Criar leilão"}</button>`;
    openModal({ title: auction ? "Editar leilão" : "Novo leilão", body, footer });

    $("#a-image").addEventListener("input", () => {
      const img = $("#a-image-preview");
      const val = $("#a-image").value.trim();
      if (val) { img.src = val; img.style.display = ""; } else img.style.display = "none";
    });
    $("#a-file").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const url = await Store.uploadImage(file, "leiloes");
        $("#a-image").value = url;
        $("#a-image-preview").src = url;
        $("#a-image-preview").style.display = "";
        toast("Imagem enviada.");
      } catch (err) {
        toast(err.message || "Não foi possível enviar a imagem.", "error");
      }
    });
    $("#a-save").addEventListener("click", async () => {
      const title = $("#a-title").value.trim();
      if (!title) return toast("Informe o título do leilão.", "error");
      const payload = {
        id: auction ? auction.id : "",
        title,
        origin: $("#a-origin").value.trim(),
        specs: $("#a-specs").value.trim(),
        startBid: Number($("#a-start").value) || 0,
        increment: Number($("#a-increment").value) || 0,
        endsAt: fromLocalInput($("#a-ends").value),
        description: $("#a-description").value.trim(),
        image: $("#a-image").value.trim(),
        active: $("#a-active").checked,
      };
      const button = $("#a-save");
      button.disabled = true;
      button.textContent = "Salvando...";
      try {
        await Store.saveAuction(payload);
        closeModal();
        await refresh();
        toast("Leilão salvo.");
      } catch (err) {
        button.disabled = false;
        button.textContent = auction ? "Salvar alterações" : "Criar leilão";
        toast(err.message || "Não foi possível salvar o leilão.", "error");
      }
    });
  }

  /* ---------------- clientes ---------------- */

  function customersView() {
    const search = state.customerSearch.trim().toLowerCase();
    const users = state.db.users.filter((u) => {
      if (!search) return true;
      return `${u.name} ${u.email} ${u.cpf} ${u.whatsapp}`.toLowerCase().includes(search);
    });
    return `
      <div class="admin-panel">
        <div class="admin-panel-head">
          <div>
            <h2>Clientes</h2>
            <p>Aprove cadastros, bloqueie acessos e confira os dados de entrega.</p>
          </div>
          <div class="admin-filters">
            <input class="input" id="customer-search" type="search" placeholder="Buscar cliente" value="${esc(state.customerSearch)}">
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Cliente</th><th>Contato</th><th>Pedidos</th><th>Status</th><th>Perfil</th><th>Ações</th></tr></thead>
            <tbody>
              ${
                users.length
                  ? users
                      .map((u) => {
                        const count = state.db.orders.filter((o) => o.userId === u.id).length;
                        return `<tr>
                          <td><strong>${esc(u.name || "Sem nome")}</strong><br><span style="font-size:12px;color:#6b7a92">${esc(u.email)}</span></td>
                          <td>${esc(u.whatsapp || "—")}<br><span style="font-size:12px;color:#6b7a92">${esc(u.cpf || "CPF não informado")}</span></td>
                          <td>${count}</td>
                          <td>${u.status === "ativo" ? '<span class="admin-badge ok">Ativo</span>' : u.status === "pendente" ? '<span class="admin-badge warn">Pendente</span>' : '<span class="admin-badge danger">Bloqueado</span>'}</td>
                          <td>${u.role === "admin" ? '<span class="admin-badge info">Administrador</span>' : '<span class="admin-badge muted">Membro</span>'}</td>
                          <td><button class="btn btn-ghost btn-sm" type="button" data-client-edit="${esc(u.id)}">Editar</button></td>
                        </tr>`;
                      })
                      .join("")
                  : `<tr class="empty-row"><td colspan="6">Nenhum cliente encontrado.</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function bindCustomers() {
    const search = $("#customer-search");
    if (search) {
      search.addEventListener("input", () => {
        state.customerSearch = search.value;
        renderView();
        const el = $("#customer-search");
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    }
    $$("[data-client-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const user = state.db.users.find((u) => u.id === btn.dataset.clientEdit);
        if (user) customerModal(user);
      });
    });
  }

  function customerModal(user) {
    const addresses = user.addresses || [];
    const body = `
      <form id="customer-form" novalidate>
        <div class="admin-form-grid">
          <label class="field span-2"><span class="field-label">Nome completo</span><input class="input" id="c-name" value="${esc(user.name || "")}"></label>
          <label class="field"><span class="field-label">E-mail (cadastro)</span><input class="input" id="c-email" value="${esc(user.email || "")}" disabled></label>
          <label class="field"><span class="field-label">CPF</span><input class="input" id="c-cpf" value="${esc(user.cpf || "")}"></label>
          <label class="field"><span class="field-label">WhatsApp</span><input class="input" id="c-whatsapp" value="${esc(user.whatsapp || "")}"></label>
          <label class="field"><span class="field-label">Telefone alternativo</span><input class="input" id="c-phone2" value="${esc(user.phone2 || "")}"></label>
          <label class="field"><span class="field-label">Status</span>
            <select class="input" id="c-status">
              <option value="pendente" ${user.status === "pendente" ? "selected" : ""}>Pendente</option>
              <option value="ativo" ${user.status === "ativo" ? "selected" : ""}>Ativo</option>
              <option value="bloqueado" ${user.status === "bloqueado" ? "selected" : ""}>Bloqueado</option>
            </select>
          </label>
          <label class="field"><span class="field-label">Perfil</span>
            <select class="input" id="c-role">
              <option value="membro" ${user.role === "membro" ? "selected" : ""}>Membro</option>
              <option value="admin" ${user.role === "admin" ? "selected" : ""}>Administrador</option>
            </select>
          </label>
          <label class="field"><span class="field-label">Crédito (R$)</span><input class="input" id="c-credit" type="number" step="0.01" value="${Number(user.credit) || 0}"></label>
        </div>
        <div class="admin-section-title">Endereços cadastrados</div>
        <div class="admin-note">
          ${
            addresses.length
              ? addresses
                  .map(
                    (a) => `<div style="margin-bottom:6px"><strong>${esc(a.label)}</strong>${a.principal ? ' <span class="admin-badge ok">principal</span>' : ""}<br>${esc(a.street)}, ${esc(a.number)}${a.complement ? " — " + esc(a.complement) : ""} · ${esc(a.district)} · ${esc(a.city)}/${esc(a.state)} · CEP ${esc(a.cep)}</div>`
                  )
                  .join("")
              : "Nenhum endereço cadastrado."
          }
        </div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-close type="button">Fechar</button>
      <button class="btn btn-primary" type="button" id="c-save">Salvar cliente</button>`;
    openModal({ title: user.name || "Cliente", subtitle: user.email, body, footer });

    $("#c-save").addEventListener("click", async () => {
      const button = $("#c-save");
      button.disabled = true;
      button.textContent = "Salvando...";
      try {
        await Store.updateProfileAdmin(user.id, {
          name: $("#c-name").value.trim(),
          cpf: $("#c-cpf").value.trim(),
          whatsapp: $("#c-whatsapp").value.trim(),
          phone2: $("#c-phone2").value.trim(),
          status: $("#c-status").value,
          role: $("#c-role").value,
          credit: Number($("#c-credit").value) || 0,
        });
        closeModal();
        await refresh();
        toast("Cliente atualizado.");
      } catch (err) {
        button.disabled = false;
        button.textContent = "Salvar cliente";
        toast(err.message || "Não foi possível salvar o cliente.", "error");
      }
    });
  }

  /* ---------------- configurações ---------------- */

  function settingsView() {
    const s = settings();
    const ship = s.shipping || {};
    const input = (id, label, value, extra = "") => `
      <label class="field">
        <span class="field-label">${esc(label)}</span>
        <input class="input" id="${id}" value="${esc(value == null ? "" : value)}" ${extra}>
      </label>`;
    const area = (id, label, value, rows = 2) => `
      <label class="field span-2">
        <span class="field-label">${esc(label)}</span>
        <textarea class="input" id="${id}" rows="${rows}">${esc(value || "")}</textarea>
      </label>`;

    return `
      <form id="settings-form" class="admin-panel" novalidate>
        <div class="admin-panel-head">
          <div>
            <h2>Configurações da loja</h2>
            <p>Textos, aparência, frete, sinal e Pix. O cliente vê as mudanças em tempo real.</p>
          </div>
          <button class="btn btn-primary btn-sm" type="submit" id="settings-save">Salvar configurações</button>
        </div>
        <div class="admin-panel-body">
          <div class="admin-section-title">Identidade do site</div>
          <div class="admin-form-grid">
            ${input("set-siteName", "Nome da loja", s.siteName)}
            ${input("set-brandMark", "Marca curta (1 ou 2 letras)", s.brandMark)}
            ${input("set-brandHighlight", "Parte destacada do nome", s.brandHighlight)}
            ${input("set-brandSub", "Subtítulo da marca", s.brandSub)}
            ${input("set-pageTitle", "Título da aba do navegador", s.pageTitle)}
            ${input("set-contactEmail", "E-mail de contato", s.contactEmail)}
            ${input("set-contactWhatsapp", "WhatsApp de contato", s.contactWhatsapp)}
            ${input("set-contactInstagram", "Instagram", s.contactInstagram)}
            ${area("set-metaDescription", "Descrição para o Google (meta description)", s.metaDescription, 3)}
          </div>

          <div class="admin-section-title">Faixa superior e rodapé</div>
          <div class="admin-form-grid">
            ${input("set-announceLeft", "Texto da faixa superior (esquerda)", s.announceLeft)}
            ${input("set-announceRight", "Texto da faixa superior (direita)", s.announceRight)}
            ${area("set-footerTagline", "Frase do rodapé", s.footerTagline, 2)}
            ${input("set-footerNote", "Rodapé · linha 1", s.footerNote)}
            ${input("set-footerDemo", "Rodapé · linha 2", s.footerDemo)}
          </div>

          <div class="admin-section-title">Tela de login e cadastro</div>
          <div class="admin-form-grid">
            ${input("set-authTag", "Selo do login", s.authTag)}
            ${input("set-authHeadline1", "Título linha 1", s.authHeadline1)}
            ${input("set-authHeadline2", "Título linha 2", s.authHeadline2)}
            ${input("set-loginTitle", "Título do login", s.loginTitle)}
            ${input("set-signupTitle", "Título do cadastro", s.signupTitle)}
            ${area("set-authLead", "Texto de apoio", s.authLead, 3)}
            ${area("set-loginLead", "Texto do login", s.loginLead, 2)}
            ${area("set-signupLead", "Texto do cadastro", s.signupLead, 2)}
            <label class="admin-toggle span-2"><input type="checkbox" id="set-autoApprove" ${s.autoApproveUsers === true ? "checked" : ""}> Aprovar cadastros automaticamente</label>
          </div>

          <div class="admin-section-title">Sinal, caixa e frete</div>
          <div class="admin-form-grid">
            <label class="admin-toggle"><input type="checkbox" id="set-sinalEnabled" ${s.sinalEnabled !== false ? "checked" : ""}> Cobrar sinal</label>
            ${input("set-sinalPorVial", "Sinal por unidade (R$)", s.sinalPorVial, 'type="number" min="0" step="0.01"')}
            ${input("set-boxSize", "Unidades que fecham uma caixa", s.boxSize, 'type="number" min="1" step="1"')}
            ${input("set-unitLabel", "Nome da unidade (singular)", s.unitLabel)}
            ${input("set-unitLabelPlural", "Nome da unidade (plural)", s.unitLabelPlural)}
            ${input("set-specsLabel", "Rótulo de modelo/especificação", s.specsLabel)}
            <label class="admin-toggle span-2"><input type="checkbox" id="set-shippingEnabled" ${s.shippingEnabled !== false ? "checked" : ""}> Cobrar frete por região</label>
            ${input("set-ship-Sudeste", "Frete Sudeste (R$)", ship.Sudeste, 'type="number" min="0" step="0.01"')}
            ${input("set-ship-Sul", "Frete Sul (R$)", ship.Sul, 'type="number" min="0" step="0.01"')}
            ${input("set-ship-Centro-Oeste", "Frete Centro-Oeste (R$)", ship["Centro-Oeste"], 'type="number" min="0" step="0.01"')}
            ${input("set-ship-Nordeste", "Frete Nordeste (R$)", ship.Nordeste, 'type="number" min="0" step="0.01"')}
            ${input("set-ship-Norte", "Frete Norte (R$)", ship.Norte, 'type="number" min="0" step="0.01"')}
          </div>

          <div class="admin-section-title">Pagamento Pix</div>
          <div class="admin-form-grid">
            <label class="field">
              <span class="field-label">Modo de cobrança</span>
              <select class="input" id="set-pixProvider">
                <option value="inter" ${s.pixProvider !== "manual" ? "selected" : ""}>Automático · Banco Inter</option>
                <option value="manual" ${s.pixProvider === "manual" ? "selected" : ""}>Manual · chave Pix</option>
              </select>
            </label>
            ${input("set-pixKey", "Chave Pix (modo manual)", s.pixKey)}
            ${input("set-pixMerchant", "Nome do recebedor no Pix", s.pixMerchant)}
            ${input("set-pixCity", "Cidade do recebedor no Pix", s.pixCity)}
            <div class="span-2 admin-note">
              <strong>Importante:</strong> as credenciais do Banco Inter (client id, secret e certificado) ficam nas
              variáveis de ambiente da Vercel, nunca neste painel. Use o botão abaixo para conferir se a API já está configurada.
              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <button class="btn btn-ghost btn-sm" type="button" id="pix-health">Testar API Pix</button>
                <span id="pix-health-result" style="font-size:12.5px"></span>
              </div>
            </div>
          </div>

          <div class="admin-section-title">Aparência</div>
          <div class="admin-form-grid">
            <label class="field">
              <span class="field-label">Cor principal</span>
              <input class="input" id="set-storePrimary" type="color" value="${esc(s.storePrimary || "#2b211b")}" style="height:44px;padding:4px">
            </label>
            <label class="field">
              <span class="field-label">Cor de destaque</span>
              <input class="input" id="set-storeAccent" type="color" value="${esc(s.storeAccent || "#a65b3c")}" style="height:44px;padding:4px">
            </label>
            ${input("set-bannerTitle", "Título do banner (opcional)", s.bannerTitle)}
            ${input("set-bannerSubtitle", "Subtítulo do banner (opcional)", s.bannerSubtitle)}
            <div class="field span-2">
              <span class="field-label">Imagem do banner</span>
              <div class="admin-image-preview">
                <img id="set-banner-preview" src="${esc(s.bannerImage || "")}" alt="" style="${s.bannerImage ? "" : "display:none"}">
                <div class="meta" style="flex:1">
                  <input class="input" id="set-bannerImage" value="${esc(s.bannerImage || "")}" placeholder="URL ou envie um arquivo">
                  <input type="file" id="set-banner-file" accept="image/*" style="margin-top:8px;font-size:12px">
                </div>
              </div>
            </div>
          </div>

          <div class="admin-section-title">Textos do guia e documentos</div>
          <div class="admin-form-grid">
            ${input("set-guideTitle", "Título do guia", s.guideTitle)}
            ${area("set-guideLead", "Introdução do guia", s.guideLead, 2)}
            ${area("set-privacyIntro", "Introdução da Política de Privacidade", s.privacyIntro, 3)}
            ${area("set-termsIntro", "Introdução dos Termos de Serviço", s.termsIntro, 3)}
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:18px">
            <button class="btn btn-primary" type="button" id="settings-save-2">Salvar configurações</button>
          </div>
        </div>
      </form>`;
  }

  function bindSettings() {
    const form = $("#settings-form");
    const markDirty = () => { state.settingsDirty = true; };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);

    $("#set-bannerImage").addEventListener("input", () => {
      const img = $("#set-banner-preview");
      const val = $("#set-bannerImage").value.trim();
      if (val) { img.src = val; img.style.display = ""; } else img.style.display = "none";
    });

    $("#set-banner-file").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const url = await Store.uploadImage(file, "banners");
        $("#set-bannerImage").value = url;
        $("#set-banner-preview").src = url;
        $("#set-banner-preview").style.display = "";
        state.settingsDirty = true;
        toast("Banner enviado. Clique em salvar.");
      } catch (err) {
        toast(err.message || "Não foi possível enviar o banner.", "error");
      }
    });

    $("#pix-health").addEventListener("click", async () => {
      const result = $("#pix-health-result");
      result.textContent = "Consultando...";
      const health = await Store.pixHealth();
      if (health && health.configured) {
        result.innerHTML = `<span class="admin-badge ok">API configurada</span> ${esc(health.environment || "")}`;
      } else {
        result.innerHTML = `<span class="admin-badge warn">API não configurada</span> ${esc((health && health.message) || "Use o modo manual ou configure a Vercel.")}`;
      }
    });

    let saving = false;
    const save = async (e) => {
      e.preventDefault();
      if (saving) return;
      saving = true;
      const button = $("#settings-save");
      const button2 = $("#settings-save-2");
      [button, button2].forEach((btn) => {
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = "Salvando...";
      });
      const ship = {
        Sudeste: Number($("#set-ship-Sudeste").value) || 0,
        Sul: Number($("#set-ship-Sul").value) || 0,
        "Centro-Oeste": Number($("#set-ship-Centro-Oeste").value) || 0,
        Nordeste: Number($("#set-ship-Nordeste").value) || 0,
        Norte: Number($("#set-ship-Norte").value) || 0,
      };
      const patch = {
        siteName: $("#set-siteName").value.trim(),
        brandMark: $("#set-brandMark").value.trim(),
        brandHighlight: $("#set-brandHighlight").value.trim(),
        brandSub: $("#set-brandSub").value.trim(),
        pageTitle: $("#set-pageTitle").value.trim(),
        metaDescription: $("#set-metaDescription").value.trim(),
        contactEmail: $("#set-contactEmail").value.trim(),
        contactWhatsapp: $("#set-contactWhatsapp").value.trim(),
        contactInstagram: $("#set-contactInstagram").value.trim(),
        announceLeft: $("#set-announceLeft").value.trim(),
        announceRight: $("#set-announceRight").value.trim(),
        footerTagline: $("#set-footerTagline").value.trim(),
        footerNote: $("#set-footerNote").value.trim(),
        footerDemo: $("#set-footerDemo").value.trim(),
        authTag: $("#set-authTag").value.trim(),
        authHeadline1: $("#set-authHeadline1").value.trim(),
        authHeadline2: $("#set-authHeadline2").value.trim(),
        authLead: $("#set-authLead").value.trim(),
        loginTitle: $("#set-loginTitle").value.trim(),
        loginLead: $("#set-loginLead").value.trim(),
        signupTitle: $("#set-signupTitle").value.trim(),
        signupLead: $("#set-signupLead").value.trim(),
        autoApproveUsers: $("#set-autoApprove").checked,
        sinalEnabled: $("#set-sinalEnabled").checked,
        sinalPorVial: Number($("#set-sinalPorVial").value) || 0,
        boxSize: Math.max(1, Number($("#set-boxSize").value) || 10),
        unitLabel: $("#set-unitLabel").value.trim(),
        unitLabelPlural: $("#set-unitLabelPlural").value.trim(),
        specsLabel: $("#set-specsLabel").value.trim(),
        shippingEnabled: $("#set-shippingEnabled").checked,
        shipping: ship,
        pixProvider: $("#set-pixProvider").value,
        pixKey: $("#set-pixKey").value.trim(),
        pixMerchant: $("#set-pixMerchant").value.trim(),
        pixCity: $("#set-pixCity").value.trim(),
        storePrimary: $("#set-storePrimary").value,
        storeAccent: $("#set-storeAccent").value,
        bannerImage: $("#set-bannerImage").value.trim(),
        bannerTitle: $("#set-bannerTitle").value.trim(),
        bannerSubtitle: $("#set-bannerSubtitle").value.trim(),
        guideTitle: $("#set-guideTitle").value.trim(),
        guideLead: $("#set-guideLead").value.trim(),
        privacyIntro: $("#set-privacyIntro").value.trim(),
        termsIntro: $("#set-termsIntro").value.trim(),
      };
      try {
        await Store.saveSettings(patch);
        state.settingsDirty = false;
        await refresh(false);
        applyTheme();
        toast("Configurações salvas. A loja já está atualizada.");
        renderView();
      } catch (err) {
        toast(err.message || "Não foi possível salvar as configurações.", "error");
        saving = false;
        button.disabled = false;
        button.textContent = "Salvar configurações";
        if (button2) {
          button2.disabled = false;
          button2.textContent = "Salvar configurações";
        }
      }
    };

    form.addEventListener("submit", save);
    const btn2 = $("#settings-save-2");
    if (btn2) btn2.addEventListener("click", save);
  }

  /* ---------------- modal / teclado ---------------- */

  modalRoot.addEventListener("click", (e) => {
    if (e.target.classList.contains("overlay") || e.target.closest("[data-close]")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.modalOpen) closeModal();
  });

  bootAdmin();
})();
