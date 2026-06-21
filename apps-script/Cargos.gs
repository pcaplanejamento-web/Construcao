/**
 * Cargos.gs — Cargos de contatos. Os 6 obrigatórios são FIXOS (constantes
 * CARGOS_OBRIGATORIOS), sempre presentes e não editáveis (a lógica condicional
 * de Vendedor/Pedreiro/Mestre/Engenheiro depende dos nomes). Cargos EXTRAS são
 * criados pelo usuário (aba Cargos) com log de criação/edição.
 *
 * O contato guarda o cargo pelo NOME (string). Esta lista só popula o seletor.
 */

/** Lista de cargos do usuário: fixos (built-in) + extras. */
function listarCargosUsuario(usuarioId) {
  const fixos = CARGOS_OBRIGATORIOS.map(function (nome) {
    return { id: "builtin:" + nome, nome: nome, fixo: true };
  });
  const extras = repoFiltrar(SCHEMA.CARGOS, function (c) {
    return String(c.usuario_id) === String(usuarioId);
  })
    .map(function (c) {
      return {
        id: c.id,
        nome: c.nome,
        fixo: false,
        criado_em: c.criado_em,
        atualizado_em: c.atualizado_em,
      };
    })
    .sort(function (a, b) {
      return String(a.nome).localeCompare(String(b.nome));
    });
  return fixos.concat(extras);
}

/** Verdadeiro se já existe um cargo (fixo ou extra do usuário) com esse nome. */
function _cargoNomeEmUso(nome, usuarioId, ignorarId) {
  const n = String(nome).trim().toLowerCase();
  if (CARGOS_OBRIGATORIOS.some(function (o) { return o.toLowerCase() === n; })) return true;
  return !!repoEncontrar(SCHEMA.CARGOS, function (c) {
    return (
      String(c.usuario_id) === String(usuarioId) &&
      String(c.id) !== String(ignorarId || "") &&
      String(c.nome).trim().toLowerCase() === n
    );
  });
}

/** Garante que o cargo (extra) é do usuário; senão lança. */
function _cargoDoUsuario(cargoId, usuarioId) {
  const c = repoEncontrar(SCHEMA.CARGOS, function (x) {
    return String(x.id) === String(cargoId);
  });
  if (!c || String(c.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Cargo não pode ser alterado.");
  }
  return c;
}

/** cargos.listar -> { cargos: [...] }. */
function cargosListar(data, sessao) {
  return { cargos: listarCargosUsuario(sessao.usuario_id) };
}

/** cargos.criar -> { cargo }. */
function cargosCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome do cargo.");
  if (_cargoNomeEmUso(nome, sessao.usuario_id)) {
    lancar(ERRO.VALIDACAO, "Já existe um cargo com esse nome.");
  }
  return comLock(function () {
    const agora = agoraIso();
    const cargo = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      criado_em: agora,
      atualizado_em: agora,
    };
    repoInserir(SCHEMA.CARGOS, cargo);
    return { cargo: cargo };
  });
}

/** cargos.atualizar -> { cargo }. */
function cargosAtualizar(data, sessao) {
  const id = data && data.id;
  _cargoDoUsuario(id, sessao.usuario_id);
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
  if (_cargoNomeEmUso(nome, sessao.usuario_id, id)) {
    lancar(ERRO.VALIDACAO, "Já existe um cargo com esse nome.");
  }
  return comLock(function () {
    const cargo = repoAtualizar(SCHEMA.CARGOS, "id", id, {
      nome: nome,
      atualizado_em: agoraIso(),
    });
    return { cargo: cargo };
  });
}

/** cargos.remover -> { id }. */
function cargosRemover(data, sessao) {
  const id = data && data.id;
  _cargoDoUsuario(id, sessao.usuario_id);
  return comLock(function () {
    repoRemover(SCHEMA.CARGOS, "id", id);
    return { id: id };
  });
}
