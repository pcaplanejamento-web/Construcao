# Princípios de Execução

Estas são as regras que governam **todo** o sistema. Qualquer código novo deve
respeitá-las. Elas existem para manter o projeto simples, independente de
ferramentas de build e previsível diante das limitações do Apps Script.

### 1. Sem build, sem dependências
Apenas a plataforma web nativa: Custom Elements, ES Modules, `fetch`. Nada de
transpilar/empacotar. O frontend roda servindo os arquivos como estão.
**Por quê:** menor superfície de manutenção; qualquer um abre e edita.

### 2. Simple requests sempre (CORS)
Nenhuma requisição pode disparar *preflight* `OPTIONS`. Logo: **sem** header
`Content-Type` JSON, **sem** headers customizados. O token vai **no corpo**.
**Por quê:** Web Apps do Apps Script não respondem `OPTIONS`; só "simple
requests" funcionam cross-origin. Toda a API foi desenhada em torno disso.
→ implementado em [`src/core/api-client.js`](../src/core/api-client.js) e
[`apps-script/Code.gs`](../apps-script/Code.gs).

### 3. Componentes independentes e autocontidos
Cada Web Component se auto-registra (`customElements.define`), encapsula estilo
em Shadow DOM e funciona dado apenas seus atributos/propriedades. Importa
explicitamente os componentes que usa.
→ base em [`src/components/base-element.js`](../src/components/base-element.js).

### 4. Dados descem, eventos sobem
Props/atributos para os filhos; `CustomEvent` (`bubbles + composed`) para os
pais. Estado compartilhado mora só em `core/` (store/auth/bus) — irmãos nunca se
acoplam diretamente.

### 5. Primitivos não conhecem o domínio
`components/` (os `ui-*`) jamais importam API, auth ou regra de negócio. Toda
regra de negócio vive em `features/`.

### 6. Servidor é a fonte de verdade; cliente é otimista
A UI atualiza de forma otimista para fluidez (ex.: ao lançar despesa), mas
**sempre reconcilia** com a resposta/refetch do servidor.
→ ver [`obra-detail-view.js`](../src/features/obras/obra-detail-view.js).

### 7. Autorização é server-side
O gating no cliente (rotas, `role-guard`) é só UX. Toda `action` revalida o
token e o papel; o `usuario_id` vem **sempre da sessão**, nunca do cliente
(previne IDOR).

### 8. Toda escrita é serializada e atômica
Qualquer mutação no Sheets ocorre sob `LockService` + `SpreadsheetApp.flush()`.
Escritas compostas (ex.: despesa + recálculo de resumo) ocorrem sob um único
lock. O resumo é **recalculado** das despesas, nunca um contador mutável.
→ ver [`apps-script/Lock.gs`](../apps-script/Lock.gs).

### 9. Um único contrato JSON
Um único `doPost` despacha por campo `action`. Envelope
`{ action, token, data }` → `{ ok, data | error }`. **Sempre HTTP 200**; o
erro é semântico no corpo (erros HTTP do Google viram HTML e quebram o parse).

### 10. Schema centralizado
Nomes de abas e colunas vivem só em [`apps-script/Schema.gs`](../apps-script/Schema.gs).
A leitura é feita por mapa de cabeçalho — nunca por índices mágicos espalhados.

### 11. Tudo em pt-BR
UI e documentação em português do Brasil. Nomes de código consistentes.

### 12. Falhar de forma explícita e amigável
Todo erro vira um *toast* legível ([`event-bus.js`](../src/core/event-bus.js) →
`<toast-host>`). Nunca falha silenciosa; o `api-client` separa erro de rede de
erro de negócio.

---

## Nota de segurança sobre senhas

O hashing usa **SHA-256 + salt por usuário** (pedido do projeto). O Apps Script
não traz bcrypt/PBKDF2 nativos, e o canal é HTTPS. Para cenários de alto risco,
considere uma derivação de chave mais forte (ex.: PBKDF2 com muitas iterações).
A verificação de papel e posse é sempre feita no servidor.
