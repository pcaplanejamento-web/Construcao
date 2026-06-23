# Catálogo de Componentes

Todos os componentes estendem
[`BaseElement`](../src/components/base-element.js) (Shadow DOM, `emitir()`,
limpeza de inscrições). Convenção: **dados descem por props/atributos; eventos
sobem por `CustomEvent`**.

---

## Primitivos reutilizáveis — `src/components/` (sem regra de negócio)

| Componente | Atributos / Propriedades | Eventos | Descrição |
|------------|--------------------------|---------|-----------|
| `ui-button` | `variant`, `loading`, `disabled`, `tamanho`, `full` | `click` (nativo) | Botão. Slot = conteúdo. Variantes: `primario` (**gradiente** `--grad-primaria` + sombra colorida), `secundario` (branco + sombra leve), `tonal` (verde-claro/`--cor-primaria-suave` — ações suaves, ex.: Editar), `perigo` (vermelho sólido), `perigo-contorno` (outline vermelho — ex.: ícone excluir), `fantasma`. Lift no hover; **animação de clique** (no `:active` afunda ~4% + a sombra "fecha" num halo curto, padrão p/ todos); raio `--raio-md`. |
| `ui-input` | `label`, `name`, `type`, `value`, `placeholder`, `error`, `required`, `step`, `min`; prop `.value` | `input`, `change`, `enter` | Campo com rótulo e erro. |
| `ui-select` | `label`, `name`, `value`, `placeholder`, `error`; prop `.options=[{value,label}]`, `.value` | `change` | Lista suspensa. |
| `ui-modal` | `open`, `title`; slots: default, `rodape` | `fechar` | Diálogo overlay (X, backdrop, Esc). **Fecha também ao trocar de rota** (`rotamudou`) — um link interno (ex.: "abrir página do item") não deixa banners flutuantes sobrepostos. |
| `ui-toast` / `toast-host` | `tipo`, `message` | — | Notificações; host ouve o `event-bus`. |
| `ui-card` | `title`; slots: default, `acoes` | — | Cartão de superfície. **Padrão:** o botão de adicionar da tabela vai no `slot="acoes"` (cabeçalho, colado à direita); título longo **quebra** mantendo o botão à direita. |
| `ui-data-table` | `.columns` (`{chave,titulo,formato?,alinhar?,largura?,secundaria?,`**`moeda?`**`,`**`valorNum?(linha)`**`}`; `secundaria`=some no mobile ≤820px; **`moeda:true`**=entra no somatório; **`valorNum`**=número a somar p/ total derivado, default `Number(linha[chave])`), `.rows`, `.acoes`, **`.acoesMassa`** ([{nome,rotulo,variant?}]); attrs `empty-text`, `fluido`, `clicavel`, **`editar-massa`**, **`excluir-massa`** | `acao`, `linha`, **`selecao`** ({linhas}), **`editar-massa`**/**`excluir-massa`** ({linhas}), **`acao-massa`** ({acao,linhas}) | **Data-grid** (não mais passivo): **coluna de seleção fixa à esquerda** (+ Selecionar Todos) — **só aparece se houver `editar-massa`/`excluir-massa`** (a seleção serve às ops em massa; tabela só-leitura não a mostra); **cabeçalho clicável** abre `ui-coluna-menu` (ordena/filtra por Valores, estado interno que **persiste**); **busca global** via `buscar(texto)` — a `ui-busca` é auto-injetada no **cabeçalho do `ui-card` mais próximo** (slot `acoes`, à ESQUERDA do botão de ação, ou no lugar dele); só atualiza o corpo p/ preservar foco/texto; **linha de Totais** (`<tfoot>` sticky-bottom, soma das colunas `moeda` visíveis); **cabeçalho sticky-top**; **barra de seleção** com a SOMA dos selecionados + **"Editar selecionadas"** (se `editar-massa`) e **"Excluir selecionadas"** (se `excluir-massa`). `.wrap` rolável (`max-height:70vh`). Células `.dir` em Space Grotesk 700. |
| `ui-coluna-menu` | `.coluna`, `.valores` (textos distintos), `.estado` ({ordem,selecionados}), `.ancora` (DOMRect) | `aplicar` ({ordem,selecionados}), `remover`, `fechar` | Dropdown ÚNICO de cabeçalho (popover fixo **colado ao tópico**: borda-topo na cor primária, raio só embaixo + backdrop/Esc): **Crescente/Decrescente**, **Filtro** (busca), **Selecionar Todos** + checklist (com scroll vertical). Aberto pelo `ui-data-table` em todas as tabelas. |
| `ui-busca` | attr `placeholder`; método `definir(texto)`; export `injetarBuscaNoCard(host, tabela)` | `buscar` ({texto}) | Botão de **pesquisa** (ícone `busca`) que expande o campo da **direita p/ a esquerda**, sobreposto (overlay) ao conteúdo à esquerda **sem deslocar nada**. Componente ÚNICO reusável. `injetarBuscaNoCard` coloca a lupa no **cabeçalho do `ui-card`** (slot `acoes`, à esquerda do botão) ligada a `tabela.buscar()`; o `ui-data-table` chama isso sozinho — wrappers (`despesa-table`, `users-table`) chamam com a tabela interna por estarem em outro shadow. Fecha ao perder foco vazio / Esc. |
| `ui-icon` | `name`, `size` | — | Biblioteca de ícones padrão (SVG `currentColor`). Sem emoji. Inclui `fornecedor`, `contato`, `cotacao` (módulo Compras), `email`, `usuarios`, `seta-direita` (login). |
| `ui-alert` | `tipo` (erro\|aviso\|info\|sucesso), `message`; prop `.mensagem` | — | **Componente PADRÃO de mensagem de erro/alerta inline.** Some quando sem `message`. Usar sempre que houver mensagem de erro de validação numa tela/form. |
| `ui-tabs` | `.abas=[{id,rotulo,icone}]`, attr `ativo`; evento `mudar` | Abas com slots nomeados (`slot="<id>"`); mostra só a aba ativa. A aba ativa muda **apenas a cor** (texto + ícone via `currentColor`) e a barra inferior — sem alterar `font-weight`/tamanho (evita reflow/deslocamento). **Lembra a aba ativa por rota** (sessionStorage, chave = pathname + ids das abas) → ao sair e voltar, reabre na mesma aba. |
| `ui-badge` | `color` (hex ou `var(--token)`), `text` | — | Etiqueta colorida; fundo via `color-mix` (tema-seguro). |
| `ui-spinner` | `text`, `centro` | — | Indicador de carregamento. |
| `ui-empty-state` | `icone`, `titulo`, `texto`; slot `acao` | — | Estado vazio. |

---

## Componentes de domínio — `src/features/`

### Shell e navegação
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `app-shell` | getter `.outlet` | Layout raiz: `app-header` (topo) + `app-sidebar` (lateral) + outlet do roteador. Altura de viewport fixa: o conteúdo rola no `main` → **sidebar com altura constante** em todas as telas. No login esconde header+sidebar; na rota pública (`/publico/*`) mostra o header (somente-leitura) **sem** sidebar. |
| `app-header` | evento `toggle-sidebar` | Cabeçalho persistente (sticky). **Marca-bloco** com gaps iguais (logo↔texto == texto↔sanduíche): **logo** `src/assets/dattaobra.png` (transparente) + texto **"Dattaobra"** (link → `/obras`) + **botão sanduíche** (recolhe no desktop / drawer no mobile). O logo alinha com a coluna de ícones da sidebar e a largura do `nav` da sidebar (195px) é igualada a este cluster → o sanduíche encosta no limite direito da sidebar. À direita: **alternador de tema** (sol/lua), chip do usuário → `/perfil`, Sair. Ícones via `ui-icon`. **Modo somente-leitura** (link público, sem sessão): o MESMO componente renderiza só a marca + selo "Somente leitura" (sem menu/usuário/sair). |
| `app-sidebar` | attr `aberto` (drawer mobile), `recolhido` (régua de ícones no desktop); evento `navegou` | Menu lateral em abas (Obras, Fornecedores, Contatos, Cotações, Itens, Administração via `role-guard`, Perfil). `template()` itera o array `ITENS`. Ao recolher, os rótulos somem e o ícone fica no mesmo lugar; altura sempre 100% do conteúdo. Preferência persistida. |
| `app-loader` | attr `texto` | Overlay de carregamento usado **só no boot sem cache** (refresh já logado). No fluxo de **login**, o carregamento acontece na própria tela de login (não há overlay). |
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
> **Toda tela/aba nova deve seguir esse padrão** — inclusive a `publico-view`, que
> usa o `app-header` padrão (somente-leitura) e a mesma `--esp-tela` no conteúdo.

### Autenticação — `features/auth/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `login-view` | — | Tela `/login` **split-screen** (igual ao design): esquerda clara com a marca + `login-form`; direita verde-escura com card "Execução das obras" (sparkline SVG), título, 3 destaques e o fundo animado `login-grafo-bg`. Visual **fixo** (não segue tema). `< 900px` esconde o painel direito. |
| `login-form` | — | Formulário; campos próprios com ícone (e-mail/usuário, senha com olho), checkbox **"Manter-me conectado"** e botão "Entrar →" (`ui-button`, gradiente via `::part`). Chama `auth.login(email, senha, lembrar)`. **O carregamento acontece nesta tela** (o botão fica em loading até o snapshot chegar — ver [app.js](../src/app.js)); em sucesso a view é substituída ao navegar. |
| `login-grafo-bg` | — | Fundo animado de "grafos" (canvas: ~52 nós à deriva + arestas) do painel direito do login. Respeita `prefers-reduced-motion`; pausa com a aba oculta; cleanup de `rAF`/observer via `aoLimpar`. |

### Perfil — `features/perfil/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `perfil-view` | — | Rota `/perfil`. Dados do usuário (do data-store) + segurança. |
| `senha-form` | — | Troca de senha (atual/nova/confirmar) → `auth.alterarSenha`. Reusa `ui-input`/`ui-button`. |

### Obras — `features/obras/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `obras-list-view` | — | Rota `/obras`. Grid de cartões + criar/editar/excluir. |
| `obra-card` | `.obra`; eventos `abrir`, `editar`, `remover` | Cartão com barra de orçamento (gradiente). **Altura fixa** (só varia na horizontal): título trava em 2 linhas (line-clamp). Ações via `ui-button`: Editar (`tonal`), Compartilhar (`secundario`), Excluir (`perigo-contorno`, ícone). |
| `obra-form` | `.obra`; eventos `salvo`, `fechar` | Modal criar/editar obra (chama a API). |
| `obra-share-form` | `.obra`; evento `fechar` | Modal (só dono): **link público** curto (gerar/copiar/abrir/desativar) + **log de acessos** + convidar usuários para colaboração. |
| `financeiro-view` | — (rota `/financeiro`) | **Painel consolidado** entre todas as obras (compõe KPIs inline + `ui-tabs` + `ui-data-table`; reusa `despesa-split.balancos`). KPIs Total/Pago/Em aberto/Em pagamento; abas **A receber** (por destinatário real: Empresa p/ Material, Equipe/Contato p/ Serviço — sem dupla contagem), **A pagar** (por responsável), **Em aberto** (despesas com resto; clique → obra). 100% derivado. |
| `obra-detail-view` | attr `id` (rota); — | **Coração do tempo real**: KPIs + `ui-tabs` (**Gráficos** / **Despesas** / **Participantes** / **Responsáveis** / **Orçamentos** / **Equipes** / **Fornecedores** / **Transferência**); dashboard + despesas (otimista + cache). Aba **Despesas**: "+ Registrar Despesa" (`cotacao-despesa-form` obra-fixa). Aba **Orçamentos**: "+ Novo orçamento" abre `orcamento-form` com a obra **travada** + grade dos orçamentos da obra. Aba **Fornecedores**: empresas usadas na obra + Nº/Total/Recebido/**Saldo a receber** (`balancos.porFornecedor`; clique → fornecedor). Aba **Transferência** → `ui-tabs` aninhado **[Transferências | Pagamentos]**: 1ª lista as transferências da obra (Data/Valor/Tipo/Pagou/Recebedor/Nº pagamentos) — **clique** abre `abrirTransferencia`, "+ Registrar transferência" (`pagamento-form`) e **Excluir** (cascata: apaga todos os pagamentos+repasses, `removerTransferencia`); 2ª lista os pagamentos + tabela de **Repasses** (repasse acessível pelo banner do pagamento). Na aba **Despesas**, ao SELECIONAR despesas (barra de seleção): **Lançar pagamento** (abre `pagamento-form` com as selecionadas; avisa/ignora as que já têm pagamento) e **Definir responsabilidade** (modal com `split-editor` aplicado às selecionadas). |
| `obra-participantes` | attr `obra-id`, `modo` (participantes\|responsaveis) | Aba de participantes (modelo paga ↔ recebe): colunas **Pago · Recebido · Saldo a pagar · Saldo a receber** (`despesa-split.balancos`) + painel **"quem deve a quem"** (`despesa-split.acerto`). modo `participantes`: todos + adicionar/remover; modo `responsaveis`: só os marcados. |
| `participante-form` | `.obraId`; eventos `salvo`, `fechar` | Modal `ui-select` p/ adicionar um **contato** cadastrado como participante. |
| `responsaveis-form` | `.obraId`; evento `fechar` | Modal p/ marcar, entre os participantes, quem são **responsáveis** (alterna o flag via `dataStore.definirResponsavel`). |
| `publico-view` | attr `token` (rota `/publico/:token`) | Visão **pública somente-leitura** (sem login): dashboard + itens + gasto por categoria. **Sem header próprio** — usa o `app-header` padrão (modo somente-leitura) montado pelo `app-shell`, que mostra o header (sem sidebar) também nas rotas `/publico/*`. |

### Despesas — `features/despesas/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| _(removido)_ `despesa-form` | — | **Cadastro manual de despesa foi removido.** A despesa nasce só do **registro de uma oferta** (`cotacao-despesa-form` em modo obra-fixa, aberto pelo botão "+ Registrar Despesa" no card "Despesas"). |
| `despesa-table` | `.despesas`, `.categorias`, `.participantes`; eventos `abrir` (clique na linha), `editar`, `remover` | Tabela **full-width** e fluida; **no mobile (≤820px) só Data/Item/Classificação/Valor/Status** (demais marcadas `secundaria`). Colunas: Item (largura mín. 280px), **Classificação** e **Subclassificação**, **Ofertante** (`ofertanteNome`) e **Empresa**, Adicionado/Editado por + **Status** (`statusPagamento`), **Pagamento**, **Distribuição**, **Responsabilidade** e **Oferta** (id de `preco_id` — vincula à oferta de origem). Reusa `ui-data-table` + `category-badge`. |
| `pagamento-form` | `.obra`, `.despesasSelecionadas`, `.aviso`; eventos `salvo`, `fechar` | **Banner (modal)** p/ registrar uma **TRANSFERÊNCIA** que agrupa N pagamentos (1 por despesa): lista as despesas com saldo (checkbox + alocação, default=resto, total ao vivo), **Quem pagou** (participante + fallback usuário/contatos), **Tipo** (dinheiro/crédito/débito/boleto) e data (máx=hoje) → **1 chamada** `dataStore.lancarTransferencia`. **Pré-valida a regra de ouro** (`transferencia-regra.recebedorUniforme`): se as marcadas têm recebedores/empresas diferentes, mostra `ui-alert` e **desabilita** o salvar (o backend revalida). |
| `repasse-form` | `.pagamento`, `.obra`; eventos `salvo`, `fechar` | **Banner (modal)** p/ registrar um **repasse** de um pagamento: contatos a repassar (checkbox) + valor + data → `dataStore.lancarRepasse`. |
| `pagamento-util.js` | [features/pagamentos/pagamento-util.js](../src/features/pagamentos/pagamento-util.js) | `previaPagamentoHtml(p)` — card de prévia do pagamento (esverdeado; mostra **também a transferência: tipo + total** via `transferenciaDoPagamento`). `abrirPagamento(p)` — **banner** com valor/data/pagou/recebedor/empresa/obra, um **bloco da TRANSFERÊNCIA em CINZA ESCURO** (clique → `abrirTransferencia`), **despesas cobertas** e **repasses como cards** (✕ → `removerRepasse`). `previaTransferenciaHtml(t)` — card cinza-escuro da transferência. `abrirTransferencia(t)` — **banner** da transferência (valor total/tipo/pagou/recebedor/empresa/obra + os **pagamentos agrupados**, clique → `abrirPagamento`). `TIPOS_TRANSFERENCIA`, `nomeTipo`, `nomeContato/nomeEquipe/nomeChavePart/nomeRecebedor`. |
| `transferencia-regra.js` | [features/pagamentos/transferencia-regra.js](../src/features/pagamentos/transferencia-regra.js) | **Regras puras** (testáveis sem DOM; espelham `_recebedorDaDespesa` do backend): `chaveRecebedor(despesa)`, `recebedorUniforme(despesas)` (regra de ouro: mesmo recebedor+empresa), `totalAlocacoes(alocacoes)`. **Testes:** `test/transferencias.test.mjs`. |
| `pagamentos-view` | rota `/pagamentos` (menu lateral, rótulo **Transferências**) | `ui-tabs` **[Transferências | Pagamentos]**: transferências como cards **cinza-escuro** (`previaTransferenciaHtml` → `abrirTransferencia`) e pagamentos como cards esverdeados (`previaPagamentoHtml` → `abrirPagamento`). |
| `pagamento-form` (multi-despesa) | + prop `.despesasSelecionadas`, `.aviso` | Lista as despesas (marcáveis, valor=resto, total ao vivo) + **Quem pagou** + **Data** (máx = hoje; não aceita futura). **NÃO** pede recebedor/empresa — cada despesa mostra "recebe: <ofertante>" e o pagamento é registrado **por despesa** (1 por despesa via `lancarPagamento`; recebedor/empresa = ofertante/fornecedor da despesa). `.despesasSelecionadas` lista só essas, já marcadas; `.aviso` mostra um `ui-alert` no topo (ex.: "N já têm pagamento e foram ignoradas") — sem `confirm()` nativo (1 banner só). |
| `despesa-detail` | `.despesa`, `.categorias`; evento `fechar` | **Banner (modal)**. Despesa de **oferta** (`preco_id`): mostra a **oferta de origem** pelo **mesmo card de prévia** (`previaOfertaHtml`); **clicar abre** o **banner único da oferta em só-leitura** (`abrirOferta(oferta,{somenteLeitura:true})`). Para editar, edita-se a OFERTA na origem. + Data. **Sem editor de subclassificação** (vem do item). Seção **Pagamentos**: badge de **status** + Pago/Resto, os pagamentos como **cards esverdeados** (`previaPagamentoHtml`; clique → `abrirPagamento`; ✕ exclui e **desvincula** via `dataStore.excluirPagamento` — funciona p/ a ENTIDADE Pagamento **e** p/ a leva embutida antiga). Os pagamentos vêm de `dataStore.pagamentosDaDespesa` (UNIFICADO: entidades + sintetizados das levas). Se já houver pagamento, o form de lançar fica **oculto** (exclua antes de relançar). Cada card de pagamento mostra **também a transferência (tipo + valor total)**. Mini-form **Lançar pagamento** (**Quem pagou** = participante + fallback usuário/contatos + **Tipo** + valor + data + `split-editor` de integrantes p/ equipe) → `dataStore.lancarPagamento` (cria 1 transferência/1 pagamento). O "quem pagou quanto" é **derivado das levas**. Também editável: observação e **Responsabilidade** (`split-editor`). Legada (sem `preco_id`): item/valor editáveis. **Regras** (`ui-alert`): quem pagou obrigatório; Σ % ≤ 100; leva ≤ resto; Σ distribuição ≤ leva. |
| `split-editor` | `.participantes`, `.itens=[{chave,valor}]`, `.modo("valor"\|"pct")`, `.limite`; evento `mudar` | Editor reutilizável de **distribuição entre participantes** (linhas `ui-select`+`ui-input`, total/soma com `.limite` = valor ou 100%; destaca quando excede). Usado p/ pagamento (R$), responsabilidade (%) e recebido por integrante (R$). |
| `despesa-split.js` | `parseLista`, `totalPago`, `distribuicao`, `rotuloOrigem`, `acerto`, `totalRealizado`, `restoDespesa`, `statusPagamento`, `balancos`, **`balancosDePagamentos`** | Helpers puros: **acerto** "quem deve a quem"; pagamentos parciais (status/realizado/resto); **`balancos`** (modelo paga ↔ recebe, lê o ESPELHO embutido da despesa) e **`balancosDePagamentos(despesas, pagamentos)`** (mesmo shape, mas lê a COLEÇÃO de Pagamentos — entende pagamento que cobre VÁRIAS despesas; equivale a `balancos` p/ despesa única). **Testes:** `node --test` (`test/despesa-split.test.mjs`, `test/pagamentos.test.mjs`). |
| `category-badge` | `nome`, `cor` | Reutiliza `ui-badge`. |

### Itens — `features/itens/` (+ `features/categorias/categoria-form.js`)
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `itens-view` | — | Rota `/itens`. `ui-tabs`: **Itens** (catálogo; badge Material/Serviço + coluna **Subclassificação**; **linha clicável → `/itens/:id`**; CRUD via `item-form`) e **Subclassificações** (só `tipo:"item"` via `dataStore.categoriasItem()`; **todas editáveis**, reusa `categoria-form`). Ambas mostram **log** (Criado em/Atualizado em + autor/editor) via `colunasLog()`. |
| `item-detail-view` | attr `id` (rota `/itens/:id`) | Página do item (espelha `fornecedor-detail-view`): **faixa de KPIs** (Total gasto · Despesas · Cotações · Obras; cards `--grad-*`) + cabeçalho (nome + badge classificação + "Editar item") + `ui-tabs` **Despesas** (de todas as obras; clique → obra), **Cotações** (clique → cotação; melhor preço via `melhorTotal`), **Obras** (agrega nº+valor gasto por obra; clique → obra). 100% client-side (lê `item_id` do store). |
| `item-form` | `.item`; eventos `salvo`, `fechar` | Modal criar/editar item (nome + `ui-select` Classificação Material/Serviço + `ui-select` **Subclassificação OBRIGATÓRIA** = `categoriasItem()`). A subclassificação só é definida/alterada aqui (propaga p/ oferta → despesa). Emite `EVENTOS.ITENS`. |
| `categoria-form` | `.categoria`, **`.tipo`** (`item`\|`fornecedor`); eventos `salvo`, `fechar` | Modal criar/editar `categoria` (nome + cor). Rótulos conforme `.tipo`: **subclassificação** (item, default) ou **classificação** (fornecedor); envia `tipo` ao criar. Emite `EVENTOS.CATEGORIAS`. |

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
| `fornecedores-view` | — | Rota `/fornecedores`. `ui-tabs` **[Fornecedores \| Classificação]**. **Fornecedores**: CRUD (nome, telefone, e-mail, classificação); linha **clicável** → página do fornecedor. **Classificação**: gerencia as classificações de fornecedor — `categoria` com **`tipo:"fornecedor"`** (pool **distinto** da subclassificação de itens; `dataStore.categoriasFornecedor()`), reusando `categoria-form` (prop `.tipo="fornecedor"`) + `dataStore.*Categoria` + banner `vinculosDaSubclassificacao`. |
| `fornecedor-detail-view` | attr `id` (rota `/fornecedores/:id`) | Página do fornecedor: cabeçalho + `ui-tabs` com **Contatos**, **Ofertas**, **Orçamentos** e **Dados** (por obra: **Recebido / Saldo a receber**; clique → obra). |
| `fornecedor-form` | `.fornecedor`; eventos `salvo`, `fechar` | Modal criar/editar (nome*, telefone, e-mail, cnpj, classificação, observação). |
| `contatos-view` | — | Rota `/contatos`. `ui-tabs`: **Contatos** (tabela clicável), **Equipes** (grade de `equipe-card` + "+ Nova equipe") e **Cargos** (fixos + extras, CRUD via `cargo-form`). |
| `contato-detail-view` | attr `id` (rota `/contatos/:id`) | Página do contato: `ui-tabs` — **Obras**, **Fornecedores** (se Vendedor), **Equipes**, **Ofertas**, **Orçamentos** e **Dados** (por obra: **Pago · Recebido · Saldo a pagar · Saldo a receber**; clique → obra). |
| `contato-form` | `.contato`; eventos `salvo`, `fechar` | Modal criar/editar. **Cargo** via `ui-select`; campo condicional **Fornecedor** (só/obrigatório p/ Vendedor). (O campo "superior" do Pedreiro foi **removido** — agora é via Equipes.) |
| `cargo-form` | `.cargo`; eventos `salvo`, `fechar` | Modal criar/editar **cargo extra** (nome). Os 6 obrigatórios são fixos. |
| `cotacoes-view` | — | Rota `/cotacoes`. Tabela `clicavel` de cotações (item, classificação, qtd, subclassificação, obra, nº ofertas, **melhor preço**, situação). Orçamentos e Ofertas saíram daqui para abas próprias do menu. |
| `ofertas-view` | — | Rota `/ofertas` (aba do menu). Lista **todas** as ofertas (`montarTabelaOfertas` + `dataStore.todasOfertas()`) + "+ Criar oferta" (`preco-form` avulsa). |
| `cotacao-form` | `.cotacao`; eventos `salvo`, `fechar` | Modal criar/editar. **Toggle `Tipo de cotação`** (só na criação): **Por item** (escolhe 1 item) ou **Por subclassificação** (escolhe a subclasse; esconde o item — as ofertas é que definem o item). Demais campos: quantidade, unidade, **Subclassificação**, **obra opcional**, status. |
| `cotacao-detail-view` | attr `id` (rota `/cotacoes/:id`) | Faixa `<oferta-kpis>` + `ui-tabs` **[Gráficos \| Ofertas]**. **Ofertas**: tabela padrão (`colunasOferta`) — em cotação **por subclassificação** as ofertas são de **itens diferentes** (coluna Item + dropdown agrupam/ordenam por item; sem destaque de "melhor preço" único, pois mistura itens). Escolher/editar/excluir + **Registrar como despesa**; `+ Adicionar oferta` (preco-form com item restrito à subclasse). |
| `oferta-kpis` | `.resumo={num,menor,media,maior,economia}` | KPIs das ofertas em cartões com gradiente (reusa o estilo do `dashboard-summary`). |
| `grafico-evolucao-precos` | `.historico`, `.cotacao`, `.contatos`, `.cores` | **Gráfico de linhas (SVG), uma linha por contato** — evolução do preço no tempo a partir do histórico; legenda por contato. |
| `preco-form` | `.cotacao`/`.cotacaoId`, `.orcamento`, `.preco`, `.somenteLeitura`; eventos `salvo`, `fechar`. Export **`abrirOferta(oferta, {somenteLeitura?,cotacao?,orcamento?})`** | **Banner ÚNICO da oferta** — **criar / editar / ver detalhes** no mesmo componente (mesclou o antigo detalhe). O **ITEM** é um **card clicável** (nome + classificação + subclassificação) → abre banner de **detalhes do item** (`abrirDetalheItem`, com link p/ `/itens/:id`); só vira **select** ao **criar sem cotação**. Demais campos: ofertante (contato/grupo), fornecedor (auto-preenchido), qtd, valor, desconto, **prazo (obrig.)**, obs. **Travas por origem:** `.somenteLeitura` (aberto pela despesa) → tudo só-leitura (item card + campos em linhas, sem Salvar); `.cotacao` → item fixo; `.orcamento` → ofertante/fornecedor travados. Regras: Material → fornecedor obrigatório; Serviço → ofertante obrigatório. Ofertas legadas pré-preenchem item/qtd pela cotação. `abrirOferta(...)` é o ÚNICO opener (clique em qualquer oferta abre este banner). Chama `criarOferta`/`atualizarOferta`. |
| `cotacao-despesa-form` | `.cotacao`+`.preco` (oferta-fixa) **ou** `.obraFixaId` (obra-fixa); eventos `registrado`, `fechar`. Export **`abrirRegistrarDespesa(oferta)`** | Banner ÚNICO **"Registrar Despesa"** (mesmo em qualquer lugar). **oferta-fixa** (`.preco`): escolhe a **obra** (resumo da oferta, item próprio mesmo sem cotação). **obra-fixa** (`.obraFixaId`, na obra): "O que registrar?" → **Uma oferta** ou **Orçamento completo**. Sem subclassificação (herdada do item). `abrirRegistrarDespesa(oferta)` é a **entrada padrão do botão "Registrar"** em toda tabela de ofertas (ignora ofertas já registradas). Chama `registrarDespesaOferta`/`registrarOrcamentoCompleto`. |
| `cotacao-util.js` | `totalOferta`, `totalOfertaCheio`, `qtdOferta`, `unitFinalOferta`, `melhorTotal`, `resumoOfertas`, `coresPorContato`, `PALETA_CONTATOS` | Funções puras. **Valor final** = `(valor_unit_desconto||valor_unit) × (preco.quantidade||cotacao.quantidade)`; `totalOfertaCheio` = sem desconto; `qtdOferta`/`unitFinalOferta` helpers; menor total/resumo p/ KPIs (pelo valor final); cor estável por contato. |

**Orçamentos — `features/orcamentos/`** (container de ofertas de várias cotações)
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `orcamento-card` | `.orcamento`; eventos `abrir`/`editar`/`remover` | Card quadrado (espelha `obra-card`): título (ou rótulo automático), badge do **tipo** (Material/Serviço), **Total** das ofertas + nº, fornecedor/contato + obra, log. |
| `orcamento-form` | `.orcamento`, `.obraFixaId`; eventos `salvo`, `fechar` | Modal: título (opc), **tipo** (Material/Serviço), **fornecedor** (só Material), **ofertante** (Material → contatos do fornecedor; **Serviço → contatos OU equipes**, valores `c:`/`e:`), **obra** (opc). Com `.obraFixaId` (aberto pela aba Orçamentos da obra) a obra é **travada** (campo somente-leitura, não alterável). |
| `orcamentos-view` | — | Rota `/orcamentos` (aba do menu). Grade de `orcamento-card` (`montarGradeOrcamentos`) + "+ Novo orçamento". |
| `orcamento-detail-view` | attr `id` (rota `/orcamentos/:id`) | Cabeçalho + resumo (nº · total) + **tabela PADRÃO de ofertas** (`colunasOferta`); "+ Adicionar oferta" abre o banner `preco-form` (escolhe o **item**; ofertante/fornecedor herdados do orçamento). |
| `orcamento-util.js` | `rotuloOrcamento`, `totalOrcamento`, `ofertanteNome`, `colunasOferta`, **`montarTabelaOfertas`**, `colunasOrcamento`, `COR_CLASSIFICACAO` | **`colunasOferta()`** = colunas PADRÃO da oferta (Item, Classificação, Subclassificação, Ofertante, Fornecedor, Qtd, Valor unit., **Unit. c/ desc.** (verde), Total, **Total c/ desc.** (verde), Prazo, Cotação, Orçamento, **Obra**, **Despesa** (id), **Status** — menos críticas `secundaria`). **Obra/Status** derivam da despesa vinculada (`despesa.preco_id == oferta.id` ou `oferta.despesa_id`): Status = `statusPagamento` (A pagar/Em pagamento/Pago); **Despesa** = id da despesa. **`montarTabelaOfertas(el, ofertas, {acoes,onAcao,onLinha,semRegistrar})`** monta a tabela padrão e **inclui a ação "Registrar"** (→ `abrirRegistrarDespesa`; suprimida por `semRegistrar`); reuso em cotação/orçamento/fornecedor/contato/Ofertas. **`previaOfertaHtml(oferta)`** = card de prévia da oferta (item/badge/valor/qtd×unit/ofertante·empresa — usado no banner Registrar Despesa e dentro da despesa). _(O detalhe da oferta foi mesclado no `preco-form` via `abrirOferta`; o antigo `abrirDetalheOferta` foi eliminado.)_ |
| `orcamento-grade.js` | `montarGradeOrcamentos(el, lista)` | Renderiza uma **grade de `orcamento-card`** com abrir/editar/excluir — reusada em `orcamentos-view`, fornecedor/contato/obra. |

> A **oferta é única** (`CotacaoPrecos`+`orcamento_id`): aparece na cotação E no orçamento.
> As abas **Ofertas** (fornecedor/contato detail) usam `colunasOferta()` (mesma tabela
> das cotações); as abas **Orçamentos** (fornecedor/contato/obra) usam
> `montarGradeOrcamentos()` (grade de cards). O contato detail tem abas **Ofertas** e
> **Orçamentos** separadas.

**Equipes — `features/equipes/`** (grupo: líder + membros + obras; espelha Orçamentos)
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `equipe-card` | `.equipe`; eventos `abrir`/`editar`/`remover` | Card quadrado: nome, líder, nº membros, nº obras, log. |
| `equipe-form` | `.equipe`; eventos `salvo`, `fechar` | Modal: **nome** + **líder** (`ui-select` filtrado a Mestre de Obra/Engenheiro/Gestor). |
| `equipe-detail-view` | attr `id` (rota `/equipes/:id`) | Cabeçalho + `ui-tabs` **Obras / Membros / Dados** (cada aba = `ui-card` + `ui-data-table`). Vincular obra / adicionar membro pelo botão "+" no `slot="acoes"` do card → **banner flutuante** (`ui-modal` + `ui-select` composto inline, sem componente novo). Dados: **tabela** (1 linha por despesa da equipe) com **Data · Obra · Item · Quem pagou · Data do pagamento · Pago · Saldo a receber** (clique → obra). Salva via `dataStore.atualizarEquipe`. |
| `equipe-util.js` | `CARGOS_LIDER`, `liderNome` | Cargos elegíveis a líder; nome do líder ao vivo. |
| `equipe-grade.js` | `montarGradeEquipes(el, lista)` | Grade de `equipe-card` (mesmo layout de Orçamento) — reusada nas abas Equipes de contatos/contato-detail/obra. |

> A antiga lógica "Pedreiro → superior" foi **removida**; o Pedreiro agora pertence a
> uma ou mais **Equipes**. `contato-detail` mostra as equipes do contato (líder/membro).

> As tabelas de fornecedores, contatos, cotações e ofertas mostram a coluna
> **"Criado em"** (campo `criado_em`); o detalhe da cotação mostra "Criada em …".

### Admin — `features/admin/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `admin-view` | — | Rota `/admin` (só admin). Lista + ações. |
| `users-table` | `.usuarios`; eventos `editar`, `config` | Reutiliza `ui-data-table`. |
| `user-form` | `.usuario`; eventos `salvo`, `fechar` | Modal criar/editar usuário. |
| `user-config-form` | `.usuario`; evento `fechar` | Modal de configurações (chave-valor). |

---

### Helpers compartilhados (não são componentes)
| Helper | Onde | O que faz |
|--------|------|-----------|
| `colunasLog()` | [core/audit-columns.js](../src/core/audit-columns.js) | Devolve as 2 colunas padrão de **log** (Criado em + autor / Atualizado em + editor) para qualquer `ui-data-table`. Usado por itens/fornecedores/contatos/cotações + detalhes; `obra-card` mostra o log no rodapé; `users-table` mostra Criado em/por. |
| `avatar.js` | [features/shared/avatar.js](../src/features/shared/avatar.js) | **Avatar único** de contato/fornecedor (iniciais, círculo, cor estável por nome). `avatarNomeHtml(nome)` (avatar + nome) e `avatarHtml(nome,tam)`/`corAvatar(nome)`/`iniciais(nome)`. Fonte ÚNICA do avatar em TODO o sistema — usado no `app-header` (chip do usuário), `contatos-view`, `fornecedores-view`, participantes/responsáveis e fornecedores da obra (`obra-participantes`, `obra-detail-view`) e membros/“quem pagou” de equipe (`equipe-detail-view`). **Sem duplicar** markup (o `.avatar` inline do header foi eliminado). Também exporta **`whatsappBtnHtml(telefone, tam)`** — botão de WhatsApp (link `wa.me`) que acompanha contato/fornecedor em todo o sistema (listas + cabeçalho do detalhe, ao lado de Editar); **inativo/cinza** quando não há telefone. Não aparece no header do app. |
| `rastreabilidade.js` | [features/shared/rastreabilidade.js](../src/features/shared/rastreabilidade.js) | **Camada PURA** (sem browser, testável) de derivação REVERSA das vinculações — "quem aponta p/ X" só a partir dos FKs diretos (nada duplicado). `rastrearContato/Fornecedor/Item/Subclassificacao/Equipe/Obra/Oferta(id, ctx)` → listas vinculadas (inclui **pagamentos/repasses**); `obraIdDaOferta(oferta, ctx)` resolve a obra em cascata (própria→cotação→orçamento, cobre avulsas). `ctx` = coleções simples. Testes: `test/rastreabilidade.test.mjs`. |
| `vinculos.js` | [features/shared/vinculos.js](../src/features/shared/vinculos.js) | `vinculosDoItem/Fornecedor/Contato/Subclassificacao/Cargo/Oferta/`**`Obra`**`/`**`Equipe(...)`** montam os grupos (colunas+rota) **delegando à camada `rastreabilidade.js`** (monta o `ctx` do store). Cobertura ampliada (ex.: fornecedor→ofertas/despesas/obras; contato→despesas/equipes/obras; item→ofertas/obras). `abrirBannerVinculos({titulo,grupos,aoExcluir})` abre o **banner** (`ui-modal`+`ui-alert`+`ui-data-table`+`ui-button`) e **bloqueia a exclusão**; sem vínculos, executa `aoExcluir`. |
| `edicao-massa.js` | [features/shared/edicao-massa.js](../src/features/shared/edicao-massa.js) | `editarEmMassa(linhas, {criarForm, reler, aplicar, ignorar?})` — edição em massa "modo planilha" REUSANDO o MESMO form de edição da linha: abre o form da 1ª selecionada e, ao `salvo`, calcula os **campos que mudaram** (comparação semântica: ignora 1↔"1", undefined↔"") e aplica **só eles** às demais via `aplicar(linha, diff)`. Ligado por quem tem `editar-massa` (ofertas, fornecedores, contatos, itens, cotações, usuários). |

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
