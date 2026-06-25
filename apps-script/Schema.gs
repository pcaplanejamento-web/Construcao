/**
 * Schema.gs — Definição CENTRAL do modelo de dados.
 *
 * Princípio de execução nº 10: o nome de cada aba e a ordem das colunas vivem
 * só aqui. Nenhum outro arquivo usa índices mágicos; tudo lê pela posição do
 * cabeçalho declarada neste objeto.
 *
 * Para ler/escrever, use SheetRepo.gs, que monta um mapa nome->índice a partir
 * de SCHEMA[aba].colunas.
 */

const SCHEMA = {
  USUARIOS: {
    aba: "Usuarios",
    colunas: [
      "id",
      "email",
      "nome",
      "senha_hash",
      "salt",
      "role",
      "ativo",
      "criado_em",
      "criado_por",
    ],
  },

  CONFIGURACOES: {
    aba: "Configuracoes",
    colunas: ["id", "usuario_id", "chave", "valor", "atualizado_em"],
  },

  OBRAS: {
    aba: "Obras",
    colunas: [
      "id",
      "usuario_id",
      "nome",
      "endereco",
      "descricao",
      "orcamento",
      "status",
      "criado_em",
      "atualizado_em",
      "link_token", // token do link público de visualização (vazio = desativado)
      "autor_nome", // (append) quem criou (desnormalizado)
      "editor_nome", // (append) quem editou por último
    ],
  },

  DESPESAS: {
    aba: "Despesas",
    colunas: [
      "id",
      "obra_id",
      "usuario_id",
      "item",
      "valor",
      "categoria_id",
      "data",
      "observacao",
      "criado_em",
      // Auditoria (nomes desnormalizados p/ exibir sem lookup no cliente):
      "autor_nome", // quem adicionou
      "atualizado_em", // data da última edição
      "editor_nome", // quem editou por último
      // Participantes / divisão de contas (append; preserva linhas existentes):
      "pago", // boolean
      "pagamentos", // JSON [{chave, valor}] — quem pagou quanto
      "responsaveis", // JSON [{chave, pct}] — de quem é a responsabilidade (% por participante)
      // Itens (append): vínculo ao catálogo. categoria_id segue sendo a SUBclassificação.
      "item_id", // FK → Itens.id (obrigatório p/ novas despesas)
      "classificacao", // Material | Serviço (desnormalizado do item)
      // Oferta de origem (append): a despesa nasce do REGISTRO de uma oferta.
      "preco_id", // FK → CotacaoPrecos.id (oferta registrada)
      "fornecedor_id", // empresa que recebe (do contato ofertante; vazio p/ equipe)
      "ofertante_contato_id", // ofertante CONTATO (XOR equipe)
      "ofertante_equipe_id", // ofertante EQUIPE (XOR contato)
      "recebidos", // (DEPRECADO — sempre []; a distribuição por integrante vive em pagamentos_realizados[].distribuicao)
      // Pagamentos parciais (append): cada lançamento = uma "leva" paga ao ofertante.
      "pagamentos_realizados", // JSON [{id,data,valor,contato_id,fornecedor_id,distribuicao:[{chave,valor}],autor_nome,criado_em}]
      // Estoque (append): quantidade/unidade da OFERTA (Material) — congeladas no registro.
      // Quando a despesa Material é QUITADA, a quantidade vira entrada no Estoque.
      "quantidade", // número (qtd da oferta); "" p/ legado sem qtd
      "unidade", // texto livre (un, m², kg, saco…)
    ],
  },

  CATEGORIAS: {
    aba: "Categorias", // Subclassificação de ITEM (tipo "item") ou Classificação de FORNECEDOR (tipo "fornecedor")
    colunas: [
      "id",
      "usuario_id",
      "nome",
      "cor",
      "ativo",
      // Auditoria (append; preserva linhas existentes):
      "criado_em",
      "atualizado_em",
      "autor_nome", // quem criou (desnormalizado)
      "editor_nome", // quem editou por último
      // Pool: distingue subclassificação de item × classificação de fornecedor.
      "tipo", // "item" (default/legado) | "fornecedor"
    ],
  },

  COMPARTILHAMENTOS: {
    aba: "Compartilhamentos",
    colunas: ["id", "obra_id", "usuario_id", "criado_em"],
  },

  OBRA_PARTICIPANTES: {
    aba: "ObraParticipantes",
    colunas: [
      "id",
      "obra_id",
      "tipo", // usuario | contato
      "ref_id", // usuario_id ou contato_id
      "nome", // desnormalizado p/ exibir sem lookup (fallback; re-derivado ao vivo no snapshot)
      "eh_responsavel", // boolean (Fase 2)
      "criado_em",
      "autor_nome", // (append) quem adicionou
    ],
  },

  ACESSOS_LINK: {
    aba: "AcessosLink",
    colunas: ["id", "obra_id", "token", "acessado_em"],
  },

  // Módulo Compras --------------------------------------------------------
  FORNECEDORES: {
    aba: "Fornecedores",
    colunas: [
      "id",
      "usuario_id",
      "nome",
      "telefone",
      "email",
      "cnpj",
      "categoria_id",
      "observacao",
      "ativo",
      "criado_em",
      "atualizado_em",
      "autor_nome", // (append) quem criou
      "editor_nome", // (append) quem editou por último
    ],
  },

  CONTATOS: {
    aba: "Contatos",
    colunas: [
      "id",
      "usuario_id",
      "nome",
      "telefone",
      "email",
      "cargo",
      "fornecedor_id", // opcional: vincula a pessoa a uma empresa (fornecedor)
      "observacao",
      "ativo",
      "criado_em",
      "atualizado_em",
      "superior_id", // (append) p/ Pedreiro: contato Mestre de Obra/Engenheiro
      "autor_nome", // (append) quem criou
      "editor_nome", // (append) quem editou por último
    ],
  },

  CARGOS: {
    aba: "Cargos", // cargos EXTRAS do usuário (os obrigatórios são constantes)
    colunas: [
      "id",
      "usuario_id",
      "nome",
      "criado_em",
      "atualizado_em",
      "autor_nome", // (append) quem criou
      "editor_nome", // (append) quem editou por último
    ],
  },

  TIPOS_TRANSF: {
    aba: "TiposTransferencia", // tipos EXTRAS de transferência do usuário (os 4 base são constantes)
    colunas: ["id", "usuario_id", "nome", "criado_em", "atualizado_em", "autor_nome", "editor_nome"],
  },

  ITENS: {
    aba: "Itens", // catálogo de itens (cada um Material ou Serviço)
    colunas: [
      "id",
      "usuario_id",
      "nome",
      "classificacao", // Material | Serviço
      "ativo",
      "criado_em",
      "atualizado_em",
      // Auditoria (append):
      "autor_nome", // quem criou (desnormalizado)
      "editor_nome", // quem editou por último
      "categoria_id", // (append) SUBclassificação do item (obrigatória na criação)
    ],
  },

  COTACOES: {
    aba: "Cotacoes",
    colunas: [
      "id",
      "usuario_id",
      "obra_id", // opcional (vazio = cotação geral)
      "descricao", // = nome do item (desnormalizado)
      "quantidade",
      "unidade",
      "categoria_id", // SUBclassificação (opcional)
      "status", // aberta | fechada
      "criado_em",
      "atualizado_em",
      // Itens (append): vínculo ao catálogo.
      "item_id", // FK → Itens.id (obrigatório quando modo = item)
      "classificacao", // Material | Serviço (desnormalizado do item)
      "autor_nome", // (append) quem criou
      "editor_nome", // (append) quem editou por último
      "modo", // (append) "item" (legado/default) | "subclasse" (cotação por subclassificação)
    ],
  },

  COTACAO_PRECOS: {
    aba: "CotacaoPrecos", // cada linha = uma OFERTA de um contato p/ a cotação
    colunas: [
      "id",
      "cotacao_id",
      "contato_id",
      "valor_unit",
      "prazo_entrega",
      "observacao",
      "escolhido",
      "criado_em",
      "despesa_id", // (append) preenchido quando a oferta vira despesa (registrada)
      "atualizado_em", // (append) data da última edição da oferta
      "autor_nome", // (append) quem criou a oferta
      "editor_nome", // (append) quem editou por último
      "orcamento_id", // (append) FK → Orcamentos.id (vazio = oferta criada direto na cotação)
      "equipe_id", // (append) FK → Equipes.id (ofertante equipe; senão contato_id)
      "quantidade", // (append) quantitativo PRÓPRIO da oferta (vazio = usa cotacao.quantidade)
      "valor_unit_desconto", // (append) valor unitário com desconto (vazio = sem desconto → usa valor_unit)
      "item_id", // (append) FK → Itens.id — item PRÓPRIO da oferta (oferta independente da cotação)
      "fornecedor_id", // (append) FK → Fornecedores.id — fornecedor da oferta (obrigatório p/ Material)
      "usuario_id", // (append) dono da oferta (permite oferta avulsa, sem cotação/orçamento)
      "obra_id", // (append) FK → Obras.id — obra da oferta (herda cotação/orçamento; resolve obra de oferta avulsa)
    ],
  },

  EQUIPES: {
    aba: "Equipes", // grupo: líder (contato) + membros (contatos) + obras (N:N)
    colunas: [
      "id",
      "usuario_id",
      "nome",
      "lider_id", // FK → Contatos.id (Mestre de Obra/Engenheiro/Gestor)
      "membros", // JSON [contato_id, ...]
      "obras", // JSON [obra_id, ...]
      "ativo",
      "criado_em",
      "atualizado_em",
      "autor_nome",
      "editor_nome",
    ],
  },

  ORCAMENTOS: {
    aba: "Orcamentos", // container de ofertas (de várias cotações) de um ofertante
    colunas: [
      "id",
      "usuario_id",
      "obra_id", // opcional (vazio = orçamento geral)
      "tipo", // Material | Serviço
      "fornecedor_id", // obrigatório p/ Material (vazio p/ Serviço)
      "contato_id", // ofertante CONTATO (Material sempre; Serviço se não for equipe)
      "equipe_id", // (append) ofertante EQUIPE (só Serviço); contato XOR equipe
      "titulo", // opcional (rótulo automático como fallback)
      "ativo",
      "criado_em",
      "atualizado_em",
      "autor_nome",
      "editor_nome",
    ],
  },

  COTACAO_PRECO_HISTORICO: {
    aba: "CotacaoPrecoHistorico", // log: 1 ponto por criação/edição de preço
    colunas: [
      "id",
      "cotacao_id",
      "preco_id",
      "contato_id",
      "valor_unit",
      "registrado_em",
    ],
  },

  PAGAMENTOS: {
    aba: "Pagamentos", // pagamento = entidade própria; pode cobrir VÁRIAS despesas (alocacoes)
    colunas: [
      "id",
      "usuario_id",
      "obra_id", // FK → Obras.id
      "data",
      "valor", // total do pagamento (= Σ alocacoes)
      "pagador_chave", // participante que pagou ("c:"/"u:"/"e:")
      "pagador_contato_id", // FK → Contatos.id (quando o pagador é contato)
      "recebedor_contato_id", // FK → Contatos.id (XOR equipe)
      "recebedor_equipe_id", // FK → Equipes.id (grupo recebedor; XOR contato)
      "fornecedor_id", // FK → Fornecedores.id (empresa que recebe; opcional)
      "alocacoes", // JSON [{despesa_id, valor}] — cobre uma OU várias despesas
      "distribuicao", // JSON [{chave, valor}] — quanto cada integrante recebeu (equipe)
      "observacao",
      "criado_em",
      "autor_nome",
      "atualizado_em",
      "editor_nome",
      "origem_leva_id", // id da leva embutida de origem (idempotência da migração)
      "transferencia_id", // (append) FK → Transferencias.id — todo pagamento pertence a 1 transferência
      "tipo", // (append) forma: dinheiro | crédito | débito | boleto (espelha a transferência)
    ],
  },

  TRANSFERENCIAS: {
    aba: "Transferencias", // 1 transferência agrupa N pagamentos (mesmo recebedor/empresa/obra/pagador)
    colunas: [
      "id",
      "usuario_id",
      "obra_id", // FK → Obras.id (mesma de todos os pagamentos)
      "data", // = data dos pagamentos
      "valor_total", // Σ valor dos pagamentos
      "tipo", // dinheiro | crédito | débito | boleto
      "recebedor_contato_id", // FK → Contatos.id (XOR equipe) — o MESMO de todos os pagamentos
      "recebedor_equipe_id", // FK → Equipes.id (XOR contato)
      "fornecedor_id", // FK → Fornecedores.id (empresa que recebe; "" p/ equipe)
      "pagador_chave", // participante que pagou ("c:"/"u:"/"e:") — o MESMO de todos
      "pagador_contato_id", // FK → Contatos.id (quando o pagador é contato)
      "pagamento_ids", // JSON [pagamento_id, ...] — os N pagamentos desta transferência
      "observacao",
      "criado_em",
      "autor_nome",
      "atualizado_em",
      "editor_nome",
    ],
  },

  REPASSES: {
    aba: "Repasses", // o recebedor de um pagamento repassa parte a outros contatos
    colunas: [
      "id",
      "usuario_id",
      "pagamento_id", // FK → Pagamentos.id
      "recebedor_contato_id", // FK → Contatos.id (quem recebeu e está repassando)
      "obra_id", // FK → Obras.id
      "contatos_repassados", // JSON [contato_id, ...]
      "valor",
      "data",
      "observacao",
      "criado_em",
      "autor_nome",
      "atualizado_em",
      "editor_nome",
    ],
  },

  ESTOQUE: {
    aba: "Estoque", // LIVRO-RAZÃO de movimentos de estoque (append-only; consolidação derivada por obra+item)
    colunas: [
      "id",
      "usuario_id",
      "obra_id", // obra "dona" do movimento (na transferência: origem grava origem; destino grava destino)
      "item_id", // FK → Itens.id
      "classificacao", // Material | Serviço (desnormalizado do item)
      "categoria_id", // subclassificação (desnormalizada do item)
      "unidade", // texto livre (un, m², kg…)
      "tipo", // entrada_despesa | entrada_manual | entrada_transferencia | saida_transferencia | consumo | retorno
      "quantidade", // SEMPRE > 0
      "despesa_id", // FK → Despesas.id (só p/ entrada_despesa)
      "obra_origem_id", // só p/ entrada_transferencia (de qual obra veio)
      "obra_destino_id", // só p/ saida_transferencia (para qual obra foi)
      "par_id", // casa os 2 lados de uma transferência (saida ↔ entrada)
      "data",
      "observacao",
      "criado_em",
      "autor_nome",
      "atualizado_em",
      "editor_nome",
    ],
  },

  SESSOES: {
    aba: "Sessoes",
    colunas: [
      "token",
      "usuario_id",
      "role",
      "criado_em",
      "expira_em",
      "ultimo_acesso",
    ],
  },
};

/** Papéis válidos. */
const ROLES = { ADMIN: "admin", USUARIO: "usuario" };

/** Status de obra válidos. */
const STATUS_OBRA = ["ativa", "pausada", "concluida"];

/** Status de cotação válidos. */
const STATUS_COTACAO = ["aberta", "fechada"];

/** Formas de transferência/pagamento válidas. */
const TIPOS_TRANSFERENCIA = ["dinheiro", "crédito", "débito", "boleto"];

/** Tipos de movimento de estoque (livro-razão). */
const TIPOS_MOVIMENTO_ESTOQUE = [
  "entrada_despesa",
  "entrada_manual",
  "entrada_transferencia",
  "saida_transferencia",
  "consumo",
  "retorno",
];

/** Classificações de item (fixas). Toda despesa/item é Material ou Serviço. */
const CLASSIFICACOES_ITEM = ["Material", "Serviço"];

/** Cor de cada classificação (espelha COR_CLASSIFICACAO do front em itens-view.js). */
const CLASSIFICACAO_COR = { Material: "#2563eb", "Serviço": "#7c3aed" };

/** Cargos obrigatórios (fixos/built-in). A lógica condicional depende destes nomes. */
const CARGOS_OBRIGATORIOS = [
  "Vendedor",
  "Mestre de Obra",
  "Pedreiro",
  "Engenheiro",
  "Despachante",
  "Gestor",
];

/** Cargos que podem ser LÍDER de uma equipe. */
const CARGOS_LIDER = ["Mestre de Obra", "Engenheiro", "Gestor"];

/** Marcador de categoria global (compartilhada por todos). */
const CATEGORIA_GLOBAL = "GLOBAL";

/** Duração da sessão em horas. */
const SESSAO_HORAS = 12;

/** Categorias semente criadas no bootstrap (usuario_id = GLOBAL). */
const CATEGORIAS_SEED = [
  { nome: "Material", cor: "#2563eb" },
  { nome: "Mão de obra", cor: "#16a34a" },
  { nome: "Equipamento", cor: "#d97706" },
  { nome: "Serviços", cor: "#7c3aed" },
  { nome: "Documentação", cor: "#0891b2" },
  { nome: "Outros", cor: "#64748b" },
];
