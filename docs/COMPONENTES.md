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
| `ui-modal` | `open`, `title`; slots: default, `rodape` | `fechar` | Diálogo overlay (X, backdrop, Esc). |
| `ui-toast` / `toast-host` | `tipo`, `message` | — | Notificações; host ouve o `event-bus`. |
| `ui-card` | `title`; slots: default, `acoes` | — | Cartão de superfície. **Padrão:** o botão de adicionar da tabela vai no `slot="acoes"` (cabeçalho, colado à direita); título longo **quebra** mantendo o botão à direita. |
| `ui-data-table` | `.columns` (`{chave,titulo,formato?,alinhar?,largura?,secundaria?}`; `largura`=min-width opcional ex. "280px"; **`secundaria:true`**=coluna some no **mobile (≤820px)**), `.rows`, `.acoes`; attrs `empty-text`, `fluido` (só as **células** quebram/preenchem — os **títulos nunca quebram**), `clicavel` (linha clicável) | `acao` ({acao,linha}), `linha` ({linha}) | Tabela genérica orientada a dados. Cabeçalho 11px maiúsculo; linhas separadas por `--cor-divisor`; células `.dir` (valores) em **Space Grotesk 700**. A 1ª coluna pode trazer avatar de iniciais via `formato` (ex.: `fornecedores-view`, `contatos-view`). |
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
| `obra-detail-view` | attr `id` (rota); — | **Coração do tempo real**: KPIs + `ui-tabs` (**Gráficos** / **Despesas** / **Participantes** / **Responsáveis** / **Orçamentos** / **Equipes** / **Fornecedores**); dashboard + despesas (otimista + cache). Aba **Despesas**: "+ Registrar Despesa" (`cotacao-despesa-form` obra-fixa). Aba **Orçamentos**: "+ Novo orçamento" abre `orcamento-form` com a obra **travada** + grade dos orçamentos da obra. Aba **Fornecedores**: empresas usadas na obra + Nº/Total/Recebido/**Saldo a receber** (`balancos.porFornecedor`; clique → fornecedor). |
| `obra-participantes` | attr `obra-id`, `modo` (participantes\|responsaveis) | Aba de participantes (modelo paga ↔ recebe): colunas **Pago · Recebido · Saldo a pagar · Saldo a receber** (`despesa-split.balancos`) + painel **"quem deve a quem"** (`despesa-split.acerto`). modo `participantes`: todos + adicionar/remover; modo `responsaveis`: só os marcados. |
| `participante-form` | `.obraId`; eventos `salvo`, `fechar` | Modal `ui-select` p/ adicionar um **contato** cadastrado como participante. |
| `responsaveis-form` | `.obraId`; evento `fechar` | Modal p/ marcar, entre os participantes, quem são **responsáveis** (alterna o flag via `dataStore.definirResponsavel`). |
| `publico-view` | attr `token` (rota `/publico/:token`) | Visão **pública somente-leitura** (sem login): dashboard + itens + gasto por categoria. **Sem header próprio** — usa o `app-header` padrão (modo somente-leitura) montado pelo `app-shell`, que mostra o header (sem sidebar) também nas rotas `/publico/*`. |

### Despesas — `features/despesas/`
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| _(removido)_ `despesa-form` | — | **Cadastro manual de despesa foi removido.** A despesa nasce só do **registro de uma oferta** (`cotacao-despesa-form` em modo obra-fixa, aberto pelo botão "+ Registrar Despesa" no card "Despesas"). |
| `despesa-table` | `.despesas`, `.categorias`, `.participantes`; eventos `abrir` (clique na linha), `editar`, `remover` | Tabela **full-width** e fluida; **no mobile (≤820px) só Data/Item/Classificação/Valor/Status** (demais marcadas `secundaria`). Colunas: Item (largura mín. 280px), **Classificação** e **Subclassificação**, **Ofertante** (`ofertanteNome`) e **Empresa**, Adicionado/Editado por + **Status** (`statusPagamento`), **Pagamento**, **Distribuição**, **Responsabilidade** e **Oferta** (id de `preco_id` — vincula à oferta de origem). Reusa `ui-data-table` + `category-badge`. |
| `despesa-detail` | `.despesa`, `.categorias`; evento `fechar` | **Banner (modal)**. Despesa de **oferta** (`preco_id`): mostra a **oferta de origem** pelo **mesmo card de prévia** do banner Registrar Despesa (`previaOfertaHtml`); **clicar abre** o banner de **detalhes completos** da oferta (`abrirDetalheOferta`). Read-only — para editar, edita-se a OFERTA. + Data. **Sem editor de subclassificação** (vem do item). Seção **Pagamentos**: badge de **status** + Pago/Resto, lista de **lançamentos (levas)** (com **quem pagou** + remover), e mini-form **Lançar pagamento** (**Quem pagou** = participante + valor + data + `split-editor` de integrantes p/ equipe) → `dataStore.lancarPagamento`. O "quem pagou quanto" é **derivado das levas**. Também editável: observação e **Responsabilidade** (`split-editor`). Legada (sem `preco_id`): item/valor editáveis. **Regras** (`ui-alert`): quem pagou obrigatório; Σ % ≤ 100; leva ≤ resto; Σ distribuição ≤ leva. |
| `split-editor` | `.participantes`, `.itens=[{chave,valor}]`, `.modo("valor"\|"pct")`, `.limite`; evento `mudar` | Editor reutilizável de **distribuição entre participantes** (linhas `ui-select`+`ui-input`, total/soma com `.limite` = valor ou 100%; destaca quando excede). Usado p/ pagamento (R$), responsabilidade (%) e recebido por integrante (R$). |
| `despesa-split.js` | `parseLista`, `totalPago`, `distribuicao`, `rotuloOrigem`, `acerto`, `totalRealizado`, `restoDespesa`, `statusPagamento`, `balancos` | Helpers puros: **acerto** "quem deve a quem"; pagamentos parciais (status/realizado/resto); e **`balancos`** (modelo paga ↔ recebe) → por chave `{pago, recebido, saldoApagar, saldoReceber}` + por fornecedor `{total, recebido, saldoReceber}`. **Testes:** `test/despesa-split.test.mjs` (rode `node --test` na raiz; `src/package.json` marca src/ como ESM p/ node). |
| `despesa-filtros` | `.categorias`; evento `filtrar` ({texto, categoria}) | Pesquisa por item + filtro por classificação (aplicado só na tabela). |
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
| `cotacao-form` | `.cotacao`; eventos `salvo`, `fechar` | Modal criar/editar: `ui-select` de **item*** (rótulo "nome · classificação") + badge da **classificação** (só leitura), quantidade, unidade, **Subclassificação**, **obra opcional**, status. |
| `cotacao-detail-view` | attr `id` (rota `/cotacoes/:id`) | Faixa `<oferta-kpis>` + `ui-tabs` **[Gráficos \| Ofertas]**: **Gráficos** (`<grafico-evolucao-precos>` + `<category-breakdown>` no layout `.graficos`, como obras); **Ofertas** (tabela: contato, empresa, valor unit., **total** c/ menor preço, prazo, obs, **Orçamento**, log, status; escolher/editar/excluir; **Registrar como despesa**). |
| `oferta-kpis` | `.resumo={num,menor,media,maior,economia}` | KPIs das ofertas em cartões com gradiente (reusa o estilo do `dashboard-summary`). |
| `grafico-evolucao-precos` | `.historico`, `.cotacao`, `.contatos`, `.cores` | **Gráfico de linhas (SVG), uma linha por contato** — evolução do preço no tempo a partir do histórico; legenda por contato. |
| `preco-form` | `.cotacao`/`.cotacaoId`, `.orcamento`, `.preco`; eventos `salvo`, `fechar` | Banner **ÚNICO "Criar oferta"** (reusado em cotação, orçamento e aba Ofertas). Escolhe o **Item** (define classificação/subclassificação, exibidas ao vivo) → **Ofertante** (contato ou grupo) + **Fornecedor** (auto-preenchido pelo contato) + Quantidade, Valor unitário, Valor unit. com desconto, **Prazo (obrigatório)**, obs. Regras: **Material** → fornecedor obrigatório; **Serviço** → ofertante obrigatório. Item travado quando vem de cotação/edição; ofertante+fornecedor travados quando vem de orçamento. Chama `dataStore.criarOferta`/`atualizarOferta`. |
| `cotacao-despesa-form` | `.cotacao`+`.preco` (oferta-fixa) **ou** `.obraFixaId` (obra-fixa); eventos `registrado`, `fechar`. Export **`abrirRegistrarDespesa(oferta)`** | Banner ÚNICO **"Registrar Despesa"** (mesmo em qualquer lugar). **oferta-fixa** (`.preco`): escolhe a **obra** (resumo da oferta, item próprio mesmo sem cotação). **obra-fixa** (`.obraFixaId`, na obra): "O que registrar?" → **Uma oferta** ou **Orçamento completo**. Sem subclassificação (herdada do item). `abrirRegistrarDespesa(oferta)` é a **entrada padrão do botão "Registrar"** em toda tabela de ofertas (ignora ofertas já registradas). Chama `registrarDespesaOferta`/`registrarOrcamentoCompleto`. |
| `cotacao-util.js` | `totalOferta`, `totalOfertaCheio`, `qtdOferta`, `unitFinalOferta`, `melhorTotal`, `resumoOfertas`, `coresPorContato`, `PALETA_CONTATOS` | Funções puras. **Valor final** = `(valor_unit_desconto||valor_unit) × (preco.quantidade||cotacao.quantidade)`; `totalOfertaCheio` = sem desconto; `qtdOferta`/`unitFinalOferta` helpers; menor total/resumo p/ KPIs (pelo valor final); cor estável por contato. |

**Orçamentos — `features/orcamentos/`** (container de ofertas de várias cotações)
| Componente | Props/Eventos | Descrição |
|------------|---------------|-----------|
| `orcamento-card` | `.orcamento`; eventos `abrir`/`editar`/`remover` | Card quadrado (espelha `obra-card`): título (ou rótulo automático), badge do **tipo** (Material/Serviço), **Total** das ofertas + nº, fornecedor/contato + obra, log. |
| `orcamento-form` | `.orcamento`, `.obraFixaId`; eventos `salvo`, `fechar` | Modal: título (opc), **tipo** (Material/Serviço), **fornecedor** (só Material), **ofertante** (Material → contatos do fornecedor; **Serviço → contatos OU equipes**, valores `c:`/`e:`), **obra** (opc). Com `.obraFixaId` (aberto pela aba Orçamentos da obra) a obra é **travada** (campo somente-leitura, não alterável). |
| `orcamentos-view` | — | Rota `/orcamentos` (aba do menu). Grade de `orcamento-card` (`montarGradeOrcamentos`) + "+ Novo orçamento". |
| `orcamento-detail-view` | attr `id` (rota `/orcamentos/:id`) | Cabeçalho + resumo (nº · total) + **tabela PADRÃO de ofertas** (`colunasOferta`); "+ Adicionar oferta" abre o banner `preco-form` (escolhe o **item**; ofertante/fornecedor herdados do orçamento). |
| `orcamento-util.js` | `rotuloOrcamento`, `totalOrcamento`, `ofertanteNome`, `colunasOferta`, **`montarTabelaOfertas`**, `colunasOrcamento`, `COR_CLASSIFICACAO` | **`colunasOferta()`** = colunas PADRÃO da oferta (Item, Classificação, Subclassificação, Ofertante, Fornecedor, Qtd, Valor unit., **Unit. c/ desc.** (verde), Total, **Total c/ desc.** (verde), Prazo, Cotação, Orçamento, **Obra**, **Despesa** (id), **Status** — menos críticas `secundaria`). **Obra/Status** derivam da despesa vinculada (`despesa.preco_id == oferta.id` ou `oferta.despesa_id`): Status = `statusPagamento` (A pagar/Em pagamento/Pago); **Despesa** = id da despesa. **`montarTabelaOfertas(el, ofertas, {acoes,onAcao,onLinha,semRegistrar})`** monta a tabela padrão e **inclui a ação "Registrar"** (→ `abrirRegistrarDespesa`; suprimida por `semRegistrar`); reuso em cotação/orçamento/fornecedor/contato/Ofertas. **`previaOfertaHtml(oferta)`** = card de prévia da oferta (item/badge/valor/qtd×unit/ofertante·empresa — usado no banner Registrar Despesa e dentro da despesa). **`abrirDetalheOferta(oferta)`** = banner `ui-modal` com TODAS as colunas da oferta (reusa `colunasOferta`). |
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
