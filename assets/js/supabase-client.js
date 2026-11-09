/* =========================================================
   rateio2you — camada de dados (Supabase)
   ---------------------------------------------------------
   Todo o site lê e grava aqui. Nenhum dado de produto, pedido
   ou cliente fica apenas no navegador.
   ========================================================= */

const Store = (() => {
  const cfg = window.LOJA_CONFIG || {};
  const url = String(cfg.SUPABASE_URL || "").trim();
  const anon = String(cfg.SUPABASE_ANON_KEY || "").trim();
  const configured =
    /^https:\/\/.+\.supabase\.co\/?$/i.test(url) &&
    anon.length > 40 &&
    !/COLE_AQUI/i.test(anon);

  let client = null;
  let realtime = null;

  class SetupError extends Error {
    constructor(message) {
      super(message);
      this.name = "SetupError";
    }
  }

  function requireConfig() {
    if (!configured) {
      throw new SetupError(
        "O arquivo assets/js/config.js ainda não foi preenchido com a URL e a chave do Supabase."
      );
    }
  }

  function init() {
    requireConfig();
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) {
      throw new SetupError("A biblioteca do Supabase não carregou. Verifique sua internet e recarregue a página.");
    }
    client = window.supabase.createClient(url.replace(/\/$/, ""), anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "rateio2you-auth",
      },
      realtime: { params: { eventsPerSecond: 5 } },
    });
    return client;
  }

  const db = () => {
    if (!client) init();
    return client;
  };

  function fail(error, fallback = "Não foi possível concluir a operação.") {
    if (!error) return;
    console.error("[rateio2you]", error);
    const message = error.message || error.error_description || error.hint || fallback;
    throw new Error(message);
  }

  function table(name) {
    return db().from(name);
  }

  /* ---------------- autenticação ---------------- */

  async function session() {
    const { data, error } = await db().auth.getSession();
    if (error) fail(error, "Sessão indisponível.");
    return data.session || null;
  }

  async function signIn(email, password) {
    const { data, error } = await db().auth.signInWithPassword({ email, password });
    if (error) {
      const msg = /invalid login/i.test(error.message)
        ? "E-mail ou senha incorretos."
        : /email not confirmed/i.test(error.message)
        ? "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."
        : error.message;
      throw new Error(msg);
    }

    /* Se o organizador ligou a aprovação automática, o próprio banco
       libera o cadastro pendente neste primeiro login. */
    await autoApproveMe();
    let profile = await getProfile(data.user.id);

    if (!profile) {
      await db().auth.signOut();
      throw new Error("Cadastro não encontrado. Fale com o organizador do grupo.");
    }
    if (profile.status === "pendente" && profile.role !== "admin") {
      await db().auth.signOut();
      throw new Error("Seu cadastro ainda aguarda a liberação do organizador.");
    }
    if (profile.status === "bloqueado") {
      await db().auth.signOut();
      throw new Error("Este acesso está bloqueado. Fale com o organizador do grupo.");
    }
    return profile;
  }

  async function signUp({ name, email, password }) {
    const { data, error } = await db().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      const msg = /already registered|already exists/i.test(error.message)
        ? "Já existe uma conta com este e-mail."
        : error.message;
      throw new Error(msg);
    }

    // Com a confirmação de e-mail desligada no Supabase, a sessão já vem
    // criada. Aproveitamos para aplicar a aprovação automática, se estiver
    // ligada no painel. Caso contrário, encerramos a sessão e mostramos a
    // tela "aguardando liberação".
    if (data.session) {
      await autoApproveMe();
      const profile = await getProfile(data.user.id);
      if (profile && profile.status === "ativo") {
        return { autoApproved: true, needsConfirmation: false, user: data.user };
      }
      await db().auth.signOut();
      return { autoApproved: false, needsConfirmation: false, user: data.user };
    }

    return { autoApproved: false, needsConfirmation: true, user: data.user };
  }

  async function autoApproveMe() {
    try {
      // Sem sessão não há o que aprovar (evita erro 400 no console).
      if (!(await session())) return;
      const { error } = await db().rpc("auto_approve_me");
      if (error && !/does not exist|schema cache/i.test(error.message || "")) {
        console.warn("[rateio2you] auto_approve_me:", error.message);
      }
    } catch (e) {
      console.warn("[rateio2you] auto_approve_me:", e.message);
    }
  }

  async function signOut() {
    await db().auth.signOut();
  }

  async function getProfile(id) {
    const { data, error } = await table("profiles").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "Não foi possível carregar seu perfil.");
    return data ? mapProfile(data) : null;
  }

  async function getAddresses(userId) {
    const { data, error } = await table("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("principal", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) fail(error, "Não foi possível carregar os endereços.");
    return (data || []).map(mapAddress);
  }

  /* ---------------- leitura da loja ---------------- */

  async function loadSnapshot({ admin = false } = {}) {
    const s = await session();
    let me = null;
    let addresses = [];
    let users = [];
    let orders = [];
    let payments = [];

    if (s) {
      const profile = await getProfile(s.user.id);
      if (profile) {
        addresses = await getAddresses(s.user.id);
        me = { ...profile, addresses };
      }
    }

    const isAdmin = !!(me && me.role === "admin");

    const [settingsRes, lotsRes, productsRes, stockRes, auctionsRes] = await Promise.all([
      table("settings").select("data").eq("id", 1).maybeSingle(),
      table("lots").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      table("products").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      table("stock_items").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      table("auctions").select("*").order("created_at", { ascending: true }),
    ]);

    // "bids" não é liberada para visitantes (só para usuários logados).
    const bidsRes = s
      ? await table("bids").select("*").order("created_at", { ascending: false })
      : { data: [], error: null };

    const firstError = [settingsRes, lotsRes, productsRes, stockRes, auctionsRes, bidsRes].find((r) => r.error);
    if (firstError) {
      const msg = firstError.error.message || "";
      if (/does not exist|schema cache/i.test(msg)) {
        throw new SetupError(
          "As tabelas ainda não foram criadas no Supabase. Rode o arquivo supabase/01-schema.sql no SQL Editor."
        );
      }
      fail(firstError.error, "Não foi possível carregar a loja.");
    }

    if (s) {
      if (isAdmin) {
        const [profilesRes, addressesRes, ordersRes, paymentsRes] = await Promise.all([
          table("profiles").select("*").order("created_at", { ascending: false }),
          table("addresses").select("*"),
          table("orders").select("*").order("created_at", { ascending: false }),
          table("payments").select("*").order("created_at", { ascending: false }),
        ]);
        if (profilesRes.error) fail(profilesRes.error);
        if (addressesRes.error) fail(addressesRes.error);
        if (ordersRes.error) fail(ordersRes.error);
        if (paymentsRes.error) fail(paymentsRes.error);

        const byUser = new Map();
        (addressesRes.data || []).map(mapAddress).forEach((a) => {
          if (!byUser.has(a.userId)) byUser.set(a.userId, []);
          byUser.get(a.userId).push(a);
        });
        users = (profilesRes.data || []).map((row) => {
          const p = mapProfile(row);
          p.addresses = byUser.get(p.id) || [];
          return p;
        });
        orders = (ordersRes.data || []).map(mapOrder);
        payments = (paymentsRes.data || []).map(mapPayment);
        me = users.find((u) => u.id === s.user.id) || me;
      } else {
        const ordersRes = await table("orders")
          .select("*")
          .eq("user_id", s.user.id)
          .order("created_at", { ascending: false });
        if (ordersRes.error) fail(ordersRes.error);
        orders = (ordersRes.data || []).map(mapOrder);
        users = me ? [me] : [];
        const ids = orders.map((o) => o.id);
        if (ids.length) {
          const payRes = await table("payments").select("*").in("order_id", ids);
          if (!payRes.error) payments = (payRes.data || []).map(mapPayment);
        }
      }
    }

    const snapshot = {
      version: 3,
      settings: settingsRes.data && settingsRes.data.data ? settingsRes.data.data : R2Y.defaultSettings(),
      lots: (lotsRes.data || []).map(mapLot).filter((l) => admin || l.active !== false),
      products: (productsRes.data || []).map(mapProduct).filter((p) => admin || p.active !== false),
      stock: (stockRes.data || []).map(mapStock).filter((s) => admin || s.active !== false),
      auctions: (auctionsRes.data || []).map(mapAuction).filter((a) => admin || a.active !== false),
      bids: (bidsRes.data || []).map(mapBid),
      users,
      orders,
      payments,
      carts: {},
      me,
    };
    return R2Y.normalize(snapshot);
  }

  /* ---------------- perfil e endereços ---------------- */

  async function updateProfile(patch) {
    const s = await session();
    if (!s) throw new Error("Entre na sua conta para salvar.");
    const row = {};
    if (patch.name !== undefined) row.full_name = patch.name;
    if (patch.cpf !== undefined) row.cpf = patch.cpf;
    if (patch.whatsapp !== undefined) row.whatsapp = patch.whatsapp;
    if (patch.phone2 !== undefined) row.phone2 = patch.phone2;
    row.updated_at = new Date().toISOString();
    const { data, error } = await table("profiles").update(row).eq("id", s.user.id).select("*").single();
    if (error) fail(error, "Não foi possível salvar seus dados.");
    return mapProfile(data);
  }

  async function saveAddress(address, currentAddresses = []) {
    const s = await session();
    if (!s) throw new Error("Entre na sua conta para salvar o endereço.");
    const row = {
      user_id: s.user.id,
      label: address.label || "Endereço",
      cep: address.cep || "",
      street: address.street || "",
      number: address.number || "",
      complement: address.complement || "",
      district: address.district || "",
      city: address.city || "",
      state: address.state || "",
      notes: address.notes || "",
      principal: !!address.principal,
    };
    if (address.principal) {
      await table("addresses").update({ principal: false }).eq("user_id", s.user.id);
    }
    if (address.id) {
      const { data, error } = await table("addresses").update(row).eq("id", address.id).eq("user_id", s.user.id).select("*").single();
      if (error) fail(error, "Não foi possível salvar o endereço.");
      return mapAddress(data);
    }
    const { data, error } = await table("addresses").insert(row).select("*").single();
    if (error) fail(error, "Não foi possível salvar o endereço.");
    if (currentAddresses.length === 0 && !data.principal) {
      await table("addresses").update({ principal: true }).eq("id", data.id);
      data.principal = true;
    }
    return mapAddress(data);
  }

  async function deleteAddress(id) {
    const { error } = await table("addresses").delete().eq("id", id);
    if (error) fail(error, "Não foi possível remover o endereço.");
  }

  async function setPrincipalAddress(id) {
    const s = await session();
    if (!s) throw new Error("Entre na sua conta.");
    const off = await table("addresses").update({ principal: false }).eq("user_id", s.user.id);
    if (off.error) fail(off.error);
    const on = await table("addresses").update({ principal: true }).eq("id", id).eq("user_id", s.user.id);
    if (on.error) fail(on.error, "Não foi possível definir o endereço principal.");
  }

  /* ---------------- pedidos, lances e pagamentos ---------------- */

  async function createOrder(order) {
    const s = await session();
    if (!s) throw new Error("Entre na sua conta para finalizar o pedido.");
    const row = mapOrderToRow({ ...order, userId: s.user.id });
    const { data, error } = await table("orders").insert(row).select("*").single();
    if (error) fail(error, "Não foi possível criar o pedido.");
    return mapOrder(data);
  }

  async function updateOrder(id, patch) {
    const row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.tracking !== undefined) row.tracking = patch.tracking;
    if (patch.events !== undefined) row.events = patch.events;
    if (patch.balance !== undefined) row.balance = patch.balance;
    if (patch.paidAt !== undefined) row.paid_at = patch.paidAt;
    row.updated_at = new Date().toISOString();
    const { data, error } = await table("orders").update(row).eq("id", id).select("*").single();
    if (error) fail(error, "Não foi possível atualizar o pedido.");
    return mapOrder(data);
  }

  async function deleteOrder(id) {
    const { error } = await table("orders").delete().eq("id", id);
    if (error) fail(error, "Não foi possível excluir o pedido.");
  }

  async function createBid(auctionId, amount) {
    const s = await session();
    if (!s) throw new Error("Entre na sua conta para dar um lance.");
    const { data, error } = await table("bids")
      .insert({ auction_id: auctionId, user_id: s.user.id, amount })
      .select("*")
      .single();
    if (error) fail(error, error.message || "Não foi possível registrar o lance.");
    return mapBid(data);
  }

  function apiBase() {
    return String(cfg.PIX_API_BASE || "").replace(/\/$/, "");
  }

  async function apiCall(path, options = {}) {
    const s = await session();
    if (!s) throw new Error("Entre na sua conta para pagar.");
    const res = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${s.access_token}`,
        ...(options.headers || {}),
      },
    });
    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      json = { ok: false, message: "Resposta inválida do servidor de pagamento." };
    }
    return { status: res.status, ...json, ok: res.ok && json.ok !== false };
  }

  async function createPix(orderId, kind) {
    return apiCall("/api/pix/create", {
      method: "POST",
      body: JSON.stringify({ orderId, kind }),
    });
  }

  async function pixStatus(orderId, kind, txid) {
    return apiCall("/api/pix/status", {
      method: "POST",
      body: JSON.stringify({ orderId, kind, txid }),
    });
  }

  async function notifyManualPayment(orderId, kind) {
    const { error } = await db().rpc("notify_manual_payment", {
      p_order_id: orderId,
      p_kind: kind,
    });
    if (error) fail(error, "Não foi possível registrar o aviso de pagamento.");
  }

  async function adminConfirmPayment(orderId, kind, amount) {
    await requireAdmin();
    const { error } = await db().rpc("admin_confirm_payment", {
      p_order_id: orderId,
      p_kind: kind,
      p_amount: amount == null ? null : Number(amount),
    });
    if (error) fail(error, "Não foi possível confirmar o pagamento.");
  }

  async function adminReleaseBalance(orderId) {
    await requireAdmin();
    const { error } = await db().rpc("admin_release_balance", { p_order_id: orderId });
    if (error) fail(error, "Não foi possível liberar o saldo do pedido.");
  }

  async function pixHealth() {
    try {
      const res = await fetch(`${apiBase()}/api/health`, { headers: { Accept: "application/json" } });
      return await res.json();
    } catch (e) {
      return { ok: false, configured: false };
    }
  }

  /* ---------------- administração ---------------- */

  async function requireAdmin() {
    const profile = await me();
    if (!profile || profile.role !== "admin") {
      throw new Error("Acesso restrito ao administrador.");
    }
    return profile;
  }

  async function me() {
    const s = await session();
    if (!s) return null;
    return getProfile(s.user.id);
  }

  async function listAdmin() {
    return loadSnapshot({ admin: true });
  }

  function productRow(p) {
    const row = {
      lot_id: p.lotId || null,
      name: p.name || "",
      brand: p.brand || "",
      specs: p.specs || "",
      sku: p.sku || "",
      price: Number(p.price) || 0,
      box_filled: Number(p.boxFilled) || 0,
      closed_boxes: Number(p.closedBoxes) || 0,
      stock_qty: Number(p.stockQty) || 0,
      max_per_order: Number(p.maxPerOrder) || 0,
      tag: p.tag || "",
      description: p.description || "",
      image: p.image || "",
      active: p.active !== false,
      sort_order: Number(p.sortOrder) || 0,
      updated_at: new Date().toISOString(),
    };
    return row;
  }

  async function saveProduct(p) {
    await requireAdmin();
    const row = productRow(p);
    if (p.id) {
      const { data, error } = await table("products").update(row).eq("id", p.id).select("*").single();
      if (error) fail(error, "Não foi possível salvar o produto.");
      return mapProduct(data);
    }
    const id = `p-${crypto.randomUUID()}`;
    const { data, error } = await table("products").insert({ id, ...row }).select("*").single();
    if (error) fail(error, "Não foi possível criar o produto.");
    return mapProduct(data);
  }

  async function deleteProduct(id) {
    await requireAdmin();
    const { error } = await table("products").delete().eq("id", id);
    if (error) fail(error, "Não foi possível excluir o produto.");
  }

  async function saveLot(l) {
    await requireAdmin();
    const row = {
      brand: l.brand || "",
      monogram: l.monogram || "R2Y",
      title: l.title || "",
      tag: l.tag || "",
      description: l.description || "",
      open: l.open !== false,
      accent: l.accent || "#5580d7",
      closes_at: l.closesAt || null,
      note: l.note || "",
      image: l.image || "",
      active: l.active !== false,
      sort_order: Number(l.sortOrder) || 0,
      updated_at: new Date().toISOString(),
    };
    if (l.id) {
      const { data, error } = await table("lots").update(row).eq("id", l.id).select("*").single();
      if (error) fail(error, "Não foi possível salvar o lote.");
      return mapLot(data);
    }
    const id = `lote-${crypto.randomUUID()}`;
    const { data, error } = await table("lots").insert({ id, ...row }).select("*").single();
    if (error) fail(error, "Não foi possível criar o lote.");
    return mapLot(data);
  }

  async function deleteLot(id) {
    await requireAdmin();
    const { error } = await table("lots").delete().eq("id", id);
    if (error) fail(error, "Não foi possível excluir o lote. Verifique se há produtos nele.");
  }

  async function saveStockItem(s) {
    await requireAdmin();
    const row = {
      name: s.name || "",
      brand: s.brand || "",
      specs: s.specs || "",
      price: Number(s.price) || 0,
      qty: Number(s.qty) || 0,
      lot: s.lot || "",
      description: s.description || "",
      image: s.image || "",
      active: s.active !== false,
      sort_order: Number(s.sortOrder) || 0,
      updated_at: new Date().toISOString(),
    };
    if (s.id) {
      const { data, error } = await table("stock_items").update(row).eq("id", s.id).select("*").single();
      if (error) fail(error, "Não foi possível salvar o item.");
      return mapStock(data);
    }
    const id = `s-${crypto.randomUUID()}`;
    const { data, error } = await table("stock_items").insert({ id, ...row }).select("*").single();
    if (error) fail(error, "Não foi possível criar o item.");
    return mapStock(data);
  }

  async function deleteStockItem(id) {
    await requireAdmin();
    const { error } = await table("stock_items").delete().eq("id", id);
    if (error) fail(error, "Não foi possível excluir o item.");
  }

  async function saveAuction(a) {
    await requireAdmin();
    const row = {
      title: a.title || "",
      origin: a.origin || "",
      description: a.description || "",
      specs: a.specs || "",
      start_bid: Number(a.startBid) || 0,
      increment: Number(a.increment) || 0,
      ends_at: a.endsAt || null,
      top_bid: a.topBid === null || a.topBid === undefined ? null : Number(a.topBid),
      image: a.image || "",
      active: a.active !== false,
      updated_at: new Date().toISOString(),
    };
    if (a.id) {
      const { data, error } = await table("auctions").update(row).eq("id", a.id).select("*").single();
      if (error) fail(error, "Não foi possível salvar o leilão.");
      return mapAuction(data);
    }
    const id = `auc-${crypto.randomUUID()}`;
    const { data, error } = await table("auctions").insert({ id, ...row }).select("*").single();
    if (error) fail(error, "Não foi possível criar o leilão.");
    return mapAuction(data);
  }

  async function deleteAuction(id) {
    await requireAdmin();
    const { error } = await table("auctions").delete().eq("id", id);
    if (error) fail(error, "Não foi possível excluir o leilão.");
  }

  async function saveSettings(data) {
    await requireAdmin();
    const current = await table("settings").select("data").eq("id", 1).maybeSingle();
    if (current.error) fail(current.error);
    const merged = { ...(current.data && current.data.data ? current.data.data : R2Y.defaultSettings()), ...data };
    const { error } = await table("settings").upsert({ id: 1, data: merged, updated_at: new Date().toISOString() });
    if (error) fail(error, "Não foi possível salvar as configurações.");
    return merged;
  }

  async function updateProfileAdmin(id, patch) {
    await requireAdmin();
    const row = {};
    if (patch.name !== undefined) row.full_name = patch.name;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.cpf !== undefined) row.cpf = patch.cpf;
    if (patch.whatsapp !== undefined) row.whatsapp = patch.whatsapp;
    if (patch.phone2 !== undefined) row.phone2 = patch.phone2;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.credit !== undefined) row.credit = Number(patch.credit) || 0;
    row.updated_at = new Date().toISOString();
    const { data, error } = await table("profiles").update(row).eq("id", id).select("*").single();
    if (error) fail(error, "Não foi possível atualizar o cliente.");
    return mapProfile(data);
  }

  async function uploadImage(file, folder = "produtos") {
    await requireAdmin();
    if (!file) throw new Error("Escolha uma imagem.");
    if (!file.type.startsWith("image/")) throw new Error("O arquivo precisa ser uma imagem.");
    if (file.size > 8 * 1024 * 1024) throw new Error("A imagem precisa ter no máximo 8 MB.");
    const bucket = cfg.STORAGE_BUCKET || "product-images";
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await db().storage.from(bucket).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      if (/bucket/i.test(error.message)) {
        throw new Error("O bucket de imagens não existe. Rode o arquivo supabase/02-storage.sql no Supabase.");
      }
      fail(error, "Não foi possível enviar a imagem.");
    }
    const { data } = db().storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /* ---------------- tempo real ---------------- */

  function subscribe(onChange) {
    if (realtime) db().removeChannel(realtime);
    let channel = db().channel("loja-tempo-real");
    [
      "settings",
      "lots",
      "products",
      "stock_items",
      "auctions",
      "bids",
      "orders",
      "profiles",
      "addresses",
      "payments",
    ].forEach((name) => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: name },
        (payload) => onChange(payload, name)
      );
    });
    realtime = channel.subscribe();
    return realtime;
  }

  function unsubscribe() {
    if (realtime) {
      db().removeChannel(realtime);
      realtime = null;
    }
  }

  /* ---------------- mapeadores ---------------- */

  function mapProfile(row) {
    return {
      id: row.id,
      name: row.full_name || "",
      email: row.email || "",
      role: row.role || "membro",
      status: row.status || "pendente",
      cpf: row.cpf || "",
      whatsapp: row.whatsapp || "",
      phone2: row.phone2 || "",
      credit: Number(row.credit) || 0,
      createdAt: row.created_at || new Date().toISOString(),
      addresses: [],
    };
  }

  function mapAddress(row) {
    return {
      id: row.id,
      userId: row.user_id,
      label: row.label || "Endereço",
      cep: row.cep || "",
      street: row.street || "",
      number: row.number || "",
      complement: row.complement || "",
      district: row.district || "",
      city: row.city || "",
      state: row.state || "",
      notes: row.notes || "",
      principal: !!row.principal,
    };
  }

  function mapLot(row) {
    return {
      id: row.id,
      brand: row.brand || "",
      monogram: row.monogram || "R2Y",
      title: row.title || "",
      tag: row.tag || "",
      description: row.description || "",
      open: row.open !== false,
      accent: row.accent || "#5580d7",
      closesAt: row.closes_at,
      note: row.note || "",
      image: row.image || "",
      active: row.active !== false,
      sortOrder: row.sort_order || 0,
    };
  }

  function mapProduct(row) {
    return {
      id: row.id,
      lotId: row.lot_id || "",
      name: row.name || "",
      brand: row.brand || "",
      specs: row.specs || "",
      sku: row.sku || "",
      price: Number(row.price) || 0,
      boxFilled: Number(row.box_filled) || 0,
      closedBoxes: Number(row.closed_boxes) || 0,
      stockQty: Number(row.stock_qty) || 0,
      maxPerOrder: Number(row.max_per_order) || 0,
      tag: row.tag || "",
      description: row.description || "",
      image: row.image || "",
      active: row.active !== false,
      sortOrder: row.sort_order || 0,
    };
  }

  function mapStock(row) {
    return {
      id: row.id,
      name: row.name || "",
      brand: row.brand || "",
      specs: row.specs || "",
      price: Number(row.price) || 0,
      qty: Number(row.qty) || 0,
      lot: row.lot || "",
      description: row.description || "",
      image: row.image || "",
      active: row.active !== false,
      sortOrder: row.sort_order || 0,
    };
  }

  function mapAuction(row) {
    return {
      id: row.id,
      title: row.title || "",
      origin: row.origin || "",
      description: row.description || "",
      specs: row.specs || "",
      startBid: Number(row.start_bid) || 0,
      increment: Number(row.increment) || 0,
      endsAt: row.ends_at,
      topBid: row.top_bid === null ? null : Number(row.top_bid),
      image: row.image || "",
      active: row.active !== false,
      paidAt: row.paid_at,
      paidBy: row.paid_by,
      createdAt: row.created_at,
    };
  }

  function mapBid(row) {
    return {
      id: row.id,
      auctionId: row.auction_id,
      userId: row.user_id,
      amount: Number(row.amount) || 0,
      at: row.created_at,
    };
  }

  function mapOrder(row) {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      lotId: row.lot_id || "",
      lotTitle: row.lot_title || "",
      auctionId: row.auction_id || "",
      items: row.items || [],
      subtotal: Number(row.subtotal) || 0,
      shipping: Number(row.shipping) || 0,
      sinal: Number(row.sinal) || 0,
      total: Number(row.total) || 0,
      balance: Number(row.balance) || 0,
      status: row.status || "aguardando_pagamento",
      address: row.address || "",
      events: row.events || [],
      tracking: row.tracking || "",
      stockApplied: !!row.stock_applied,
      paymentMethod: row.payment_method || "pix",
      pixTxid: row.pix_txid || "",
      pixCopiaCola: row.pix_copia_cola || "",
      pixExpiresAt: row.pix_expires_at,
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapOrderToRow(o) {
    return {
      id: o.id,
      user_id: o.userId,
      type: o.type,
      lot_id: o.lotId || null,
      lot_title: o.lotTitle || "",
      auction_id: o.auctionId || null,
      items: o.items || [],
      subtotal: Number(o.subtotal) || 0,
      shipping: Number(o.shipping) || 0,
      sinal: Number(o.sinal) || 0,
      total: Number(o.total) || 0,
      balance: Number(o.balance) || 0,
      status: o.status || "aguardando_pagamento",
      address: o.address || "",
      events: o.events || [],
      tracking: o.tracking || "",
      stock_applied: !!o.stockApplied,
      payment_method: o.paymentMethod || "pix",
    };
  }

  function mapPayment(row) {
    return {
      id: row.id,
      orderId: row.order_id,
      txid: row.txid,
      kind: row.kind,
      amount: Number(row.amount) || 0,
      status: row.status,
      provider: row.provider,
      copiaECola: row.copia_cola,
      expiresAt: row.expires_at,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    };
  }

  return {
    configured,
    SetupError,
    init,
    session,
    signIn,
    signUp,
    signOut,
    autoApproveMe,
    loadSnapshot,
    updateProfile,
    saveAddress,
    deleteAddress,
    setPrincipalAddress,
    createOrder,
    updateOrder,
    deleteOrder,
    createBid,
    createPix,
    pixStatus,
    notifyManualPayment,
    adminConfirmPayment,
    adminReleaseBalance,
    pixHealth,
    listAdmin,
    saveProduct,
    deleteProduct,
    saveLot,
    deleteLot,
    saveStockItem,
    deleteStockItem,
    saveAuction,
    deleteAuction,
    saveSettings,
    updateProfileAdmin,
    uploadImage,
    subscribe,
    unsubscribe,
    me,
  };
})();
