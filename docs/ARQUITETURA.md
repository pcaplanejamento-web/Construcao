# Arquitetura

## Visão geral

```
┌─────────────────────────────────────────┐        ┌──────────────────────────┐
│  Navegador (SPA estática — Cloudflare)   │        │   Google Apps Script      │
│                                          │  POST  │   (Web App /exec)         │
│  index.html                              │ ─────► │                           │
│   └─ src/app.js (router + boot)          │  JSON  │  doPost(e)                │
│       ├─ features/  (domínio)            │ ◄───── │   └─ Router (action→fn)   │
│       ├─ components/ (ui-* primitivos)   │  302   │       ├─ Auth/Obras/...    │
│       └─ core/  (api, auth, bus, store)  │  +JSON │       └─ SheetRepo + Lock  │
└─────────────────────────────────────────┘        │            │              │
                                                    │      Google Sheets (DB)   │
                                                    └──────────────────────────┘
```

## Camadas do frontend

1. **`core/`** — sem UI. Conhece o backend e o estado global.
   - `api-client.js`: único ponto que fala com a API.
   - `auth-store.js`: sessão (token/usuário/config) + persistência.
   - `data-store.js`: **estado central + cache** (cache-first). Carrega tudo via
     `dados.snapshot`, persiste em localStorage por usuário, e expõe getters +
     mutações write-through. As views leem daqui (sem recarregar).
   - `router.js`: roteamento por path (History API, URLs limpas `/obras`) +
     gating de rota; intercepta `<a href="/...">` e cai no `index.html` (SPA).
     **Caminho-base** (`BASE`, do `<base href>`): vazio na raiz (Cloudflare),
     `/Construcao` no GitHub Pages — `rotaAtual()` remove o BASE e `navegar`/
     `irPara`/`urlAbsoluta()` o adicionam, então o mesmo código serve raiz e
     subpasta. Rotas internas são sempre **sem** o BASE (ex.: `"/obras"`).
   - `store.js`, `event-bus.js`: estado reativo e pub/sub.
   - `formatters.js`, `validators.js`, `config.js`: utilitários e configuração.
2. **`components/`** — primitivos reutilizáveis `ui-*` (botão, input, modal,
   tabela, badge, toast…). **Não conhecem o domínio.**
3. **`features/`** — componentes de domínio (obras, despesas, dashboard, admin,
   auth) que compõem os primitivos e usam `core/`.

## Fluxo de uma requisição

1. Uma view chama `api.call("despesas.criar", {...})`.
2. O `api-client` monta `{ action, token, data }` e faz `fetch` **POST**
   **sem** `Content-Type` (simple request → sem preflight CORS).
3. O Apps Script responde **302** para `script.googleusercontent.com/.../echo`;
   o navegador segue o redirect automaticamente.
4. A resposta final é `ContentService` JSON com CORS liberado.
5. O `doPost` faz `JSON.parse`, valida o token (cache → aba `Sessoes`) e
   despacha para o handler da `action`.
6. Handlers de escrita rodam sob `LockService`; o resumo é recalculado.
7. Resposta `{ ok: true, data }` (ou `{ ok:false, error }`) — **sempre HTTP 200**.

## Por que CORS molda tudo

Web Apps do Apps Script **não respondem `OPTIONS`** (preflight). Qualquer header
customizado (`Content-Type: application/json`, `Authorization`) dispararia
preflight e falharia. Por isso:
- O cliente envia o corpo como texto simples (sem header de tipo) e o token vai
  no JSON.
- Não há verbos REST nem rotas por path → **um `doPost` com dispatcher por
  `action`**.
- Respostas são sempre JSON via `ContentService`, sempre HTTP 200.

## Carregamento único, cache e layout

- **Carregamento inicial:** no boot **sem cache**, `app.js` mostra `<app-loader>`
  e chama `dataStore.inicializar()` → uma única requisição `dados.snapshot` traz
  todo o estado do usuário. Em recargas seguintes, `dataStore.restaurarCache()`
  pinta a UI **instantânea** a partir do localStorage e atualiza em 2º plano.
- **Carregamento após login:** acontece NA própria tela de login — o botão do
  `login-form` fica em loading enquanto `app.js` carrega o snapshot (sem overlay);
  ao terminar, navega para o sistema e a `login-view` é substituída.
- **Cache-first:** as views leem do `data-store` (sem recarregar a cada
  navegação). Trocar de aba é instantâneo.
- **Write-through:** mutações chamam a API, atualizam o store e persistem o
  cache; a UI reage por assinatura do store.
- **Layout:** `app-header` (persistente) + `app-sidebar` (abas; recolhível no
  desktop; drawer no mobile) + outlet do roteador, montados pelo `app-shell`. A
  altura é de viewport fixa e o conteúdo rola no `main` → a sidebar tem **altura
  constante** em todas as telas. Gutter padrão de 24px (header/sidebar/conteúdo).

## "Tempo real" sem websocket

O Apps Script não tem websockets. O acompanhamento ao vivo é obtido por:

1. **UI otimista** — a despesa entra na lista e o resumo é recalculado no store
   no instante do envio (ver [`data-store.js`](../src/core/data-store.js)).
2. **Confirmação** — `despesas.criar` devolve o `resumo` do servidor, que vira a
   verdade (substitui o item otimista).
3. **Refresh em 2º plano** — `app.js` chama `dataStore.atualizarEmSegundoPlano()`
   ao focar a aba e a cada ~60s, refazendo o snapshot silenciosamente. Assim
   mudanças de outros usuários (ex.: colaborador) aparecem sem recarregar.

## Sessão e cache

- Login cria um token UUID gravado na aba `Sessoes` (expira em 12h) e espelhado
  no `CacheService` (validação rápida sem ler a planilha).
- `auth.me` revalida a sessão no boot do SPA.
- **"Manter-me conectado"** (checkbox do login): marcado → token em `localStorage`
  (persiste entre sessões, padrão); desmarcado → `sessionStorage` (some ao fechar a
  aba). O `auth-store` infere a origem no boot e o `logout` limpa ambos.
- Um trigger diário (`limparSessoesExpiradas`) remove sessões vencidas.
