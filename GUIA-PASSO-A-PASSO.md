# rateio2you — Guia passo a passo (do zero ao site no ar)

> **Para quem é este guia:** você nunca publicou um site e quer fazer tudo sozinho.
> Siga na ordem. Cada etapa termina com um **✅ Confira** para você saber que deu certo.
> Tempo estimado: **1 a 2 horas** (sem contar a aprovação da integração do Banco Inter, que pode levar alguns dias).

---

## O que você vai precisar

- [ ] Uma conta no [Supabase](https://supabase.com) (gratuita).
- [ ] Uma conta no [GitHub](https://github.com) (gratuita).
- [ ] Uma conta na [Vercel](https://vercel.com) (gratuita) — é onde o site e a API do Pix vão rodar.
- [ ] Uma conta **Pessoa Jurídica** no Banco Inter com Pix habilitado (só para o Pix automático).
- [ ] Um computador com Windows (os comandos deste guia usam o PowerShell, que já vem instalado).

> **Importante:** o site funciona em dois modos de Pix:
> 1. **Manual** — você cadastra sua chave Pix e confere o pagamento no extrato. Funciona **hoje**, sem Banco Inter.
> 2. **Automático (Banco Inter)** — o site gera o QR Code, consulta o banco e confirma sozinho. Precisa das credenciais do Inter (guia separado: `GUIA-BANCO-INTER.md`).
>
> Comece no modo manual. Depois ligue o automático quando quiser.

---

## Visão geral do que já está pronto

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | A loja (catálogo, pedidos, leilão, conta, login). |
| `admin.html` | O painel do organizador (protegido por login). |
| `assets/js/config.js` | **O único arquivo que você edita com as chaves do Supabase.** |
| `supabase/01-schema.sql` | Cria as tabelas, regras de segurança e funções. |
| `supabase/02-storage.sql` | Cria o espaço de imagens dos produtos. |
| `supabase/03-seed.sql` | Coloca produtos de exemplo e textos iniciais. |
| `api/` + `lib/` | A API do Pix (roda na Vercel, nunca no navegador). |
| `.env.example` | Lista das variáveis secretas que vão na Vercel. |

---

# ETAPA 1 — Criar o projeto no Supabase

1. Entre em <https://supabase.com/dashboard>.
2. Clique em **New project** (Novo projeto).
3. Preencha:
   - **Name:** `rateio2you`
   - **Database Password:** clique em **Generate a password** e **guarde essa senha** (você não vai precisar dela no dia a dia, mas não perca).
   - **Region:** escolha **South America (São Paulo)** se aparecer. Caso não apareça, escolha a mais próxima.
4. Clique em **Create new project** e espere de **2 a 5 minutos** (o Supabase está montando o banco).

### ✅ Confira
Você deve ver o painel do projeto com o menu lateral: **Table Editor**, **SQL Editor**, **Authentication**, **Storage**, etc.

---

# ETAPA 2 — Criar as tabelas (rodar os 3 SQLs)

Você vai copiar e colar **três arquivos** no SQL Editor, **nesta ordem**.

### 2.1 — `01-schema.sql` (tabelas e segurança)

1. No menu lateral, clique em **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase/01-schema.sql` do projeto no Bloco de Notas (ou no VS Code).
4. Selecione **tudo** (`Ctrl + A`), copie (`Ctrl + C`) e cole no SQL Editor.
5. Clique em **Run** (ou `Ctrl + Enter`).
6. Deve aparecer **“Success. No rows returned”** ou uma mensagem parecida.

### 2.2 — `02-storage.sql` (imagens)

1. **New query** novamente.
2. Copie todo o conteúdo de `supabase/02-storage.sql`, cole e clique em **Run**.
3. Deve aparecer **Success**.

### 2.3 — `03-seed.sql` (produtos de exemplo)

1. **New query** novamente.
2. Copie todo o conteúdo de `supabase/03-seed.sql`, cole e clique em **Run**.
3. Deve aparecer **Success**.

### ✅ Confira
No menu **Table Editor**, você deve ver estas tabelas:
`profiles`, `addresses`, `lots`, `products`, `stock_items`, `auctions`, `bids`, `orders`, `payments`, `settings`.

> **Deu erro?** Veja a seção **Problemas comuns** no fim deste guia. O erro mais comum é rodar os arquivos fora de ordem.

---

# ETAPA 3 — Copiar a URL e a chave para o `config.js`

1. No Supabase, clique no ícone de engrenagem (**Project Settings**) e procure **Data API** (em projetos novos) ou **API** (em projetos antigos).
2. Copie dois valores:
   - **Project URL** (às vezes aparece como **API URL**) — algo como `https://abcdefghijklmno.supabase.co`
   - **anon public** (ou **Publishable key**) — um texto longo começando com `eyJ...` ou `sb_publishable_...`
3. Abra o arquivo `assets/js/config.js` neste projeto.
4. Substitua **somente** estas duas linhas:

```js
SUPABASE_URL: "COLE_AQUI_A_URL_DO_SUPABASE",
SUPABASE_ANON_KEY: "COLE_AQUI_A_ANON_KEY_DO_SUPABASE",
```

Por (repare que os valores ficam **entre aspas**):

```js
SUPABASE_URL: "https://abcdefghijklmno.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
```

> ⚠️ **Atenção ao copiar a URL:** se o painel mostrar
> `https://abcdefghijklmno.supabase.co/rest/v1/`, apague o final
> `/rest/v1/` e a barra. A URL correta termina em **`.supabase.co`**.
> Também não esqueça as **aspas** em volta da URL e da chave.

5. Salve o arquivo (`Ctrl + S`).

> **Nunca** coloque a chave **service_role** neste arquivo. Ela é secreta e só vai na Vercel (Etapa 6).
> A chave **anon** pode ficar no site: ela é pública por natureza e as regras do banco (RLS) protegem os dados.

### ✅ Confira
Abra o `index.html` no navegador. Em vez da tela “Falta conectar o banco de dados”, deve aparecer a tela de **Entrar / Criar conta**.
Se ainda aparecer o aviso, confira se não sobrou nenhum `COLE_AQUI` e se a URL termina em `.supabase.co`.

---

# ETAPA 4 — Configurar o login (Authentication)

1. No Supabase, clique em **Authentication** → **Providers** → **Email**.
2. Confirme que **Enable Email provider** está ligado.
3. Para facilitar o começo, **desligue** a opção **Confirm email** (Confirmar e-mail).
   - Com ela desligada, o cliente cria a conta e já entra.
   - Se preferir mais segurança, deixe ligada; o cliente terá que clicar no link do e-mail.
4. Clique em **Save**.

### 4.1 — Endereços do site (URL Configuration)

1. Ainda em **Authentication**, clique em **URL Configuration**.
2. Em **Site URL**, coloque o endereço final do site (você ainda não o tem; pode voltar aqui depois):
   `https://SEU-SITE.vercel.app`
3. Em **Redirect URLs**, adicione:
   - `https://SEU-SITE.vercel.app/**`
   - `http://localhost:3000/**` (se for testar no seu computador)
4. Clique em **Save**.

> Se você ainda não publicou, siga para a Etapa 6 e volte aqui depois de saber o endereço da Vercel.

---

# ETAPA 5 — Criar o seu usuário administrador

O painel `admin.html` só abre para quem tem `role = 'admin'` e `status = 'ativo'` na tabela `profiles`.

### 5.1 — Criar o usuário

1. No Supabase, clique em **Authentication** → **Users**.
2. Clique em **Add user** → **Create new user**.
3. Preencha:
   - **Email:** seu e-mail (ex.: `seuemail@gmail.com`)
   - **Password:** uma senha forte (mínimo 6 caracteres; use 12 ou mais)
   - Marque **Auto Confirm User** (Confirmar usuário automaticamente).
4. Clique em **Create user**.

> O banco cria sozinho a linha correspondente na tabela `profiles` (existe um gatilho para isso).

### 5.2 — Transformar em administrador

1. Vá em **SQL Editor** → **New query**.
2. Cole o comando abaixo, **trocando o e-mail** pelo seu:

```sql
update public.profiles
   set role = 'admin',
       status = 'ativo'
 where email = 'seuemail@gmail.com';
```

3. Clique em **Run**.
4. Para conferir, rode:

```sql
select id, full_name, email, role, status
  from public.profiles
 where role = 'admin';
```

### ✅ Confira
A consulta deve mostrar o seu e-mail com `role = admin` e `status = ativo`.

> **Não apareceu nenhuma linha?** O usuário não foi criado no Authentication, ou o e-mail está diferente. Crie o usuário novamente e repita o `update`.

---

# ETAPA 6 — Publicar na Vercel

> A Vercel hospeda o site **e** a API do Pix (`/api/...`) no mesmo endereço. É o caminho mais simples.

## 6.1 — Colocar o projeto no GitHub

1. Crie uma conta em <https://github.com> (se ainda não tiver).
2. Baixe e instale o **GitHub Desktop**: <https://desktop.github.com>.
3. Abra o GitHub Desktop → **File** → **Add local repository**.
4. Escolha a pasta `rateio2you-supabase` (esta pasta do projeto).
5. Clique em **create a repository** (criar um repositório) quando ele avisar que a pasta não é um repositório.
   - **Name:** `rateio2you-supabase`
   - **Local path:** a pasta do projeto
   - Clique em **Create repository**.
6. Clique em **Publish repository**.
   - Desmarque **Keep this code private** se quiser um repositório público (não há segredo dentro dele).
   - Clique em **Publish repository**.

> **Nunca** suba o arquivo `.env` para o GitHub. O projeto já tem um `.gitignore` que impede isso. As chaves secretas ficam na Vercel.

## 6.2 — Importar na Vercel

1. Entre em <https://vercel.com> e faça login **com a conta do GitHub**.
2. Clique em **Add New…** → **Project**.
3. Encontre o repositório `rateio2you-supabase` e clique em **Import**.
4. Em **Framework Preset**, escolha **Other** (ou deixe **Vercel** detectar; o `vercel.json` já configura tudo).
5. **Root Directory:** deixe vazio (a raiz do repositório).
6. **Build Command:** deixe vazio.
7. **Output Directory:** deixe vazio.
8. **Environment Variables:** adicione as variáveis da tabela abaixo (clique em **Add** para cada uma).

### Variáveis obrigatórias (para o site funcionar)

| Nome | Onde pegar | Exemplo |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → Data API (ou API) → Project URL (sem `/rest/v1/`) | `https://abcdefghijklmno.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → anon public / Publishable key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → service_role / Secret key (clique em **Reveal**) | `eyJhbGci...` |
| `PUBLIC_SITE_URL` | O endereço que a Vercel vai te dar (ex.: `https://rateio2you.vercel.app`) | sem barra no final |

> `SUPABASE_SERVICE_ROLE_KEY` é **secreta**. Ela só é usada pela API do Pix no servidor. Nunca a coloque no `config.js` nem no GitHub.

### Variáveis do Pix automático (só quando for usar o Inter)

| Nome | O que é |
| --- | --- |
| `INTER_ENV` | `producao` (ou `sandbox` para testes) |
| `INTER_CLIENT_ID` | Client ID da integração do Inter |
| `INTER_CLIENT_SECRET` | Client Secret da integração do Inter |
| `INTER_PIX_KEY` | Sua chave Pix cadastrada na conta PJ |
| `INTER_CERT_B64` | Certificado `.crt` convertido para base64 |
| `INTER_KEY_B64` | Chave `.key` convertida para base64 |
| `INTER_PFX_B64` | (alternativa) arquivo `.pfx` inteiro em base64 |
| `INTER_PFX_PASSWORD` | (só se usar `.pfx`) senha do arquivo |
| `INTER_WEBHOOK_TOKEN` | Um texto longo e aleatório que você inventa |
| `ADMIN_TOKEN` | Outro texto longo e aleatório que você inventa |
| `INTER_SCOPES` | Opcional. Ex.: `pix.read pix.write cob.read cob.write webhook.read webhook.write` |

> O passo a passo completo do Inter está em `GUIA-BANCO-INTER.md`. Se ainda não for usar, **pule estas variáveis**. O site cai no modo manual.

9. Clique em **Deploy** e espere. Em 1 ou 2 minutos a Vercel mostra o endereço, algo como:
   `https://rateio2you-supabase.vercel.app`

## 6.3 — Ajustar o endereço do site

1. Copie o endereço que a Vercel te deu.
2. Na Vercel: **Project** → **Settings** → **Environment Variables** → edite `PUBLIC_SITE_URL` e cole o endereço (sem `/` no final).
3. Volte ao Supabase → **Authentication** → **URL Configuration** → cole o mesmo endereço em **Site URL** e em **Redirect URLs** (`https://SEU-SITE.vercel.app/**`).
4. Na Vercel, abra a aba **Deployments**, clique nos três pontinhos do último deploy → **Redeploy** (para aplicar a variável alterada).

### ✅ Confira
Abra `https://SEU-SITE.vercel.app` no navegador (ou no celular). A tela de login deve aparecer.
Abra `https://SEU-SITE.vercel.app/admin.html` e entre com o e-mail/senha do administrador criado na Etapa 5. O painel deve abrir.

---

# ETAPA 7 — Testar a loja de ponta a ponta

Faça este roteiro na ordem. Ele valida banco, login, cadastro, pedido e painel.

1. **Criar um cliente de teste**
   - Abra o site → **Criar conta** → preencha nome, e-mail e senha.
   - Se você desligou a confirmação de e-mail, ele já entra; senão, confirme pelo e-mail.
   - Se aparecer **“aguardando liberação”**, é porque a aprovação automática está desligada. Vá ao painel → **Clientes** → aprove o cadastro.

2. **Conferir o catálogo**
   - Entre como cliente. Devem aparecer os 3 produtos de exemplo no lote “Smartwatch”.
   - Se não aparecer nada, confira se o `03-seed.sql` foi executado e se o cliente está **ativo**.

3. **Fazer um pedido**
   - Abra **Fazer pedido**, escolha o lote, ajuste as quantidades e clique em **Reservar**.
   - Escolha um endereço (cadastre um em **Minha conta** se precisar).
   - Clique em **Gerar Pix**.
   - No modo manual, aparece o código copia-e-cola. No modo automático, aparece o QR Code do Inter.

4. **Conferir no painel**
   - Abra `admin.html` → **Pedidos**.
   - O pedido deve aparecer **em tempo real**, com itens, endereço, telefone e e-mail.
   - Clique em **Detalhes** para ver tudo.

5. **Confirmar o pagamento (modo manual)**
   - No pedido, clique em **Confirmar Pix**.
   - O status deve mudar para **Pago** (ou **Sinal pago**, se for sinal).
   - O cliente vê a mudança na hora, em **Meus pedidos**.

6. **Testar produto novo**
   - Painel → **Produtos** → **Novo produto** → preencha nome, preço, descrição e estoque.
   - Envie uma imagem (o upload usa o bucket `product-images`).
   - Salve e confira se o produto aparece na loja **sem recarregar a página**.

7. **Testar configurações**
   - Painel → **Configurações** → mude o nome do site ou as cores → **Salvar configurações**.
   - A loja deve atualizar sozinha.

### ✅ Confira
Se os 7 passos funcionaram, o núcleo do site está pronto. 🎉

---

# ETAPA 8 — Escolher e configurar o modo de cobrança Pix

## Opção A — Manual (recomendado para começar hoje)

1. Painel → **Configurações** → seção **Pagamento**.
2. Em **Modo de cobrança**, escolha **Manual — chave Pix**.
3. Preencha:
   - **Chave Pix:** sua chave (CPF/CNPJ, e-mail, telefone ou aleatória). Use exatamente como está cadastrada no banco.
   - **Nome do recebedor no Pix:** sem acentos e em maiúsculas (ex.: `RATEIO2YOU`).
   - **Cidade do recebedor no Pix:** sem acentos e em maiúsculas (ex.: `SAO PAULO`).
4. Clique em **Salvar configurações**.
5. Faça um pedido de teste e pague um valor pequeno de verdade.
6. Confira o valor na sua conta e clique em **Confirmar Pix** no painel.

> **Atenção:** no modo manual o site **não** verifica o pagamento sozinho. Ele apenas mostra o código e avisa você. A conferência é feita por você, no extrato do banco. Nunca confirme sem ver o dinheiro na conta.

## Opção B — Automático com Banco Inter

1. Siga o `GUIA-BANCO-INTER.md` para obter as credenciais e configurar as variáveis na Vercel.
2. Depois de configurar, abra o painel → **Configurações** → **Pagamento** → **Testar API Pix**.
3. Se aparecer **API configurada**, escolha **Automático — Banco Inter** e salve.
4. Faça um pedido de teste e pague um valor pequeno de verdade.
5. O site consulta o Inter a cada 5 segundos e confirma sozinho. O webhook é uma segunda camada de segurança.
6. Se o pagamento não confirmar, veja o **webhook** no guia do Inter.

---

# ETAPA 9 — Registrar o webhook do Inter (só modo automático)

O webhook é o aviso que o Banco Inter manda para o seu site quando alguém paga. Sem ele, a confirmação ainda funciona pela consulta a cada 5 segundos, mas o webhook deixa tudo mais rápido e seguro.

1. Tenha em mãos o `ADMIN_TOKEN` que você criou na Vercel.
2. Abra o **PowerShell** no Windows e rode (trocando o endereço e o token):

```powershell
$site = "https://SEU-SITE.vercel.app"
$token = "SEU_ADMIN_TOKEN"

Invoke-RestMethod `
  -Method Post `
  -Uri "$site/api/pix/register-webhook" `
  -Headers @{ "x-admin-token" = $token } `
  -ContentType "application/json" `
  -Body '{}'
```

3. A resposta deve ser algo como:

```json
{ "ok": true, "webhookUrl": "https://SEU-SITE.vercel.app/api/pix/webhook?token=..." }
```

4. Se der erro, confira:
   - O site é **HTTPS** e está público (não use `localhost`).
   - O `ADMIN_TOKEN` é exatamente o mesmo da Vercel.
   - As variáveis do Inter estão corretas (veja `GUIA-BANCO-INTER.md`).

---

# ETAPA 10 — Como usar o painel no dia a dia

Abra `https://SEU-SITE.vercel.app/admin.html`.

| Menu | O que você faz |
| --- | --- |
| **Visão geral** | Vendas, pedidos aguardando pagamento, clientes pendentes e estoque baixo. |
| **Pedidos** | Vê pedidos em tempo real, filtra por status, abre detalhes, confirma Pix, libera saldo, marca como enviado/entregue e coloca o código de rastreio. |
| **Produtos** | Cria, edita e apaga produtos. Define preço, descrição, estoque, quantidade máxima por pedido e imagem. |
| **Lotes** | Cria e edita os lotes de compra coletiva (título, marca, descrição, data de fechamento). |
| **Pronta entrega** | Cadastra itens com estoque próprio. O estoque baixa sozinho quando o Pix é confirmado. |
| **Leilões** | Cria leilões e acompanha os lances. |
| **Clientes** | Aprova, bloqueia, edita dados e endereços. |
| **Configurações** | Muda textos, cores, banner, frete por região, sinal, modo de Pix e aprovação automática de cadastros. |

### Regras importantes do painel

- **Confirmar Pix** só deve ser clicado depois de ver o dinheiro na conta (modo manual).
- **Liberar saldo** é usado quando o box fecha e o cliente precisa pagar o restante.
- **Excluir** um produto ou pedido é permanente. Não existe lixeira.
- As credenciais do Inter **não ficam** no painel. Elas ficam nas variáveis da Vercel.

---

# Checklist final

- [ ] Os 3 SQLs rodaram sem erro.
- [ ] `config.js` tem a URL e a anon key do Supabase.
- [ ] O administrador foi criado no Authentication e promovido no SQL.
- [ ] O site abre na Vercel e o login funciona.
- [ ] `admin.html` abre e mostra o painel.
- [ ] Consegui criar um cliente, aprovar, fazer um pedido e ver no painel.
- [ ] O modo de Pix escolhido funciona (manual testado ou API configurada).
- [ ] `PUBLIC_SITE_URL` está igual ao endereço da Vercel.
- [ ] O Supabase tem **Site URL** e **Redirect URLs** iguais ao endereço da Vercel.
- [ ] O webhook foi registrado (só se usar o Inter).
- [ ] Testei um pagamento real de valor pequeno.

---

# Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| “O arquivo config.js ainda não foi preenchido” | URL ou anon key erradas / ainda com `COLE_AQUI` | Confira a Etapa 3. A URL precisa terminar em `.supabase.co`. |
| “As tabelas ainda não foram criadas” | `01-schema.sql` não rodou ou rodou pela metade | Rode o `01-schema.sql` inteiro novamente. |
| “Cadastro não encontrado” | Gatilho de perfil não existe | Rode novamente a parte de funções/gatilhos do `01-schema.sql`. |
| “Seu cadastro ainda aguarda liberação” | Aprovação automática desligada | Painel → **Clientes** → aprove; ou ligue **Aprovação automática** em Configurações. |
| Nenhum produto aparece | `03-seed.sql` não rodou, ou o cliente não está ativo | Rode o seed e aprove o cliente. |
| Upload de imagem falha | Bucket não existe | Rode o `02-storage.sql`. |
| “API Pix não configurada” | Variáveis do Inter faltando na Vercel | Veja `GUIA-BANCO-INTER.md`; ou use o modo manual. |
| Pix gerado, mas não confirma | Webhook não registrado / pagamento ainda não caiu | Confira o extrato, registre o webhook e aguarde alguns segundos. |
| Login funciona no Supabase, mas o site não entra | URL do site diferente da cadastrada no Supabase | Ajuste **Site URL** e **Redirect URLs** (Etapa 4.1). |
| Alterei a Vercel e nada mudou | Faltou redeploy | **Deployments** → **Redeploy**. |

---

# Segurança e manutenção

- **Nunca** compartilhe a `service_role`.
- **Nunca** suba o `.env` para o GitHub.
- Troque o `ADMIN_TOKEN` e o `INTER_WEBHOOK_TOKEN` se desconfiar de vazamento.
- Faça backup: Supabase → **Database** → **Backups** (o plano gratuito tem backup diário limitado). Para uma cópia manual, use **Table Editor** → exportar CSV das tabelas principais.
- Se o certificado do Inter vencer, gere outro e atualize `INTER_CERT_B64`/`INTER_KEY_B64` na Vercel.
- Para atualizar o site, edite os arquivos, faça commit no GitHub Desktop e envie. A Vercel publica sozinha.

---

# Onde está cada coisa

```text
rateio2you-supabase/
├── index.html               → loja
├── admin.html               → painel do organizador
├── assets/
│   ├── css/                 → estilos (loja e painel)
│   ├── js/
│   │   ├── config.js        → SUAS CHAVES DO SUPABASE (edite aqui)
│   │   ├── supabase-client.js → toda a comunicação com o banco
│   │   ├── core.js          → layout, tema, Pix, tempo real
│   │   ├── pages-*.js       → telas da loja
│   │   └── admin.js         → telas do painel
│   ├── img/                 → imagens e favicon
│   └── fonts/               → fontes
├── supabase/
│   ├── 01-schema.sql        → tabelas, RLS, funções
│   ├── 02-storage.sql       → bucket de imagens
│   └── 03-seed.sql          → dados de exemplo
├── api/                     → rotas do Pix (Vercel)
├── lib/                     → código do servidor (Inter, Supabase, auth)
├── .env.example             → modelo das variáveis da Vercel
├── vercel.json              → configuração de deploy
└── package.json             → dependência do servidor
```

---

## Próximo passo

Se você chegou até aqui e o site está no ar no modo manual: **parabéns, você já tem uma loja funcionando.**

Quando quiser receber Pix automático, abra o **`GUIA-BANCO-INTER.md`** e siga com calma. É a parte mais burocrática, mas está explicada campo por campo.
