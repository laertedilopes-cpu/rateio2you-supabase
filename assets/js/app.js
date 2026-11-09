/* =========================================================
   rateio2you — roteador da loja
   ========================================================= */

const ROUTES = {
  login: {
    title: "Entrar",
    render: renderLoginPage,
    init: initLoginPage,
    public: true,
    bare: true,
  },
  cadastro: {
    title: "Criar conta",
    render: renderSignupPage,
    init: initSignupPage,
    public: true,
    bare: true,
  },
  pedido: { title: "Fazer pedido", render: renderOrderPage, init: initOrderPage },
  calculadora: { title: "Calculadora", render: renderCalculatorPage, init: initCalculatorPage },
  pedidos: { title: "Meus pedidos", render: renderOrdersPage, init: initOrdersPage },
  leilao: { title: "Leilão", render: renderAuctionPage, init: initAuctionPage },
  "pronta-entrega": { title: "Pronta entrega", render: renderStockPage, init: initStockPage },
  conta: { title: "Minha conta", render: renderAccountPage, init: initAccountPage },
  guia: { title: "Guia de compra", render: renderGuidePage, public: true },
  privacidade: {
    title: "Política de Privacidade",
    render: () => renderLegalPage("privacidade"),
    init: initLegalPage,
    public: true,
  },
  termos: {
    title: "Termos de Serviço",
    render: () => renderLegalPage("termos"),
    init: initLegalPage,
    public: true,
  },
};

function publicHeaderHTML() {
  const s = settings();
  return `
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="#/login">
          ${brandMarkHTML()}
          <span>
            <span class="brand-name">${brandNameHTML()}</span>
            <span class="brand-sub">${esc(s.brandSub)}</span>
          </span>
        </a>
        <div class="nav-wrap" style="justify-content:flex-end">
          <a class="btn btn-primary btn-sm" href="#/login">Entrar</a>
        </div>
      </div>
    </header>`;
}

async function logout() {
  try {
    await Store.signOut();
  } catch (e) {
    console.warn(e);
  }
  db = R2Y.empty();
  ui.lastPath = "";
  ui.selectedLotId = null;
  ui.orderQty = {};
  ui.addressFormOpen = false;
  toast("Sessão encerrada.");
  location.hash = "#/login";
  renderRoute();
}

function renderRoute() {
  if (!app) return;
  const user = currentUser();
  let path = routeId();

  // O antigo painel dentro do index agora é uma página separada.
  if (path === "admin") {
    window.location.href = "admin.html";
    return;
  }

  if (!path) path = user ? "pedido" : "login";

  const route = ROUTES[path];

  if (!route) {
    location.hash = user ? "#/pedido" : "#/login";
    return;
  }

  if (!user && !route.public) {
    location.hash = "#/login";
    return;
  }

  if (user && route.bare) {
    location.hash = "#/pedido";
    return;
  }

  closeModal();
  document.title = `${route.title} · ${siteName()}`;
  document.body.dataset.route = path;

  const content = route.render();

  if (route.bare) {
    app.innerHTML = content;
  } else if (user) {
    app.innerHTML = shell(content);
  } else {
    app.innerHTML = `${publicHeaderHTML()}<main class="page-main">${content}</main>${footerHTML()}`;
  }

  if (route.init) route.init();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const activeNav = document.querySelector(".main-nav a.active");
  if (activeNav) activeNav.scrollIntoView({ block: "nearest", inline: "center" });

  startTicker();

  if (ui.lastPath !== path) {
    window.scrollTo({ top: 0, behavior: "auto" });
    ui.lastPath = path;
  }
}

window.renderRoute = renderRoute;
window.addEventListener("hashchange", renderRoute);

// core.js apenas define as funções; aqui a loja é realmente iniciada,
// depois que todos os arquivos de páginas já foram carregados.
boot();
