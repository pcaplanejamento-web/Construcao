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
| `app-shell` | getter `.outlet` | Layout raiz: `app-header` (topo) + `app-sidebar` (lateral) + outlet do roteador. Esconde header/sidebar no login. |
| `app-header` | evento `toggle-sidebar` | Cabeçalho persistente (sticky): marca, ☰ (mobile), chip do usuário → `#/perfil`, Sair. |
| `app-sidebar` | attr `aberto`; evento `navegou` | Menu lateral em abas (Obras, Classificações, Administração via `role-guard`, Perfil). Drawer retrátil no mobile. |
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
| `obra-share-form` | `.obra`; evento `fechar` | Modal (só dono) para compartilhar a obra com outros usuários. |
| `obra-detail-view` | attr `id` (rota); — | **Coração do tempo real**: dashboard + despesas (otimista + polling). |

### Despesas — `features/despesas/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `despesa-form` | `.categorias`, `.emEdicao`; eventos `adicionar`, `salvar`, `cancelar` | Formulário inline (não chama API; emite eventos). |
| `despesa-table` | `.despesas`, `.categorias`; eventos `editar`, `remover` | Reutiliza `ui-data-table` + `category-badge`. |
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
