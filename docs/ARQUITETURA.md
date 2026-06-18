# Arquitetura

## Visão geral

```
┌─────────────────────────────────────────┐        ┌──────────────────────────┐
│  Navegador (SPA estática — GitHub Pages) │        │   Google Apps Script      │
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
   - `router.js`: roteamento hash-based + gating de rota.
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

## "Tempo real" sem websocket

O Apps Script não tem websockets. O acompanhamento ao vivo dos gastos é obtido
por (ver [`obra-detail-view.js`](../src/features/obras/obra-detail-view.js)):

1. **UI otimista** — a despesa entra na lista e o resumo é recalculado
   localmente no instante do envio.
2. **Confirmação** — `despesas.criar` devolve o `resumo` do servidor, que vira a
   verdade (substitui o item otimista).
3. **Refetch por evento** — mutações emitem `despesas:changed`.
4. **Polling leve** — enquanto a tela de detalhe está aberta, recarrega o resumo
   a cada `CONFIG.POLLING_RESUMO_MS`, reconciliando alterações de outra aba.

## Sessão e cache

- Login cria um token UUID gravado na aba `Sessoes` (expira em 12h) e espelhado
  no `CacheService` (validação rápida sem ler a planilha).
- `auth.me` revalida a sessão no boot do SPA.
- Um trigger diário (`limparSessoesExpiradas`) remove sessões vencidas.
