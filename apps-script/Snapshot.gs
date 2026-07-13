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

  // Notas por obra (compartilhadas: quem tem acesso à obra vê), mais recentes 1º.
  const notasPorObra = {};
  obras.forEach(function (o) {
    notasPorObra[o.id] = [];
  });
  repoListar(SCHEMA.NOTAS).forEach(function (n) {
    if (idsAcc[n.obra_id]) notasPorObra[n.obra_id].push(n);
  });
  Object.keys(notasPorObra).forEach(function (id) {
    notasPorObra[id].sort(function (a, b) {
      return String(b.atualizado_em).localeCompare(String(a.atualizado_em));
    });
  });

  // ===================================================================
  // Catálogo + Compras + Financeiro — inclui os dados das obras acessíveis,
  // INCLUSIVE as COMPARTILHADAS. Antes tudo era filtrado por `u.id` (só o
  // usuário logado), então a obra compartilhada não resolvia item/empresa/
  // ofertante das despesas e as abas Compras/Transferências/Orçamentos ficavam
  // vazias. Agora: o que tem `obra_id` carrega por obra acessível; o CATÁLOGO
  // puro (contatos/empresas/itens/equipes) entra REFERENCIADO-SÓ (privacidade —
  // não vaza o catálogo inteiro do dono). `usuario_id` viaja em cada linha →
  // o front distingue "compartilhado" (usuario_id !== eu).
  // ===================================================================

  const temCompart = obras.some(function (o) {
    return String(o.usuario_id) !== String(u.id);
  });

  // 1) REFERÊNCIAS de todas as obras acessíveis (own + compartilhadas) — resolve
  //    tanto o que o DONO referencia quanto o que o CONVIDADO criou (simétrico).
  const refF = {}, refC = {}, refE = {}, refI = {}, refPreco = {}, refCat = {};
  function _addChaveRef(ch) {
    const s = String(ch || "");
    if (s.indexOf("c:") === 0) refC[s.slice(2)] = true;
    else if (s.indexOf("e:") === 0) refE[s.slice(2)] = true;
  }
  obras.forEach(function (o) {
    (participantesPorObra[o.id] || []).forEach(function (p) { _addChaveRef(p.chave); });
    (despesasPorObra[o.id] || []).forEach(function (d) {
      if (d.item_id) refI[String(d.item_id)] = true;
      if (d.fornecedor_id) refF[String(d.fornecedor_id)] = true;
      if (d.ofertante_contato_id) refC[String(d.ofertante_contato_id)] = true;
      if (d.ofertante_equipe_id) refE[String(d.ofertante_equipe_id)] = true;
      if (d.preco_id) refPreco[String(d.preco_id)] = true;
      if (d.categoria_id) refCat[String(d.categoria_id)] = true;
      (d.responsaveis || []).forEach(function (r) { _addChaveRef(r.chave); });
      (d.pagamentos || []).forEach(function (pg) { _addChaveRef(pg.chave); });
      (d.pagamentos_realizados || []).forEach(function (lv) {
        if (lv.contato_id) refC[String(lv.contato_id)] = true;
        if (lv.fornecedor_id) refF[String(lv.fornecedor_id)] = true;
        _addChaveRef(lv.pagador);
        (lv.distribuicao || []).forEach(function (x) { _addChaveRef(x.chave); });
      });
    });
  });

  // 2) FINANCEIRO por obra acessível (têm obra_id): transferências, pagamentos,
  //    repasses (own OU obra acessível — preserva os próprios e soma os da obra).
  const transferencias = repoFiltrar(SCHEMA.TRANSFERENCIAS, function (t) {
    return String(t.usuario_id) === String(u.id) || idsAcc[t.obra_id];
  }).map(_lerTransferencia);
  const pagamentos = repoFiltrar(SCHEMA.PAGAMENTOS, function (p) {
    return String(p.usuario_id) === String(u.id) || idsAcc[p.obra_id];
  }).map(_lerPagamento);
  const repasses = repoFiltrar(SCHEMA.REPASSES, function (r) {
    return String(r.usuario_id) === String(u.id) || idsAcc[r.obra_id];
  }).map(_lerRepasse);
  transferencias.concat(pagamentos).forEach(function (t) {
    if (t.fornecedor_id) refF[String(t.fornecedor_id)] = true;
    if (t.recebedor_contato_id) refC[String(t.recebedor_contato_id)] = true;
    if (t.recebedor_equipe_id) refE[String(t.recebedor_equipe_id)] = true;
    _addChaveRef(t.pagador_chave);
  });

  // 3) ORÇAMENTOS: próprios (inclui gerais sem obra) + os de obra acessível.
  const orcamentosUsuario = repoFiltrar(SCHEMA.ORCAMENTOS, function (o) {
    return _orcamentoAtivo(o) && (String(o.usuario_id) === String(u.id) || (o.obra_id && idsAcc[o.obra_id]));
  }).sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); });
  const idsOrc = {};
  orcamentosUsuario.forEach(function (o) { idsOrc[o.id] = true; });

  // 4) COTAÇÕES (base): próprias + as de obra acessível (obra_id é opcional).
  const cotacoesBase = repoFiltrar(SCHEMA.COTACOES, function (c) {
    return String(c.usuario_id) === String(u.id) || (c.obra_id && idsAcc[c.obra_id]);
  });
  const idsCot = {};
  cotacoesBase.forEach(function (c) { idsCot[c.id] = true; });

  // 5) OFERTAS/PREÇOS: próprias, de cotação/orçamento incluído, de obra acessível,
  //    OU referenciadas como "oferta de origem" de uma despesa (`preco_id`).
  const ofertas = repoListar(SCHEMA.COTACAO_PRECOS).filter(function (p) {
    return (
      String(p.usuario_id || "") === String(u.id) ||
      idsCot[p.cotacao_id] ||
      idsOrc[p.orcamento_id] ||
      (p.obra_id && idsAcc[p.obra_id]) ||
      refPreco[String(p.id)]
    );
  });
  ofertas.sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); });
  // Referências vindas das ofertas incluídas + cotações que faltam carregar.
  const cotIdsExtra = {};
  ofertas.forEach(function (p) {
    if (p.item_id) refI[String(p.item_id)] = true;
    if (p.fornecedor_id) refF[String(p.fornecedor_id)] = true;
    if (p.contato_id) refC[String(p.contato_id)] = true;
    if (p.equipe_id) refE[String(p.equipe_id)] = true;
    if (p.cotacao_id && !idsCot[p.cotacao_id]) cotIdsExtra[String(p.cotacao_id)] = true;
  });
  const cotacoes = cotacoesBase
    .concat(repoFiltrar(SCHEMA.COTACOES, function (c) { return cotIdsExtra[String(c.id)]; }))
    .sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); });
  cotacoes.forEach(function (c) { idsCot[c.id] = true; });

  // precosPorCotacao / historicoPorCotacao a partir do conjunto FINAL de cotações.
  const precosPorCotacao = {};
  cotacoes.forEach(function (c) { precosPorCotacao[c.id] = []; });
  ofertas.forEach(function (p) {
    if (idsCot[p.cotacao_id]) precosPorCotacao[p.cotacao_id].push(p);
  });
  Object.keys(precosPorCotacao).forEach(function (id) {
    precosPorCotacao[id].sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); });
  });
  const historicoPorCotacao = {};
  cotacoes.forEach(function (c) { historicoPorCotacao[c.id] = []; });
  repoListar(SCHEMA.COTACAO_PRECO_HISTORICO).forEach(function (h) {
    if (idsCot[h.cotacao_id]) historicoPorCotacao[h.cotacao_id].push(h);
  });
  Object.keys(historicoPorCotacao).forEach(function (id) {
    historicoPorCotacao[id].sort(function (a, b) { return String(a.registrado_em).localeCompare(String(b.registrado_em)); });
  });

  // 6) CATÁLOGO: próprios (ativos) + os REFERENCIADOS pelas obras (qualquer dono,
  //    qualquer estado — resolve nomes mesmo de referências antigas). 1 leitura/aba.
  const fornecedores = repoListar(SCHEMA.FORNECEDORES).filter(function (f) {
    return (_fornecedorAtivo(f) && String(f.usuario_id) === String(u.id)) || refF[String(f.id)];
  }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
  const contatos = repoListar(SCHEMA.CONTATOS).filter(function (c) {
    return (_contatoAtivo(c) && String(c.usuario_id) === String(u.id)) || refC[String(c.id)];
  }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
  const itens = repoListar(SCHEMA.ITENS).filter(function (i) {
    return (_itemAtivo(i) && String(i.usuario_id) === String(u.id)) || refI[String(i.id)];
  }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
  const equipes = repoListar(SCHEMA.EQUIPES).filter(function (e) {
    return (_equipeAtiva(e) && String(e.usuario_id) === String(u.id)) || refE[String(e.id)];
  }).sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }).map(_lerEquipe);

  // Categorias (subclassificação): próprias/GLOBAL + as referenciadas por
  // itens/empresas/despesas compartilhados (senão o badge fica "sem categoria").
  const categorias = listarCategoriasUsuario(u.id);
  if (temCompart) {
    const jaCat = {};
    categorias.forEach(function (c) { jaCat[String(c.id)] = true; });
    itens.forEach(function (i) { if (i.categoria_id) refCat[String(i.categoria_id)] = true; });
    fornecedores.forEach(function (f) { if (f.categoria_id) refCat[String(f.categoria_id)] = true; });
    repoListar(SCHEMA.CATEGORIAS).forEach(function (c) {
      if (refCat[String(c.id)] && !jaCat[String(c.id)]) categorias.push(c);
    });
  }

  const snapshot = {
    usuario: usuarioPublico(u),
    config: montarConfigUsuario(u.id),
    categorias: categorias,
    obras: obras,
    despesas: despesasPorObra,
    resumos: resumos,
    categoriasPorObra: categoriasPorObra,
    participantesPorObra: participantesPorObra,
    notasPorObra: notasPorObra,
    fornecedores: fornecedores,
    contatos: contatos,
    cargos: listarCargosUsuario(u.id),
    tiposTransferencia: listarTiposTransferenciaUsuario(u.id),
    itens: itens,
    cotacoes: cotacoes,
    precosPorCotacao: precosPorCotacao,
    ofertas: ofertas,
    historicoPorCotacao: historicoPorCotacao,
    orcamentos: orcamentosUsuario,
    equipes: equipes,
    transferencias: transferencias,
    pagamentos: pagamentos,
    repasses: repasses,
    estoque: listarMovimentosDeObras(idsAcc), // livro-razão das obras acessíveis
    servidor_em: agoraIso(),
  };

  // Admin: inclui a lista de usuários para o painel administrativo.
  if (sessao.role === ROLES.ADMIN) {
    snapshot.usuarios = repoListar(SCHEMA.USUARIOS).map(usuarioPublico);
  }
  return snapshot;
}
