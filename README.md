# rateio2you

Loja de compras coletivas com **Supabase** (banco, login, imagens e tempo real) e **Pix do Banco Inter** (cobrança automática, confirmação por consulta e webhook).

O visual original foi preservado. O site é **estático** (HTML/CSS/JS, sem build) e a API do Pix roda como **serverless functions** na Vercel.

---

## Comece por aqui

| Documento | Para quem |
| --- | --- |
| **[GUIA-PASSO-A-PASSO.md](GUIA-PASSO-A-PASSO.md)** | **Comece por este.** Cria o Supabase, roda os SQLs, publica na Vercel e testa tudo. |
| **[GUIA-BANCO-INTER.md](GUIA-BANCO-INTER.md)** | Só quando quiser ligar o Pix automático. Explica credenciais, certificado, base64, webhook e erros. |
| **[.env.example](.env.example)** | Lista das variáveis da Vercel (sem valores). |

---

## O que já está pronto

- Catálogo dinâmico: lotes, produtos, pronta entrega e leilões vindos do Supabase.
- Cadastro/login com Supabase Auth, aprovação de membros e aprovação automática opcional.
- Carrinho por usuário (localStorage) e pedidos salvos na nuvem.
- Endereços, perfil e histórico em **Minha conta**.
- Painel `admin.html` protegido por `role = admin`:
  - visão geral, pedidos em tempo real, detalhes e itens;
  - confirmação manual de Pix, liberação de saldo, envio, rastreio e entrega;
  - CRUD de produtos, lotes, pronta entrega e leilões com upload de imagem;
  - clientes (aprovar, bloquear, editar);
  - textos, cores, banner, frete, sinal e modo de cobrança.
- Tempo real: mudanças no painel aparecem na loja sem recarregar.
- Pix em dois modos:
  - **manual** (chave Pix + conferência no extrato);
  - **automático** (Banco Inter: cria cobrança, consulta a cada 5 s e recebe webhook).
- Regras de segurança (RLS) no banco: cada cliente vê apenas os próprios pedidos; só o admin altera o catálogo e as configurações.
- Valores de pagamento e confirmação são processados no banco por funções atômicas.

---

## Estrutura

```text
rateio2you-supabase/
├── index.html                  loja
├── admin.html                  painel do organizador
├── assets/
│   ├── css/
│   │   ├── styles.css          visual da loja
│   │   └── admin.css           visual do painel
│   ├── js/
│   │   ├── config.js           ← edite aqui: URL + anon key do Supabase
│   │   ├── data.js             dados padrão e normalização
│   │   ├── pix.js              geração do código Pix (manual)
│   │   ├── supabase-client.js  camada de dados/auth/tempo real
│   │   ├── core.js             layout, tema, modais, Pix
│   │   ├── pages-*.js          telas da loja
│   │   ├── admin.js            telas do painel
│   │   └── app.js              roteador da loja
│   ├── img/                    imagens e favicon
│   └── fonts/                  fontes locais
├── supabase/
│   ├── 01-schema.sql           tabelas, índices, funções, triggers e RLS
│   ├── 02-storage.sql          bucket product-images
│   └── 03-seed.sql             configurações e catálogo de exemplo
├── api/
│   ├── health.js               diagnóstico público
│   └── pix/
│       ├── create.js           cria/reaproveita cobrança no Inter
│       ├── status.js           consulta e confirma o Pix
│       ├── webhook.js          recebe o aviso do Inter
│       └── register-webhook.js registra a URL no Inter (ADMIN_TOKEN)
├── lib/
│   ├── http.js                 CORS, respostas e parse do corpo
│   ├── supabase.js             cliente com service_role (servidor)
│   ├── auth.js                 valida o token do usuário
│   └── inter.js                OAuth mTLS, cobrança, consulta e webhook
├── .env.example
├── vercel.json
└── package.json
```

---

## Início rápido (5 passos)

1. Crie um projeto no Supabase.
2. No **SQL Editor**, rode nesta ordem: `supabase/01-schema.sql`, `supabase/02-storage.sql`, `supabase/03-seed.sql`.
3. Copie **Project URL** e **anon public** para `assets/js/config.js`.
4. Crie seu usuário em **Authentication → Users** e rode o `update` que promove a admin (está no fim do `03-seed.sql`).
5. Publique na Vercel e cadastre as variáveis de `.env.example`.

O detalhe de cada passo está no **[GUIA-PASSO-A-PASSO.md](GUIA-PASSO-A-PASSO.md)**.

---

## Rodar localmente

### Opção 1 — Vercel CLI (recomendado: testa site + API)

Precisa do [Node.js LTS](https://nodejs.org) instalado.

```powershell
npm install
npx vercel dev
```

Na primeira vez, o Vercel CLI pede login e algumas respostas. Aceite as opções padrão. Ele sobe o site em `http://localhost:3000` e também executa `/api/*`.

Crie um arquivo `.env` (copie de `.env.example`) com as mesmas variáveis da Vercel. **Nunca** envie o `.env` para o GitHub.

### Opção 2 — Servidor estático (só a loja, sem API)

Qualquer servidor estático serve. Exemplos:

```powershell
npx serve .
```

ou, no VS Code, instale a extensão **Live Server** e clique em **Go Live**.

> Sem a API, o botão de Pix automático não funciona. Use o **modo manual** em Configurações → Pagamento.
> Não abra o `index.html` direto com `file://`: o login do Supabase precisa de um endereço `http://` ou `https://`.

---

## Deploy

### Vercel (recomendado)

1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel: **Add New → Project → Import**.
3. Framework: **Other**. Build e Output: vazio.
4. Cadastre as variáveis de `.env.example` (as do Supabase são obrigatórias).
5. **Deploy**.
6. Ajuste `PUBLIC_SITE_URL` e faça **Redeploy**.
7. No Supabase: **Authentication → URL Configuration** → **Site URL** e **Redirect URLs** iguais ao endereço da Vercel.

### Netlify

O site estático funciona no Netlify (arraste a pasta ou conecte o GitHub). Porém, as funções em `api/` estão no formato da Vercel. Sem adaptá-las para `netlify/functions`, o **Pix automático não funciona** no Netlify — use o modo manual ou publique a API na Vercel.

---

## Segurança

- `assets/js/config.js` contém apenas a **anon key** (pública). As regras de RLS protegem os dados.
- `SUPABASE_SERVICE_ROLE_KEY`, certificado do Inter, Client Secret e tokens ficam **somente** nas variáveis da Vercel.
- O `.gitignore` já bloqueia `.env`, `.vercel`, `node_modules` e logs.
- O painel `admin.html` tem `noindex` e exige login com `role = admin` **e** `status = ativo`.
- O webhook exige `INTER_WEBHOOK_TOKEN`; o registro do webhook exige `ADMIN_TOKEN`.
- A API valida o token do usuário no Supabase antes de criar/consultar cobranças.
- A confirmação de pagamento é feita por função no banco (`security definer`), não pelo navegador.

> **Nunca** confirme um Pix manual sem ver o valor na conta. O modo manual não verifica o extrato sozinho.

---

## Modo manual x automático

| | Manual | Automático (Inter) |
| --- | --- | --- |
| Precisa de conta PJ no Inter | Não | Sim |
| Gera QR Code | Sim (código estático) | Sim (cobrança dinâmica) |
| Confirma sozinho | Não | Sim (consulta + webhook) |
| Onde configurar | Painel → Configurações → Pagamento | Variáveis da Vercel + painel |
| Indicado para | Começar hoje / testar | Produção com volume |

Para trocar de modo: painel → **Configurações** → **Pagamento** → **Modo de cobrança** → salvar.

---

## Licença e uso

Projeto privado de uso pessoal. As imagens e marcas dos produtos pertencem aos seus respectivos donos. Substitua o catálogo de exemplo antes de vender.
