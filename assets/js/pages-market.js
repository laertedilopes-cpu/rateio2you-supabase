/* =========================================================
   rateio2you — leilão e pronta entrega
   ========================================================= */

function auctionState(a) {
  const user = currentUser();
  const bids = db.bids
    .filter((b) => b.auctionId === a.id)
    .slice()
    .sort((x, y) => y.amount - x.amount);
  const top = bids[0] || null;
  const current = top ? top.amount : a.startBid;
  const min = current + a.increment;
  const ended = Date.now() >= new Date(a.endsAt).getTime();
  const leading = !!(top && user && top.userId === user.id);
  return { top, current, min, ended, leading };
}

function auctionCardHTML(a) {
  const st = auctionState(a);
  const left = new Date(a.endsAt).getTime() - Date.now();
  return `
    <article class="auction-card">
      <div class="auction-cover">
        <div class="thumb">${productImageHTML(a, { tone: "#5580d7", label: a.specs || "Watch" })}</div>
        <div class="auction-timer">
          <div class="k">${st.ended ? "Encerrado" : "Termina em"}</div>
          <div class="v" data-deadline="${new Date(a.endsAt).getTime()}">${st.ended ? "Encerrado" : fmtCountdown(left)}</div>
        </div>
      </div>
      <div class="auction-body">
        <h2>${esc(a.title)}</h2>
        <p class="auction-origin">${esc(a.origin)}</p>
        ${a.specs ? `<div class="product-brand" style="margin-top:6px">${esc(a.specs)}</div>` : ""}
        ${a.description ? `<p class="product-desc" style="margin:6px 0 0">${esc(a.description)}</p>` : ""}
        <div class="auction-bid-row">
          <div>
            <div class="k">${st.top ? "Lance atual" : "Lance inicial"}</div>
            <div class="v">${fmt(st.current)}</div>
          </div>
          <div style="text-align:right">
            <div class="k">Incremento</div>
            <div style="font-size:14px;font-weight:800;color:var(--olive);margin-top:3px">+ ${fmt(a.increment)}</div>
          </div>
        </div>
        ${st.leading ? `<span class="winning">${ICONS.check} Você está na frente</span>` : ""}
        ${
          st.ended
            ? `<div class="auction-meta"><span>${a.paidAt ? "Arremate concluído" : st.leading ? "Arremate seu lote" : "Leilão encerrado"}</span><span>${st.top ? "1 lance vencedor" : "Sem lances"}</span></div>
               ${st.leading && !a.paidAt ? `<button class="btn btn-primary" style="margin-top:10px" type="button" data-auction-pay="${a.id}">${ICONS.pix} Pagar arremate ${fmt(st.current)}</button>` : ""}
               ${a.paidAt ? `<span class="winning" style="margin-top:10px">${ICONS.check} Pagamento do arremate confirmado</span>` : ""}`
            : `<div class="bid-box">
                <input class="input" id="bid-${a.id}" type="number" inputmode="decimal" min="${st.min}" step="${a.increment}" placeholder="Mín. ${fmt(st.min)}" aria-label="Seu lance para ${esc(a.title)}">
                <button class="btn btn-accent" type="button" data-bid="${a.id}">Dar lance</button>
              </div>
              <div class="auction-meta"><span>Lance mínimo: <strong>${fmt(st.min)}</strong></span><span>${st.top ? `Último lance ${fmtDateTime(st.top.at)}` : "Seja o primeiro"}</span></div>`
        }
      </div>
    </article>`;
}

function renderAuctionPage() {
  return `
    <div class="container">
      <div class="page-head">
        <div>
          <span class="eyebrow">Oportunidades do grupo</span>
          <h1>Leilão</h1>
          <p class="sub">Itens remanescentes de pedidos não quitados. Dê um lance acima do mínimo; o maior lance válido leva o lote.</p>
        </div>
        <span class="pill pill-yellow">${db.auctions.length} lotes</span>
      </div>

      <div class="callout" style="margin-bottom:16px">
        <span class="ico">${ICONS.gavel}</span>
        <span><strong>Como participar:</strong> escolha um lote e informe um lance de no mínimo o valor atual + incremento. O vencedor recebe uma cobrança Pix do arremate e o item entra no histórico de pedidos.</span>
      </div>

      <div class="auction-grid">
        ${db.auctions.map(auctionCardHTML).join("")}
      </div>
    </div>`;
}

function initAuctionPage() {
  $$("[data-bid]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.bid;
      const auction = db.auctions.find((a) => a.id === id);
      if (!auction) return;
      const st = auctionState(auction);
      if (st.ended) {
        toast("Este leilão já foi encerrado.", "error");
        return;
      }
      const input = document.getElementById(`bid-${id}`);
      const value = Math.round(Number(input.value) * 100) / 100;
      if (!value || value < st.min) {
        toast(`O lance mínimo é ${fmt(st.min)}.`, "error");
        input.focus();
        return;
      }
      btn.disabled = true;
      try {
        const bid = await Store.createBid(id, value);
        db.bids.unshift(bid);
        auction.topBid = value;
        toast(`Lance de ${fmt(value)} registrado.`);
        // Recarrega para receber o top_bid atualizado pelo banco.
        db = await Store.loadSnapshot();
        applyTheme();
        window.renderRoute();
      } catch (err) {
        toast(err.message || "Não foi possível registrar o lance.", "error");
        btn.disabled = false;
      }
    });
  });

  $$("[data-auction-pay]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const auction = db.auctions.find((a) => a.id === btn.dataset.auctionPay);
      if (!auction) return;
      const st = auctionState(auction);
      if (!st.leading) {
        toast("Este arremate não está na sua conta.", "error");
        return;
      }
      if (auction.paidAt) {
        toast("O pagamento deste arremate já foi confirmado.", "error");
        return;
      }
      const user = currentUser();
      const pending = db.orders.find(
        (o) => o.type === "leilao" && o.auctionId === auction.id && o.userId === user.id && (o.status === "aguardando_pagamento" || o.status === "aguardando_confirmacao")
      );
      if (pending) {
        await openPixForOrder(pending.id, "total");
        return;
      }
      const addr = mainAddress(user);
      if (!addr) {
        toast("Cadastre um endereço principal antes de pagar o arremate.", "error");
        go("conta");
        return;
      }
      btn.disabled = true;
      const order = {
        id: nextOrderId(),
        userId: user.id,
        type: "leilao",
        auctionId: auction.id,
        lotId: "",
        lotTitle: `Leilão · ${auction.title}`,
        items: [{ productId: "", name: auction.title, specs: auction.specs || "", qty: 1, price: st.current }],
        subtotal: st.current,
        shipping: 0,
        sinal: 0,
        total: st.current,
        balance: 0,
        status: "aguardando_pagamento",
        createdAt: new Date().toISOString(),
        address: formatAddress(addr),
        events: [
          { at: new Date().toISOString(), text: `Arremate do leilão “${auction.title}”.` },
          { at: new Date().toISOString(), text: "Aguardando pagamento do arremate via Pix." },
        ],
        tracking: "",
      };
      try {
        const saved = await Store.createOrder(order);
        db.orders.unshift(saved);
        await openPixForOrder(saved.id, "total");
      } catch (err) {
        btn.disabled = false;
        toast(err.message || "Não foi possível criar a cobrança do arremate.", "error");
      }
    });
  });
}

/* ---------------- pronta entrega ---------------- */

function renderStockPage() {
  const user = currentUser();
  const cart = cartForUser(user);
  const count = cartCount(user);
  const total = cartTotal(user);

  return `
    <div class="container">
      <div class="page-head">
        <div>
          <span class="eyebrow">Estoque no Brasil</span>
          <h1>Pronta entrega</h1>
          <p class="sub">Itens já disponíveis para envio. Adicione ao carrinho e pague tudo em um único Pix. Quando o estoque acaba, o produto sai da lista.</p>
        </div>
        <span class="pill pill-sage pill-dot">${db.stock.filter((s) => s.qty > 0 && s.active !== false).length} disponíveis</span>
      </div>

      <div class="callout" style="margin-bottom:16px">
        <span class="ico">${ICONS.truck}</span>
        <span><strong>Envio imediato após o Pix:</strong> os itens ficam reservados no carrinho por 30 minutos. O frete é calculado pela região do seu endereço principal e aparece antes do pagamento.</span>
      </div>

      ${
        db.stock.some((s) => s.qty > 0 && s.active !== false)
          ? `<div class="stock-grid">
              ${db.stock
                .filter((s) => s.qty > 0 && s.active !== false)
                .map((s) => {
                  const qty = ui.cartQty[s.id] || 1;
                  const inCart = cart.filter((i) => i.stockId === s.id).reduce((n, i) => n + i.qty, 0);
                  const available = s.qty - inCart;
                  return `<article class="stock-card">
                    <div class="stock-top">
                      <div class="stock-thumb">${productImageHTML(s, { tone: "#93a5bd", label: s.specs || "Watch" })}</div>
                      <div style="min-width:0">
                        <div class="stock-brand">${esc(s.brand || s.lot || "")}</div>
                        <div class="stock-name">${esc(s.name)} <span style="color:var(--muted);font-weight:600;font-size:13px">${esc(s.specs || s.mg || "")}</span></div>
                        <div class="stock-lot">${esc(s.lot)}</div>
                        ${s.description ? `<p class="product-desc" style="margin-top:4px">${esc(s.description)}</p>` : ""}
                        <div class="stock-price">${fmt(s.price)}</div>
                      </div>
                    </div>
                    <div class="stock-foot">
                      <span class="stock-qty">${s.qty <= 2 ? "<strong>Últimas unidades</strong>" : `${s.qty} em estoque`}${inCart ? ` · ${inCart} no carrinho` : ""}</span>
                      <div class="stepper">
                        <button type="button" data-stock-step="-1" data-sid="${s.id}" aria-label="Diminuir">−</button>
                        <span class="qty">${qty}</span>
                        <button type="button" data-stock-step="1" data-sid="${s.id}" aria-label="Aumentar">+</button>
                      </div>
                    </div>
                    <button class="btn ${available <= 0 ? "btn-ghost" : "btn-primary"}" type="button" data-add-cart="${s.id}" ${available <= 0 ? "disabled" : ""}>
                      ${available <= 0 ? "Esgotado no carrinho" : `${ICONS.bag} Adicionar ao carrinho`}
                    </button>
                  </article>`;
                })
                .join("")}
            </div>`
          : `<div class="empty">
              <div class="empty-icon">${ICONS.box}</div>
              <h3>Nenhum item disponível</h3>
              <p>O estoque de pronta entrega está vazio agora. Volte depois ou acompanhe os lotes abertos.</p>
              <a class="btn btn-primary" href="#/pedido">Ver lotes abertos</a>
            </div>`
      }
    </div>

    ${
      count > 0
        ? `<div class="cart-bar">
            <span class="stat-icon" style="background:rgba(255, 226, 122,.15);color:var(--yellow)">${ICONS.bag}</span>
            <div class="cart-info">
              <div class="k"><span id="cart-bar-count">${count}</span> ${count === 1 ? "item reservado" : "itens reservados"}</div>
              <div class="v">Total <strong id="cart-bar-total">${fmt(total)}</strong> + frete</div>
            </div>
            <button class="btn btn-accent" type="button" id="open-cart">Abrir carrinho ${ICONS.arrow}</button>
          </div>`
        : ""
    }`;
}

function refreshCartBar(user) {
  const count = cartCount(user);
  const total = cartTotal(user);
  const c = document.getElementById("cart-bar-count");
  const t = document.getElementById("cart-bar-total");
  if (c) c.textContent = count;
  if (t) t.textContent = fmt(total);
}

function renderCartModal(user) {
  const cart = cartForUser(user);
  const items = cart
    .map((i) => {
      const s = db.stock.find((x) => x.id === i.stockId);
      return s ? { ...i, stock: s } : null;
    })
    .filter(Boolean);

  if (!items.length) {
    closeModal();
    window.renderRoute();
    return;
  }

  const subtotal = items.reduce((sum, i) => sum + i.stock.price * i.qty, 0);
  const shipping = shippingForUser(user);
  const total = subtotal + shipping;
  const addr = mainAddress(user);

  openModal({
    title: "Seu carrinho",
    subtitle: "Itens de pronta entrega reservados por 30 minutos.",
    wide: true,
    body: `
      <div class="cart-list">
        ${items
          .map(
            (i) => `<div class="cart-item">
              <div class="thumb">${productImageHTML(i.stock, { tone: "#93a5bd", label: i.stock.specs || "Watch" })}</div>
              <div style="min-width:0">
                <div class="n">${esc(i.stock.name)} ${esc(i.stock.specs || i.stock.mg || "")}</div>
                <div class="m">${fmt(i.stock.price)} cada · ${i.stock.qty} em estoque</div>
                <div class="stepper" style="height:26px;margin-top:5px">
                  <button type="button" data-cart-step="-1" data-cid="${i.stockId}" aria-label="Diminuir">−</button>
                  <span class="qty" style="min-width:22px">${i.qty}</span>
                  <button type="button" data-cart-step="1" data-cid="${i.stockId}" aria-label="Aumentar">+</button>
                </div>
              </div>
              <div style="text-align:right">
                <div class="p">${fmt(i.stock.price * i.qty)}</div>
                <button class="cart-remove" type="button" data-cart-remove="${i.stockId}">Remover</button>
              </div>
            </div>`
          )
          .join("")}
      </div>
      <div class="confirm-totals">
        <div><span>Subtotal</span><strong>${fmt(subtotal)}</strong></div>
        <div><span>Frete (${regionForUser(user) || "região não definida"})</span><strong>${shipping ? fmt(shipping) : "—"}</strong></div>
        <div class="big"><span>Total com frete</span><strong>${fmt(total)}</strong></div>
      </div>
      <div class="region-box" style="margin-top:12px;background:var(--mist);border:1px solid var(--line)">
        <div class="region" style="color:var(--olive-deep)">${ICONS.pin} ${addr ? esc(addr.city + "/" + addr.state) : "Endereço não cadastrado"}</div>
        <div class="hint" style="color:var(--muted)">${esc(addr ? formatAddress(addr) : "Cadastre um endereço principal em Minha conta.")}</div>
      </div>
      <p style="margin-top:10px;font-size:12.5px;color:var(--muted);line-height:1.5">O pagamento é feito em um único Pix, já com o frete. Após a confirmação, o estoque é baixado e o pedido entra em separação.</p>`,
    foot: `<button class="btn btn-ghost" data-close type="button">Continuar comprando</button>
           <button class="btn btn-primary" id="checkout-cart" type="button">${ICONS.pix} Pagar ${fmt(total)} via Pix</button>`,
  });

  $$("[data-cart-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cid = btn.dataset.cid;
      const delta = Number(btn.dataset.cartStep);
      const item = cart.find((i) => i.stockId === cid);
      const stock = db.stock.find((s) => s.id === cid);
      if (!item || !stock) return;
      item.qty = Math.max(1, Math.min(stock.qty, item.qty + delta));
      saveDB();
      refreshCartBar(user);
      renderCartModal(user);
    });
  });

  $$("[data-cart-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cid = btn.dataset.cartRemove;
      const index = cart.findIndex((i) => i.stockId === cid);
      if (index >= 0) cart.splice(index, 1);
      saveDB();
      if (!cart.length) {
        closeModal();
        toast("Carrinho vazio.");
        window.renderRoute();
        return;
      }
      refreshCartBar(user);
      renderCartModal(user);
    });
  });

  $("#checkout-cart").addEventListener("click", async () => {
    if (!addr) {
      closeModal();
      toast("Cadastre um endereço principal antes de pagar.", "error");
      go("conta");
      return;
    }
    const button = $("#checkout-cart");
    button.disabled = true;
    button.textContent = "Criando pedido...";
    const order = {
      id: nextOrderId(),
      userId: user.id,
      type: "estoque",
      lotId: "",
      lotTitle: "Pronta entrega",
      items: items.map((i) => ({
        productId: i.stockId,
        name: i.stock.name,
        specs: i.stock.specs || i.stock.mg || "",
        qty: i.qty,
        price: i.stock.price,
      })),
      subtotal,
      shipping,
      sinal: 0,
      total,
      balance: 0,
      status: "aguardando_pagamento",
      stockApplied: false,
      createdAt: new Date().toISOString(),
      address: formatAddress(addr),
      events: [
        { at: new Date().toISOString(), text: "Pedido de pronta entrega criado." },
        { at: new Date().toISOString(), text: "Aguardando pagamento via Pix." },
      ],
      tracking: "",
    };
    try {
      const saved = await Store.createOrder(order);
      db.orders.unshift(saved);
      db.carts[user.id] = [];
      saveDB();
      closeModal();
      toast("Pedido salvo. Agora é só pagar o Pix.");
      await openPixForOrder(saved.id, "total");
    } catch (err) {
      toast(err.message || "Não foi possível criar o pedido.", "error");
      button.disabled = false;
      button.innerHTML = `${ICONS.pix} Pagar ${fmt(total)} via Pix`;
    }
  });
}

function initStockPage() {
  const user = currentUser();

  $$("[data-stock-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sid = btn.dataset.sid;
      const delta = Number(btn.dataset.stockStep);
      const stock = db.stock.find((s) => s.id === sid);
      ui.cartQty[sid] = Math.max(1, Math.min(stock.qty, (ui.cartQty[sid] || 1) + delta));
      window.renderRoute();
    });
  });

  $$("[data-add-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sid = btn.dataset.addCart;
      const stock = db.stock.find((s) => s.id === sid);
      const cart = cartForUser(user);
      const already = cart.filter((i) => i.stockId === sid).reduce((n, i) => n + i.qty, 0);
      const qty = Math.min(ui.cartQty[sid] || 1, stock.qty - already);
      if (qty <= 0) {
        toast("Não há mais unidades disponíveis deste item.", "error");
        return;
      }
      const existing = cart.find((i) => i.stockId === sid);
      if (existing) existing.qty += qty;
      else cart.push({ stockId: sid, qty });
      ui.cartQty[sid] = 1;
      saveDB();
      toast(`${qty} ${qty === 1 ? "unidade adicionada" : "unidades adicionadas"} ao carrinho.`);
      window.renderRoute();
    });
  });

  const open = $("#open-cart");
  if (open) open.addEventListener("click", () => renderCartModal(user));
}
