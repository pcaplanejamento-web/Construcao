# Design System

Referência visual do sistema. As regras estão nos princípios 13–19 de
[PRINCIPIOS-DE-EXECUCAO.md](PRINCIPIOS-DE-EXECUCAO.md). A fonte única de verdade
dos valores é [`src/styles/tokens.css`](../src/styles/tokens.css).

## Fonte
- **Corpo/labels/tabelas:** **Plus Jakarta Sans** em `--fonte-base`.
  **Títulos, números e valores monetários:** **Space Grotesk** em `--fonte-titulo`
  (com `letter-spacing: -0.025em`). Importadas no `index.html` via Google Fonts,
  com fallback do sistema. Mono em `--fonte-mono`. **Nunca** Inter/Roboto/Arial.
- Componentes herdam `--fonte-base` no `:host` e `--fonte-titulo` nos `h1..h6`
  (ambos no `RESET` de [`base-element.js`](../src/components/base-element.js)).
  Para número/valor que **não** seja heading (ex.: célula monetária, KPI),
  declarar `font-family: var(--fonte-titulo)` no elemento.
- Tamanhos: `--fs-xs … --fs-3xl`. `--fs-2xl` (títulos) é fluido com `clamp()`.

## Ícones — `<ui-icon>`
Biblioteca padrão (sem emoji, sem dependência). SVG estilo Lucide, traço
`currentColor` → herda cor do contexto e do tema.
```html
<ui-icon name="obra"></ui-icon>
<ui-icon name="excluir" size="18"></ui-icon>
```
Atributos: `name` (obrigatório), `size` (px, padrão 20).
Conjunto atual: `obra, tag, usuario, config, local, compartilhar, sair, menu,
mais, editar, excluir, sucesso, aviso, info, fechar, sol, lua, vazio, seguranca`.
Para um ícone novo, adicione o path ao registro `ICONES` em
[`ui-icon.js`](../src/components/ui-icon.js).

## Cores (tokens)
- **Marca:** `--cor-primaria`, `--cor-primaria-escura/clara/suave`.
- **Semânticas:** `--cor-sucesso`, `--cor-erro`, `--cor-aviso`, `--cor-info`,
  `--cor-roxo` (admin), `--cor-neutro` (genérico/sem categoria) — cada uma com
  variante `*-suave` para fundos.
- **Superfície/texto/borda:** `--cor-fundo` (#f3f5f8), `--cor-superficie`,
  `--cor-superficie-2`, `--cor-borda` (#eef1f4, cards/estrutura), `--cor-borda-forte`
  (#e2e8f0, inputs/botões), `--cor-divisor` (#f1f5f9, linhas de tabela),
  `--cor-texto`, `--cor-texto-suave` (#64748b), `--cor-texto-fraco`.
  `--cor-overlay` para modais/drawer.
- **Regra:** chrome usa sempre `var(--cor-*)`. Cores de categoria escolhidas
  pelo usuário são **dados** (hex), não chrome.
- **Gradiente da marca:** `--grad-primaria` (`#0d9488→#059669`) — botões primários,
  barra de progresso da obra, avatares.
- **Gradientes de KPI:** `--grad-azul` (TOTAL GASTO, indigo), `--grad-laranja`
  (ORÇAMENTO, âmbar), `--grad-verde` (SALDO, esmeralda), `--grad-roxo` (DESPESAS,
  violeta), `--grad-vermelho` (saldo estourado) — `dashboard-summary` (texto branco).
- **Pills (classificação, via `ui-badge`/`color-mix`):** Material `#1d4ed8`,
  Serviço `#6d28d9` (`COR_CLASSIFICACAO`); status/obra usam as semânticas
  (A pagar→aviso, Ativa→sucesso).

## Tema claro/escuro
- Conjunto claro em `:root`; escuro aplicado por `@media (prefers-color-scheme:
  dark)` (quando não forçado claro) e por `:root[data-tema="escuro"]`.
- Gerência em [`theme.js`](../src/core/theme.js): `atual()/efetivo()/definir()/
  alternar()/init()`. Modos: `sistema | claro | escuro`, persistidos em
  `localStorage["obras.tema"]`. Alternador (sol/lua) no `app-header`.
- Anti-FOUC: `index.html` aplica `data-tema` salvo antes do CSS.
- `<ui-badge>` usa `color-mix` no fundo, então recalcula no tema (aceita hex ou
  `var(--token)`).

## Espaçamento
Escala base 4px: `--esp-1`(4) `--esp-2`(8) `--esp-3`(12) `--esp-4`(16)
`--esp-5`(24) `--esp-6`(32) `--esp-8`(48). Usar para padding/gap/margin —
nada de valor avulso.

**Distância padrão de tela — `--esp-tela`** (= `--esp-5`): gap do header e do
menu lateral até o conteúdo. Toda tela usa `.area { padding: var(--esp-tela) }`
**sem `max-width` e sem `margin: 0 auto`** → o conteúdo **preenche a largura** e a
distância em volta é a mesma: header→conteúdo == menu→conteúdo == borda
direita→conteúdo, em qualquer largura (e acompanha quando a sidebar recolhe). O
`app-sidebar` usa o mesmo token no topo. O reset do Shadow DOM zera margens
(`* { margin: 0 }`) p/ o 1º componente ficar exatamente a `--esp-tela` do header.
Usar sempre em telas/abas novas.

**Link de retorno (`.voltar`)** — padrão nas detail-views: `<a class="voltar"
href="<pai habitual>"><ui-icon name="seta-esquerda"></ui-icon><span>Texto</span></a>`.
Estilo: `inline-flex` teal (`var(--cor-primaria)`), **negrito** (`--peso-forte`),
`font-size: var(--fs-md)`, `gap: var(--esp-2)` (seta↔texto), **sem underline**
(inclusive no hover), `align-self: flex-start`. Comportamento **voltar inteligente**
(em `router.js`): se o usuário chegou navegando no app, volta à página ANTERIOR (de
onde veio); se entrou direto (link/refresh), vai ao `href` (pai habitual). O router
detecta o link pela classe `voltar`. O **texto** também reflete o destino real via
`rotuloVoltar(fallback)` (rótulo da página anterior, ou do pai habitual se entrou direto).

**Cache de estado da página** (enquanto logado): ao sair e voltar, a página reabre no
mesmo estado. **Rolagem** — o `router.js` memoriza o `scrollTop` do outlet por rota e
restaura ao voltar. **Aba ativa** — o `ui-tabs` lembra a aba por rota (sessionStorage).
Padrão universal: estado de UI persiste por rota → o usuário continua de onde saiu.
Nas detail-views o conteúdo vive em `#conteudo`, que é **flex-column com
`gap: var(--esp-5)`** — então o back link (e os demais blocos) têm o **mesmo
espaçamento (24px) acima e abaixo** automaticamente, sem `margin` avulso.

## Raio, sombra, camadas
`--raio-sm`(8) `--raio-md`(12, botões/inputs) `--raio-lg`(20, cards) `--raio-completo`(999);
`--sombra-sm/md/lg` (tonalizadas no escuro) são **empilhadas estilo Apple** (contato 1px +
chave curta + ambiente difusa) → aspecto mais sério/robusto. **Card** usa `--sombra-md`,
**Mesa** usa `--sombra-mesa` sobre `--cor-mesa`. Contornos hairline um pouco mais nítidos
(`--cor-borda`/`--cor-borda-forte`). `--z-nav/modal/toast`; transição padrão `--transicao`.
**Transições sempre escopadas** às propriedades animadas (ex.: `transition: box-shadow, transform`)
— **nunca `transition: all`**, senão o card anima largura no reflow (sidebar
recolher) e as cores no troca de tema (efeito "bugado").
**Acessibilidade:** `@media (prefers-reduced-motion: reduce)` no `reset.css` zera
animações/transições no documento; componentes em Shadow DOM (`ui-modal`/`ui-toast`)
repetem o guard internamente (Shadow DOM não herda regras do documento).

## Liquid glass (vidro)
Superfícies e chrome usam **"liquid glass"** — vidro **quase opaco** (não totalmente
transparente), via tokens em `tokens.css` (claro + os **dois** blocos escuros):
- `--vidro-fundo` (~90% claro/88% escuro), `--vidro-fundo-forte` (~94/93%, chrome),
  `--vidro-mesa` — `color-mix(in srgb, var(--cor-superficie|mesa) X%, transparent)`.
- `--vidro-blur` = `blur(18px) saturate(1.6)` (cai p/ `blur(12px)` em ≤600px — leve no celular).
- `--vidro-borda` (hairline) + `--vidro-realce` (sheen interno de topo) + sombra empilhada.
- **`--fundo-app`**: gradiente sutil no `body` (`reset.css`) p/ o vidro "ler" (não chapado);
  `--cor-fundo` segue **cor sólida** (fallback do `body`).
- **Padrão de uso:** `background: var(--vidro-fundo[-forte|-mesa])` + `-webkit-backdrop-filter`
  e `backdrop-filter: var(--vidro-blur)` + `border: 1px solid var(--vidro-borda)` +
  `box-shadow: var(--vidro-realce), var(--sombra-*)`. **Fallback:** sem `backdrop-filter` o
  fundo continua quase sólido (nada fica ilegível).
- **Aplicado em** (superfícies/chrome): `ui-card` (+ `mesa`), `ui-modal` (`.dialogo` + blur leve no `.backdrop`),
  `app-header`, `app-sidebar` (`nav`), dock do `app-shell`, `ui-coluna-menu`, `ui-toast`, `ui-busca` (campo expandido).
- **NÃO** vira vidro (continuam sólidos): `ui-input`/`ui-select`/`ui-button`/`ui-badge`,
  cartões de KPI (`--grad-*`) e as linhas/thead/tfoot da `ui-data-table`.

## Mesa + cards (sistema baseado em cards)
**Camadas (do mais escuro ao mais claro):** fundo do sistema `--cor-fundo` < **mesa
`--cor-mesa`** < card `--cor-superficie`. Ou seja, a mesa é **mais clara que o fundo e
mais escura que o card** (claro: #f3f5f8 < #f8fafc < #fff; escuro: #0b1220 < #0e1727 < #111c2e).
**Mesa** = container que segura os cards (tabela ou grade). É o `ui-card` com o atributo
**`mesa`**: o card inteiro (**incluindo o título**) em `--cor-mesa` + sombra
**`--sombra-mesa`** (elevação moderna que a separa do fundo) + borda `--cor-borda-forte`.
**A mesa NÃO levanta** no hover. Formulários/KPIs usam `ui-card` sem `mesa`.
**Card** (clicável) = obra/equipe/orçamento, pagamento/transferência/oferta (`.resumo`) e
**cada linha** das tabelas. Espec única de elevação: base `--sombra-md`, hover
`box-shadow: var(--sombra-lg); transform: translateY(-4px)` (transição escopada). **KPIs
coloridos não são clicáveis → não levantam.**
**Linha-card** (`ui-data-table`): `border-collapse: separate; border-spacing: 0 var(--esp-2)`;
as **células de dados** formam UM card branco com **contorno contínuo** (`border 1px`:
cima/baixo em todas + esquerda na 1ª col. de dados + direita na última = um retângulo só,
sem bordas internas — como o card de obra). **Hover = efeito no COMPONENTE INTEIRO, nunca
por célula:** a **sombra é única, num pseudo-elemento `tbody tr::after`** (`--sombra-realce`,
sutil) que cobre **só a região de DADOS** (`left: 36px` quando há coluna de marcação — via
`:host([tem-selecao])` que o componente reflete; `clip-path: inset(-24px -24px -24px 0)`
corta o vazamento horizontal da sombra na **borda esquerda do card**, mantendo a marcação
limpa; sobe o mesmo `translateY(-4px)` das células → contorno e sombra alinhados) e fica em
`z-index: 4` — **por cima da coluna de marcação e da linha de soma** (z2/3), mas **abaixo do
cabeçalho** (thead z5/6). O **lift** vai nas **células de dados** (`translateY(-4px)` — sobem
juntas; `transform` não vale p/ `<tr>`); o contorno **escurece** (`--cor-borda-forte`). Os
**tópicos (thead), a linha de soma (tfoot, SEM divisória) e a coluna de marcação (.sel)**
usam `--cor-mesa`; a marcação fica SEPARADA e **não sobe**.

## Breakpoints (proporcionalidade)
Convenção (CSS não aceita `var()` em `@media`): **sm 600 · md 900 · lg 1100**.
Layout fluido com `max-width`, `%`, `minmax`, `clamp`. Sidebar vira drawer no
mobile; grids `auto-fill/minmax`.

### Mobile / touch (≤600px, drawer ≤820px)
Regras de adaptação a telefone/toque (tudo escopado em `@media` → **desktop intacto**):
- **iOS / barra transparente (iOS 26, liquid glass)**: `index.html` usa `viewport-fit=cover` + metas `apple-mobile-web-app-*` (status bar translúcida). O `app-shell` usa **`100dvh`** (dynamic viewport — acompanha a barra do Safari que some/aparece; **header SEMPRE fixo no topo**), e **`env(safe-area-inset-*)`** dá folga ao header (topo/laterais), ao `<main>` (base) e ao drawer/`ui-modal`, para nada ficar sob o notch / home indicator / barra flutuante.
- **Barra do navegador TRANSLÚCIDA (Safari iOS 26)**: o app **NÃO define `theme-color`** (removido do `<meta>`, do anti-FOUC e do `theme.js`) — assim o Safari renderiza sua barra **liquid glass nativa**, que desfoca o conteúdo da página (no tema escuro a barra fica escura porque a página atrás é escura). Trade-off: o Chrome (Android) não tinge a barra (usa o padrão). Combina com `viewport-fit=cover` + `env(safe-area-inset-*)` + `apple-mobile-web-app-status-bar-style: black-translucent`.
- **`--esp-tela` cai p/ `--esp-4`** (16px) em ≤600px (`tokens.css`) → mais espaço útil.
- **Marca no MENU**: a logo + "Dattaobra" ficam no **topo do `app-sidebar`** (recolhe para só o ícone no desktop recolhido). O **`app-header` autenticado mostra só o ícone de menu** (☰) à esquerda + tema/avatar/Sair à direita — header minimalista (formato app). (Modo público/somente-leitura mantém a marca no header, pois não há sidebar.)
- **`ui-tabs`**: a barra de abas faz **scroll SÓ horizontal** (`overflow-x:auto; overflow-y:hidden; flex-wrap:nowrap; touch-action:pan-x`; scrollbar oculta) — abas nunca quebram, estouram nem deslizam na vertical.
- **`ui-data-table`**: ≤600px cada **linha vira um CARD empilhado** — `thead` some, `tr` vira card (borda+sombra+raio), cada `td` é `display:flex` "RÓTULO ↔ valor" (rótulo via `::before { content: attr(data-label) }`, divisória sutil, feedback de toque no `:active`). **Mostra só as colunas PRINCIPAIS** (`.sec` ocultas — card conciso; o toque na linha abre o detalhe). **Seleção = PRIMEIRA linha do card** ("Selecionar" + checkbox, em fluxo, **sem sobrepor nada**). Ações em linha cheia. **Linha de TOTAIS encosta na última (sem fresta)**: última linha-card perde a margem/cantos de baixo e o `tfoot` vira a base do mesmo bloco. 601–820px: tabela rola na horizontal, escondendo `.sec`.
- **Totais sem fresta (desktop)**: o `tfoot` sticky é puxado p/ cima pelo `border-spacing` (`transform: translateY(-esp-2)`) → encosta na última linha, sem vão.
- **Banner flutuante (`ui-modal`)**: rola **só na vertical** (`.corpo { overflow-y:auto; overflow-x:hidden; touch-action:pan-y }`; `.dialogo { overflow:hidden }`) — sem deriva horizontal.
- **KPIs** (`dashboard-summary`, `financeiro`, `oferta-kpis`): grade fixa **2 colunas** (`repeat(2,1fr)`) em ≤600px.
- **`app-sidebar` (drawer)**: o `:host` cobre a viewport (`position:fixed; inset:0; z-index:z-nav+1; pointer-events:none`), quem desliza é o `<nav>`; o `.backdrop` (absolute, sem transform) cobre a tela toda → **tocar fora fecha**. Fechado, `pointer-events:none` deixa o conteúdo clicável.
- **`app-header`**: ≤820px barra de **56px**; alvos de toque ≥ 44px; nome/cargo do chip ocultos (só avatar).
- **Toque**: `ui-button[tamanho=sm]` sobe p/ **40px** de altura em ≤600px (inputs/selects já 42px).
- **Sem ZOOM**: viewport com `maximum-scale=1, user-scalable=no` + bloqueio de pinça/double-tap em JS (`index.html`) — a página nunca dá zoom (não quebra o layout no celular).
- **Dock flutuante (`app-shell`)**: atalhos rápidos numa **cápsula ESCURA translúcida estilo iOS/Instagram** (tokens `--dock-*` + `--vidro-blur`; `border-radius: var(--raio-completo)`, `--sombra-lg` + sheen de topo; centralizada, flutua acima do conteúdo), **em MOBILE e DESKTOP** (só autenticado; some no login e no link público). Itens **só ícone, monocromáticos** (Contatos · Empresas · Obras · Transferências · Orçamentos); **sem cores por item** — o item **ativo** ganha uma **"pílula" clara/elevada** atrás (`--dock-ativo` + `--dock-ativo-sombra`). A cápsula **segue o tema** (clara translúcida no claro; escura no escuro — `--dock-*` no `:root` claro e nos blocos de tema escuro). **Auto-redução:** ao rolar p/ baixo o dock só **ENCOLHE** (`.reduzido` = `scale(.78)`, `transform-origin: bottom center`), permanecendo **visível e clicável**; volta ao subir/topo. `:host([com-barra]) main` ganha `padding-bottom` p/ o conteúdo não ficar atrás. Gating via atributo `com-barra` no host. **Auto-ocultar (iOS 26)**: ao **rolar p/ baixo** o dock desliza e some (`.oculto` = `translateY(180%)` + `opacity:0`); **reaparece ao subir** ou no topo (listener de scroll no `#outlet`).
- **KPIs clicáveis (`dashboard-summary`)**: cada cartão é um `<button>` (cursor + hover + ícone "ⓘ"); o clique abre **banner flutuante** (`ui-modal`) explicando **de onde vem o número** + composição (por classificação/subclassificação, ou Orçamento−Total=Saldo).
