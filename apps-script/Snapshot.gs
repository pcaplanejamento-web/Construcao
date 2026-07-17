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

/**
 * Fecha TRANSITIVAMENTE as referências de uma obra compartilhada: a partir das
 * sementes (refC/refF/refI/refE já coletadas das despesas/financeiro/compras),
 * anda pelas arestas do grafo raso até estabilizar — o convidado precisa não só
 * do dado direto, mas de tudo que o NORTEIA:
 *   contato    → sua empresa (fornecedor_id → refF), seu superior (superior_id →
 *                refC) e seu cargo (nome → refCargoNome)
 *   equipe     → seu líder (lider_id) + membros[] (→ refC)
 *   fornecedor → sua classificação (categoria_id → refCat)
 *   item       → sua subclassificação (categoria_id → refCat)
 * Termina sempre: cada id é processado 1× (guardas procX) sobre conjuntos finitos;
 * só re-itera quando um id NOVO é adicionado. Muta os objetos-set em `refs`.
 * Espelha o `fecharCompartilhado` do frontend (compartilhamento-closure.js).
 * `mapas` = { contato, fornecedor, item, equipe } (id → linha crua).
 */
function _fecharRefsCompartilhadas(refs, mapas) {
  var refC = refs.refC, refF = refs.refF, refI = refs.refI, refE = refs.refE,
    refCat = refs.refCat, refCargoNome = refs.refCargoNome;
  var procC = {}, procE = {}, procF = {}, procI = {};
  var seguir = true, voltas = 0;
  while (seguir && voltas < 50) { // trava dura de segurança (nunca deve ser atingida)
    seguir = false;
    voltas++;
    Object.keys(refC).forEach(function (id) {
      if (procC[id]) return;
      procC[id] = true;
      var x = mapas.contato[id];
      if (!x) return;
      var forn = String(x.fornecedor_id || "");
      if (forn && !refF[forn]) { refF[forn] = true; seguir = true; }
      var sup = String(x.superior_id || "");
      if (sup && !refC[sup]) { refC[sup] = true; seguir = true; }
      if (x.cargo) refCargoNome[String(x.cargo).trim().toLowerCase()] = true;
    });
    Object.keys(refE).forEach(function (id) {
      if (procE[id]) return;
      procE[id] = true;
      var x = mapas.equipe[id];
      if (!x) return;
      var lider = String(x.lider_id || "");
      if (lider && !refC[lider]) { refC[lider] = true; seguir = true; }
      _parseJsonLista(x.membros).forEach(function (m) {
        var v = String(m || "");
        if (v && !refC[v]) { refC[v] = true; seguir = true; }
      });
    });
    Object.keys(refF).forEach(function (id) {
      if (procF[id]) return;
      procF[id] = true;
      var x = mapas.fornecedor[id];
      if (x && x.categoria_id) refCat[String(x.categoria_id)] = true;
    });
    Object.keys(refI).forEach(function (id) {
      if (procI[id]) return;
      procI[id] = true;
      var x = mapas.item[id];
      if (x && x.categoria_id) refCat[String(x.categoria_id)] = true;
    });
  }
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

  // 1) REFERÊNCIAS de todas as obras acessíveis (own + compartilhadas) — resolve
  //    tanto o que o DONO referencia quanto o que o CONVIDADO criou (simétrico).
  const refF = {}, refC = {}, refE = {}, refI = {}, refPreco = {}, refCat = {}, refCargoNome = {};
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
    return String(t.usuario_id) === String(u.id) || (t.obra_id && idsAcc[t.obra_id]);
  }).map(_lerTransferencia);
  const pagamentos = repoFiltrar(SCHEMA.PAGAMENTOS, function (p) {
    return String(p.usuario_id) === String(u.id) || (p.obra_id && idsAcc[p.obra_id]);
  }).map(_lerPagamento);
  const repasses = repoFiltrar(SCHEMA.REPASSES, function (r) {
    return String(r.usuario_id) === String(u.id) || (r.obra_id && idsAcc[r.obra_id]);
  }).map(_lerRepasse);
  transferencias.concat(pagamentos).forEach(function (t) {
    if (t.fornecedor_id) refF[String(t.fornecedor_id)] = true;
    if (t.recebedor_contato_id) refC[String(t.recebedor_contato_id)] = true;
    if (t.recebedor_equipe_id) refE[String(t.recebedor_equipe_id)] = true;
    _addChaveRef(t.pagador_chave);
  });
  // Repasses: o recebedor e os contatos repassados também norteiam a obra (senão
  // os nomes ficam "—" no banner da transferência/pagamento).
  repasses.forEach(function (r) {
    if (r.recebedor_contato_id) refC[String(r.recebedor_contato_id)] = true;
    (r.contatos_repassados || []).forEach(function (cid) { refC[String(cid)] = true; });
  });

  // 3) ORÇAMENTOS: próprios (inclui gerais sem obra) + os de obra acessível.
  const orcamentosUsuario = repoFiltrar(SCHEMA.ORCAMENTOS, function (o) {
    return _orcamentoAtivo(o) && (String(o.usuario_id) === String(u.id) || (o.obra_id && idsAcc[o.obra_id]));
  }).sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); });
  const idsOrc = {};
  orcamentosUsuario.forEach(function (o) {
    idsOrc[o.id] = true;
    // O orçamento (container) já aponta o ofertante/empresa — semeia as refs.
    if (o.fornecedor_id) refF[String(o.fornecedor_id)] = true;
    if (o.contato_id) refC[String(o.contato_id)] = true;
    if (o.equipe_id) refE[String(o.equipe_id)] = true;
  });

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
  cotacoes.forEach(function (c) {
    idsCot[c.id] = true;
    // A cotação aponta o item e a subclassificação — semeia as refs.
    if (c.item_id) refI[String(c.item_id)] = true;
    if (c.categoria_id) refCat[String(c.categoria_id)] = true;
  });

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
  //    Lê as abas UMA vez (arrays crus) e monta mapas id→linha p/ o FECHAMENTO
  //    TRANSITIVO (o convidado leva tudo que norteia o dado: contato→empresa/
  //    cargo/superior, equipe→membros, empresa/item→categoria).
  const _fornAll = repoListar(SCHEMA.FORNECEDORES);
  const _contAll = repoListar(SCHEMA.CONTATOS);
  const _itemAll = repoListar(SCHEMA.ITENS);
  const _equipeAll = repoListar(SCHEMA.EQUIPES);
  const mapaC = {}, mapaF = {}, mapaI = {}, mapaE = {};
  _contAll.forEach(function (c) { mapaC[String(c.id)] = c; });
  _fornAll.forEach(function (f) { mapaF[String(f.id)] = f; });
  _itemAll.forEach(function (i) { mapaI[String(i.id)] = i; });
  _equipeAll.forEach(function (e) { mapaE[String(e.id)] = e; });
  // Equipe por N:N obras: se a equipe pertence a uma obra acessível, é semente.
  _equipeAll.forEach(function (e) {
    _parseJsonLista(e.obras).forEach(function (oid) {
      if (idsAcc[oid]) refE[String(e.id)] = true;
    });
  });
  _fecharRefsCompartilhadas(
    { refC: refC, refF: refF, refI: refI, refE: refE, refCat: refCat, refCargoNome: refCargoNome },
    { contato: mapaC, fornecedor: mapaF, item: mapaI, equipe: mapaE }
  );

  const fornecedores = _fornAll.filter(function (f) {
    return (_fornecedorAtivo(f) && String(f.usuario_id) === String(u.id)) || refF[String(f.id)];
  }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
  const contatos = _contAll.filter(function (c) {
    return (_contatoAtivo(c) && String(c.usuario_id) === String(u.id)) || refC[String(c.id)];
  }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
  const itens = _itemAll.filter(function (i) {
    return (_itemAtivo(i) && String(i.usuario_id) === String(u.id)) || refI[String(i.id)];
  }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
  const equipes = _equipeAll.filter(function (e) {
    return (_equipeAtiva(e) && String(e.usuario_id) === String(u.id)) || refE[String(e.id)];
  }).sort(function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }).map(_lerEquipe);

  // Categorias (subclassificação): próprias/GLOBAL + as referenciadas (item+empresa,
  // via closure) — SEMPRE (não gate por temCompart): a badge precisa do nome/cor.
  const categorias = listarCategoriasUsuario(u.id);
  const jaCat = {};
  categorias.forEach(function (c) { jaCat[String(c.id)] = true; });
  repoListar(SCHEMA.CATEGORIAS).forEach(function (c) {
    if (refCat[String(c.id)] && !jaCat[String(c.id)]) { categorias.push(c); jaCat[String(c.id)] = true; }
  });

  // Cargos: os fixos + os extras do usuário; MAIS os cargos EXTRAS do DONO cujo
  // NOME é referenciado por um contato compartilhado (senão o cargo custom não
  // viaja e a aba "Compartilhados > Cargos" fica vazia). `usuario_id` distingue.
  const cargos = listarCargosUsuario(u.id);
  const jaCargoNome = {};
  cargos.forEach(function (cg) { jaCargoNome[String(cg.nome).trim().toLowerCase()] = true; });
  // SÓ cargos de um DONO de obra acessível (senão, casar por NOME entre TODOS os
  // usuários vazaria o cargo de um terceiro sem relação com esta sessão).
  const donosAcc = {};
  obras.forEach(function (o) { donosAcc[String(o.usuario_id)] = true; });
  repoListar(SCHEMA.CARGOS).forEach(function (cg) {
    var n = String(cg.nome || "").trim().toLowerCase();
    if (n && refCargoNome[n] && !jaCargoNome[n] && String(cg.usuario_id) !== String(u.id) && donosAcc[String(cg.usuario_id)]) {
      cargos.push({
        id: cg.id, usuario_id: cg.usuario_id, nome: cg.nome, fixo: false,
        criado_em: cg.criado_em, atualizado_em: cg.atualizado_em,
      });
      jaCargoNome[n] = true;
    }
  });

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
    cargos: cargos,
    tiposTransferencia: listarTiposTransferenciaUsuario(u.id),
    classificacoesItem: listarClassificacoesExtras(),
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
