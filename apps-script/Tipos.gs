/**
 * Tipos.gs — Tipos de TRANSFERÊNCIA. Os 4 base são FIXOS (constante
 * TIPOS_TRANSFERENCIA: dinheiro/crédito/débito/boleto), sempre presentes. Tipos
 * EXTRAS (ex.: Pix, transferência bancária) são criados pelo usuário na aba
 * Configuração → Transferências, com log de criação/edição. Espelha Cargos.gs.
 *
 * A transferência guarda o tipo pelo NOME (string). Esta lista só popula o seletor.
 */

/** Lista de tipos do usuário: base (built-in) + extras. */
function listarTiposTransferenciaUsuario(usuarioId) {
  const fixos = TIPOS_TRANSFERENCIA.map(function (nome) {
    return { id: "builtin:" + nome, nome: nome, fixo: true };
  });
  const extras = repoFiltrar(SCHEMA.TIPOS_TRANSF, function (t) {
    return String(t.usuario_id) === String(usuarioId);
  })
    .map(function (t) {
      return { id: t.id, nome: t.nome, fixo: false, criado_em: t.criado_em, atualizado_em: t.atualizado_em };
    })
    .sort(function (a, b) {
      return String(a.nome).localeCompare(String(b.nome));
    });
  return fixos.concat(extras);
}

/** Verdadeiro se já existe um tipo (base ou extra do usuário) com esse nome. */
function _tipoTransfNomeEmUso(nome, usuarioId, ignorarId) {
  const n = String(nome).trim().toLowerCase();
  if (TIPOS_TRANSFERENCIA.some(function (o) { return o.toLowerCase() === n; })) return true;
  return !!repoEncontrar(SCHEMA.TIPOS_TRANSF, function (t) {
    return (
      String(t.usuario_id) === String(usuarioId) &&
      String(t.id) !== String(ignorarId || "") &&
      String(t.nome).trim().toLowerCase() === n
    );
  });
}

/** Garante que o tipo (extra) é do usuário; senão lança. */
function _tipoTransfDoUsuario(tipoId, usuarioId) {
  const t = repoEncontrar(SCHEMA.TIPOS_TRANSF, function (x) {
    return String(x.id) === String(tipoId);
  });
  if (!t || String(t.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Tipo de transferência não pode ser alterado.");
  }
  return t;
}

/** tiposTransferencia.listar -> { tipos: [...] }. */
function tiposTransferenciaListar(data, sessao) {
  return { tipos: listarTiposTransferenciaUsuario(sessao.usuario_id) };
}

/** tiposTransferencia.criar -> { tipo }. */
function tiposTransferenciaCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome do tipo.");
  if (_tipoTransfNomeEmUso(nome, sessao.usuario_id)) {
    lancar(ERRO.VALIDACAO, "Já existe um tipo com esse nome.");
  }
  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const tipo = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.TIPOS_TRANSF, tipo);
    return { tipo: tipo };
  });
}

/** tiposTransferencia.atualizar -> { tipo }. */
function tiposTransferenciaAtualizar(data, sessao) {
  const id = data && data.id;
  _tipoTransfDoUsuario(id, sessao.usuario_id);
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
  if (_tipoTransfNomeEmUso(nome, sessao.usuario_id, id)) {
    lancar(ERRO.VALIDACAO, "Já existe um tipo com esse nome.");
  }
  return comLock(function () {
    const tipo = repoAtualizar(SCHEMA.TIPOS_TRANSF, "id", id, {
      nome: nome,
      atualizado_em: agoraIso(),
      editor_nome: (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "",
    });
    return { tipo: tipo };
  });
}

/** tiposTransferencia.remover -> { id }. Tipos base não podem ser removidos (são fixos). */
function tiposTransferenciaRemover(data, sessao) {
  const id = data && data.id;
  _tipoTransfDoUsuario(id, sessao.usuario_id);
  return comLock(function () {
    repoRemover(SCHEMA.TIPOS_TRANSF, "id", id);
    return { id: id };
  });
}
