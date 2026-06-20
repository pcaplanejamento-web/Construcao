# Design System

Referência visual do sistema. As regras estão nos princípios 13–19 de
[PRINCIPIOS-DE-EXECUCAO.md](PRINCIPIOS-DE-EXECUCAO.md). A fonte única de verdade
dos valores é [`src/styles/tokens.css`](../src/styles/tokens.css).

## Fonte
- **Padrão:** stack do sistema, em `--fonte-base` (`-apple-system, "Segoe UI",
  Roboto, …`). Mono em `--fonte-mono`.
- Componentes herdam a fonte do `:host` (definida no `RESET` de
  [`base-element.js`](../src/components/base-element.js)) — **nunca** declarar
  `font-family` fixa.
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
- **Superfície/texto/borda:** `--cor-fundo`, `--cor-superficie`,
  `--cor-superficie-2`, `--cor-borda`, `--cor-borda-forte`, `--cor-texto`,
  `--cor-texto-suave`, `--cor-texto-fraco`. `--cor-overlay` para modais/drawer.
- **Regra:** chrome usa sempre `var(--cor-*)`. Cores de categoria escolhidas
  pelo usuário são **dados** (hex), não chrome.
- **Gradientes de KPI:** `--grad-azul`, `--grad-verde`, `--grad-laranja`,
  `--grad-roxo`, `--grad-vermelho` — usados nos cartões de `dashboard-summary`
  (texto branco; iguais nos dois temas).

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
**sem `margin: 0 auto`** (conteúdo à esquerda) → header→conteúdo == menu→conteúdo,
em qualquer largura; o `app-sidebar` usa o mesmo token no topo. Usar sempre em
telas/abas novas.

## Raio, sombra, camadas
`--raio-sm/md/lg/completo`; `--sombra-sm/md/lg` (tonalizadas no escuro);
`--z-nav/modal/toast`; transição padrão `--transicao`.

## Breakpoints (proporcionalidade)
Convenção (CSS não aceita `var()` em `@media`): **sm 600 · md 900 · lg 1100**.
Layout fluido com `max-width`, `%`, `minmax`, `clamp`. Sidebar vira drawer no
mobile; grids `auto-fill/minmax`; tabelas com scroll horizontal.
