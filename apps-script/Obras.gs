/**
 * Obras.gs — CRUD de obras, sempre escopado ao usuário da sessão.
 *
 * Princípio nº 7: o `usuario_id` vem SEMPRE da sessão; qualquer valor enviado
 * pelo cliente é ignorado (previne IDOR).
 */

/** Garante que a obra existe e pertence ao usuário; retorna a obra. */
function _obraDoUsuario(obraId, usuarioId) {
  const obra = repoEncontrar(SCHEMA.OBRAS, function (o) {
    return String(o.id) === String(obraId);
  });
  if (!obra || String(obra.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_ENCONTRADO, "Obra não encontrada.");
  }
  return obra;
}

/** Normaliza/valida o status, com fallback para "ativa". */
function _statusValido(status) {
  return STATUS_OBRA.indexOf(status) >= 0 ? status : "ativa";
}

/** obras.listar -> { obras: [...] } (apenas as do usuário, com total_gasto). */
function obrasListar(data, sessao) {
  const obras = repoFiltrar(SCHEMA.OBRAS, function (o) {
    return String(o.usuario_id) === String(sessao.usuario_id);
  });

  // Soma as despesas do usuário por obra numa única leitura (eficiente).
  const totais = {};
  repoFiltrar(SCHEMA.DESPESAS, function (d) {
    return String(d.usuario_id) === String(sessao.usuario_id);
  }).forEach(function (d) {
    totais[d.obra_id] = (totais[d.obra_id] || 0) + (Number(d.valor) || 0);
  });

  obras.forEach(function (o) {
    o.total_gasto = totais[o.id] || 0;
  });
  return { obras: obras };
}

/** obras.obter -> { obra }. */
function obrasObter(data, sessao) {
  const obra = _obraDoUsuario(data && data.id, sessao.usuario_id);
  return { obra: obra };
}

/** obras.criar -> { obra }. */
function obrasCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome da obra.");

  return comLock(function () {
    const obra = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      endereco: String((data && data.endereco) || ""),
      descricao: String((data && data.descricao) || ""),
      orcamento: Number((data && data.orcamento) || 0) || 0,
      status: _statusValido(data && data.status),
      criado_em: agoraIso(),
      atualizado_em: agoraIso(),
    };
    repoInserir(SCHEMA.OBRAS, obra);
    return { obra: obra };
  });
}

/** obras.atualizar -> { obra }. */
function obrasAtualizar(data, sessao) {
  const id = data && data.id;
  _obraDoUsuario(id, sessao.usuario_id); // valida posse.

  const patch = { atualizado_em: agoraIso() };
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "O nome não pode ficar vazio.");
    patch.nome = nome;
  }
  if (data.endereco !== undefined) patch.endereco = String(data.endereco);
  if (data.descricao !== undefined) patch.descricao = String(data.descricao);
  if (data.orcamento !== undefined)
    patch.orcamento = Number(data.orcamento) || 0;
  if (data.status !== undefined) patch.status = _statusValido(data.status);

  return comLock(function () {
    const obra = repoAtualizar(SCHEMA.OBRAS, "id", id, patch);
    return { obra: obra };
  });
}

/** obras.remover -> { id } (remove a obra e suas despesas). */
function obrasRemover(data, sessao) {
  const id = data && data.id;
  _obraDoUsuario(id, sessao.usuario_id); // valida posse.

  return comLock(function () {
    // Remove despesas vinculadas primeiro (varre de baixo p/ cima).
    const despesas = repoFiltrar(SCHEMA.DESPESAS, function (d) {
      return String(d.obra_id) === String(id);
    });
    despesas.forEach(function (d) {
      repoRemover(SCHEMA.DESPESAS, "id", d.id);
    });
    repoRemover(SCHEMA.OBRAS, "id", id);
    return { id: id };
  });
}
