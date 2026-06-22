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

**Link de retorno (`.voltar`)** — padrão nas detail-views: `inline-flex` teal
(`var(--cor-primaria)`), `font-weight: var(--peso-semi)`, `align-self: flex-start`.
Nas detail-views o conteúdo vive em `#conteudo`, que é **flex-column com
`gap: var(--esp-5)`** — então o back link (e os demais blocos) têm o **mesmo
espaçamento (24px) acima e abaixo** automaticamente, sem `margin` avulso.

## Raio, sombra, camadas
`--raio-sm`(8) `--raio-md`(12, botões/inputs) `--raio-lg`(20, cards) `--raio-completo`(999);
`--sombra-sm/md/lg` (tonalizadas no escuro). **Card** usa `--sombra-md` (duas camadas:
contorno suave + halo difuso). `--z-nav/modal/toast`; transição padrão `--transicao`.
Botões/cards sobem 1–3px no hover (`translateY`) com `--transicao`. **Transições
sempre escopadas** às propriedades animadas (ex.: `transition: box-shadow, transform`)
— **nunca `transition: all`**, senão o card anima largura no reflow (sidebar
recolher) e as cores no troca de tema (efeito "bugado").

## Breakpoints (proporcionalidade)
Convenção (CSS não aceita `var()` em `@media`): **sm 600 · md 900 · lg 1100**.
Layout fluido com `max-width`, `%`, `minmax`, `clamp`. Sidebar vira drawer no
mobile; grids `auto-fill/minmax`; tabelas com scroll horizontal.
