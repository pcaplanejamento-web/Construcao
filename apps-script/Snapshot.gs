/**
 * Snapshot.gs — Estado inicial completo do usuário em UMA resposta.
 *
 * Permite ao frontend carregar tudo de uma vez (carregamento inicial) e operar
 * a partir de cache, sem recarregar tela a tela. Reutiliza a lógica já
 * existente (obrasListar, listarCategoriasUsuario, mapaCategorias) e lê a aba
 * Despesas UMA vez, agrupando por obra (eficiência).
 */

/** Calcula o resumo de uma obra a partir de despesas já carregadas. */
function _resumoEmMemoria(obra, despesas, catMap) {
  const ag = _agruparResumo(despesas, catMap); // helper compartilhado (Despesas.gs)
  const orcamento = Number(obra.orcamento) || 0;
  return {
    obra_id: obra.id,
    total: ag.total,
    qtd: despesas.length,
    orcamento: orcamento,
    saldo: orcamento - ag.total,
    por_categoria: ag.por_subclassificacao, // compat (= subclassificação)
    por_subclassificacao: ag.por_subclassificacao,
    por_classificacao: ag.por_classificacao,
  };
}

/** dados.snapshot -> estado inicial completo do usuário. */
function dadosSnapshot(data, sessao) {
  const u = buscarUsuarioPorId(sessao.usuario_id);
  if (!u) lancar(ERRO.NAO_AUTENTICADO, "Usuário não encontrado.");

  // Auto-reparo (uma vez): conserta dados de versões antigas — ex.: ofertas órfãs
  // de despesas excluídas antes da regra de reversão.
  _migrarUmaVez();

  // Obras acessíveis (próprias + compartilhadas), com ehDono/dono/total_gasto.
  const obras = obrasListar(data, sessao).obras;
  const idsAcc = {};
  obras.forEach(function (o) {
    idsAcc[o.id] = true;
  });

  // Lê todas as despesas uma vez e agrupa pelas obras acessíveis.
  const despesasPorObra = {};
  obras.forEach(function (o) {
    despesasPorObra[o.id] = [];
  });
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    if (idsAcc[d.obra_id]) despesasPorObra[d.obra_id].push(_lerDespesa(d));
  });
  // Ordena cada lista por data (desc), como em despesas.listar.
  Object.keys(despesasPorObra).forEach(function (id) {
    despesasPorObra[id].sort(function (a, b) {
      return String(b.data).localeCompare(String(a.data));
    });
  });

  // Memoiza categorias por dono (mapa e lista) para resumo e select.
  const mapPorDono = {};
  const listaPorDono = {};
  function catMapDe(donoId) {
    if (!mapPorDono[donoId]) mapPorDono[donoId] = mapaCategorias(donoId);
    return mapPorDono[donoId];
  }
  function catListaDe(donoId) {
    if (!listaPorDono[donoId]) listaPorDono[donoId] = listarCategoriasUsuario(donoId);
    return listaPorDono[donoId];
  }

  const resumos = {};
  const categoriasPorObra = {};
  const participantesPorObra = {};
  obras.forEach(function (o) {
    const dono = o.usuario_id;
    resumos[o.id] = _resumoEmMemoria(o, despesasPorObra[o.id], catMapDe(dono));
    categoriasPorObra[o.id] = catListaDe(dono);
    participantesPorObra[o.id] = listarParticipantesObra(o.id);
  });

  // Módulo Compras: coleções globais do usuário + ofertas agrupadas por cotação.
  const cotacoes = listarCotacoesUsuario(u.id);
  const idsCot = {};
  cotacoes.forEach(function (c) {
    idsCot[c.id] = true;
  });
  const precosPorCotacao = {};
  cotacoes.forEach(function (c) {
    precosPorCotacao[c.id] = [];
  });
  repoListar(SCHEMA.COTACAO_PRECOS).forEach(function (p) {
    if (idsCot[p.cotacao_id]) precosPorCotacao[p.cotacao_id].push(p);
  });
  Object.keys(precosPorCotacao).forEach(function (id) {
    precosPorCotacao[id].sort(function (a, b) {
      return String(b.criado_em).localeCompare(String(a.criado_em));
    });
  });

  // Lista PLANA de ofertas (oferta = unidade independente): todas as CotacaoPrecos
  // do usuário, por dono direto (usuario_id), por cotação OU por orçamento dele.
  const orcamentosUsuario = listarOrcamentosUsuario(u.id);
  const idsOrc = {};
  orcamentosUsuario.forEach(function (o) {
    idsOrc[o.id] = true;
  });
  const ofertas = repoListar(SCHEMA.COTACAO_PRECOS).filter(function (p) {
    return (
      String(p.usuario_id || "") === String(u.id) ||
      idsCot[p.cotacao_id] ||
      idsOrc[p.orcamento_id]
    );
  });
  ofertas.sort(function (a, b) {
    return String(b.criado_em).localeCompare(String(a.criado_em));
  });

  // Histórico de preços (evolução no tempo) agrupado por cotação (asc por data).
  const historicoPorCotacao = {};
  cotacoes.forEach(function (c) {
    historicoPorCotacao[c.id] = [];
  });
  repoListar(SCHEMA.COTACAO_PRECO_HISTORICO).forEach(function (h) {
    if (idsCot[h.cotacao_id]) historicoPorCotacao[h.cotacao_id].push(h);
  });
  Object.keys(historicoPorCotacao).forEach(function (id) {
    historicoPorCotacao[id].sort(function (a, b) {
      return String(a.registrado_em).localeCompare(String(b.registrado_em));
    });
  });

  const snapshot = {
    usuario: usuarioPublico(u),
    config: montarConfigUsuario(u.id),
    categorias: listarCategoriasUsuario(u.id),
    obras: obras,
    despesas: despesasPorObra,
    resumos: resumos,
    categoriasPorObra: categoriasPorObra,
    participantesPorObra: participantesPorObra,
    fornecedores: listarFornecedoresUsuario(u.id),
    contatos: listarContatosUsuario(u.id),
    cargos: listarCargosUsuario(u.id),
    tiposTransferencia: listarTiposTransferenciaUsuario(u.id),
    itens: listarItensUsuario(u.id),
    cotacoes: cotacoes,
    precosPorCotacao: precosPorCotacao,
    ofertas: ofertas,
    historicoPorCotacao: historicoPorCotacao,
    orcamentos: orcamentosUsuario,
    equipes: listarEquipesUsuario(u.id),
    transferencias: listarTransferenciasUsuario(u.id),
    pagamentos: listarPagamentosUsuario(u.id),
    repasses: listarRepassesUsuario(u.id),
    servidor_em: agoraIso(),
  };

  // Admin: inclui a lista de usuários para o painel administrativo.
  if (sessao.role === ROLES.ADMIN) {
    snapshot.usuarios = repoListar(SCHEMA.USUARIOS).map(usuarioPublico);
  }
  return snapshot;
}
