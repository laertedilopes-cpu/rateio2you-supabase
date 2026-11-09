/* =========================================================
   rateio2you — login e cadastro (Supabase Auth)
   ========================================================= */

function authAsideHTML() {
  const s = settings();
  const benefits = (s.authBenefits || []).map(
    (b) => `<li><span class="tick">✓</span> ${esc(tokens(b))}</li>`
  ).join("");
  return `
    <aside class="auth-aside">
      <a class="brand" href="#/login">
        ${brandMarkHTML()}
        <span>
          <span class="brand-name">${brandNameHTML()}</span>
          <span class="brand-sub">${esc(s.brandSub)}</span>
        </span>
      </a>
      <div class="auth-copy">
        <span class="tag">${ICONS.spark} ${esc(tokens(s.authTag))}</span>
        <h1>${esc(tokens(s.authHeadline1))}<br><em>${esc(tokens(s.authHeadline2))}</em></h1>
        <p>${esc(tokens(s.authLead))}</p>
        <ul class="auth-benefits">${benefits}</ul>
      </div>
      <div class="auth-art" aria-hidden="true">
        <div class="auth-vial"></div>
        <div class="auth-vial"></div>
        <div class="auth-vial"></div>
        <span class="caption">${esc(siteName())} · lote aberto</span>
      </div>
    </aside>`;
}

function authShellHTML(card) {
  return `<div class="auth-shell">
    ${authAsideHTML()}
    <main class="auth-main"><div class="auth-card">${card}</div></main>
  </div>`;
}

function renderLoginPage() {
  const s = settings();
  return authShellHTML(`
    <h2>${esc(s.loginTitle)}</h2>
    <p class="lead">${esc(tokens(s.loginLead))}</p>
    <form class="auth-form" id="login-form" novalidate>
      <div class="form-error" id="auth-error"></div>
      <label class="field">
        <span class="field-label">E-mail</span>
        <input class="input" id="login-email" name="email" type="email" autocomplete="email" placeholder="voce@email.com" required>
      </label>
      <label class="field">
        <span class="field-label">Senha</span>
        <span style="position:relative;display:block">
          <input class="input" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required>
          <button class="pw-toggle" type="button" id="toggle-password">Mostrar</button>
        </span>
      </label>
      <button class="btn btn-primary btn-block btn-lg auth-submit" type="submit" id="login-submit">Entrar no grupo ${ICONS.arrow}</button>
    </form>

    <div class="auth-alt">Ainda não tem conta? <a href="#/cadastro">Cadastre-se</a></div>

    <div class="auth-demo">
      <span>
        <strong style="display:block;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--olive)">Organizador da loja</strong>
        O painel administrativo tem uma entrada separada.
      </span>
      <a href="admin.html" class="btn btn-ghost btn-sm">Abrir admin</a>
    </div>

    <p class="auth-foot">
      Ao entrar, você concorda com os <a href="#/termos">Termos de Serviço</a> e a
      <a href="#/privacidade">Política de Privacidade</a>.<br>
      ${esc(siteName())} · seus dados ficam salvos com segurança na nuvem.
    </p>
  `);
}

function initLoginPage() {
  const form = $("#login-form");
  const errorBox = $("#auth-error");
  const email = $("#login-email");
  const password = $("#login-password");
  const submit = $("#login-submit");

  const showError = (msg) => {
    errorBox.innerHTML = `${ICONS.alert}<span>${esc(msg)}</span>`;
    errorBox.classList.add("show");
  };

  $("#toggle-password").addEventListener("click", () => {
    const isPwd = password.type === "password";
    password.type = isPwd ? "text" : "password";
    $("#toggle-password").textContent = isPwd ? "Ocultar" : "Mostrar";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("show");
    const mail = email.value.trim().toLowerCase();
    const pass = password.value;
    if (!mail || !pass) {
      showError("Informe e-mail e senha para continuar.");
      return;
    }
    submit.disabled = true;
    submit.textContent = "Entrando...";
    try {
      const profile = await Store.signIn(mail, pass);
      db = await Store.loadSnapshot();
      applyTheme();
      toast(`Que bom te ver, ${String(profile.name || "").split(" ")[0] || "bem-vindo"}.`);
      go(profile.role === "admin" ? "pedido" : "pedido");
    } catch (err) {
      showError(err.message || "Não foi possível entrar.");
    } finally {
      submit.disabled = false;
      submit.innerHTML = `Entrar no grupo ${ICONS.arrow}`;
    }
  });
}

function renderSignupPage() {
  const s = settings();
  if (ui.pendingEmail) {
    return authShellHTML(`
      <div class="pending-box">
        <div class="pending-icon">${ICONS.clock}</div>
        <h2>Cadastro aguardando liberação</h2>
        <p class="lead">Recebemos seu cadastro${ui.pendingEmail ? ` para <strong>${esc(ui.pendingEmail)}</strong>` : ""}.
        Se você recebeu um e-mail de confirmação do Supabase, clique no link dele primeiro.
        Depois, o organizador do grupo precisa aprovar o acesso antes de liberar o catálogo.</p>
        <div class="callout" style="margin-top:16px;text-align:left">
          <span class="ico">i</span>
          <span>Se você acabou de se cadastrar e o organizador já liberou, use o botão abaixo para entrar.</span>
        </div>
        <a class="btn btn-accent btn-block btn-lg" style="margin-top:16px" href="#/login">Ir para o login</a>
        <div class="auth-alt"><a href="admin.html">Sou o organizador</a></div>
      </div>
    `);
  }

  return authShellHTML(`
    <h2>${esc(s.signupTitle)}</h2>
    <p class="lead">${esc(tokens(s.signupLead))}</p>
    <form class="auth-form" id="signup-form" novalidate>
      <div class="form-error" id="signup-error"></div>
      <label class="field">
        <span class="field-label">Nome completo</span>
        <input class="input" id="signup-name" type="text" autocomplete="name" placeholder="Como no documento" required>
      </label>
      <label class="field">
        <span class="field-label">E-mail</span>
        <input class="input" id="signup-email" type="email" autocomplete="email" placeholder="voce@email.com" required>
      </label>
      <div class="form-grid" style="margin-top:14px">
        <label class="field" style="margin:0">
          <span class="field-label">Senha</span>
          <input class="input" id="signup-password" type="password" autocomplete="new-password" placeholder="Mín. 8 caracteres" required>
        </label>
        <label class="field" style="margin:0">
          <span class="field-label">Confirmar senha</span>
          <input class="input" id="signup-confirm" type="password" autocomplete="new-password" placeholder="Repita a senha" required>
        </label>
      </div>
      <label class="check" style="margin-top:16px">
        <input type="checkbox" id="signup-terms">
        <span>Li e aceito os <a href="#/termos" style="color:var(--olive);font-weight:700;text-decoration:underline">Termos de Serviço</a> e a <a href="#/privacidade" style="color:var(--olive);font-weight:700;text-decoration:underline">Política de Privacidade</a>.</span>
      </label>
      <button class="btn btn-primary btn-block btn-lg auth-submit" type="submit" id="signup-submit">Enviar cadastro ${ICONS.arrow}</button>
    </form>
    <div class="auth-alt">Já tem conta? <a href="#/login">Entrar</a></div>
    <p class="auth-foot">O cadastro não garante acesso imediato. O organizador pode aprovar, recusar ou suspender membros.</p>
  `);
}

function initSignupPage() {
  if (ui.pendingEmail) return;

  const form = $("#signup-form");
  const errorBox = $("#signup-error");
  const submit = $("#signup-submit");
  const showError = (msg) => {
    errorBox.innerHTML = `${ICONS.alert}<span>${esc(msg)}</span>`;
    errorBox.classList.add("show");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.remove("show");
    const name = $("#signup-name").value.trim();
    const email = $("#signup-email").value.trim().toLowerCase();
    const pass = $("#signup-password").value;
    const confirm = $("#signup-confirm").value;

    if (name.length < 4) return showError("Informe seu nome completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("Informe um e-mail válido.");
    if (pass.length < 8) return showError("A senha precisa ter pelo menos 8 caracteres.");
    if (pass !== confirm) return showError("As senhas não conferem.");
    if (!$("#signup-terms").checked) return showError("Marque o aceite dos termos para continuar.");

    submit.disabled = true;
    submit.textContent = "Enviando...";
    try {
      const result = await Store.signUp({ name, email, password: pass });
      if (result.autoApproved) {
        db = await Store.loadSnapshot();
        applyTheme();
        toast("Cadastro aprovado automaticamente. Boas compras!");
        go("pedido");
        return;
      }
      ui.pendingEmail = email;
      window.renderRoute();
      toast("Cadastro enviado. Aguarde a liberação do organizador.");
    } catch (err) {
      showError(err.message || "Não foi possível criar a conta.");
    } finally {
      submit.disabled = false;
      submit.innerHTML = `Enviar cadastro ${ICONS.arrow}`;
    }
  });
}
