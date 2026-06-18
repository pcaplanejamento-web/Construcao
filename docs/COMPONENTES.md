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
| `ui-data-table` | `.columns`, `.rows`, `.acoes`; attr `empty-text` | `acao` ({acao, linha}) | Tabela genérica orientada a dados. |
| `ui-badge` | `color`, `text` | — | Etiqueta colorida. |
| `ui-spinner` | `text`, `centro` | — | Indicador de carregamento. |
| `ui-empty-state` | `icone`, `titulo`, `texto`; slot `acao` | — | Estado vazio. |

---

## Componentes de domínio — `src/features/`

### Shell e navegação
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `app-shell` | getter `.outlet` | Layout raiz: cabeçalho + outlet do roteador. Esconde o cabeçalho no login. |
| `app-nav` | — | Navegação; item de admin via `role-guard`. |
| `role-guard` | attr `role="admin"\|"usuario"` | Mostra/oculta o slot conforme o papel (UX). |

### Autenticação — `features/auth/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `login-view` | — | Tela `#/login` (cartão centralizado). |
| `login-form` | — | Formulário; chama `auth.login`. |

### Obras — `features/obras/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `obras-list-view` | — | Rota `#/obras`. Grid de cartões + criar/editar/excluir. |
| `obra-card` | `.obra`; eventos `abrir`, `editar`, `remover` | Cartão com barra de orçamento. |
| `obra-form` | `.obra`; eventos `salvo`, `fechar` | Modal criar/editar obra (chama a API). |
| `obra-detail-view` | attr `id` (rota); — | **Coração do tempo real**: dashboard + despesas (otimista + polling). |

### Despesas — `features/despesas/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `despesa-form` | `.categorias`, `.emEdicao`; eventos `adicionar`, `salvar`, `cancelar` | Formulário inline (não chama API; emite eventos). |
| `despesa-table` | `.despesas`, `.categorias`; eventos `editar`, `remover` | Reutiliza `ui-data-table` + `category-badge`. |
| `category-badge` | `nome`, `cor` | Reutiliza `ui-badge`. |

### Dashboard — `features/dashboard/`
| Componente | Props | Descrição |
|------------|-------|-----------|
| `dashboard-summary` | `.resumo` | Cartões: total, orçamento, saldo, qtd. |
| `category-breakdown` | `.porCategoria` | Barras de gasto por categoria (CSS puro). |

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
