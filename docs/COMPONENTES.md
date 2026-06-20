# Catálogo de Componentes

Todos os componentes estendem
[`BaseElement`](../src/components/base-element.js) (Shadow DOM, `emitir()`,
limpeza de inscrições). Convenção: **dados descem por props/atributos; eventos
sobem por `CustomEvent`**.

---

## Primitivos reutilizáveis — `src/components/` (sem regra de negócio)

| Componente | Atributos / Propriedades | Eventos | Descrição |
|------------|--------------------------|---------|-----------|
| `ui-button` | `variant`, `loading`, `disabled`, `tamanho`, `full` | `click` (nativo) | Botão. Slot = conteúdo. |
| `ui-input` | `label`, `name`, `type`, `value`, `placeholder`, `error`, `required`, `step`, `min`; prop `.value` | `input`, `change`, `enter` | Campo com rótulo e erro. |
| `ui-select` | `label`, `name`, `value`, `placeholder`, `error`; prop `.options=[{value,label}]`, `.value` | `change` | Lista suspensa. |
| `ui-modal` | `open`, `title`; slots: default, `rodape` | `fechar` | Diálogo overlay (X, backdrop, Esc). |
| `ui-toast` / `toast-host` | `tipo`, `message` | — | Notificações; host ouve o `event-bus`. |
| `ui-card` | `title`; slots: default, `acoes` | — | Cartão de superfície. |
| `ui-data-table` | `.columns`, `.rows`, `.acoes`; attrs `empty-text`, `fluido` (células proporcionais/quebram), `clicavel` (linha clicável) | `acao` ({acao,linha}), `linha` ({linha}) | Tabela genérica orientada a dados. |
| `ui-icon` | `name`, `size` | — | Biblioteca de ícones padrão (SVG `currentColor`). Sem emoji. Inclui `fornecedor`, `contato`, `cotacao` (módulo Compras). |
| `ui-tabs` | `.abas=[{id,rotulo,icone}]`, attr `ativo`; evento `mudar` | Abas com slots nomeados (`slot="<id>"`); mostra só a aba ativa. |
| `ui-badge` | `color` (hex ou `var(--token)`), `text` | — | Etiqueta colorida; fundo via `color-mix` (tema-seguro). |
| `ui-spinner` | `text`, `centro` | — | Indicador de carregamento. |
| `ui-empty-state` | `icone`, `titulo`, `texto`; slot `acao` | — | Estado vazio. |

---

## Componentes de domínio — `src/features/`

### Shell e navegação
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `app-shell` | getter `.outlet` | Layout raiz: `app-header` (topo) + `app-sidebar` (lateral) + outlet do roteador. Altura de viewport fixa: o conteúdo rola no `main` → **sidebar com altura constante** em todas as telas. Esconde header/sidebar no login. |
| `app-header` | evento `toggle-sidebar` | Cabeçalho persistente (sticky): marca, **botão sanduíche** (recolhe no desktop / drawer no mobile), **alternador de tema** (sol/lua), chip do usuário → `#/perfil`, Sair. Ícones via `ui-icon`. |
| `app-sidebar` | attr `aberto` (drawer mobile), `recolhido` (régua de ícones no desktop); evento `navegou` | Menu lateral em abas (Obras, Fornecedores, Contatos, Cotações, Classificações, Administração via `role-guard`, Perfil). `template()` itera o array `ITENS`. Ao recolher, os rótulos somem e o ícone fica no mesmo lugar; altura sempre 100% do conteúdo. Preferência persistida. |
| `app-loader` | attr `texto` | Tela de carregamento inicial (overlay) exibida enquanto o snapshot carrega. |
| `role-guard` | attr `role="admin"\|"usuario"` | Mostra/oculta o slot conforme o papel (UX). |

> As views leem do **data-store** ([data-store.js](../src/core/data-store.js)) — cache-first, sem recarregar. Navegação entre abas é instantânea.

### Autenticação — `features/auth/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `login-view` | — | Tela `#/login` (cartão centralizado). |
| `login-form` | — | Formulário; chama `auth.login`. |

### Perfil — `features/perfil/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `perfil-view` | — | Rota `#/perfil`. Dados do usuário (do data-store) + segurança. |
| `senha-form` | — | Troca de senha (atual/nova/confirmar) → `auth.alterarSenha`. Reusa `ui-input`/`ui-button`. |

### Obras — `features/obras/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `obras-list-view` | — | Rota `#/obras`. Grid de cartões + criar/editar/excluir. |
| `obra-card` | `.obra`; eventos `abrir`, `editar`, `remover` | Cartão com barra de orçamento. |
| `obra-form` | `.obra`; eventos `salvo`, `fechar` | Modal criar/editar obra (chama a API). |
| `obra-share-form` | `.obra`; evento `fechar` | Modal (só dono): **link público** curto (gerar/copiar/abrir/desativar) + **log de acessos** + convidar usuários para colaboração. |
| `obra-detail-view` | attr `id` (rota); — | **Coração do tempo real**: dashboard + despesas (otimista + cache). |
| `publico-view` | attr `token` (rota `#/publico/:token`) | Visão **pública somente-leitura** (sem login): dashboard + itens + gasto por categoria. |

### Despesas — `features/despesas/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `despesa-form` | `.categorias`; evento `adicionar` | Formulário **só de adição** (edição é no banner). Não chama API. |
| `despesa-table` | `.despesas`, `.categorias`; eventos `abrir` (clique na linha), `editar`, `remover` | Tabela **full-width** e fluida; colunas **Adicionado** e **Editado por** separadas. Reusa `ui-data-table` + `category-badge`. |
| `despesa-detail` | `.despesa`, `.categorias`; evento `fechar` | **Banner (modal)** com info completa; **edita/exclui via data-store** (otimista, com loading) — item, valor, classificação, data e **observação** persistem; preenche **autor/editor**. |
| `despesa-filtros` | `.categorias`; evento `filtrar` ({texto, categoria}) | Pesquisa por item + filtro por classificação (aplicado só na tabela). |
| `category-badge` | `nome`, `cor` | Reutiliza `ui-badge`. |

### Classificações — `features/categorias/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `categorias-view` | — | Rota `#/categorias`. Cada usuário cria/edita/remove suas classificações; mostra as globais como referência. Reusa `ui-data-table` + `category-badge`. |
| `categoria-form` | `.categoria`; eventos `salvo`, `fechar` | Modal criar/editar classificação (nome + cor). Emite `EVENTOS.CATEGORIAS`. |

> Ao criar/editar uma classificação, `EVENTOS.CATEGORIAS` faz a `obra-detail-view`
> recarregar as categorias (atualiza o select de despesa e os rótulos da tabela).

### Dashboard — `features/dashboard/`
| Componente | Props | Descrição |
|------------|-------|-----------|
| `dashboard-summary` | `.resumo` | KPIs em **cartões com gradiente + ícone** (total, orçamento, saldo, qtd); reusa `ui-icon` e tokens `--grad-*`. |
| `category-breakdown` | `.porCategoria` | Barras de gasto por categoria; preenche a altura e **rola na vertical** com muitas categorias. |
| `grafico-rosca` | `.porCategoria` | Donut (SVG) **sem número central** + legenda (rola se necessário). |
| `grafico-mensal` | `.despesas` | Barras por mês; **rola na horizontal** com muitos meses. |

> Os 3 gráficos ficam em `ui-card` de **tamanho igual** (grade 1×3, altura fixa);
> cada um preenche o cartão e rola internamente. A view do detalhe usa `ui-tabs`
> (**Gráficos** / **Despesas**) abaixo dos KPIs.

### Compras — `features/fornecedores/`, `features/contatos/`, `features/cotacoes/`
Módulo de cotações: agenda de **fornecedores** (empresas) e **contatos** (pessoas);
**cotações** comparam ofertas de contatos e a melhor pode virar despesa numa obra.
Tudo lê do data-store (cache-first) e emite `EVENTOS.FORNECEDORES/CONTATOS/COTACOES`.

| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `fornecedores-view` | — | Rota `#/fornecedores`. CRUD de fornecedores (nome, telefone, e-mail, classificação). Reusa `ui-data-table` + `category-badge`. |
| `fornecedor-form` | `.fornecedor`; eventos `salvo`, `fechar` | Modal criar/editar (nome*, telefone, e-mail, cnpj, classificação, observação). |
| `contatos-view` | — | Rota `#/contatos`. CRUD de contatos; mostra a **empresa** (fornecedor vinculado). |
| `contato-form` | `.contato`; eventos `salvo`, `fechar` | Modal criar/editar (nome*, telefone, e-mail, cargo, **fornecedor** opcional, observação). |
| `cotacoes-view` | — | Rota `#/cotacoes`. Lista (tabela `clicavel`): descrição, qtd, classificação, obra, nº de ofertas, **melhor preço**, situação. |
| `cotacao-form` | `.cotacao`; eventos `salvo`, `fechar` | Modal criar/editar (descrição*, quantidade, unidade, classificação, **obra opcional**, status). |
| `cotacao-detail-view` | attr `id` (rota `#/cotacoes/:id`) | **KPIs + 2 gráficos + comparativo**: faixa `<oferta-kpis>`, `<grafico-evolucao-precos>` e `<category-breakdown>` (reusado p/ comparar ofertas por contato), e a tabela de ofertas (contato, empresa, valor unit., **total** com destaque do menor preço, prazo, obs, **Criado em**); escolher/editar/excluir oferta; **Registrar como despesa**. |
| `oferta-kpis` | `.resumo={num,menor,media,maior,economia}` | KPIs das ofertas em cartões com gradiente (reusa o estilo do `dashboard-summary`). |
| `grafico-evolucao-precos` | `.historico`, `.cotacao`, `.contatos`, `.cores` | **Gráfico de linhas (SVG), uma linha por contato** — evolução do preço no tempo a partir do histórico; legenda por contato. |
| `preco-form` | `.cotacaoId`, `.preco`; eventos `salvo`, `fechar` | Modal de oferta (**contato**, valor unitário*, prazo, observação). |
| `cotacao-despesa-form` | `.cotacao`, `.preco`, `.contatoNome`; eventos `registrado`, `fechar` | Mini-modal: escolhe a **obra** + classificação e lança a oferta escolhida como despesa (reusa `dataStore.adicionarDespesa`). |
| `cotacao-util.js` | `totalOferta`, `melhorTotal`, `resumoOfertas`, `coresPorContato`, `PALETA_CONTATOS` | Funções puras (total = valor_unit × quantidade; menor total; resumo p/ KPIs; cor estável por contato). |

> As tabelas de fornecedores, contatos, cotações e ofertas mostram a coluna
> **"Criado em"** (campo `criado_em`); o detalhe da cotação mostra "Criada em …".

### Admin — `features/admin/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `admin-view` | — | Rota `#/admin` (só admin). Lista + ações. |
| `users-table` | `.usuarios`; eventos `editar`, `config` | Reutiliza `ui-data-table`. |
| `user-form` | `.usuario`; eventos `salvo`, `fechar` | Modal criar/editar usuário. |
| `user-config-form` | `.usuario`; evento `fechar` | Modal de configurações (chave-valor). |

---

## Como reutilizar / criar um componente

1. Estenda `BaseElement` e implemente `estilos()` e `template()`.
2. Use `aoConectar()` para listeners e `aoLimpar(unsub)` para limpeza automática.
3. Para um primitivo, **não** importe nada de `core/` (exceto utilitários puros)
   nem de `features/`.
4. Emita resultados via `this.emitir("nome", detalhe)`.
5. `customElements.define("minha-tag", MinhaClasse)` no fim do arquivo.
