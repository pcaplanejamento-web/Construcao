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
    ],
  },

  CATEGORIAS: {
    aba: "Categorias",
    colunas: ["id", "usuario_id", "nome", "cor", "ativo"],
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
      "nome", // desnormalizado p/ exibir sem lookup
      "eh_responsavel", // boolean (Fase 2)
      "criado_em",
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
    ],
  },

  CARGOS: {
    aba: "Cargos", // cargos EXTRAS do usuário (os obrigatórios são constantes)
    colunas: ["id", "usuario_id", "nome", "criado_em", "atualizado_em"],
  },

  COTACOES: {
    aba: "Cotacoes",
    colunas: [
      "id",
      "usuario_id",
      "obra_id", // opcional (vazio = cotação geral)
      "descricao",
      "quantidade",
      "unidade",
      "categoria_id",
      "status", // aberta | fechada
      "criado_em",
      "atualizado_em",
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

/** Cargos obrigatórios (fixos/built-in). A lógica condicional depende destes nomes. */
const CARGOS_OBRIGATORIOS = [
  "Vendedor",
  "Mestre de Obra",
  "Pedreiro",
  "Engenheiro",
  "Despachante",
  "Gestor",
];

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
