# rateio2you

Demonstração offline de uma plataforma de compras coletivas, feita como site estático (HTML, CSS e JavaScript puro), sem build, sem npm e sem dependências externas em tempo de execução. O visual usa a paleta creme, oliva, sálvia e amarelo do projeto.

> **Importante:** este projeto é uma demonstração. Pagamentos, aprovações e dados são simulados no próprio navegador. Ele não processa dinheiro real e não deve ser publicado como está para uso comercial.

## Como visualizar

1. Abra o arquivo `index.html` no Chrome, Edge ou Firefox (duplo clique já funciona).
2. Entre com a conta de demonstração:
   - **E-mail:** `dyane.lopes@gmail.com`
   - **Senha:** `Dd702320`
   - Na tela de login, o botão **Preencher** completa os campos automaticamente.

Não é necessário instalar nada. As fontes e a biblioteca de QR Code estão incluídas em `assets/`, então o site funciona sem internet.

Se o navegador restringir `localStorage` ou a área de transferência ao abrir via `file://`, use um servidor estático local (por exemplo, a extensão Live Server do VS Code) e acesse pelo endereço indicado.

## O que está incluído

- Login, cadastro e tela de cadastro aguardando aprovação (com aprovação simulada).
- Catálogo por lote, com busca, filtros, quantidade, caixa de 10 unidades e progresso do box.
- Resumo da reserva, frete por região e cobrança do sinal via Pix.
- Pix demonstrativo com QR Code e código copia e cola gerados localmente.
- Meus pedidos com histórico, status, rastreio, pagamento de sinal/saldo e simulação de fechamento do box.
- Leilão com lances, encerramento por tempo e pagamento do arremate via Pix.
- Pronta entrega com carrinho, controle de estoque e checkout via Pix.
- Minha conta com dados pessoais, endereços, CEP via ViaCEP e restauração da demonstração.
- Calculadora de reconstituição U-100 (ferramenta matemática, sem recomendação clínica).
- Guia de compra, Política de Privacidade e Termos de Serviço.
- Layout responsivo para desktop, tablet e celular.

## Rotas

| Rota | Página |
| --- | --- |
| `#/login` | Entrar |
| `#/cadastro` | Criar conta |
| `#/pedido` | Fazer pedido / catálogo |
| `#/calculadora` | Calculadora U-100 |
| `#/pedidos` | Meus pedidos |
| `#/leilao` | Leilão |
| `#/pronta-entrega` | Pronta entrega |
| `#/conta` | Minha conta |
| `#/guia` | Guia de compra |
| `#/privacidade` | Política de Privacidade |
| `#/termos` | Termos de Serviço |

As rotas `guia`, `privacidade` e `termos` são públicas. As demais exigem login, exceto `login` e `cadastro`.

## Dados e persistência

Tudo fica no `localStorage` do navegador:

- `rateio2you_db_v1` — usuários, lotes, produtos, estoque, leilões, pedidos, lances e carrinhos.
- `rateio2you_session_v1` — usuário logado.

A conta demo já vem com três pedidos de exemplo (saldo liberado, sinal pago e entregue) e um endereço principal em São Paulo/SP.

Para voltar ao estado inicial, entre em **Minha conta** e use **Restaurar dados de demonstração**. Isso apaga pedidos, endereços, carrinhos e lances criados neste navegador.

## Pix demonstrativo

- Chave usada: `pagamentos@rateio2you.demo`
- O código BR Code é montado localmente com os campos EMV e CRC16.
- O QR Code é gerado no navegador pela biblioteca em `assets/vendor/qrcode.js`.
- O botão de confirmação apenas marca o pagamento como concluído neste navegador. Nenhuma cobrança real é feita.

## Estrutura

```text
index.html                  entrada do site
assets/
  css/styles.css            design, paleta, componentes e responsividade
  js/data.js                dados de demonstração, sessão e persistência
  js/core.js                helpers, ícones, header/footer, modal, toast e Pix
  js/pix.js                 geração do BR Code e do QR Code
  js/app.js                 rotas, guarda de acesso e logout
  js/pages-auth.js          login e cadastro
  js/pages-order.js         catálogo, reserva, pedidos e pagamentos
  js/pages-market.js        leilão, pronta entrega e carrinho
  js/pages-account.js       conta, dados, endereços e CEP
  js/pages-content.js       calculadora e guia de compra
  js/legal.js               política de privacidade e termos
  vendor/qrcode.js          biblioteca local de QR Code
  fonts/                    fontes Manrope e Sora
  img/favicon.svg           ícone da marca
```

## Personalização

- Cores: variáveis CSS no início de `assets/css/styles.css` (`--cream`, `--olive`, `--sage`, `--mist`, `--yellow`, etc.).
- Produtos, lotes, estoque, leilões e pedidos de exemplo: `assets/js/data.js`.
- Regiões de frete e valor do sinal: constantes na mesma função em `assets/js/data.js` (`REGIOES` e `PIX.sinalPorVial`).
- Nome, textos institucionais, guia e documentos legais: arquivos em `assets/js/` e `assets/js/legal.js`.

## Limitações e próximos passos para publicação

Esta versão foi construída para visualização e validação de fluxo. Para operar de verdade, ainda é necessário:

- Backend com banco de dados, autenticação segura e senhas com hash.
- Painel administrativo para aprovar membros, abrir/fechar lotes, controlar boxes, estoque, leilões e pedidos.
- Integração com um PSP Pix real (cobrança, webhook de confirmação e conciliação).
- Controle de acesso por perfil e auditoria de ações.
- Envio de e-mails/WhatsApp e gestão de notificações.
- Domínio, hospedagem com HTTPS, backups e monitoramento.
- Revisão jurídica dos Termos, da Política de Privacidade e das regras de venda, além de adequação à LGPD.
- Definição de regras comerciais, política de cancelamento, reembolso, frete e responsabilidade.

Os textos legais incluídos são modelos demonstrativos e não substituem assessoria jurídica. A calculadora é apenas uma ferramenta matemática de referência e não constitui prescrição, orientação de uso, preparo ou aplicação.
