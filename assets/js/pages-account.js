/* =========================================================
   rateio2you — minha conta, dados e endereços
   ========================================================= */

function renderAccountPage() {
  const user = currentUser();
  const addr = mainAddress(user);
  const orders = db.orders.filter((o) => o.userId === user.id);
  const pending = !user.cpf || !user.whatsapp || !addr;

  return `
    <div class="container">
      <div class="page-head">
        <div>
          <span class="eyebrow">Área do participante</span>
          <h1>Minha conta</h1>
          <p class="sub">Mantenha seus dados e endereços atualizados. O endereço principal define o frete e a etiqueta de envio.</p>
        </div>
      </div>

      <div class="account-head">
        <span class="avatar lg">${esc(initials(user.name))}</span>
        <div class="who">
          <h1>${esc(user.name || "Novo participante")}</h1>
          <div class="email">${esc(user.email)}</div>
          ${statusPill(user.status)}
        </div>
        <a class="btn btn-ghost" href="#/pedidos">Ver meus pedidos ${ICONS.arrow}</a>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="k">Crédito disponível</div>
          <div class="v">${fmt(user.credit || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="k">Pedidos na conta</div>
          <div class="v">${orders.length}</div>
        </div>
        <div class="stat-card">
          <div class="k">Endereço principal</div>
          <div class="v small">${addr ? `${esc(addr.city)}/${esc(addr.state)}` : "não cadastrado"}</div>
        </div>
      </div>

      ${
        pending
          ? `<div class="callout" style="margin-bottom:16px">
              <span class="ico">!</span>
              <span><strong>Complete seu cadastro.</strong> Precisamos de nome, CPF, WhatsApp e um endereço principal completo para enviar seus pedidos.</span>
            </div>`
          : ""
      }

      <div class="account-grid">
        <div>
          <section class="panel">
            <div class="panel-title">
              <h2>Dados pessoais</h2>
              <span class="hint">Visíveis apenas para o organizador</span>
            </div>
            <form id="personal-form" novalidate>
              <div class="form-grid">
                <label class="field span-2">
                  <span class="field-label">Nome completo</span>
                  <input class="input" id="personal-name" type="text" value="${esc(user.name)}" required>
                </label>
                <label class="field">
                  <span class="field-label">CPF</span>
                  <input class="input" id="personal-cpf" type="text" inputmode="numeric" placeholder="000.000.000-00" value="${esc(user.cpf)}">
                </label>
                <label class="field">
                  <span class="field-label">WhatsApp</span>
                  <input class="input" id="personal-whatsapp" type="tel" placeholder="(11) 90000-0000" value="${esc(user.whatsapp)}">
                </label>
                <label class="field span-2">
                  <span class="field-label">Telefone alternativo <span class="opt">opcional</span></span>
                  <input class="input" id="personal-phone2" type="tel" placeholder="(11) 3000-0000" value="${esc(user.phone2 || "")}">
                </label>
              </div>
              <button class="btn btn-primary" type="submit" style="margin-top:16px">Salvar dados pessoais</button>
            </form>
          </section>

          <section class="panel">
            <div class="panel-title">
              <h2>Endereços de entrega</h2>
              <button class="btn btn-soft btn-sm" id="toggle-address-form" type="button">${ui.addressFormOpen ? "Fechar formulário" : "+ Novo endereço"}</button>
            </div>

            <div class="addresses">
              ${
                user.addresses && user.addresses.length
                  ? user.addresses
                      .map(
                        (a) => `<div class="address-card ${a.principal ? "principal" : ""}">
                          <div class="top">
                            <span class="label">${ICONS.pin} ${esc(a.label || "Endereço")} ${a.principal ? '<span class="pill pill-sage" style="font-size:12.5px">Principal</span>' : ""}</span>
                            <span style="font-size:12.5px;color:var(--muted);font-weight:700">${esc(a.cep)}</span>
                          </div>
                          <div class="lines">${esc(formatAddress(a))}${a.notes ? `<br><span style="color:var(--muted)">Obs.: ${esc(a.notes)}</span>` : ""}</div>
                          <div class="actions">
                            ${a.principal ? "" : `<button type="button" data-addr-principal="${a.id}">Definir como principal</button>`}
                            <button type="button" class="danger" data-addr-remove="${a.id}">Remover</button>
                          </div>
                        </div>`
                      )
                      .join("")
                  : `<div class="empty" style="padding:26px 16px">
                      <div class="empty-icon">${ICONS.pin}</div>
                      <h3>Nenhum endereço cadastrado</h3>
                      <p>Cadastre um endereço completo com CEP para liberar reservas e calcular o frete.</p>
                    </div>`
              }
            </div>

            <div id="address-form-wrap" style="display:${ui.addressFormOpen ? "block" : "none"};margin-top:${ui.addressFormOpen ? "16px" : "0"};border-top:${ui.addressFormOpen ? "1px solid var(--line)" : "0"};padding-top:${ui.addressFormOpen ? "16px" : "0"}">
              <form id="address-form" novalidate>
                <div class="form-grid">
                  <label class="field">
                    <span class="field-label">Identificação</span>
                    <input class="input" id="addr-label" type="text" placeholder="Casa, trabalho..." value="Casa">
                  </label>
                  <label class="field">
                    <span class="field-label">CEP</span>
                    <span class="input-group">
                      <input class="input" id="addr-cep" type="text" inputmode="numeric" placeholder="00000-000" maxlength="9">
                      <button class="btn btn-soft" id="cep-lookup" type="button">Buscar</button>
                    </span>
                  </label>
                  <label class="field span-2">
                    <span class="field-label">Rua / avenida</span>
                    <input class="input" id="addr-street" type="text" placeholder="Preenchido pelo CEP">
                  </label>
                  <label class="field">
                    <span class="field-label">Número</span>
                    <input class="input" id="addr-number" type="text" placeholder="123">
                  </label>
                  <label class="field">
                    <span class="field-label">Complemento <span class="opt">opcional</span></span>
                    <input class="input" id="addr-complement" type="text" placeholder="Apto, bloco...">
                  </label>
                  <label class="field">
                    <span class="field-label">Bairro</span>
                    <input class="input" id="addr-district" type="text">
                  </label>
                  <label class="field">
                    <span class="field-label">Cidade</span>
                    <input class="input" id="addr-city" type="text">
                  </label>
                  <label class="field">
                    <span class="field-label">Estado</span>
                    <select class="select" id="addr-state">
                      <option value="">UF</option>
                      ${Object.keys(R2Y.ESTADOS)
                        .sort()
                        .map((uf) => `<option value="${uf}">${uf}</option>`)
                        .join("")}
                    </select>
                  </label>
                  <label class="field">
                    <span class="field-label">Observações <span class="opt">opcional</span></span>
                    <input class="input" id="addr-notes" type="text" placeholder="Ponto de referência">
                  </label>
                  <label class="check span-2">
                    <input type="checkbox" id="addr-principal" ${user.addresses && user.addresses.length ? "" : "checked"}>
                    <span>Definir como endereço principal</span>
                  </label>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
                  <button class="btn btn-primary" type="submit">Salvar endereço</button>
                  <button class="btn btn-ghost" type="button" id="cancel-address">Cancelar</button>
                </div>
                <p class="field-help" style="margin-top:8px">A busca de CEP usa o ViaCEP e precisa de internet. Sem conexão, preencha os campos manualmente.</p>
              </form>
            </div>
          </section>
        </div>

        <aside>
          <div class="panel">
            <div class="panel-title"><h3>Como usamos seus dados</h3></div>
            <p style="font-size:13.5px;line-height:1.7;color:var(--muted)">
              Nome, CPF, WhatsApp e endereço são usados para liberar o acesso, montar reservas,
              emitir etiquetas e acompanhar pagamentos Pix. Você pode corrigir os dados a qualquer momento.
            </p>
            <div class="divider"></div>
            <div class="summary-row" style="color:var(--muted);font-size:13.5px"><span>Crédito de sinal</span><strong style="color:var(--olive-deep)">${fmt(user.credit || 0)}</strong></div>
            <div class="summary-row" style="color:var(--muted);font-size:13.5px;margin-top:6px"><span>Caixa fecha a cada</span><strong style="color:var(--olive-deep)">${boxSize()} ${esc(unitLabel(true))}</strong></div>
            <div class="summary-row" style="color:var(--muted);font-size:13.5px;margin-top:6px"><span>Sinal por ${esc(unitLabel())}</span><strong style="color:var(--olive-deep)">${sinalEnabled() ? fmt(sinalPerUnit()) : "não exigido"}</strong></div>
            <div class="summary-row" style="color:var(--muted);font-size:13.5px;margin-top:6px"><span>Pagamento</span><strong style="color:var(--olive-deep)">Pix</strong></div>
            <a class="btn btn-ghost btn-block" href="#/privacidade" style="margin-top:14px">Política de Privacidade</a>
          </div>

          <div class="demo-note">
            <strong>Dados protegidos na nuvem.</strong> Seus dados pessoais, endereços e pedidos ficam
            salvos no Supabase e são visíveis apenas para você e para o organizador da loja.
            <button class="btn btn-ghost btn-block btn-sm" id="account-logout" type="button" style="margin-top:10px">Sair da conta</button>
          </div>
        </aside>
      </div>
    </div>`;
}

async function lookupCEP() {
  const input = $("#addr-cep");
  const btn = $("#cep-lookup");
  const cep = input.value.replace(/\D/g, "");
  if (cep.length !== 8) {
    toast("Informe um CEP com 8 dígitos.", "error");
    input.focus();
    return;
  }
  btn.disabled = true;
  btn.textContent = "Buscando...";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error("falha");
    const data = await res.json();
    if (data.erro) {
      toast("CEP não encontrado. Confira o número.", "error");
      return;
    }
    $("#addr-street").value = data.logradouro || "";
    $("#addr-district").value = data.bairro || "";
    $("#addr-city").value = data.localidade || "";
    $("#addr-state").value = data.uf || "";
    if (data.complemento && !$("#addr-complement").value) $("#addr-complement").value = data.complemento;
    $("#addr-number").focus();
    toast("Endereço preenchido pelo CEP.");
  } catch (e) {
    toast("Não foi possível buscar o CEP agora. Preencha os campos manualmente.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Buscar";
  }
}

async function reloadAccountSnapshot() {
  db = await Store.loadSnapshot();
  applyTheme();
  window.renderRoute();
}

function initAccountPage() {
  const user = currentUser();

  const logoutBtn = $("#account-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await Store.signOut();
      db = R2Y.empty();
      ui.selectedLotId = null;
      ui.orderQty = {};
      ui.addressFormOpen = false;
      go("login");
      toast("Sessão encerrada.");
    });
  }

  $("#personal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#personal-name").value.trim();
    if (name.length < 4) {
      toast("Informe seu nome completo.", "error");
      return;
    }
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const updated = await Store.updateProfile({
        name,
        cpf: $("#personal-cpf").value.trim(),
        whatsapp: $("#personal-whatsapp").value.trim(),
        phone2: $("#personal-phone2").value.trim(),
      });
      db.me = { ...db.me, ...updated, addresses: user.addresses };
      toast("Dados pessoais atualizados na nuvem.");
      window.renderRoute();
    } catch (err) {
      toast(err.message || "Não foi possível salvar seus dados.", "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#toggle-address-form").addEventListener("click", () => {
    ui.addressFormOpen = !ui.addressFormOpen;
    window.renderRoute();
  });

  const cancel = $("#cancel-address");
  if (cancel) {
    cancel.addEventListener("click", () => {
      ui.addressFormOpen = false;
      window.renderRoute();
    });
  }

  const cepBtn = $("#cep-lookup");
  if (cepBtn) cepBtn.addEventListener("click", lookupCEP);

  $$("[data-addr-principal]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await Store.setPrincipalAddress(btn.dataset.addrPrincipal);
        await reloadAccountSnapshot();
        toast("Endereço principal atualizado.");
      } catch (err) {
        toast(err.message || "Não foi possível atualizar o endereço.", "error");
      }
    });
  });

  $$("[data-addr-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const addr = user.addresses.find((a) => a.id === btn.dataset.addrRemove);
      if (!addr) return;
      confirmDialog({
        title: "Remover endereço",
        message: `Deseja remover <strong>${esc(addr.label || "este endereço")}</strong>? Pedidos em andamento continuam usando o endereço registrado no momento da compra.`,
        confirmLabel: "Remover",
        danger: true,
        onConfirm: async () => {
          try {
            await Store.deleteAddress(addr.id);
            await reloadAccountSnapshot();
            toast("Endereço removido.");
          } catch (err) {
            toast(err.message || "Não foi possível remover o endereço.", "error");
          }
        },
      });
    });
  });

  const form = $("#address-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cep = $("#addr-cep").value.trim();
      const street = $("#addr-street").value.trim();
      const number = $("#addr-number").value.trim();
      const district = $("#addr-district").value.trim();
      const city = $("#addr-city").value.trim();
      const state = $("#addr-state").value;
      if (cep.replace(/\D/g, "").length !== 8) return toast("Informe um CEP válido.", "error");
      if (!street || !number || !district || !city || !state) return toast("Preencha rua, número, bairro, cidade e estado.", "error");

      const principal = $("#addr-principal").checked || !user.addresses.length;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await Store.saveAddress(
          {
            label: $("#addr-label").value.trim() || "Endereço",
            cep,
            street,
            number,
            complement: $("#addr-complement").value.trim(),
            district,
            city,
            state,
            notes: $("#addr-notes").value.trim(),
            principal,
          },
          user.addresses
        );
        ui.addressFormOpen = false;
        await reloadAccountSnapshot();
        toast("Endereço salvo na nuvem.");
      } catch (err) {
        toast(err.message || "Não foi possível salvar o endereço.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }
}
