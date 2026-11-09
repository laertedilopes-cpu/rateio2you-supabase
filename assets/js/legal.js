/* =========================================================
   rateio2you — documentos legais (texto demonstrativo)
   ========================================================= */

const LEGAL_DOCS = {
  privacidade: {
    title: "Política de Privacidade",
    updated: "Última atualização: novembro de 2026",
    intro:
      "Esta política explica como o rateio2you trata os dados pessoais dos participantes do grupo fechado de compras coletivas, em conformidade com a Lei nº 13.709/2018 (LGPD).",
    sections: [
      {
        id: "quem-somos",
        title: "1. Quem somos",
        html: `<p>O rateio2you é uma ferramenta de organização de compras coletivas operada pelo organizador do grupo fechado. O acesso é restrito a membros previamente aprovados.</p>
        <p>Ao criar uma conta ou utilizar o site, você declara que leu esta política e os Termos de Serviço. Se não concordar, não utilize a plataforma.</p>`,
      },
      {
        id: "dados",
        title: "2. Dados que coletamos",
        html: `<p>Coletamos apenas os dados necessários para organizar reservas, pagamentos e entregas:</p>
        <ul>
          <li><strong>Cadastro:</strong> nome completo, e-mail, CPF, WhatsApp e telefone alternativo.</li>
          <li><strong>Entrega:</strong> CEP, rua, número, complemento, bairro, cidade, estado, observações e indicação do endereço principal.</li>
          <li><strong>Pedidos:</strong> produtos, dosagens, quantidades, valores, frete, sinal, saldo, status, histórico e código de rastreio.</li>
          <li><strong>Pagamentos:</strong> referências e valores de cobranças Pix. Não armazenamos senha bancária, chave Pix pessoal ou dados de cartão.</li>
          <li><strong>Interações:</strong> lances em leilões, itens no carrinho e mensagens enviadas ao organizador.</li>
        </ul>`,
      },
      {
        id: "finalidades",
        title: "3. Para que usamos os dados",
        html: `<ul>
          <li>Liberar e controlar o acesso de membros ao grupo.</li>
          <li>Montar reservas, calcular caixas e boxes, gerar cobranças e conferir pagamentos.</li>
          <li>Preparar etiquetas, organizar envios e informar o andamento dos pedidos.</li>
          <li>Enviar comunicações operacionais sobre lotes, pedidos, leilões e entregas.</li>
          <li>Cumprir obrigações legais, fiscais e regulatórias aplicáveis.</li>
          <li>Prevenir fraudes, abusos e uso indevido da plataforma.</li>
        </ul>`,
      },
      {
        id: "compartilhamento",
        title: "4. Compartilhamento com terceiros",
        html: `<p>Não vendemos nem alugamos dados pessoais. O compartilhamento ocorre apenas quando necessário para a operação:</p>
        <ul>
          <li><strong>Processador de pagamentos Pix:</strong> recebe os dados indispensáveis para emitir e confirmar a cobrança. O rateio2you recebe apenas a confirmação do pagamento.</li>
          <li><strong>ViaCEP:</strong> serviço público consultado para preencher o endereço a partir do CEP informado por você.</li>
          <li><strong>Infraestrutura:</strong> provedores de hospedagem, banco de dados e autenticação, contratados com medidas de segurança adequadas.</li>
          <li><strong>Autoridades:</strong> quando houver obrigação legal ou ordem judicial.</li>
        </ul>
        <p>Em leilões de itens remanescentes, apenas o organizador e o arrematante têm acesso aos dados necessários para concluir a negociação.</p>`,
      },
      {
        id: "seguranca",
        title: "5. Segurança e controle de acesso",
        html: `<p>Adotamos medidas técnicas e organizacionais para proteger os dados, incluindo controle de acesso por perfil, conexão criptografada em produção e restrição de visualização: cada participante acessa apenas os próprios dados; o organizador e o suporte autorizado acessam o necessário para operar o grupo.</p>
        <p>Nenhum sistema é totalmente imune a incidentes. Caso ocorra um incidente relevante, os titulares e a ANPD serão comunicados nos termos da LGPD.</p>`,
      },
      {
        id: "retencao",
        title: "6. Retenção e exclusão",
        html: `<p>Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário para apurar pendências financeiras, cumprir obrigações legais e resguardar direitos.</p>
        <p>Você pode solicitar a correção dos dados a qualquer momento em <strong>Minha conta</strong>. Pedidos de exclusão devem ser feitos ao organizador; valores pendentes ou pedidos em andamento precisam ser resolvidos antes da exclusão. Endereços usados em etiquetas podem ser mantidos no histórico do pedido mesmo após a remoção da lista de endereços.</p>`,
      },
      {
        id: "direitos",
        title: "7. Seus direitos (LGPD)",
        html: `<p>Você pode solicitar ao organizador, a qualquer momento:</p>
        <ul>
          <li>Confirmação da existência de tratamento e acesso aos seus dados.</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade.</li>
          <li>Portabilidade, nos termos da regulamentação aplicável.</li>
          <li>Informação sobre compartilhamentos e sobre a possibilidade de não fornecer consentimento.</li>
          <li>Revogação do consentimento, quando o tratamento se basear nele.</li>
        </ul>
        <p>As solicitações serão respondidas nos prazos legais pelos canais oficiais do grupo.</p>`,
      },
      {
        id: "cookies",
        title: "8. Cookies e armazenamento local",
        html: `<p>Na versão publicada, usamos cookies e armazenamento local apenas para manter a sessão e preferências essenciais. Não utilizamos cookies de publicidade nem rastreamento de terceiros.</p>
        <p><strong>Nesta demonstração offline</strong>, todos os dados ficam exclusivamente no <em>localStorage</em> do seu navegador. Nenhuma informação é enviada a servidores. Você pode apagar tudo restaurando a demonstração ou limpando os dados do site no navegador.</p>`,
      },
      {
        id: "saude",
        title: "9. Aviso de saúde",
        html: `<p>A calculadora disponível no site é uma ferramenta matemática de conversão de unidades. Ela não é prescrição, orientação de uso, preparo ou aplicação, e não substitui avaliação profissional.</p>
        <p>Decisões relacionadas à saúde exigem acompanhamento de profissional habilitado. O uso de qualquer produto é de responsabilidade exclusiva do participante.</p>`,
      },
      {
        id: "alteracoes",
        title: "10. Alterações e contato",
        html: `<p>Esta política pode ser atualizada para refletir mudanças na operação ou na legislação. A versão vigente permanece disponível nesta página, com a data de atualização no topo.</p>
        <p>Dúvidas sobre privacidade devem ser encaminhadas ao organizador pelos canais oficiais do grupo fechado.</p>`,
      },
    ],
  },
  termos: {
    title: "Termos de Serviço",
    updated: "Última atualização: novembro de 2026",
    intro:
      "Estes termos regulam o uso do rateio2you, ferramenta de organização de compras coletivas destinada aos membros aprovados do grupo.",
    sections: [
      {
        id: "servico",
        title: "1. Sobre o serviço",
        html: `<p>O {site} centraliza o cadastro de participantes, a montagem de reservas por lote, o controle de caixas de {caixa} {unidadePlural}, a cobrança de sinal e saldo final via Pix, o acompanhamento de envios e leilões de itens remanescentes.</p>
        <p>A plataforma é uma ferramenta de organização. Não é instituição financeira, transportadora, farmácia, importadora ou prestadora de serviços de saúde.</p>`,
      },
      {
        id: "cadastro",
        title: "2. Cadastro e liberação de acesso",
        html: `<p>O cadastro exige nome completo, e-mail, CPF, WhatsApp e, para reservar, endereço de entrega completo com CEP e um endereço marcado como principal.</p>
        <p>Toda conta começa pendente e só é liberada após aprovação do organizador. O organizador pode recusar, suspender ou bloquear acessos por descumprimento destes termos, inadimplência ou conduta inadequada.</p>
        <p>Você é responsável pela veracidade e atualização dos dados informados.</p>`,
      },
      {
        id: "reservas",
        title: "3. Reservas, lotes e caixas",
        html: `<p>As reservas são organizadas por lote, com data de fechamento própria. Após o encerramento, não são aceitas novas reservas e os boxes são acertados.</p>
        <p>Para o mesmo produto e modelo, cada grupo de {caixa} {unidadePlural} do seu pedido forma uma caixa exclusiva, considerada completa após o sinal. As unidades restantes entram no box compartilhado de avulsos, que fecha ao completar {caixa} {unidadePlural}.</p>
        <p>No encerramento do lote, unidades de boxes incompletos são canceladas. O sinal é abatido dos itens mantidos; se não houver itens ou sobrar valor, ele fica como crédito para uma próxima compra.</p>`,
      },
      {
        id: "pagamentos",
        title: "4. Sinal, saldo final e Pix",
        html: `<p>A reserva exige sinal de {sinal} por {unidade}, pago via Pix. Somente o sinal confirmado efetiva a reserva e ocupa a vaga; a seleção de produtos, sozinha, não garante vaga.</p>
        <p>O saldo final é liberado quando os boxes do pedido fecham. O sinal integra o pagamento e é descontado do total — não é taxa extra. O valor final considera frete da região e eventuais taxas ou ajustes informados no pedido.</p>
        <p>Cobranças Pix têm prazo de validade. Não pague um código antigo após ajustes no pedido: gere a cobrança atualizada em <strong>Meus pedidos</strong>. Não repita o pagamento sem conferir o anterior.</p>
        <p>Nesta versão, o Pix é o único meio de pagamento aceito. Todos os valores são expressos em reais (BRL).</p>`,
      },
      {
        id: "inadimplencia",
        title: "5. Inadimplência e leilão",
        html: `<p>Se o saldo final não for pago no prazo, o organizador pode disponibilizar os itens remanescentes em leilão para outros membros aprovados, definindo lance inicial, incremento e encerramento.</p>
        <p>Nessa hipótese, o participante original perde o sinal dos itens leiloados, sem gerar crédito. O arrematante recebe uma cobrança Pix do valor do arremate; prevalece o maior lance válido. É vedado dar lance em leilão originado do próprio pedido.</p>`,
      },
      {
        id: "envio",
        title: "6. Envio, entrega e rastreio",
        html: `<p>Após o pagamento do saldo e a compra com o fornecedor, o envio passa por etapas de acompanhamento: saída da China, alfândega, trânsito no Brasil e entrega. O código de rastreio aparece no pedido quando informado pelo organizador.</p>
        <p>Os prazos dependem do fechamento dos boxes, do fornecedor, do transporte internacional e da liberação aduaneira. Não há prazo garantido. Confira o endereço principal antes do despacho; mudanças em pedidos já enviados dependem de acordo com o organizador.</p>`,
      },
      {
        id: "saude",
        title: "7. Calculadora e aviso de saúde",
        html: `<p>A calculadora converte valores informados em concentração, volume e unidades de seringa U-100. Trata-se de referência matemática, não de prescrição, orientação de uso, preparo ou aplicação.</p>
        <p>O uso de qualquer produto é de responsabilidade exclusiva do participante. Decisões de saúde exigem acompanhamento de profissional habilitado. Produtos sujeitos a prescrição somente devem ser utilizados conforme orientação profissional e a legislação aplicável.</p>`,
      },
      {
        id: "responsabilidades",
        title: "8. Responsabilidades e limites",
        html: `<p>O organizador cuida da conferência de pagamentos, do fechamento dos lotes e da organização dos envios. O participante responde pela exatidão dos dados, do endereço e dos pagamentos.</p>
        <p>Atrasos causados por dados incorretos, CEP inválido ou pagamento em cobrança expirada não geram ressarcimento automático, mas serão tratados com o organizador. Falhas de serviços de terceiros (pagamento, logística, comunicação) serão mediadas pelo organizador.</p>`,
      },
      {
        id: "conduta",
        title: "9. Conduta",
        html: `<p>É proibido: compartilhar o acesso com não membros; usar a plataforma para revenda organizada fora do grupo; fornecer dados falsos; tentar alterar preços, boxes ou pagamentos por meios indevidos; e dar lances em leilões dos próprios itens.</p>
        <p>O descumprimento pode levar à suspensão ou ao bloqueio da conta, sem prejuízo das medidas legais cabíveis.</p>`,
      },
      {
        id: "alteracoes",
        title: "10. Alterações e cancelamento",
        html: `<p>Estes termos podem ser atualizados. A versão vigente permanece nesta página, com a data de atualização no topo. Mudanças relevantes serão comunicadas aos participantes.</p>
        <p>Você pode pedir a saída do grupo ao organizador, resolvendo antes valores pendentes ou pedidos em andamento.</p>`,
      },
    ],
  },
};

function initLegalPage() {
  $$("[data-scroll]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.dataset.scroll);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderLegalPage(key) {
  const doc = LEGAL_DOCS[key] || LEGAL_DOCS.privacidade;
  const s = settings();
  const isPrivacy = key === "privacidade";
  const title = isPrivacy ? s.privacyTitle || doc.title : s.termsTitle || doc.title;
  const updated = isPrivacy ? s.privacyUpdated || doc.updated : s.termsUpdated || doc.updated;
  const intro = isPrivacy ? s.privacyIntro || doc.intro : s.termsIntro || doc.intro;
  const localize = (text) =>
    tokens(text).replace(/rateio2you/g, siteName());
  return `
    <div class="container">
      <div class="legal-layout">
        <aside class="legal-aside">
          <div class="k">Nesta página</div>
          <nav>
            ${doc.sections.map((sec) => `<button type="button" data-scroll="${sec.id}">${esc(localize(sec.title))}</button>`).join("")}
          </nav>
          <a class="btn btn-ghost btn-sm" href="#/pedido" style="margin-top:14px;width:100%">Voltar ao site</a>
        </aside>
        <article class="legal-body">
          <span class="eyebrow">Documento legal</span>
          <h1>${esc(localize(title))}</h1>
          <p class="updated">${esc(localize(updated))}</p>
          <p style="margin-top:14px">${esc(localize(intro))}</p>
          ${doc.sections
            .map(
              (sec) => `<h2 id="${sec.id}">${esc(localize(sec.title))}</h2>${localize(sec.html)}`
            )
            .join("")}
          <div class="legal-note">
            <strong>Nota desta demonstração:</strong> este texto é um modelo funcional criado para o projeto offline do
            ${esc(siteName())}. Antes de publicar o site, faça a revisão jurídica, inclua a identificação completa do organizador,
            o canal de contato e os dados do controlador de tratamento.
          </div>
        </article>
      </div>
    </div>`;
}
