/* =========================================================
   rateio2you — catálogo, reserva, pedidos e Pix
   ========================================================= */

function formatAddress(a) {
  if (!a) return "—";
  const comp = a.complement ? ` — ${a.complement}` : "";
  return `${a.street}, ${a.number}${comp} — ${a.district}, ${a.city}/${a.state}`;
}

function lotCardHTML(lot, selected) {
  return `
    <button class="lot-card ${selected ? "selected" : ""}" type="button" data-lot="${lot.id}"
      aria-pressed="${selected}" style="--lot-accent:${lot.accent || "#5580d7"}">
      <div class="lot-cover">
        <span class="lot-status"><span class="pill pill-yellow">Aberto</span></span>
        <span class="lot-check">✓</span>
        <span class="lot-monogram">${esc(lot.monogram || "R2Y")}<small>${esc(lot.brand)}</small></span>
      </div>
      <div class="lot-body">
        <h2>${esc(lot.title)}</h2>
        <p>${esc(lot.description)}</p>
        <div class="lot-foot">
          <span>Ver catálogo ${ICONS.arrow}</span>
          <span class="date">fecha ${fmtDate(lot.closesAt)}</span>
        </div>
      </div>
    </button>`;
}

function orderQty(productId) {
  return ui.orderQty[productId] || 0;
}

function productCardHTML(p, lot) {
  const qty = orderQty(p.id);
  const size = boxSize();
  const rest = qty % size;
  const totalInBox = p.boxFilled + rest;
  const formed = Math.floor(totalInBox / size);
  const remainder = totalInBox % size;
  const userInRemainder = Math.min(rest, remainder);
  const userBase = remainder - userInRemainder;
  const brand = p.brand || lot.brand;
  const specs = p.specs || p.mg || "";
  const unit = unitLabel();

  const segments = Array.from({ length: size }, (_, i) => {
    if (i < userBase) return '<span class="on"></span>';
    if (i < remainder) return '<span class="user"></span>';
    return "<span></span>";
  }).join("");

  const boxLabel =
    remainder === 0 && totalInBox > 0
      ? `<strong>Box completo</strong> · ${formed} caixa(s)`
      : `${remainder}/${size} no box${formed > 0 ? ` · ${formed} caixa(s) fechada(s)` : ""}`;

  return `
    <article class="product-card ${qty ? "selected" : ""}" data-product="${p.id}">
      <div class="product-thumb">${productImageHTML(p, { tone: lot.accent, label: specs })}</div>
      <div class="product-info">
        <div class="product-brand">${esc(brand)}</div>
        <div class="product-name-row">
          <span class="product-name">${esc(p.name)}</span>
          <span class="product-mg">${esc(specs)}</span>
          ${p.tag ? `<span class="pill pill-mist" style="font-size:12.5px">${esc(p.tag)}</span>` : ""}
        </div>
        ${p.description ? `<p class="product-desc">${esc(p.description)}</p>` : ""}
        <div class="product-meta">
          <span>${fmt(p.price)} / ${esc(unit)}</span>
          <span>·</span>
          <span>${remainder === 0 && totalInBox > 0 ? "Caixa exclusiva pronta" : `${p.boxFilled}/${size} já preenchidos no box`}</span>
        </div>
        <div class="product-price">${fmt(p.price)} <small>por ${esc(unit)}</small></div>
      </div>
      <div class="product-actions">
        <div class="stepper" aria-label="Quantidade de ${esc(p.name)}">
          <button type="button" data-step="-1" data-pid="${p.id}" aria-label="Diminuir">−</button>
          <span class="qty">${qty}</span>
          <button type="button" data-step="1" data-pid="${p.id}" aria-label="Aumentar">+</button>
        </div>
        <button class="quick-box" type="button" data-box="${p.id}">+ Caixa (${size})</button>
      </div>
      <div class="box-row">
        <div class="box-bar" aria-hidden="true">${segments}</div>
        <span class="box-label">${boxLabel}</span>
      </div>
    </article>`;
}

function filteredProducts(lot) {
  const term = ui.search.trim().toLowerCase();
  return productsForLot(lot.id).filter((p) => {
    if (p.active === false) return false;
    const matchTerm = !term || `${p.name} ${p.specs || p.mg || ""} ${p.brand || ""}`.toLowerCase().includes(term);
    if (!matchTerm) return false;
    if (ui.filter === "quase") return p.boxFilled >= boxSize() - 3 || orderQty(p.id) >= boxSize() - 3;
    if (ui.filter === "selecionados") return orderQty(p.id) > 0;
    return true;
  });
}

function orderTotals(lot) {
  const user = currentUser();
  let count = 0;
  let subtotal = 0;
  productsForLot(lot.id).forEach((p) => {
    const q = orderQty(p.id);
    count += q;
    subtotal += q * p.price;
  });
  const shipping = shippingForUser(user);
  const sinal = sinalEnabled() ? count * sinalPerUnit() : 0;
  const total = count ? subtotal + shipping : 0;
  return { count, subtotal, shipping, sinal, total, balance: Math.max(0, total - sinal) };
}

function refreshCatalog(lot) {
  const list = $("#catalog-products");
  if (!list) return;
  const items = filteredProducts(lot);
  list.innerHTML = items.length
    ? items.map((p) => productCardHTML(p, lot)).join("")
    : `<div class="empty">
        <div class="empty-icon">${ICONS.search}</div>
        <h3>Nenhum produto encontrado</h3>
        <p>Tente outro termo ou remova os filtros para ver o catálogo completo do lote.</p>
      </div>`;
  const count = $("#catalog-count");
  if (count) count.textContent = `${items.length} ${items.length === 1 ? "produto" : "produtos"}`;
}

function refreshOrderSummary(lot) {
  const t = orderTotals(lot);
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set("sum-count", t.count);
  set("sum-subtotal", fmt(t.subtotal));
  set("sum-shipping", t.shipping ? fmt(t.shipping) : "a calcular");
  set("sum-total", fmt(t.total));
  set("sum-sinal-count", t.count);
  const sinalOn = sinalEnabled();
  set("sum-sinal", sinalOn ? fmt(t.sinal) : "Não exigido");
  set("sum-pay", fmt(sinalOn ? t.sinal : t.total));
  set("sum-balance", fmt(sinalOn ? t.balance : 0));
  set("mobile-total", fmt(t.total));
  set("mobile-count", `${t.count} ${t.count === 1 ? "item" : "itens"}`);

  ["reserve-btn", "reserve-btn-mobile"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.disabled = t.count === 0;
  });
}

function reservationSummaryHTML(lot, t) {
  const user = currentUser();
  const addr = mainAddress(user);
  const items = productsForLot(lot.id).filter((p) => orderQty(p.id) > 0);
  const unit = unitLabel();
  const payNow = t.sinal > 0 ? t.sinal : t.total;
  return `
    <div class="confirm-list">
      ${items
        .map(
          (p) => `<div class="confirm-item">
            <span class="n">${esc(p.name)} ${esc(p.specs || p.mg || "")} <strong>× ${orderQty(p.id)}</strong></span>
            <span class="p">${fmt(p.price * orderQty(p.id))}</span>
          </div>`
        )
        .join("")}
    </div>
    <div class="confirm-totals">
      <div><span>Subtotal</span><strong>${fmt(t.subtotal)}</strong></div>
      <div><span>Frete regional</span><strong>${fmt(t.shipping)}</strong></div>
      ${
        t.sinal > 0
          ? `<div><span>Sinal (${t.count} × ${fmt(sinalPerUnit())})</span><strong>${fmt(t.sinal)}</strong></div>`
          : `<div><span>Sinal</span><strong>Não exigido</strong></div>`
      }
      <div class="big"><span>Pagar agora via Pix</span><strong>${fmt(payNow)}</strong></div>
    </div>
    <div class="region-box" style="margin-top:14px;background:var(--mist);border:1px solid var(--line)">
      <div class="region" style="color:var(--olive-deep)">${ICONS.pin} Entregar em ${esc(addr ? addr.city + "/" + addr.state : "—")}</div>
      <div class="hint" style="color:var(--muted)">${esc(addr ? formatAddress(addr) : "Cadastre um endereço principal em Minha conta.")}</div>
    </div>
    <p style="margin-top:12px;font-size:12.5px;line-height:1.55;color:var(--muted)">
      ${
        t.sinal > 0
          ? `O sinal de ${fmt(t.sinal)} será descontado do saldo final. O saldo estimado com frete é de`
          : `Nenhum sinal é exigido nesta compra. O valor total com frete é de`
      }
      <strong style="color:var(--ink-soft)">${fmt(t.balance)}</strong>.
    </p>`;
}

function openReservation(lot) {
  const user = currentUser();
  const t = orderTotals(lot);
  if (!t.count) {
    toast("Escolha pelo menos um produto para reservar.", "error");
    return;
  }
  const addr = mainAddress(user);
  if (!addr || !addr.state) {
    openModal({
      title: "Endereço principal necessário",
      subtitle: "O frete é calculado pela região do seu CEP.",
      body: `<p style="font-size:14.5px;line-height:1.65;color:var(--ink-soft)">Cadastre um endereço de entrega e defina-o como principal para concluir a reserva.</p>`,
      foot: `<button class="btn btn-ghost" data-close type="button">Agora não</button>
             <button class="btn btn-primary" id="go-account" type="button">Cadastrar endereço</button>`,
    });
    $("#go-account").addEventListener("click", () => {
      closeModal();
      go("conta");
    });
    return;
  }

  const needsSinal = t.sinal > 0;
  openModal({
    title: "Confirmar reserva",
    subtitle: `${lot.title} · ${t.count} ${t.count === 1 ? unitLabel() : unitLabel(true)}`,
    wide: true,
    body: reservationSummaryHTML(lot, t),
    foot: `<button class="btn btn-ghost" data-close type="button">Voltar</button>
           <button class="btn btn-accent" id="confirm-reserve" type="button">${ICONS.pix} ${
      needsSinal ? "Gerar Pix do sinal" : "Gerar Pix do total"
    }</button>`,
  });

  $("#confirm-reserve").addEventListener("click", async () => {
    const button = $("#confirm-reserve");
    button.disabled = true;
    button.textContent = "Salvando reserva...";
    const items = productsForLot(lot.id)
      .filter((p) => orderQty(p.id) > 0)
      .map((p) => ({
        productId: p.id,
        name: p.name,
        specs: p.specs || p.mg || "",
        qty: orderQty(p.id),
        price: p.price,
      }));
    const order = {
      id: nextOrderId(),
      userId: user.id,
      type: "rateio",
      lotId: lot.id,
      lotTitle: lot.title,
      items,
      subtotal: t.subtotal,
      shipping: t.shipping,
      sinal: t.sinal,
      total: t.total,
      balance: t.balance,
      status: needsSinal ? "aguardando_sinal" : "aguardando_pagamento",
      createdAt: new Date().toISOString(),
      address: formatAddress(addr),
      events: [
        { at: new Date().toISOString(), text: `Reserva criada no ${lot.title}.` },
        {
          at: new Date().toISOString(),
          text: needsSinal
            ? "Aguardando confirmação do sinal via Pix."
            : "Aguardando confirmação do pagamento total via Pix.",
        },
      ],
      tracking: "",
    };
    try {
      const saved = await Store.createOrder(order);
      db.orders.unshift(saved);
      productsForLot(lot.id).forEach((p) => {
        if (orderQty(p.id) > 0) ui.orderQty[p.id] = 0;
      });
      closeModal();
      await openPixForOrder(saved.id, needsSinal ? "sinal" : "total", true);
    } catch (err) {
      toast(err.message || "Não foi possível salvar a reserva.", "error");
      button.disabled = false;
      button.innerHTML = `${ICONS.pix} ${needsSinal ? "Gerar Pix do sinal" : "Gerar Pix do total"}`;
    }
  });
}

async function openPixForOrder(orderId, kind, navigateAfter = true) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return;
  const isSinal = kind === "sinal";
  const amount = isSinal ? order.sinal : kind === "total" ? order.total : order.balance;
  const label = isSinal ? `Sinal · ${order.id}` : kind === "total" ? `Pagamento · ${order.id}` : `Saldo final · ${order.id}`;
  const description = `${label} · ${order.lotTitle}`;

  const manualPix = () => {
    const pix = pixConfig();
    if (!pix.key) {
      openModal({
        title: "Pix ainda não configurado",
        subtitle: "O organizador precisa ligar a integração com o Banco Inter.",
        body: `<p style="font-size:14.5px;line-height:1.7;color:var(--ink-soft)">
          A cobrança automática não está disponível e não há uma chave Pix manual cadastrada.
          Peça ao organizador para abrir o <strong>Painel Admin → Configurações → Pagamento</strong> e
          preencher a chave Pix ou as credenciais do Banco Inter.</p>`,
        foot: `<button class="btn btn-primary" data-close type="button">Entendi</button>`,
      });
      return;
    }
    const code = Pix.build({
      key: pix.key,
      merchant: pix.merchant,
      city: pix.city,
      amount,
      txid: order.id.replace(/-/g, ""),
    });
    openPixModal({
      amount,
      txid: order.id.replace(/-/g, ""),
      description,
      code,
      manual: true,
      orderId: order.id,
      kind,
      confirmLabel: "Já fiz o Pix",
      onPaid: async () => {
        await Store.notifyManualPayment(order.id, kind);
        if (navigateAfter) setTimeout(() => go("pedidos"), 400);
        return true;
      },
    });
  };

  // Modo manual escolhido no painel: não chama a API do Inter.
  if (settings().pixProvider === "manual") {
    manualPix();
    return;
  }

  try {
    const res = await Store.createPix(order.id, kind);
    if (res.ok && res.copiaECola) {
      openPixModal({
        amount: res.amount || amount,
        txid: res.txid,
        description,
        code: res.copiaECola,
        manual: false,
        orderId: order.id,
        kind,
        expiresAt: res.expiresAt,
        confirmLabel: "Já paguei · verificar",
      });
      return;
    }
    if (res.code === "PIX_NOT_CONFIGURED" || res.status === 503) {
      manualPix();
      return;
    }
    throw new Error(res.message || "Não foi possível gerar o Pix agora.");
  } catch (err) {
    console.warn("[pix]", err);
    manualPix();
  }
}

/* ---------------- home / catálogo ---------------- */

function renderOrderPage() {
  const user = currentUser();
  const openLots = db.lots.filter((l) => l.open);
  const lot = currentLot();
  if (!lot) {
    return `<div class="container"><div class="page-head"><div><span class="eyebrow">Catálogo</span><h1>Faça seu pedido</h1></div></div>
      <div class="empty"><div class="empty-icon">${ICONS.box}</div><h3>Nenhum lote aberto</h3><p>Quando o organizador abrir um novo rateio, o catálogo aparece aqui.</p></div></div>`;
  }

  const addr = mainAddress(user);
  const region = regionForUser(user);
  const shipping = region ? regionShipping(region) : 0;
  const t = orderTotals(lot);
  const products = productsForLot(lot.id);
  const size = boxSize();
  const unit = unitLabel();
  const sinalOn = sinalEnabled();

  return `
    <div class="container">
      <div class="page-head">
        <div>
          <span class="eyebrow">Lote aberto · fecha ${fmtDate(lot.closesAt)}</span>
          <h1>Faça seu pedido</h1>
          <p class="sub"><strong>${esc(lot.title)}</strong> — escolha os produtos, monte caixas de ${size} ${esc(unitLabel(true))} e pague ${sinalOn ? "o sinal" : "o total"} via Pix.</p>
        </div>
        <span class="pill pill-sage pill-dot">${openLots.length} compras abertas</span>
      </div>

      <div class="hero-strip">
        ${
          sinalOn
            ? `<div class="stat"><span class="stat-icon">${ICONS.pix}</span><div><strong>Sinal ${fmt(sinalPerUnit())}</strong><span>por ${esc(unit)} · abatido do total</span></div></div>`
            : `<div class="stat"><span class="stat-icon">${ICONS.pix}</span><div><strong>Sem sinal</strong><span>pagamento integral via Pix</span></div></div>`
        }
        <div class="stat"><span class="stat-icon">${ICONS.box}</span><div><strong>Caixa de ${size}</strong><span>${size} ${esc(unitLabel(true))} fecham o box</span></div></div>
        <div class="stat"><span class="stat-icon y">${ICONS.truck}</span><div><strong>Frete por região</strong><span>calculado pelo CEP</span></div></div>
        <div class="stat"><span class="stat-icon y">${ICONS.shield}</span><div><strong>Acesso aprovado</strong><span>grupo fechado de compras</span></div></div>
      </div>

      <div class="order-grid">
        <div>
          <div class="section-label">
            <span class="eyebrow">Compras abertas · ${openLots.length}</span>
            <span style="font-size:12.5px;color:var(--muted)">Escolha a marca certa antes de adicionar itens</span>
          </div>
          <div class="lot-notice">${ICONS.alert} Cada lote tem catálogo, preços e data de fechamento próprios. Ao trocar de compra, o carrinho do lote anterior é zerado.</div>
          <div class="lot-grid">
            ${openLots.map((l) => lotCardHTML(l, l.id === lot.id)).join("")}
          </div>

          <div class="catalog-head">
            <h2>Catálogo <span>· ${esc(lot.brand)}</span></h2>
            <span class="pill pill-mist" id="catalog-count">${filteredProducts(lot).length} produtos</span>
          </div>

          <div class="catalog-toolbar">
            <div class="search">
              ${ICONS.search}
              <input class="input" id="catalog-search" type="search" placeholder="Buscar por nome, marca ou modelo" value="${esc(ui.search)}" aria-label="Buscar produtos">
            </div>
            <div class="filter-chips">
              <button class="chip ${ui.filter === "todos" ? "active" : ""}" type="button" data-filter="todos">Todos</button>
              <button class="chip ${ui.filter === "quase" ? "active" : ""}" type="button" data-filter="quase">Quase fechando</button>
              <button class="chip ${ui.filter === "selecionados" ? "active" : ""}" type="button" data-filter="selecionados">Selecionados</button>
            </div>
          </div>

          <div class="product-list" id="catalog-products">
            ${filteredProducts(lot).map((p) => productCardHTML(p, lot)).join("")}
          </div>

          <div class="callout" style="margin-top:16px">
            <span class="ico">i</span>
            <span><strong>Como funciona a caixa:</strong> a cada ${size} ${esc(unitLabel(true))} do mesmo produto e modelo, uma caixa é fechada. Caixas completas são exclusivas e não dependem de outros participantes. Os avulsos entram no box compartilhado até completar ${size}.</span>
          </div>
        </div>

        <aside class="self-start">
          <div class="reserve-card">
            <div class="reserve-title"><span>Sua reserva</span><span class="dot"></span></div>
            <div class="region-box">
              <div class="region">
                <span>${region ? `${region} · ${addr ? esc(addr.state) : ""}` : "Região de entrega"}</span>
                <span class="pill">${region ? fmt(shipping) : "a calcular"}</span>
              </div>
              <div class="hint">
                ${
                  addr
                    ? `Entrega em ${esc(addr.city)}/${esc(addr.state)}. <a href="#/conta">Alterar endereço</a>`
                    : `Definida pelo CEP do endereço principal. <a href="#/conta">Cadastrar endereço</a>`
                }
              </div>
            </div>
            <div class="summary-rows">
              <div class="summary-row"><span>Subtotal (<span id="sum-count">${t.count}</span> itens)</span><strong id="sum-subtotal">${fmt(t.subtotal)}</strong></div>
              <div class="summary-row"><span>Frete regional</span><strong id="sum-shipping">${t.shipping ? fmt(t.shipping) : "a calcular"}</strong></div>
            </div>
            <div class="total-block">
              <div class="label">Total estimado</div>
              <div class="value" id="sum-total">${fmt(t.total)}</div>
            </div>
            <div class="pay-rows">
              ${
                sinalOn
                  ? `<div class="pay-row"><span>Sinal · <span id="sum-sinal-count">${t.count}</span> × ${fmt(sinalPerUnit())}</span><strong id="sum-sinal">${fmt(t.sinal)}</strong></div>
                     <div class="pay-row"><span>Pagar agora</span><strong id="sum-pay">${fmt(t.sinal)}</strong></div>
                     <div class="pay-row balance"><span>Saldo estimado com frete</span><span id="sum-balance">${fmt(t.balance)}</span></div>`
                  : `<div class="pay-row"><span>Sinal</span><strong id="sum-sinal">Não exigido</strong></div>
                     <div class="pay-row"><span>Pagar agora</span><strong id="sum-pay">${fmt(t.total)}</strong></div>
                     <div class="pay-row balance"><span>Saldo após o pagamento</span><span id="sum-balance">${fmt(0)}</span></div>`
              }
            </div>
            <button class="btn btn-accent btn-lg" id="reserve-btn" type="button" ${t.count ? "" : "disabled"}>
              ${sinalOn ? "Reservar e pagar sinal" : "Reservar e pagar total"} ${ICONS.arrow}
            </button>
            <p class="reserve-note">${
              sinalOn
                ? "O sinal é descontado do saldo final. A vaga só é confirmada depois do pagamento do Pix."
                : "O pagamento é integral via Pix. A vaga é confirmada assim que o valor total é pago."
            }</p>
          </div>
        </aside>
      </div>
    </div>

    <div class="mobile-bar">
      <div><div class="label"><span id="mobile-count">${t.count} itens</span> · total estimado</div><div class="value" id="mobile-total">${fmt(t.total)}</div></div>
      <button class="btn btn-accent" id="reserve-btn-mobile" type="button" ${t.count ? "" : "disabled"}>${sinalOn ? "Reservar sinal" : "Pagar total"}</button>
    </div>`;
}

function initOrderPage() {
  const lot = currentLot();
  if (!lot) return;

  $$(".lot-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (ui.selectedLotId === card.dataset.lot) return;
      ui.selectedLotId = card.dataset.lot;
      ui.search = "";
      ui.filter = "todos";
      window.renderRoute();
    });
  });

  const search = $("#catalog-search");
  if (search) {
    search.addEventListener("input", () => {
      ui.search = search.value;
      refreshCatalog(lot);
    });
  }

  $$("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.filter = btn.dataset.filter;
      $$("[data-filter]").forEach((b) => b.classList.toggle("active", b === btn));
      refreshCatalog(lot);
    });
  });

  const list = $("#catalog-products");
  if (list) {
    list.addEventListener("click", (e) => {
      const step = e.target.closest("[data-step]");
      if (step) {
        const id = step.dataset.pid;
        const delta = Number(step.dataset.step);
        ui.orderQty[id] = Math.max(0, Math.min(999, orderQty(id) + delta));
        refreshCatalog(lot);
        refreshOrderSummary(lot);
        return;
      }
      const box = e.target.closest("[data-box]");
      if (box) {
        const id = box.dataset.box;
        ui.orderQty[id] = Math.min(999, orderQty(id) + boxSize());
        refreshCatalog(lot);
        refreshOrderSummary(lot);
      }
    });
  }

  ["reserve-btn", "reserve-btn-mobile"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => openReservation(lot));
  });
}

/* ---------------- meus pedidos ---------------- */

function orderCardHTML(order) {
  const due =
    order.status === "saldo_liberado"
      ? order.balance
      : order.status === "aguardando_sinal"
      ? order.sinal
      : order.status === "aguardando_pagamento"
      ? order.total
      : 0;

  const lastCell =
    due > 0
      ? `<div class="order-total-cell highlight"><div class="k">${order.status === "aguardando_sinal" ? "Sinal agora" : "A pagar"}</div><div class="v">${fmt(due)}</div></div>`
      : `<div class="order-total-cell paid"><div class="k">${order.status === "entregue" ? "Total pago" : "Situação"}</div><div class="v">${order.status === "entregue" ? fmt(order.total) : (STATUS[order.status] || {}).label || "—"}</div></div>`;

  let actions = "";
  if (order.status === "aguardando_sinal") {
    actions += `<button class="btn btn-accent" type="button" data-pay="sinal" data-order="${order.id}">${ICONS.pix} Pagar sinal ${fmt(order.sinal)}</button>`;
  }
  if (order.status === "saldo_liberado") {
    actions += `<button class="btn btn-primary" type="button" data-pay="saldo" data-order="${order.id}">${ICONS.pix} Pagar saldo ${fmt(order.balance)}</button>`;
  }
  if (order.status === "aguardando_pagamento") {
    actions += `<button class="btn btn-primary" type="button" data-pay="total" data-order="${order.id}">${ICONS.pix} Pagar ${fmt(order.total)}</button>`;
  }
  if (order.status === "sinal_pago") {
    actions += `<button class="btn btn-soft" type="button" disabled>${ICONS.clock} Aguardando fechamento</button>`;
  }
  if (order.status === "aguardando_confirmacao") {
    actions += `<button class="btn btn-soft" type="button" disabled>${ICONS.clock} Aguardando conferência do organizador</button>`;
  }
  if (order.status === "enviado" || order.status === "entregue" || order.status === "pago") {
    actions += `<button class="btn btn-soft" type="button" data-reorder="1">${ICONS.bag} Comprar novamente</button>`;
  }
  actions += `<a class="btn btn-ghost" href="#/guia">Como funciona</a>`;

  return `
    <article class="order-card">
      <div class="order-top">
        <div>
          <div class="order-id">${esc(order.id)}</div>
          <div class="order-lot">${esc(order.lotTitle || "Pronta entrega")}</div>
          <div class="order-date">Criado em ${fmtDateTime(order.createdAt)} · ${order.items.reduce((s, i) => s + i.qty, 0)} ${order.items.reduce((s, i) => s + i.qty, 0) === 1 ? "unidade" : "unidades"}</div>
        </div>
        ${statusPill(order.status)}
      </div>
      <div class="order-body">
        <div class="order-items">
          ${order.items
            .map(
              (i) => `<div class="order-item">
                <span class="n"><strong>${esc(i.name)} ${esc(i.specs || i.mg || "")}</strong> · ${i.qty} × ${fmt(i.price)}</span>
                <span class="p">${fmt(i.price * i.qty)}</span>
              </div>`
            )
            .join("")}
        </div>
        <div class="order-totals">
          <div class="order-total-cell"><div class="k">Subtotal</div><div class="v">${fmt(order.subtotal)}</div></div>
          <div class="order-total-cell"><div class="k">Frete</div><div class="v">${fmt(order.shipping)}</div></div>
          <div class="order-total-cell"><div class="k">Sinal</div><div class="v">${fmt(order.sinal)}</div></div>
          ${lastCell}
        </div>
        <div class="order-actions">${actions}</div>
      </div>
      <details class="order-timeline">
        <summary>Histórico e rastreio <span class="chev">${ICONS.chevron}</span></summary>
        <div class="timeline">
          ${(order.events || [])
            .slice()
            .reverse()
            .map(
              (ev) => `<div class="timeline-item done">
                <div><div class="t">${fmtDateTime(ev.at)}</div><div class="d">${esc(ev.text)}</div></div>
              </div>`
            )
            .join("")}
        </div>
        ${order.tracking ? `<div class="tracking-box"><span>Código de rastreio</span><code>${esc(order.tracking)}</code></div>` : ""}
      </details>
    </article>`;
}

function renderOrdersPage() {
  const user = currentUser();
  const orders = db.orders
    .filter((o) => o.userId === user.id)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return `
    <div class="container">
      <div class="page-head">
        <div>
          <span class="eyebrow">Histórico da conta</span>
          <h1>Meus pedidos</h1>
          <p class="sub">Acompanhe o sinal, o fechamento das caixas, o saldo final e o envio de cada reserva.</p>
        </div>
        <span class="pill pill-mist">${orders.length} no total</span>
      </div>
      ${
        orders.length
          ? `<div class="orders-list">${orders.map(orderCardHTML).join("")}</div>`
          : `<div class="empty">
              <div class="empty-icon">${ICONS.bag}</div>
              <h3>Você ainda não tem pedidos</h3>
              <p>Escolha um lote aberto, monte sua reserva e pague o sinal via Pix para garantir a vaga.</p>
              <a class="btn btn-primary" href="#/pedido">Fazer meu primeiro pedido ${ICONS.arrow}</a>
            </div>`
      }
    </div>`;
}

function initOrdersPage() {
  $$("[data-pay]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openPixForOrder(btn.dataset.order, btn.dataset.pay);
    });
  });
  $$("[data-reorder]").forEach((btn) => {
    btn.addEventListener("click", () => go("pedido"));
  });
}
