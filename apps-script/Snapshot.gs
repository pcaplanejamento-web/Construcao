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
  const acumulado = {};
  let total = 0;
  despesas.forEach(function (d) {
    const v = Number(d.valor) || 0;
    total += v;
    acumulado[d.categoria_id] = (acumulado[d.categoria_id] || 0) + v;
  });
  const por_categoria = Object.keys(acumulado)
    .map(function (catId) {
      const c = catMap[catId] || { nome: "Sem categoria", cor: "#94a3b8" };
      return { categoria_id: catId, nome: c.nome, cor: c.cor, total: acumulado[catId] };
    })
    .sort(function (a, b) {
      return b.total - a.total;
    });
  const orcamento = Number(obra.orcamento) || 0;
  return {
    obra_id: obra.id,
    total: total,
    qtd: despesas.length,
    orcamento: orcamento,
    saldo: orcamento - total,
    por_categoria: por_categoria,
  };
}

/** dados.snapshot -> estado inicial completo do usuário. */
function dadosSnapshot(data, sessao) {
  const u = buscarUsuarioPorId(sessao.usuario_id);
  if (!u) lancar(ERRO.NAO_AUTENTICADO, "Usuário não encontrado.");

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
    if (idsAcc[d.obra_id]) despesasPorObra[d.obra_id].push(d);
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
  obras.forEach(function (o) {
    const dono = o.usuario_id;
    resumos[o.id] = _resumoEmMemoria(o, despesasPorObra[o.id], catMapDe(dono));
    categoriasPorObra[o.id] = catListaDe(dono);
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

  const snapshot = {
    usuario: usuarioPublico(u),
    config: montarConfigUsuario(u.id),
    categorias: listarCategoriasUsuario(u.id),
    obras: obras,
    despesas: despesasPorObra,
    resumos: resumos,
    categoriasPorObra: categoriasPorObra,
    fornecedores: listarFornecedoresUsuario(u.id),
    contatos: listarContatosUsuario(u.id),
    cotacoes: cotacoes,
    precosPorCotacao: precosPorCotacao,
    servidor_em: agoraIso(),
  };

  // Admin: inclui a lista de usuários para o painel administrativo.
  if (sessao.role === ROLES.ADMIN) {
    snapshot.usuarios = repoListar(SCHEMA.USUARIOS).map(usuarioPublico);
  }
  return snapshot;
}
