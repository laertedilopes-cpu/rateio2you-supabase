/* =========================================================
   rateio2you — calculadora U-100 e guia de compra
   ========================================================= */

function renderCalculatorPage() {
  const c = ui.calc;
  return `
    <div class="container">
      <div class="page-head">
        <div>
          <span class="eyebrow">Ferramentas · dose U-100</span>
          <h1>Calculadora de reconstituição</h1>
          <p class="sub">Converta miligramas, volume de diluente e dose desejada em unidades de seringa U-100. Apenas referência matemática.</p>
        </div>
        <span class="pill pill-mist">100 unid. = 1 mL</span>
      </div>

      <div class="calc-grid">
        <div>
          <section class="panel">
            <div class="panel-title">
              <h2>Dados do frasco</h2>
              <span class="hint">Confira o rótulo antes de calcular</span>
            </div>
            <div class="calc-field-grid">
              <div>
                <label class="field-label" for="calc-mg">Peptídeo no frasco (mg)</label>
                <input class="input" id="calc-mg" type="number" min="0.1" step="0.1" value="${c.mg}" inputmode="decimal">
                <div class="preset-row">
                  ${[1, 5, 10, 15, 20, 30, 50].map((v) => `<button class="preset" type="button" data-preset="mg" data-value="${v}">${v} mg</button>`).join("")}
                </div>
              </div>
              <div>
                <label class="field-label" for="calc-ml">Diluente usado (mL)</label>
                <input class="input" id="calc-ml" type="number" min="0.1" step="0.1" value="${c.ml}" inputmode="decimal">
                <div class="preset-row">
                  ${[0.5, 1, 1.5, 2, 3, 5].map((v) => `<button class="preset" type="button" data-preset="ml" data-value="${v}">${fmtNum(v, 1)} mL</button>`).join("")}
                </div>
              </div>
            </div>

            <div class="calc-sub">
              <h3>Dose desejada</h3>
              <p>Quantidade por aplicação, em miligramas — conforme a orientação recebida.</p>
              <div class="calc-field-grid">
                <div>
                  <label class="field-label" for="calc-dose">Dose (mg)</label>
                  <input class="input" id="calc-dose" type="number" min="0.01" step="0.01" value="${c.dose}" inputmode="decimal">
                  <div class="preset-row">
                    ${[0.1, 0.25, 0.5, 1, 2.5, 5, 10].map((v) => `<button class="preset" type="button" data-preset="dose" data-value="${v}">${fmtNum(v, v < 1 ? 2 : 1)} mg</button>`).join("")}
                  </div>
                </div>
                <div>
                  <span class="field-label">Seringa</span>
                  <div class="syringe-picker">
                    ${[
                      { u: 30, ml: "0,3 mL" },
                      { u: 50, ml: "0,5 mL" },
                      { u: 100, ml: "1 mL" },
                    ]
                      .map(
                        (s) => `<button class="syringe-option ${c.syringe === s.u ? "active" : ""}" type="button" data-syringe="${s.u}">
                          <strong>${s.u} un</strong><span>${s.ml}</span>
                        </button>`
                      )
                      .join("")}
                  </div>
                  <p class="field-help">Escolha a seringa que você vai usar. O resultado mostra as unidades a aspirar.</p>
                </div>
              </div>
            </div>
          </section>

          <section class="panel calc-reference">
            <div class="panel-title"><h2>Como o cálculo funciona</h2></div>
            <div class="steps-grid">
              <div class="step-card">
                <div class="step-num">1</div>
                <h3>Concentração</h3>
                <p>Divida o total em mg pelo volume de diluente em mL: <strong>mg ÷ mL = mg/mL</strong>.</p>
              </div>
              <div class="step-card">
                <div class="step-num">2</div>
                <h3>Volume da dose</h3>
                <p>Divida a dose desejada pela concentração: <strong>dose ÷ concentração = mL</strong>.</p>
              </div>
              <div class="step-card">
                <div class="step-num">3</div>
                <h3>Unidades U-100</h3>
                <p>Multiplique o volume por 100: <strong>mL × 100 = unidades</strong>. Em U-100, 1 mL equivale a 100 unidades.</p>
              </div>
              <div class="step-card">
                <div class="step-num">4</div>
                <h3>Doses por frasco</h3>
                <p>Divida o total do frasco pela dose: <strong>mg do frasco ÷ dose = doses</strong>.</p>
              </div>
            </div>
          </section>
        </div>

        <aside>
          <div class="calc-result">
            <span class="eyebrow">Você deve aspirar</span>
            <div class="calc-big">
              <span class="num" id="calc-units">—</span>
              <span class="unit">unid.</span>
            </div>
            <div class="calc-big-label" id="calc-units-label">Preencha os dados ao lado</div>
            <div class="calc-metrics">
              <div class="calc-metric"><div class="k">Concentração</div><div class="v" id="calc-conc">—</div></div>
              <div class="calc-metric"><div class="k">Volume por dose</div><div class="v" id="calc-vol">—</div></div>
              <div class="calc-metric"><div class="k">Doses por frasco</div><div class="v" id="calc-doses">—</div></div>
              <div class="calc-metric"><div class="k">Seringa</div><div class="v" id="calc-syringe">—</div></div>
            </div>
            <div id="calc-warning"></div>
            <div class="calc-note">
              <strong>Referência matemática.</strong> Esta ferramenta não é prescrição, orientação de uso, preparo ou aplicação.
              Confirme concentração, escala da seringa e dose com um profissional habilitado. Produtos manipulados exigem
              prescrição e acompanhamento adequados. Nunca reutilize agulhas ou seringas.
            </div>
          </div>
        </aside>
      </div>
    </div>`;
}

function calcUpdate() {
  const mg = Number($("#calc-mg")?.value);
  const ml = Number($("#calc-ml")?.value);
  const dose = Number($("#calc-dose")?.value);
  const syringe = ui.calc.syringe;
  const unitsEl = $("#calc-units");
  if (!unitsEl) return;

  const conc = mg > 0 && ml > 0 ? mg / ml : null;
  const vol = conc && dose > 0 ? dose / conc : null;
  const units = vol != null ? vol * 100 : null;
  const doses = dose > 0 && mg > 0 ? mg / dose : null;

  if (units == null || !isFinite(units)) {
    unitsEl.textContent = "—";
    $("#calc-units-label").textContent = "Preencha os dados ao lado";
    $("#calc-conc").textContent = "—";
    $("#calc-vol").textContent = "—";
    $("#calc-doses").textContent = "—";
    $("#calc-syringe").textContent = `${syringe} un`;
    $("#calc-warning").innerHTML = "";
    return;
  }

  const rounded = Math.round(units * 10) / 10;
  unitsEl.textContent = fmtNum(rounded, rounded < 10 ? 1 : 1);
  $("#calc-units-label").textContent = `${fmtNum(vol, 3)} mL por dose · seringa de ${fmtNum(syringe / 100, 1)} mL`;
  $("#calc-conc").textContent = `${fmtNum(conc, 2)} mg/mL`;
  $("#calc-vol").textContent = `${fmtNum(vol, 3)} mL`;
  $("#calc-doses").textContent = doses >= 100 ? "99+" : fmtNum(doses, 1);
  $("#calc-syringe").textContent = `${syringe} un`;

  const warn = $("#calc-warning");
  if (units > syringe) {
    warn.innerHTML = `<div class="calc-warn">${ICONS.alert}<span><strong>Acima da capacidade da seringa:</strong> ${fmtNum(units, 1)} unidades não cabem em uma seringa de ${syringe} unidades. Revise a dose ou a concentração com um profissional.</span></div>`;
  } else if (rounded < 1) {
    warn.innerHTML = `<div class="calc-warn" style="background:rgba(69, 87, 112,.1);border-color:rgba(69, 87, 112,.25);color:var(--olive-deep)">${ICONS.info}<span><strong>Volume muito pequeno:</strong> menos de 1 unidade na seringa. A precisão de leitura é limitada; confirme a diluição com um profissional.</span></div>`;
  } else {
    warn.innerHTML = "";
  }
}

function initCalculatorPage() {
  ["calc-mg", "calc-ml", "calc-dose"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", calcUpdate);
  });

  $$("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.preset;
      const value = btn.dataset.value;
      const map = { mg: "#calc-mg", ml: "#calc-ml", dose: "#calc-dose" };
      const input = $(map[target]);
      if (!input) return;
      input.value = value;
      $$(`[data-preset="${target}"]`).forEach((b) => b.classList.toggle("active", b === btn));
      calcUpdate();
    });
  });

  $$("[data-syringe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.calc.syringe = Number(btn.dataset.syringe);
      $$("[data-syringe]").forEach((b) => b.classList.toggle("active", b === btn));
      calcUpdate();
    });
  });

  calcUpdate();
}

/* ---------------- guia de compra ---------------- */

function renderGuidePage() {
  const s = settings();
  const size = boxSize();
  const unit = unitLabel();
  const sinalOn = sinalEnabled();
  const sinalTxt = sinalOn ? `${fmt(sinalPerUnit())} por ${unit}` : "isento nesta configuração";
  const steps = [
    {
      t: "Crie sua conta e aguarde a liberação",
      d: "O cadastro é analisado pelo organizador do grupo. Enquanto o acesso estiver pendente, o catálogo continua bloqueado. Você recebe a liberação pelos canais do grupo.",
    },
    {
      t: "Complete seus dados e endereço",
      d: "Em <strong>Minha conta</strong>, informe nome completo, CPF e WhatsApp válido. Cadastre o endereço com CEP, rua, número, bairro, cidade e estado. Um endereço precisa ser marcado como principal.",
    },
    {
      t: "Escolha um lote aberto",
      d: "Cada lote tem catálogo, preços e data de fechamento próprios. Confira a marca selecionada antes de adicionar produtos. Lotes encerrados não aceitam novas reservas.",
    },
    {
      t: `Selecione avulsos ou caixas de ${size}`,
      d: `Use os botões de quantidade ou <strong>+ Caixa (${size})</strong>. A barra abaixo do produto mostra o preenchimento do box compartilhado. Cada grupo de ${size} ${esc(unitLabel(true))} forma uma caixa exclusiva.`,
    },
    {
      t: sinalOn ? `Pague o sinal de ${fmt(sinalPerUnit())} por ${unit}` : "Pague o valor total via Pix",
      d: sinalOn
        ? "Envie a reserva e gere o Pix do sinal. A seleção de produtos, sozinha, não confirma a vaga: somente o pagamento do sinal efetiva a reserva e ocupa o box."
        : "Envie a reserva e gere o Pix do valor total. A seleção de produtos, sozinha, não confirma a vaga: somente o pagamento integral efetiva a reserva e ocupa o box.",
    },
    {
      t: "Acompanhe o fechamento dos boxes",
      d: `Avulsos entram na fila compartilhada por ordem de confirmação. Quando o box completa ${size} ${esc(unitLabel(true))}, ele fecha. Caixas exclusivas já ficam completas após o sinal.`,
    },
    {
      t: sinalOn ? "Confira e pague o saldo final" : "Acompanhe o envio",
      d: sinalOn
        ? "O saldo é liberado em <strong>Meus pedidos</strong> quando os boxes fecham. Confira itens mantidos, frete, ajustes e o desconto do sinal antes de gerar o Pix final."
        : "Com o pagamento integral confirmado, o pedido entra na fila de compra e envio. Acompanhe o status em <strong>Meus pedidos</strong>.",
    },
    {
      t: "Acompanhe o envio e a entrega",
      d: "Depois do pagamento, o pedido passa por compra no fornecedor, envio da China, alfândega e trânsito no Brasil. O rastreio aparece na página do pedido quando disponível.",
    },
  ];

  return `
    <div class="container">
      <section class="guide-hero">
        <span class="eyebrow">Guia do participante</span>
        <h1>${esc(tokens(s.guideTitle))}</h1>
        <p>${esc(tokens(s.guideLead))}</p>
        <div class="hero-strip">
          ${
            sinalOn
              ? `<div class="stat"><span class="stat-icon">${ICONS.pix}</span><div><strong>Sinal de ${fmt(sinalPerUnit())}</strong><span>por ${esc(unit)} · abatido do total</span></div></div>`
              : `<div class="stat"><span class="stat-icon">${ICONS.pix}</span><div><strong>Sem sinal</strong><span>pagamento integral via Pix</span></div></div>`
          }
          <div class="stat"><span class="stat-icon">${ICONS.box}</span><div><strong>Caixa de ${size}</strong><span>${size} ${esc(unitLabel(true))} fecham o box</span></div></div>
          <div class="stat"><span class="stat-icon y">${ICONS.truck}</span><div><strong>Frete por região</strong><span>calculado pelo CEP principal</span></div></div>
          <div class="stat"><span class="stat-icon y">${ICONS.shield}</span><div><strong>Pagamento via Pix</strong><span>um código por etapa</span></div></div>
        </div>
      </section>

      <div class="callout" style="margin-bottom:16px">
        <span class="ico">i</span>
        <span><strong>Caixa exclusiva não é box de avulsos.</strong> Se você reservar ${size} ${esc(unitLabel(true))} de um produto, sua caixa fica separada — mesmo que o box compartilhado tenha outras pessoas. Se reservar ${size + 4}, serão 1 caixa exclusiva + 4 avulsos no box.</span>
      </div>

      <section class="panel">
        <div class="panel-title">
          <h2>Sua compra, em 8 passos</h2>
          <span class="hint">Resumo do fluxo completo</span>
        </div>
        <div class="steps-grid">
          ${steps
            .map(
              (step, i) => `<div class="step-card">
                <div class="step-num">${i + 1}</div>
                <h3>${step.t}</h3>
                <p>${step.d}</p>
              </div>`
            )
            .join("")}
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">
          <h2>Como as caixas se formam</h2>
          <span class="hint">Exemplo visual</span>
        </div>
        <div class="box-viz">
          <div class="box-demo">
            <div class="k">Box compartilhado de avulsos</div>
            <div class="desc">4 ${esc(unitLabel(true))} confirmadas por outros participantes + 1 sua. Ainda faltam ${size - 5} para fechar.</div>
            <div class="bar">
              <div class="seg">
                ${Array.from({ length: size }, (_, i) => `<span class="${i < 4 ? "on" : i === 4 ? "you" : ""}"></span>`).join("")}
              </div>
              <div class="cap"><span>Sua unidade em amarelo</span><span>5/${size}</span></div>
            </div>
          </div>
          <div class="box-demo exclusive">
            <div class="k">Caixa exclusiva de ${size}</div>
            <div class="desc">Você reserva ${size} ${esc(unitLabel(true))} do mesmo produto e modelo. A caixa é sua e não depende de ninguém.</div>
            <div class="bar">
              <div class="seg">${Array.from({ length: size }, () => '<span class="you"></span>').join("")}</div>
              <div class="cap"><span>Fechada após o sinal</span><span>${size}/${size}</span></div>
            </div>
          </div>
        </div>
        <div class="callout" style="margin-top:14px">
          <span class="ico">!</span>
          <span>Se o box de avulsos não completar ${size} ${esc(unitLabel(true))} até o fechamento do lote, as unidades não confirmadas são canceladas. O sinal pago é abatido dos itens mantidos ou vira crédito para a próxima compra.</span>
        </div>
      </section>

      ${
        sinalOn
          ? `<section class="panel">
        <div class="panel-title">
          <h2>Como o sinal é descontado</h2>
          <span class="hint">Exemplo ilustrativo</span>
        </div>
        <div class="example-card" style="max-width:520px">
          <div class="example-line"><span>Produtos mantidos</span><span>R$ 450,00</span></div>
          <div class="example-line"><span>Frete do exemplo</span><span>R$ 50,00</span></div>
          <div class="example-line discount"><span>Sinal já pago · 3 × ${fmt(sinalPerUnit())}</span><span>− ${fmt(3 * sinalPerUnit())}</span></div>
          <div class="example-line total"><span>Saldo final a pagar</span><span>${fmt(Math.max(0, 500 - 3 * sinalPerUnit()))}</span></div>
        </div>
        <p style="margin-top:10px;font-size:12.5px;color:var(--muted)">Créditos disponíveis, taxas ou ajustes, quando existirem, também entram na conta exibida no pedido.</p>
      </section>`
          : ""
      }

      <section class="panel">
        <div class="panel-title"><h2>Perguntas frequentes</h2></div>
        <div class="faq">
          ${[
            [`Uma caixa de ${size} precisa esperar outros clientes?`, `Não. Ao reservar ${size} ${unitLabel(true)} do mesmo produto e modelo, você forma uma caixa exclusiva. Ela é considerada completa após a confirmação do sinal e não ocupa vagas do box compartilhado.`],
            [`Se já há ${Math.floor(size / 2)} avulsos e eu comprar ${size}, quantas vagas faltam?`, `Sua caixa de ${size} é separada. O box compartilhado continua com as ${Math.floor(size / 2)} ${unitLabel(true)} de outros participantes e ainda precisa de mais ${size - Math.floor(size / 2)} para fechar.`],
            ["O que acontece se o box não fechar?", "No encerramento do lote, as unidades de boxes incompletos são canceladas. O sinal pago é descontado dos itens mantidos; se não houver itens ou sobrar valor, ele fica como crédito."],
            ["E se eu não pagar o saldo final?", "O organizador pode disponibilizar os itens remanescentes em leilão para outros membros aprovados. Nesse caso, o sinal dos itens leiloados é perdido, sem gerar crédito."],
            ["Posso alterar ou cancelar meu pedido?", "Alterações dependem do estágio do lote e do fechamento das caixas. Fale com o organizador pelos canais do grupo informando o número do pedido."],
            ["Paguei o Pix, mas o pedido não atualizou. O que faço?", "A confirmação pode levar alguns instantes. Guarde o comprovante e o número do pedido. Se continuar pendente, fale com o organizador — não repita o pagamento sem conferir o anterior."],
            ["Posso pagar com cartão, boleto ou outra moeda?", "Não. Nesta versão, todos os pagamentos são feitos via Pix, em reais, com um código por etapa (sinal, saldo final ou arremate)."],
            ["A calculadora recomenda uma dose?", "Não. Ela apenas converte valores informados em concentração, volume e unidades U-100. Qualquer decisão de saúde deve ser tomada com um profissional habilitado."],
          ]
            .map(
              ([q, a]) => `<details class="faq-item">
                <summary>${esc(q)}<span class="plus">+</span></summary>
                <div class="a">${esc(a)}</div>
              </details>`
            )
            .join("")}
        </div>
      </section>

      <section class="panel" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div>
          <h2 style="font-size:19px">Pronto para participar?</h2>
          <p style="font-size:14px;color:var(--muted);margin-top:4px">Escolha um lote, monte sua caixa e gere o Pix do sinal.</p>
        </div>
        <div class="cta-row" style="margin:0">
          <a class="btn btn-primary" href="#/pedido">Fazer pedido ${ICONS.arrow}</a>
          <a class="btn btn-ghost" href="#/pedidos">Meus pedidos</a>
          <a class="btn btn-ghost" href="#/conta">Conferir meus dados</a>
        </div>
      </section>
    </div>`;
}
