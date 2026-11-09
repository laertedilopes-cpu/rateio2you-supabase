# Banco Inter — Pix automático, campo por campo

> **Leia antes:** este guia só é necessário se você quiser que o site **gere o QR Code e confirme o pagamento sozinho**.
> Se você só quer começar a vender, use o **modo manual** (chave Pix) explicado no `GUIA-PASSO-A-PASSO.md`.
>
> **O que este guia NÃO faz:** ele não abre conta, não aprova integração e não substitui o suporte do Banco Inter.
> A aprovação da integração é feita pelo próprio banco e pode levar alguns dias.

---

## Como o Pix automático funciona neste projeto

```text
Cliente clica em "Gerar Pix"
        │
        ▼
Site chama /api/pix/create (na Vercel)
        │  valida o login e o pedido
        ▼
API pega um token no Inter (com certificado + client id/secret)
        │
        ▼
API cria a cobrança no Inter (PUT /pix/v2/cob/{txid})
        │
        ▼
Site mostra o QR Code e o copia-e-cola
        │
        ├── a cada 5 s o site chama /api/pix/status
        │       └── se o Inter responder CONCLUIDA → confirma no banco
        │
        └── o Inter também chama /api/pix/webhook quando o Pix cai
                └── confirma no banco (segunda camada)
```

O certificado, o client secret e a chave Pix **nunca** vão para o navegador. Eles ficam apenas nas variáveis de ambiente da Vercel.

---

# PARTE 1 — Conseguir as credenciais no Banco Inter

## 1.1 — Pré-requisitos

- [ ] Conta **Pessoa Jurídica (PJ)** no Banco Inter.
- [ ] Pix habilitado nessa conta.
- [ ] Acesso ao **Internet Banking PJ** (pelo computador; o aplicativo pode não mostrar todas as opções).
- [ ] Um celular cadastrado para receber o SMS de confirmação.
- [ ] A chave Pix que vai receber os pagamentos já cadastrada na conta.

> **Pessoa Física não serve** para a API Pix do Inter Empresas. É preciso CNPJ e conta PJ.

## 1.2 — Criar a integração (passo a passo)

1. Entre no **Internet Banking PJ** do Inter: <https://bancointer.com.br> → **Pessoa Jurídica** → **Acessar**.
2. No menu, procure **Soluções para sua empresa** (ou **Integrar**).
3. Clique em **Nova Integração**.
4. Preencha os dados pedidos:
   - **Nome da integração:** `rateio2you`
   - **Descrição:** `Loja de compras coletivas — cobrança Pix`
   - **URL do site:** o endereço da sua loja na Vercel.
5. Clique em **Continuar**.
6. Selecione os serviços que a integração vai usar. Para este projeto, habilite:
   - **Pix Cobrança** / **Cobrança Pix** (criar e consultar cobranças)
   - **Webhook** / **Notificações Pix** (receber o aviso de pagamento)
   - Se aparecer **Pix Recebimentos** ou **Consultar Pix**, também pode marcar.
7. Confirme a criação com o **código enviado por SMS**.
8. O pedido será **analisado pelo Inter**. Se atender aos requisitos, o banco pode pedir um formulário complementar.
9. Quando for **aprovada**, a integração aparece na aba **Minhas Integrações** com o status **“Novo”**.

> **Muito importante:** o certificado e as credenciais são exibidos **uma única vez**, enquanto o status é **“Novo”**. Se você perder, provavelmente terá que criar outra integração.

## 1.3 — Baixar o certificado e as credenciais

1. Ainda no Internet Banking PJ, vá em **Minhas Integrações**.
2. Na linha da sua integração, clique nos **três pontinhos** da coluna **Ações**.
3. Escolha **Download chave e certificado**.
4. Guarde os arquivos em uma pasta segura, por exemplo:
   `C:\Users\EMPRESA\Downloads\inter\`
   - um arquivo de certificado, normalmente `certificado.crt` (ou `.pem`);
   - um arquivo de chave, normalmente `chave.key` (ou `.pem`);
   - em algumas contas, um único arquivo `.pfx`.
5. Na mesma tela (ou no download), copie e guarde:
   - **Client ID**
   - **Client Secret**

> **Segurança:** esses arquivos dão acesso à sua conta. Não envie por WhatsApp, não suba para o GitHub e não guarde no OneDrive público. Se vazar, gere outra integração e cancele a antiga.

## 1.4 — Descobrir a chave Pix

A chave Pix é a que já está cadastrada na conta PJ. Pode ser:

- CNPJ (somente números, ou no formato `00.000.000/0000-00` — use **exatamente** como aparece no cadastro);
- e-mail;
- telefone (com `+55`);
- chave aleatória (um texto longo).

Para conferir no Internet Banking: **Pix** → **Minhas chaves**.

> A chave usada em `INTER_PIX_KEY` precisa pertencer à **mesma conta** dona da integração. Se for de outra pessoa, o Inter recusa a cobrança.

---

# PARTE 2 — Converter o certificado para base64

A Vercel guarda variáveis de ambiente como texto. Por isso, o certificado e a chave precisam ser convertidos para **base64** (um texto longo).

## 2.1 — Abrir o PowerShell

1. Clique no botão **Iniciar** do Windows.
2. Digite **PowerShell**.
3. Abra o **Windows PowerShell** (não precisa ser administrador).

## 2.2 — Converter o certificado

No PowerShell, rode o comando abaixo **trocando o caminho** pelo caminho real do seu arquivo:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\EMPRESA\Downloads\inter\certificado.crt")) | Set-Clipboard
```

O texto em base64 já estará **na área de transferência**. Cole no Bloco de Notas para conferir e guardar.

## 2.3 — Converter a chave

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\EMPRESA\Downloads\inter\chave.key")) | Set-Clipboard
```

> **Atenção:** o arquivo `.key` é a **chave privada**. Trate como senha. Não cole em chats, e-mails ou documentos compartilhados.

## 2.4 — Se o Inter te entregou um `.pfx` / `.p12`

Use a forma alternativa:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\Users\EMPRESA\Downloads\inter\integracao.pfx")) | Set-Clipboard
```

E guarde também a **senha do .pfx**. Nesse caso você vai usar `INTER_PFX_B64` + `INTER_PFX_PASSWORD` em vez de `INTER_CERT_B64` + `INTER_KEY_B64`.

## 2.5 — Conferir se o base64 ficou certo

O texto deve:

- começar com `MII` (quase sempre);
- não ter espaços, quebras de linha ou aspas;
- ter alguns milhares de caracteres.

Se você colar no Bloco de Notas e aparecer tudo em **uma linha**, está certo.

> **Dica:** o sistema também aceita o conteúdo PEM original (aquele que começa com `-----BEGIN CERTIFICATE-----`). Mas o base64 é mais seguro contra quebras de linha acidentais. Se for colar o PEM, cole **exatamente** como está, com as linhas `BEGIN` e `END`.

---

# PARTE 3 — Configurar as variáveis na Vercel

## 3.1 — Adicionar as variáveis

1. Entre em <https://vercel.com> → seu projeto.
2. **Settings** → **Environment Variables**.
3. Clique em **Add** e crie uma por uma:

| Variável | Valor | Exemplo / observação |
| --- | --- | --- |
| `INTER_ENV` | `producao` | Use `sandbox` só se for testar no sandbox. |
| `INTER_CLIENT_ID` | Client ID | Copiado do Inter. |
| `INTER_CLIENT_SECRET` | Client Secret | Copiado do Inter. |
| `INTER_PIX_KEY` | Sua chave Pix | Ex.: `12345678000195` (CNPJ) ou um e-mail. |
| `INTER_CERT_B64` | Base64 do `.crt` | Cole o texto gerado no PowerShell. |
| `INTER_KEY_B64` | Base64 do `.key` | Cole o texto gerado no PowerShell. |
| `INTER_WEBHOOK_TOKEN` | Um texto aleatório | Ex.: `r2y_wh_9f3a...` (40+ caracteres). |
| `ADMIN_TOKEN` | Outro texto aleatório | Ex.: `r2y_adm_7c1b...` (40+ caracteres). |
| `INTER_SCOPES` | (opcional) | Só preencha se o Inter exigir. Veja a seção de erros. |

Se for usar `.pfx`, troque as duas variáveis de certificado por:

| Variável | Valor |
| --- | --- |
| `INTER_PFX_B64` | Base64 do `.pfx` |
| `INTER_PFX_PASSWORD` | Senha do `.pfx` |

4. Confira também se as variáveis gerais já existem:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PUBLIC_SITE_URL`

5. Clique em **Save** em cada uma.

> **Atenção:** variáveis com valores muito longos (certificado/chave) podem demorar alguns segundos para salvar. Não feche a página no meio.

## 3.2 — Fazer o redeploy

A Vercel só aplica as novas variáveis em um **novo deploy**.

1. Abra a aba **Deployments**.
2. Clique nos **três pontinhos** do último deploy.
3. Clique em **Redeploy**.
4. Confirme.

---

# PARTE 4 — Testar a configuração

## 4.1 — Testar pelo navegador

Abra no navegador:

```text
https://SEU-SITE.vercel.app/api/health
```

Você deve ver algo parecido com:

```json
{
  "ok": true,
  "configured": true,
  "inter": {
    "configured": true,
    "environment": "producao",
    "missing": []
  },
  "supabaseServerConfigured": true,
  "missing": [],
  "environment": "producao",
  "site": "https://SEU-SITE.vercel.app",
  "time": "2026-11-08T12:00:00.000Z"
}
```

### Como interpretar

| O que aparece | Significado | O que fazer |
| --- | --- | --- |
| `"configured": true` | Tudo pronto. | Pode gerar um Pix de teste. |
| `"inter": { "configured": false, "missing": [...] }` | Faltam variáveis do Inter. | Veja a lista em `missing` e preencha na Vercel. |
| `"supabaseServerConfigured": false` | Falta `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY`. | Preencha e faça redeploy. |
| Erro 404 | O projeto não tem a pasta `api/` ou o deploy não subiu. | Confira se a pasta `api` foi para o GitHub. |
| Erro 500 | Alguma variável está vazia ou inválida. | Abra **Functions** → **Logs** na Vercel. |

> O `/api/health` **não** mostra o valor de nenhum segredo. Ele só diz se a variável existe.

## 4.2 — Testar pelo painel

1. Abra `https://SEU-SITE.vercel.app/admin.html` e entre.
2. Vá em **Configurações** → seção **Pagamento**.
3. Clique em **Testar API Pix**.
4. Deve aparecer **API configurada** em verde.
5. Em **Modo de cobrança**, escolha **Automático — Banco Inter**.
6. Clique em **Salvar configurações**.

## 4.3 — Teste real (valor pequeno)

1. Crie um pedido de teste com um produto barato (ou ajuste o preço de um produto para R$ 1,00 temporariamente).
2. Gere o Pix.
3. Pague com o aplicativo do seu banco.
4. Em até 5 segundos o modal deve mudar para **“Pagamento confirmado”**.
5. Confira no painel → **Pedidos**: o status deve ser **Pago** e o estoque deve ter baixado (se for pronta entrega).

> **Isso é dinheiro real.** Em produção, o valor cai na sua conta PJ. Para treinar sem dinheiro, use o sandbox (Parte 6) ou o modo manual com um valor simbólico.

---

# PARTE 5 — Registrar o webhook

O webhook faz o Inter avisar o site assim que o Pix cai, sem depender da consulta de 5 em 5 segundos.

## 5.1 — Pelo PowerShell (mais fácil)

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

A resposta deve ser parecida com:

```json
{
  "ok": true,
  "webhookUrl": "https://SEU-SITE.vercel.app/api/pix/webhook?token=SEU_INTER_WEBHOOK_TOKEN"
}
```

O sistema monta a URL automaticamente usando `PUBLIC_SITE_URL` + `INTER_WEBHOOK_TOKEN`.

## 5.2 — Se `PUBLIC_SITE_URL` estiver vazia

Envie a URL completa no corpo:

```powershell
$body = '{"webhookUrl":"https://SEU-SITE.vercel.app/api/pix/webhook?token=SEU_INTER_WEBHOOK_TOKEN"}'

Invoke-RestMethod `
  -Method Post `
  -Uri "https://SEU-SITE.vercel.app/api/pix/register-webhook" `
  -Headers @{ "x-admin-token" = "SEU_ADMIN_TOKEN" } `
  -ContentType "application/json" `
  -Body $body
```

## 5.3 — Pelo painel do Inter

Se preferir, o próprio Internet Banking pode ter uma tela de **webhook** na integração. Nesse caso, cadastre manualmente:

```text
https://SEU-SITE.vercel.app/api/pix/webhook?token=SEU_INTER_WEBHOOK_TOKEN
```

> A URL precisa ser **HTTPS**, pública e estar no ar. O Inter não consegue chamar `localhost`.

## 5.4 — Como saber se o webhook funcionou

- Faça um Pix de teste.
- O pedido deve mudar para **Pago** em poucos segundos.
- Na Vercel: **Project** → **Logs** (ou **Functions** → `api/pix/webhook`) deve aparecer uma chamada `POST 200`.
- Se aparecer `401`, o token da URL não bate com `INTER_WEBHOOK_TOKEN`.
- Se aparecer `200` mas o pedido não mudar, o `txid` não foi encontrado — veja a tabela `payments` no Supabase.

---

# PARTE 6 — Sandbox (testes sem dinheiro real)

O Inter oferece um ambiente de testes separado. Para usá-lo:

1. Acesse <https://developers.inter.co/sandbox> e siga as instruções do Inter para obter **credenciais e certificado de sandbox**.
2. Na Vercel, ajuste:
   - `INTER_ENV=sandbox`
   - (opcional) `INTER_API_BASE=https://cdpj-sandbox.partners.bancointer.com.br`
3. Troque `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET`, `INTER_PIX_KEY`, `INTER_CERT_B64` e `INTER_KEY_B64` pelos valores de sandbox.
4. Faça o redeploy e repita o `/api/health`.

> O sandbox é um ambiente separado: as credenciais de produção **não** funcionam nele, e vice-versa. Não misture.

---

# PARTE 7 — Erros comuns e o que fazer

| Código / mensagem | Causa provável | Solução |
| --- | --- | --- |
| `401 Unauthorized` no `/api/health` ou ao gerar Pix | Client ID/Secret errados, certificado errado ou vencido | Confira os valores na Vercel e refaça o download se necessário. Lembre que as credenciais aparecem uma única vez. |
| `401` com “invalid_client” | Client ID/Secret de outra integração | Use o par exato da mesma integração. |
| `401` com erro de certificado / TLS | `.crt` e `.key` não são do mesmo par, ou base64 corrompido | Gere o base64 novamente e cole sem espaços. |
| `403 Forbidden` | A integração não tem o serviço de Pix/webhook habilitado | Edite a integração no Inter e habilite Pix Cobrança e Webhook. |
| `403` com “insufficient_scope” | Falta escopo no token | Adicione `INTER_SCOPES` na Vercel com os escopos da integração, por exemplo `pix.read pix.write cob.read cob.write webhook.read webhook.write`, e faça redeploy. |
| `400` ao criar cobrança | Chave Pix inválida, valor inválido ou `txid` repetido | Confira `INTER_PIX_KEY`; o valor precisa ser maior que zero. |
| `400 calendario.expiracao` | Tempo de expiração fora do permitido | O projeto usa 3600 segundos (1 hora), que é o padrão do Inter. Se você alterou, volte para 3600. |
| `404` ao consultar cobrança | O `txid` não existe naquela conta/ambiente | Confira se está em produção/sandbox correto e se a cobrança foi criada pela mesma integração. |
| `409` / “já existe” | `txid` duplicado | O site reaproveita cobranças pendentes. Se persistir, apague a linha antiga em `payments` ou aguarde a expiração. |
| Pix cai, mas o pedido não muda | Webhook não registrado, token errado ou `txid` desconhecido | Veja os logs da Vercel e a tabela `payments`. |
| “A integração com o Banco Inter não está configurada” | Falta alguma variável | Abra `/api/health` e veja a lista `missing`. |
| QR Code não aparece | Cobrança criada, mas `pixCopiaECola` vazio | Veja os logs de `api/pix/create`. Pode ser erro de chave ou de serviço não habilitado. |

## Onde ver os logs

1. Vercel → seu projeto → **Logs** (ou **Functions**).
2. Filtre por `api/pix/create`, `api/pix/status` ou `api/pix/webhook`.
3. Os erros aparecem com `[pix/create]`, `[pix/status]` e `[pix/webhook]` antes da mensagem.

---

# PARTE 8 — Segurança e manutenção

- O certificado e a chave são **equivalentes a uma senha bancária**. Nunca os coloque no GitHub, em prints ou em chats.
- Use um gerenciador de senhas para guardar o Client Secret, o `ADMIN_TOKEN` e o `INTER_WEBHOOK_TOKEN`.
- Troque o `INTER_WEBHOOK_TOKEN` se desconfiar de vazamento e registre o webhook novamente.
- O certificado do Inter tem validade (normalmente 1 ano). Anote a data de vencimento e renove antes.
- Se o certificado vencer, o site para de gerar Pix automático. O modo manual continua funcionando.
- Não compartilhe a `SUPABASE_SERVICE_ROLE_KEY`. Ela ignora as regras de segurança do banco.

---

## Checklist do Inter

- [ ] Conta PJ com Pix habilitado.
- [ ] Integração criada e **aprovada** no Internet Banking PJ.
- [ ] `Client ID` e `Client Secret` copiados.
- [ ] Certificado `.crt` e chave `.key` baixados (ou `.pfx`).
- [ ] Arquivos convertidos para base64.
- [ ] Variáveis `INTER_*` cadastradas na Vercel.
- [ ] Redeploy feito.
- [ ] `/api/health` mostra `"configured": true`.
- [ ] Painel → **Testar API Pix** mostra **API configurada**.
- [ ] Modo de cobrança = **Automático — Banco Inter**.
- [ ] Webhook registrado.
- [ ] Pix real de valor pequeno confirmado no painel.

Se todos os itens estiverem marcados, o Pix automático está funcionando. 🎉
