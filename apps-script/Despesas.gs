/**
 * Despesas.gs — CRUD de despesas e agregação do resumo da obra.
 *
 * O resumo é SEMPRE recalculado a partir das despesas (nunca um contador
 * mutável separado), evitando divergência. Mutações retornam o resumo já
 * atualizado para a UI otimizar o dashboard sem refetch extra.
 */

/** Calcula o resumo financeiro de uma obra. */
function _calcularResumo(obraId, usuarioId) {
  const obra = _obraAcessivel(obraId, usuarioId);
  const despesas = repoFiltrar(SCHEMA.DESPESAS, function (d) {
    return String(d.obra_id) === String(obraId);
  });

  // Mapeia categorias pelo DONO da obra (global + dele), garantindo rótulos
  // consistentes para todos os colaboradores.
  const mapaCat = mapaCategorias(obra.usuario_id);
  const acumulado = {}; // categoria_id -> total
  let total = 0;
  despesas.forEach(function (d) {
    const v = Number(d.valor) || 0;
    total += v;
    acumulado[d.categoria_id] = (acumulado[d.categoria_id] || 0) + v;
  });

  const porCategoria = Object.keys(acumulado).map(function (catId) {
    const cat = mapaCat[catId] || { nome: "Sem categoria", cor: "#94a3b8" };
    return {
      categoria_id: catId,
      nome: cat.nome,
      cor: cat.cor,
      total: acumulado[catId],
    };
  });
  porCategoria.sort(function (a, b) {
    return b.total - a.total;
  });

  const orcamento = Number(obra.orcamento) || 0;
  return {
    obra_id: obraId,
    total: total,
    qtd: despesas.length,
    orcamento: orcamento,
    saldo: orcamento - total,
    por_categoria: porCategoria,
  };
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
  return { despesas: despesas };
}

/** despesas.resumo -> { ...resumo } (usado pelo polling do dashboard). */
function despesasResumo(data, sessao) {
  return _calcularResumo(data && data.obra_id, sessao.usuario_id);
}

/** despesas.criar -> { despesa, resumo }. */
function despesasCriar(data, sessao) {
  const obraId = data && data.obra_id;
  _obraAcessivel(obraId, sessao.usuario_id);

  const item = String((data && data.item) || "").trim();
  const valor = Number(data && data.valor);
  if (!item) lancar(ERRO.VALIDACAO, "Informe o item da despesa.");
  if (!(valor > 0)) lancar(ERRO.VALIDACAO, "Informe um valor maior que zero.");

  const nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
  return comLock(function () {
    const agora = agoraIso();
    const despesa = {
      id: novoId(),
      obra_id: obraId,
      usuario_id: sessao.usuario_id,
      item: item,
      valor: valor,
      categoria_id: String((data && data.categoria_id) || ""),
      data: String((data && data.data) || agora.substring(0, 10)),
      observacao: String((data && data.observacao) || ""),
      criado_em: agora,
      autor_nome: nome,
      atualizado_em: agora,
      editor_nome: nome,
    };
    repoInserir(SCHEMA.DESPESAS, despesa);
    return { despesa: despesa, resumo: _calcularResumo(obraId, sessao.usuario_id) };
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
  if (data.item !== undefined) {
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

  // Auditoria: registra quem editou e quando.
  patch.atualizado_em = agoraIso();
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const despesa = repoAtualizar(SCHEMA.DESPESAS, "id", id, patch);
    return {
      despesa: despesa,
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
