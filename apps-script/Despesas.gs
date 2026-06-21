/**
 * Despesas.gs — CRUD de despesas e agregação do resumo da obra.
 *
 * O resumo é SEMPRE recalculado a partir das despesas (nunca um contador
 * mutável separado), evitando divergência. Mutações retornam o resumo já
 * atualizado para a UI otimizar o dashboard sem refetch extra.
 */

/**
 * Agrupa despesas para os gráficos: por SUBclassificação (categoria_id) e por
 * CLASSIFICAÇÃO (Material/Serviço). Reutilizado por _calcularResumo (Despesas)
 * e _resumoEmMemoria (Snapshot). Itens em {nome, cor, total} (desc por total).
 */
function _agruparResumo(despesas, mapaCat) {
  const porSub = {}; // categoria_id -> total
  const porClass = {}; // classificacao -> total
  let total = 0;
  despesas.forEach(function (d) {
    const v = Number(d.valor) || 0;
    total += v;
    porSub[d.categoria_id] = (porSub[d.categoria_id] || 0) + v;
    porClass[String(d.classificacao || "")] = (porClass[String(d.classificacao || "")] || 0) + v;
  });

  const por_subclassificacao = Object.keys(porSub)
    .map(function (catId) {
      const cat = mapaCat[catId] || { nome: "Sem subclassificação", cor: "#94a3b8" };
      return { categoria_id: catId, nome: cat.nome, cor: cat.cor, total: porSub[catId] };
    })
    .sort(function (a, b) {
      return b.total - a.total;
    });

  const por_classificacao = Object.keys(porClass)
    .map(function (cl) {
      return { nome: cl || "Sem classificação", cor: CLASSIFICACAO_COR[cl] || "#94a3b8", total: porClass[cl] };
    })
    .sort(function (a, b) {
      return b.total - a.total;
    });

  return { total: total, por_subclassificacao: por_subclassificacao, por_classificacao: por_classificacao };
}

/** Calcula o resumo financeiro de uma obra. */
function _calcularResumo(obraId, usuarioId) {
  const obra = _obraAcessivel(obraId, usuarioId);
  const despesas = repoFiltrar(SCHEMA.DESPESAS, function (d) {
    return String(d.obra_id) === String(obraId);
  });

  // Mapeia categorias pelo DONO da obra (global + dele), garantindo rótulos
  // consistentes para todos os colaboradores.
  const mapaCat = mapaCategorias(obra.usuario_id);
  const ag = _agruparResumo(despesas, mapaCat);

  const orcamento = Number(obra.orcamento) || 0;
  return {
    obra_id: obraId,
    total: ag.total,
    qtd: despesas.length,
    orcamento: orcamento,
    saldo: orcamento - ag.total,
    por_categoria: ag.por_subclassificacao, // compat (= subclassificação)
    por_subclassificacao: ag.por_subclassificacao,
    por_classificacao: ag.por_classificacao,
  };
}

/** JSON de lista (pagamentos/responsaveis) -> array; tolerante a vazio/erro. */
function _parseJsonLista(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

/** Normaliza uma despesa para o cliente: pago boolean + listas como arrays. */
function _lerDespesa(d) {
  if (!d) return d;
  return Object.assign({}, d, {
    pago: _boolDe(d.pago),
    pagamentos: _parseJsonLista(d.pagamentos),
    responsaveis: _parseJsonLista(d.responsaveis),
  });
}

/** despesas.listar -> { despesas: [...] } (da obra acessível). */
function despesasListar(data, sessao) {
  const obraId = data && data.obra_id;
  _obraAcessivel(obraId, sessao.usuario_id);
  const despesas = repoFiltrar(SCHEMA.DESPESAS, function (d) {
    return String(d.obra_id) === String(obraId);
  });
  despesas.sort(function (a, b) {
    return String(b.data).localeCompare(String(a.data));
  });
  return { despesas: despesas.map(_lerDespesa) };
}

/** despesas.resumo -> { ...resumo } (usado pelo polling do dashboard). */
function despesasResumo(data, sessao) {
  return _calcularResumo(data && data.obra_id, sessao.usuario_id);
}

/**
 * Monta e insere uma despesa (SEM lock — o chamador deve estar sob comLock e já
 * ter validado o acesso à obra). Reutilizado por despesas.criar e pelo
 * "registrar cotação como despesa" (Cotacoes.gs).
 */
function _novaDespesa(obraId, usuarioId, dados) {
  const nome = (buscarUsuarioPorId(usuarioId) || {}).nome || "";
  const agora = agoraIso();

  // Vínculo ao item: se item_id, deriva nome+classificacao do catálogo (fonte de
  // verdade). Sem item_id (legado/cotação antiga), usa o texto/classificacao recebidos.
  let itemNome = String((dados && dados.item) || "").trim();
  let classificacao = String((dados && dados.classificacao) || "");
  const itemId = String((dados && dados.item_id) || "");
  if (itemId) {
    const it = _itemPorId(itemId, usuarioId);
    itemNome = it.nome;
    classificacao = it.classificacao;
  }

  const despesa = {
    id: novoId(),
    obra_id: obraId,
    usuario_id: usuarioId,
    item: itemNome,
    valor: Number(dados && dados.valor) || 0,
    categoria_id: String((dados && dados.categoria_id) || ""),
    data: String((dados && dados.data) || agora.substring(0, 10)),
    observacao: String((dados && dados.observacao) || ""),
    criado_em: agora,
    autor_nome: nome,
    atualizado_em: agora,
    editor_nome: nome,
    pago: (dados && dados.pago) === true,
    pagamentos: JSON.stringify(
      dados && Array.isArray(dados.pagamentos) ? dados.pagamentos : []
    ),
    responsaveis: JSON.stringify(
      dados && Array.isArray(dados.responsaveis) ? dados.responsaveis : []
    ),
    item_id: itemId,
    classificacao: classificacao,
  };
  repoInserir(SCHEMA.DESPESAS, despesa);
  return despesa;
}

/** despesas.criar -> { despesa, resumo }. */
function despesasCriar(data, sessao) {
  const obraId = data && data.obra_id;
  _obraAcessivel(obraId, sessao.usuario_id);

  const itemId = String((data && data.item_id) || "");
  const valor = Number(data && data.valor);
  if (!itemId) lancar(ERRO.VALIDACAO, "Selecione um item para a despesa.");
  if (!(valor > 0)) lancar(ERRO.VALIDACAO, "Informe um valor maior que zero.");

  return comLock(function () {
    const despesa = _novaDespesa(obraId, sessao.usuario_id, {
      item_id: itemId,
      valor: valor,
      categoria_id: data && data.categoria_id,
      data: data && data.data,
      observacao: data && data.observacao,
      pago: data && data.pago,
      pagamentos: data && data.pagamentos,
      responsaveis: data && data.responsaveis,
    });
    return { despesa: _lerDespesa(despesa), resumo: _calcularResumo(obraId, sessao.usuario_id) };
  });
}

/** Localiza despesa garantindo acesso via a OBRA (dono ou compartilhado). */
function _despesaAcessivel(despesaId, usuarioId) {
  const d = repoEncontrar(SCHEMA.DESPESAS, function (x) {
    return String(x.id) === String(despesaId);
  });
  if (!d) lancar(ERRO.NAO_ENCONTRADO, "Despesa não encontrada.");
  _obraAcessivel(d.obra_id, usuarioId); // valida acesso à obra (lança se não tiver)
  return d;
}

/** despesas.atualizar -> { despesa, resumo }. */
function despesasAtualizar(data, sessao) {
  const id = data && data.id;
  const atual = _despesaAcessivel(id, sessao.usuario_id);

  const patch = {};
  // Item: se vier item_id, re-deriva nome+classificacao do catálogo (fonte de verdade).
  if (data.item_id !== undefined && String(data.item_id || "")) {
    const it = _itemPorId(String(data.item_id), sessao.usuario_id);
    patch.item_id = String(data.item_id);
    patch.item = it.nome;
    patch.classificacao = it.classificacao;
  } else if (data.item !== undefined) {
    const item = String(data.item).trim();
    if (!item) lancar(ERRO.VALIDACAO, "O item não pode ficar vazio.");
    patch.item = item;
  }
  if (data.valor !== undefined) {
    const valor = Number(data.valor);
    if (!(valor > 0)) lancar(ERRO.VALIDACAO, "Valor inválido.");
    patch.valor = valor;
  }
  if (data.categoria_id !== undefined)
    patch.categoria_id = String(data.categoria_id);
  if (data.data !== undefined) patch.data = String(data.data);
  if (data.observacao !== undefined)
    patch.observacao = String(data.observacao);
  // Participantes / divisão de contas.
  if (data.pago !== undefined) patch.pago = data.pago === true;
  if (data.pagamentos !== undefined)
    patch.pagamentos = JSON.stringify(Array.isArray(data.pagamentos) ? data.pagamentos : []);
  if (data.responsaveis !== undefined)
    patch.responsaveis = JSON.stringify(Array.isArray(data.responsaveis) ? data.responsaveis : []);

  // Auditoria: registra quem editou e quando.
  patch.atualizado_em = agoraIso();
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const despesa = repoAtualizar(SCHEMA.DESPESAS, "id", id, patch);
    return {
      despesa: _lerDespesa(despesa),
      resumo: _calcularResumo(atual.obra_id, sessao.usuario_id),
    };
  });
}

/** despesas.remover -> { id, resumo }. */
function despesasRemover(data, sessao) {
  const id = data && data.id;
  const atual = _despesaAcessivel(id, sessao.usuario_id);

  return comLock(function () {
    repoRemover(SCHEMA.DESPESAS, "id", id);
    return {
      id: id,
      resumo: _calcularResumo(atual.obra_id, sessao.usuario_id),
    };
  });
}
