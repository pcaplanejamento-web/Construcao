# Setup e Deploy

Guia passo a passo para colocar o sistema no ar: **backend** (Apps Script +
Sheets) e **frontend** (Cloudflare Workers).

---

## Parte 1 — Backend (Google Apps Script + Sheets)

Você pode subir o código de `apps-script/` de duas formas: pelo **editor web**
(copiar/colar) ou via **clasp** (CLI). A planilha-banco é criada automaticamente
pelo `bootstrapAdmin()`.

### Opção A — clasp (recomendado)

1. Instale e autentique:
   ```bash
   npm install -g @google/clasp
   clasp login
   ```
2. Crie o projeto Apps Script (standalone):
   ```bash
   cd apps-script
   clasp create --type standalone --title "Gestão de Obras API"
   ```
   Isso gera um `.clasp.json` com o `scriptId` (já no `.gitignore`).
   Use [`.clasp.example.json`](../apps-script/.clasp.example.json) como referência.
3. Envie o código:
   ```bash
   clasp push
   ```

### Opção B — Editor web

1. Acesse <https://script.google.com> → **Novo projeto**.
2. Crie um arquivo para cada `.gs` de `apps-script/` e cole o conteúdo.
3. Em **Configurações do projeto**, marque "Mostrar arquivo de manifesto
   `appsscript.json`" e cole o conteúdo de
   [`appsscript.json`](../apps-script/appsscript.json).

### Configurar e rodar o bootstrap

1. No editor do projeto, vá em **Configurações do projeto → Propriedades do
   script** e adicione:
   | Propriedade | Valor |
   |-------------|-------|
   | `ADMIN_EMAIL` | e-mail do admin inicial |
   | `ADMIN_SENHA` | senha do admin inicial |
   | `ADMIN_NOME` | (opcional) nome do admin |
   | `SPREADSHEET_ID` | (opcional) ID de uma planilha existente; se vazio, será criada |
2. Selecione a função **`bootstrapAdmin`** e clique **Executar**. Autorize os
   escopos quando solicitado.
3. Veja o **Log de execução**: se a planilha foi criada, a URL aparece ali.
   Confirme as abas (`Usuarios`, `Obras`, `Despesas`, `Categorias`,
   `Configuracoes`, `Sessoes`) e o admin em `Usuarios`.
   > As abas do módulo Compras (`Fornecedores`, `Contatos`, `Cotacoes`,
   > `CotacaoPrecos`) **se autocriam** no primeiro acesso (via `SheetRepo._abaDe`);
   > nenhum escopo OAuth novo. Após atualizar o backend, basta `clasp push` +
   > redeploy da mesma implantação (mesma `API_URL`).
4. (Opcional) Rode **`instalarTriggerLimpeza`** uma vez para agendar a limpeza
   diária de sessões expiradas.

### Publicar o Web App

1. **Implantar → Nova implantação → Tipo: App da Web**.
2. Configure:
   - **Executar como:** Eu (o proprietário).
   - **Quem pode acessar:** Qualquer pessoa.
3. **Implantar** e copie a **URL do app da Web** (termina em `/exec`).
4. Teste abrindo a URL no navegador — deve mostrar o JSON do health-check.

> A cada alteração no código do Apps Script, crie uma **nova versão** da
> implantação (ou gerencie a existente) para que entre em produção.

---

## Parte 2 — Frontend

1. Cole a URL do Web App em [`src/core/config.js`](../src/core/config.js):
   ```js
   API_URL: "https://script.google.com/macros/s/SEU_DEPLOY/exec",
   ```
2. Teste localmente:
   ```bash
   python3 -m http.server 8123   # ou: npx serve .
   ```
   Abra `http://localhost:8123` e faça login com o admin do bootstrap.

### Publicar no Cloudflare Workers (git-connected)

O site está em **Cloudflare Workers** (assets estáticos), conectado ao GitHub:
cada push na `main` redeploya sozinho. Domínio: **dattaobra.com.br**.

- **`wrangler.jsonc`** — `assets.directory: "."` (serve a raiz) +
  `not_found_handling: "single-page-application"` (URLs limpas: qualquer path cai
  no `index.html`, então refresh/links diretos funcionam).
- **`.assetsignore`** — exclui do que vai ao ar: `apps-script/` (backend), `docs/`,
  `test/`, `scripts/`, `*.md`, configs. **Sem isso o backend vazaria.**
- **`_headers`** — cabeçalhos de segurança/cache (Workers honra `_headers`).
- **URLs limpas:** assets do `index.html` e do `app-header` usam caminho
  **absoluto** (`/src/...`) — obrigatório para funcionarem em paths profundos
  (ex.: `/obras/123`). Links internos são `<a href="/rota">` (sem `#`).

---

## Validação ponta a ponta

1. **Health-check:** abrir a URL `/exec` no navegador → JSON `status: online`.
2. **Login via console** (na página do front, F12):
   ```js
   fetch(CONFIG_API_URL, { method:"POST",
     body: JSON.stringify({ action:"auth.login", data:{ email:"...", senha:"..." } }) })
     .then(r=>r.json()).then(console.log);
   ```
   Esperado: `{ ok:true, data:{ token, usuario, config } }`.
3. **Fluxo completo:** login → criar obra → abrir obra → adicionar despesas com
   categorias → ver dashboard e gasto por categoria atualizarem na hora.
4. **Tempo real:** adicione uma despesa em uma aba e veja outra aba (mesma obra)
   refletir via polling em até `POLLING_RESUMO_MS`.
5. **Admin:** logar como admin → criar usuário → definir config → logar com o
   novo usuário e confirmar acesso só às próprias obras.

## Solução de problemas (CORS)

- **Erro de CORS / preflight:** confirme que o `api-client` **não** envia
  `Content-Type` e que o servidor responde com `ContentService` JSON. Não
  adicione headers customizados.
- **Resposta HTML / parse falhou:** geralmente a implantação não está como
  "Qualquer pessoa" ou a URL não é a `/exec`. Reveja a implantação.
- **`NAO_AUTENTICADO` logo após login:** verifique o relógio/fuso e se a aba
  `Sessoes` está sendo gravada.
