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
| `ui-card` | `title`; slots: default, `acoes` | — | Cartão de superfície. **Padrão:** o botão de adicionar da tabela vai no `slot="acoes"` (cabeçalho, colado à direita); título longo **quebra** mantendo o botão à direita. |
| `ui-data-table` | `.columns`, `.rows`, `.acoes`; attrs `empty-text`, `fluido` (células proporcionais/quebram), `clicavel` (linha clicável) | `acao` ({acao,linha}), `linha` ({linha}) | Tabela genérica orientada a dados. |
| `ui-icon` | `name`, `size` | — | Biblioteca de ícones padrão (SVG `currentColor`). Sem emoji. Inclui `fornecedor`, `contato`, `cotacao` (módulo Compras). |
| `ui-alert` | `tipo` (erro\|aviso\|info\|sucesso), `message`; prop `.mensagem` | — | **Componente PADRÃO de mensagem de erro/alerta inline.** Some quando sem `message`. Usar sempre que houver mensagem de erro de validação numa tela/form. |
| `ui-tabs` | `.abas=[{id,rotulo,icone}]`, attr `ativo`; evento `mudar` | Abas com slots nomeados (`slot="<id>"`); mostra só a aba ativa. A aba ativa muda **apenas a cor** (texto + ícone via `currentColor`) e a barra inferior — sem alterar `font-weight`/tamanho (evita reflow/deslocamento). |
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
| `app-sidebar` | attr `aberto` (drawer mobile), `recolhido` (régua de ícones no desktop); evento `navegou` | Menu lateral em abas (Obras, Fornecedores, Contatos, Cotações, Itens, Administração via `role-guard`, Perfil). `template()` itera o array `ITENS`. Ao recolher, os rótulos somem e o ícone fica no mesmo lugar; altura sempre 100% do conteúdo. Preferência persistida. |
| `app-loader` | attr `texto` | Tela de carregamento inicial (overlay) exibida enquanto o snapshot carrega. |
| `role-guard` | attr `role="admin"\|"usuario"` | Mostra/oculta o slot conforme o papel (UX). |

> As views leem do **data-store** ([data-store.js](../src/core/data-store.js)) — cache-first, sem recarregar. Navegação entre abas é instantânea.

> **Convenção de layout (distância padrão `--esp-tela`):** toda tela usa
> `.area { padding: var(--esp-tela); }` — **sem `max-width` e sem `margin: 0 auto`**.
> O conteúdo **preenche toda a largura** disponível e a distância é a MESMA em volta:
> **header→conteúdo == menu→conteúdo == borda direita→conteúdo** (= `--esp-tela`,
> hoje 24px), em qualquer largura. Quando a sidebar recolhe, o `main` alarga e o
> conteúdo acompanha automaticamente (largura fluida). O `app-sidebar` usa
> `--esp-tela` no topo → o 1º item do menu alinha com o topo do conteúdo. Nas telas
> com KPIs (detalhe da obra e da cotação) os KPIs são o **primeiro componente**.
> O reset do Shadow DOM ([base-element.js](../src/components/base-element.js)) zera
> margens (`* { margin: 0 }`, espelhando `reset.css`), então o 1º componente fica
> exatamente a `--esp-tela` do header em TODA tela (com ou sem KPIs).
> **Toda tela/aba nova deve seguir esse padrão.** Exceção: `publico-view` (página
> pública sem menu) permanece centralizada.

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
| `obra-detail-view` | attr `id` (rota); — | **Coração do tempo real**: KPIs + `ui-tabs` (**Gráficos** / **Despesas** / **Participantes da obra** / **Responsáveis**); dashboard + despesas (otimista + cache). |
| `obra-participantes` | attr `obra-id`, `modo` (participantes\|responsaveis) | Aba de participantes com **acerto de contas**: colunas Pago/Devido/**Saldo** (a receber/a pagar) + painel **"quem deve a quem"** (`despesa-split.acerto`). modo `participantes`: todos + adicionar/remover contato; modo `responsaveis`: só os marcados + "Definir responsáveis". |
| `participante-form` | `.obraId`; eventos `salvo`, `fechar` | Modal `ui-select` p/ adicionar um **contato** cadastrado como participante. |
| `responsaveis-form` | `.obraId`; evento `fechar` | Modal p/ marcar, entre os participantes, quem são **responsáveis** (alterna o flag via `dataStore.definirResponsavel`). |
| `publico-view` | attr `token` (rota `#/publico/:token`) | Visão **pública somente-leitura** (sem login): dashboard + itens + gasto por categoria. |

### Despesas — `features/despesas/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `despesa-form` | `.obraId`, `.categorias`; eventos `salvo`, `fechar` | **Banner (modal)** de adição: `ui-tabs` **Material/Serviço** (classificação) → `ui-select` de **item** filtrado pela aba (obrigatório) → **Subclassificação** (opcional) + valor/data; chama `dataStore.adicionarDespesa`. Aberto pelo botão "+ Adicionar despesa" no card "Despesas". |
| `despesa-table` | `.despesas`, `.categorias`, `.participantes`; eventos `abrir` (clique na linha), `editar`, `remover` | Tabela **full-width** e fluida; colunas Item, **Classificação** (Material/Serviço) e **Subclassificação** (distintas), Adicionado/Editado por + **Pago**, **Pagamento** (total), **Distribuição** e **Responsabilidade**. Reusa `ui-data-table` + `category-badge`. |
| `despesa-detail` | `.despesa`, `.categorias`; evento `fechar` | **Banner (modal)**: abas Material/Serviço + item (obrigatório) + **Subclassificação**/valor/data/observação + **Pago**, **Pagamento** e **Responsabilidade** (via `split-editor`). **Regras** (via `ui-alert`): soma dos pagamentos ≤ valor; soma das % ≤ 100. Pré-seleciona aba/item por `classificacao`/`item_id`. |
| `split-editor` | `.participantes`, `.itens=[{chave,valor}]`, `.modo("valor"\|"pct")`, `.limite`; evento `mudar` | Editor reutilizável de **distribuição entre participantes** (linhas `ui-select`+`ui-input`, total/soma com `.limite` = valor ou 100%; destaca quando excede). Usado p/ pagamento (R$) e responsabilidade (%). |
| `despesa-split.js` | `parseLista`, `totalPago`, `distribuicao`, `rotuloOrigem` | Helpers puros (Fase 2: algoritmo de acerto). |
| `despesa-filtros` | `.categorias`; evento `filtrar` ({texto, categoria}) | Pesquisa por item + filtro por classificação (aplicado só na tabela). |
| `category-badge` | `nome`, `cor` | Reutiliza `ui-badge`. |

### Itens — `features/itens/` (+ `features/categorias/categoria-form.js`)
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `itens-view` | — | Rota `#/itens`. `ui-tabs`: **Itens** (catálogo; badge Material/Serviço; **linha clicável → `#/itens/:id`**; CRUD via `item-form`) e **Subclassificações** (lista única **todas editáveis**, reusa `categoria-form`). Ambas mostram **log** (Criado em/Atualizado em + autor/editor) via `colunasLog()`. |
| `item-detail-view` | attr `id` (rota `#/itens/:id`) | Página do item (espelha `fornecedor-detail-view`): **faixa de KPIs** (Total gasto · Despesas · Cotações · Obras; cards `--grad-*`) + cabeçalho (nome + badge classificação + "Editar item") + `ui-tabs` **Despesas** (de todas as obras; clique → obra), **Cotações** (clique → cotação; melhor preço via `melhorTotal`), **Obras** (agrega nº+valor gasto por obra; clique → obra). 100% client-side (lê `item_id` do store). |
| `item-form` | `.item`; eventos `salvo`, `fechar` | Modal criar/editar item (nome + `ui-select` Classificação Material/Serviço). Emite `EVENTOS.ITENS`. Espelha `categoria-form`. |
| `categoria-form` | `.categoria`; eventos `salvo`, `fechar` | Modal criar/editar **subclassificação** (nome + cor). Emite `EVENTOS.CATEGORIAS`. |

> Ao criar/editar uma classificação, `EVENTOS.CATEGORIAS` faz a `obra-detail-view`
> recarregar as categorias (atualiza o select de despesa e os rótulos da tabela).

### Dashboard — `features/dashboard/`
| Componente | Props | Descrição |
|------------|-------|-----------|
| `dashboard-summary` | `.resumo` | KPIs em **cartões com gradiente + ícone** (total, orçamento, saldo, qtd); reusa `ui-icon` e tokens `--grad-*`. |
| `category-breakdown` | `.porCategoria`; attr `titulo` | Barras (rola na vertical). Título configurável (`titulo`, padrão "Gastos por categoria") p/ reuso: obra/público = **"Gastos por subclassificação"** (`por_subclassificacao`); cotação = comparativo por contato. |
| `grafico-rosca` | `.porCategoria`; attr `titulo` | Donut (SVG) **sem número central** + legenda. Título configurável; na obra = **"Distribuição por classificação"** (`por_classificacao` = Material/Serviço). |
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
| `fornecedores-view` | — | Rota `#/fornecedores`. CRUD de fornecedores (nome, telefone, e-mail, classificação). Linha **clicável** → abre a página do fornecedor. Reusa `ui-data-table` + `category-badge`. |
| `fornecedor-detail-view` | attr `id` (rota `#/fornecedores/:id`) | Página do fornecedor: cabeçalho + `ui-tabs` com **Contatos** (os contatos deste fornecedor; CRUD via `contato-form`) e **Ofertas** (ofertas feitas pelos contatos dele em todas as cotações, com link para a cotação). |
| `fornecedor-form` | `.fornecedor`; eventos `salvo`, `fechar` | Modal criar/editar (nome*, telefone, e-mail, cnpj, classificação, observação). |
| `contatos-view` | — | Rota `#/contatos`. `ui-tabs`: **Contatos** (tabela clicável → página do contato) e **Cargos** (fixos + extras, CRUD via `cargo-form`). |
| `contato-detail-view` | attr `id` (rota `#/contatos/:id`) | Página do contato: `ui-tabs` conforme o cargo — **Obras** (onde participa), **Fornecedores** (se Vendedor), **Equipe** (Pedreiro→superior+colegas / Mestre·Engenheiro→subordinados). |
| `contato-form` | `.contato`; eventos `salvo`, `fechar` | Modal criar/editar. **Cargo** via `ui-select` (fixos+extras); campos condicionais: **Fornecedor** (só/obrigatório p/ Vendedor) e **Vínculo** Mestre/Engenheiro (só/obrigatório p/ Pedreiro), com `ui-alert`. |
| `cargo-form` | `.cargo`; eventos `salvo`, `fechar` | Modal criar/editar **cargo extra** (nome). Os 6 obrigatórios são fixos. |
| `cotacoes-view` | — | Rota `#/cotacoes`. `ui-tabs` **[Cotações \| Orçamento]**: aba Cotações = tabela `clicavel` (item, classificação, qtd, subclassificação, obra, nº ofertas, **melhor preço**, situação); aba Orçamento = **grade de `orcamento-card`** (estilo Obras) + "+ Novo orçamento". |
| `cotacao-form` | `.cotacao`; eventos `salvo`, `fechar` | Modal criar/editar: `ui-select` de **item*** (rótulo "nome · classificação") + badge da **classificação** (só leitura), quantidade, unidade, **Subclassificação**, **obra opcional**, status. |
| `cotacao-detail-view` | attr `id` (rota `#/cotacoes/:id`) | **KPIs + 2 gráficos + comparativo**: faixa `<oferta-kpis>`, `<grafico-evolucao-precos>` e `<category-breakdown>` (reusado p/ comparar ofertas por contato), e a tabela de ofertas (contato, empresa, valor unit., **total** com destaque do menor preço, prazo, obs, **Criado em**); escolher/editar/excluir oferta; **Registrar como despesa**. |
| `oferta-kpis` | `.resumo={num,menor,media,maior,economia}` | KPIs das ofertas em cartões com gradiente (reusa o estilo do `dashboard-summary`). |
| `grafico-evolucao-precos` | `.historico`, `.cotacao`, `.contatos`, `.cores` | **Gráfico de linhas (SVG), uma linha por contato** — evolução do preço no tempo a partir do histórico; legenda por contato. |
| `preco-form` | `.cotacaoId`, `.preco`, `.orcamento`; eventos `salvo`, `fechar` | Modal de oferta (valor unitário*, prazo, observação). Modo **cotação**: escolhe o contato. Modo **orçamento** (`.orcamento`): contato **travado** (ofertante do orçamento) + seletor de **cotação** filtrado pela classificação do orçamento. |
| `cotacao-despesa-form` | `.cotacao`, `.preco`, `.contatoNome`; eventos `registrado`, `fechar` | Banner flutuante: escolhe a **obra** + **Subclassificação** e lança a oferta como despesa via `dataStore.registrarDespesaOferta` — que **marca a oferta** ("Registrada", `despesa_id`) e **fecha a cotação**. A despesa herda `item_id`/classificação da cotação. |
| `cotacao-util.js` | `totalOferta`, `melhorTotal`, `resumoOfertas`, `coresPorContato`, `PALETA_CONTATOS` | Funções puras (total = valor_unit × quantidade; menor total; resumo p/ KPIs; cor estável por contato). |

**Orçamentos — `features/orcamentos/`** (container de ofertas de várias cotações)
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `orcamento-card` | `.orcamento`; eventos `abrir`/`editar`/`remover` | Card quadrado (espelha `obra-card`): título (ou rótulo automático), badge do **tipo** (Material/Serviço), **Total** das ofertas + nº, fornecedor/contato + obra, log. |
| `orcamento-form` | `.orcamento`; eventos `salvo`, `fechar` | Modal: título (opc), **tipo** (Material/Serviço), **fornecedor** (só Material), **ofertante** (Material → contatos do fornecedor; Serviço → qualquer), **obra** (opc). |
| `orcamento-detail-view` | attr `id` (rota `#/orcamentos/:id`) | Cabeçalho (tipo, fornecedor/contato, obra) + resumo (nº · total) + tabela das ofertas (cotação, valor unit., total, prazo, obs, status); "+ Adicionar oferta" abre `preco-form` modo orçamento. |
| `orcamento-util.js` | `rotuloOrcamento`, `totalOrcamento`, `colunasOrcamento`, `COR_CLASSIFICACAO` | Rótulo automático; soma dos totais das ofertas; colunas da tabela de orçamentos (abas de fornecedor/contato/obra). |

> A **oferta é única** (`CotacaoPrecos`+`orcamento_id`): aparece na cotação E no orçamento.
> As abas **Orçamentos** (fornecedor/contato/obra detail) usam `colunasOrcamento()`.

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

### Helpers compartilhados (não são componentes)
| Helper | Onde | O que faz |
|--------|------|-----------|
| `colunasLog()` | [core/audit-columns.js](../src/core/audit-columns.js) | Devolve as 2 colunas padrão de **log** (Criado em + autor / Atualizado em + editor) para qualquer `ui-data-table`. Usado por itens/fornecedores/contatos/cotações + detalhes; `obra-card` mostra o log no rodapé; `users-table` mostra Criado em/por. |
| `vinculos.js` | [features/shared/vinculos.js](../src/features/shared/vinculos.js) | `vinculosDoItem/Fornecedor/Contato/Subclassificacao/Cargo/Oferta(...)` calculam os vínculos pelo store; `abrirBannerVinculos({titulo,grupos,aoExcluir})` abre um **banner** (compõe `ui-modal`+`ui-alert`+`ui-data-table`+`ui-button`) listando onde está vinculado (linhas clicáveis → navegam) e **bloqueia a exclusão**; sem vínculos, executa `aoExcluir` (com confirmação). |

> **Valores ao vivo:** as tabelas resolvem o nome ATUAL da entidade vinculada pelo
> `id` (`dataStore.item(id)` etc.) — o campo denormalizado é só fallback. Renomear
> reflete em todas as telas. (Participantes e visão pública re-derivam no backend.)

## Como reutilizar / criar um componente

1. Estenda `BaseElement` e implemente `estilos()` e `template()`.
2. Use `aoConectar()` para listeners e `aoLimpar(unsub)` para limpeza automática.
3. Para um primitivo, **não** importe nada de `core/` (exceto utilitários puros)
   nem de `features/`.
4. Emita resultados via `this.emitir("nome", detalhe)`.
5. `customElements.define("minha-tag", MinhaClasse)` no fim do arquivo.
