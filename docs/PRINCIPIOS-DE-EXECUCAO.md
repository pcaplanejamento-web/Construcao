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

### 6. Cache-first; servidor é a fonte de verdade
Todo o estado é carregado uma vez (`dados.snapshot`) para um **data-store**
central, persistido em cache (localStorage por usuário). As views leem do store
(sem recarregar); as mutações são **write-through** (API → store → cache) e a UI
atualiza de forma otimista. Mas a verdade é sempre o servidor: a resposta de
cada mutação e o refresh em 2º plano reconciliam o cache.
→ ver [`data-store.js`](../src/core/data-store.js) e
[`obra-detail-view.js`](../src/features/obras/obra-detail-view.js).

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

## Princípios de UI/design

Detalhes e valores em [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

### 13. Nunca usar emoji
Emoji é proibido como ícone ou enfeite. Todo ícone vem de
[`<ui-icon>`](../src/components/ui-icon.js).

### 14. Biblioteca de ícones padrão única
A "biblioteca" é o `<ui-icon>` — registro SVG curado (estilo Lucide) com traço
`currentColor`. Sem dependência externa; o ícone herda a cor do contexto e do
tema. Adicionar ícone = adicionar um path ao registro.

### 15. Fonte padrão única
Uma só fonte para todo o sistema, via `--fonte-base` (stack do sistema). Nunca
declarar `font-family` fixa em componente — herda do `:host` (base-element).

### 16. Design único e consistente
Toda decisão visual vem dos **tokens** ([tokens.css](../src/styles/tokens.css)):
cor, raio, sombra, tipografia. Proibido valor mágico de cor/tamanho; cores de
chrome usam `var(--cor-*)`. Cores escolhidas pelo usuário (categorias) são dados.

### 17. Espaçamento padrão
Usar a escala `--esp-1..8` (base 4px) para paddings, gaps e margens. Seções de
página separadas por gap padrão; nada de espaçamento arbitrário.

### 18. Tema claro/escuro em todos os componentes
Claro e escuro funcionam em 100% dos componentes porque o chrome só usa tokens
(que mudam por tema). Segue o SO (`prefers-color-scheme`) com alternador no
header e escolha persistida ([theme.js](../src/core/theme.js)). Badges usam
`color-mix` para recalcular no tema. Nenhum hex de chrome fixo.

### 19. Proporcional em todas as telas + touchscreen
Layouts fluidos (max-width, %, `minmax`, `clamp`) e breakpoints padrão (sm 600,
md 900, lg 1100). Sidebar vira drawer no mobile; grids reflowam; tabelas rolam.
Nada deve estourar em telas pequenas, médias ou grandes.
**Touchscreen (telefones):** toda funcionalidade tem que ser usável por toque —
barras de ação/seleção quebram em várias linhas (`flex-wrap`), modais cabem na
largura (não estouram), tabelas largas rolam SÓ internamente (`.wrap` com
`overflow:auto`, sem vazar o documento) e os alvos de toque têm tamanho
confortável. Ao mexer numa tela, verificar no preview em ~390px sem overflow
horizontal do documento.

---

## Nota de segurança sobre senhas

O hashing usa **SHA-256 + salt por usuário** (pedido do projeto). O Apps Script
não traz bcrypt/PBKDF2 nativos, e o canal é HTTPS. Para cenários de alto risco,
considere uma derivação de chave mais forte (ex.: PBKDF2 com muitas iterações).
A verificação de papel e posse é sempre feita no servidor.
