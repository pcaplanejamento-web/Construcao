/**
 * Equipes.gs — Equipes (grupos): líder (contato) + membros (contatos) + obras (N:N).
 *
 * O líder é obrigatoriamente Mestre de Obra/Engenheiro/Gestor (CARGOS_LIDER).
 * Membros e obras são listas (JSON) geridas na página da equipe. Substitui a
 * lógica antiga de "Pedreiro vinculado a um superior".
 */

/** Verdadeiro se a equipe está ativa. */
function _equipeAtiva(e) {
  return e.ativo === true || e.ativo === "TRUE" || e.ativo === "true";
}

/** Normaliza a equipe para o cliente: membros/obras como arrays. */
function _lerEquipe(e) {
  if (!e) return e;
  return Object.assign({}, e, {
    membros: _parseJsonLista(e.membros),
    obras: _parseJsonLista(e.obras),
  });
}

/** Lista as equipes ativas do usuário (mais recentes primeiro). */
function listarEquipesUsuario(usuarioId) {
  const lista = repoFiltrar(SCHEMA.EQUIPES, function (e) {
    return _equipeAtiva(e) && String(e.usuario_id) === String(usuarioId);
  });
  lista.sort(function (a, b) {
    return String(b.criado_em).localeCompare(String(a.criado_em));
  });
  return lista.map(_lerEquipe);
}

/** Garante que a equipe é do usuário; senão lança. Retorna a linha crua. */
function _equipeDoUsuario(id, usuarioId) {
  const e = repoEncontrar(SCHEMA.EQUIPES, function (x) {
    return String(x.id) === String(id);
  });
  if (!e || String(e.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Equipe não encontrada.");
  }
  return e;
}

/** Valida o líder: contato do usuário com cargo em CARGOS_LIDER. */
function _validarLider(liderId, usuarioId) {
  if (!liderId) lancar(ERRO.VALIDACAO, "Selecione o líder da equipe.");
  const contato = _contatoDoUsuario(liderId, usuarioId);
  if (CARGOS_LIDER.indexOf(String(contato.cargo)) < 0) {
    lancar(ERRO.VALIDACAO, "O líder deve ser Mestre de Obra, Engenheiro ou Gestor.");
  }
  return contato;
}

/** Normaliza uma lista de ids validando posse (contatos/obras do usuário). */
function _idsValidos(lista, tipo, usuarioId) {
  const arr = Array.isArray(lista) ? lista : _parseJsonLista(lista);
  const out = [];
  arr.forEach(function (id) {
    const sid = String(id || "");
    if (!sid) return;
    if (tipo === "contato") _contatoDoUsuario(sid, usuarioId);
    else _obraAcessivel(sid, usuarioId);
    if (out.indexOf(sid) < 0) out.push(sid);
  });
  return out;
}

/** equipes.listar -> { equipes: [...] }. */
function equipesListar(data, sessao) {
  return { equipes: listarEquipesUsuario(sessao.usuario_id) };
}

/** equipes.criar -> { equipe }. */
function equipesCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome da equipe.");
  const liderId = String((data && data.lider_id) || "");
  _validarLider(liderId, sessao.usuario_id);

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const equipe = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      lider_id: liderId,
      membros: JSON.stringify(_idsValidos(data && data.membros, "contato", sessao.usuario_id)),
      obras: JSON.stringify(_idsValidos(data && data.obras, "obra", sessao.usuario_id)),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.EQUIPES, equipe);
    return { equipe: _lerEquipe(equipe) };
  });
}

/** equipes.atualizar -> { equipe }. */
function equipesAtualizar(data, sessao) {
  const id = data && data.id;
  _equipeDoUsuario(id, sessao.usuario_id);

  const patch = { atualizado_em: agoraIso() };
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
    patch.nome = nome;
  }
  if (data.lider_id !== undefined) {
    _validarLider(String(data.lider_id || ""), sessao.usuario_id);
    patch.lider_id = String(data.lider_id);
  }
  if (data.membros !== undefined) {
    patch.membros = JSON.stringify(_idsValidos(data.membros, "contato", sessao.usuario_id));
  }
  if (data.obras !== undefined) {
    patch.obras = JSON.stringify(_idsValidos(data.obras, "obra", sessao.usuario_id));
  }
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const equipe = repoAtualizar(SCHEMA.EQUIPES, "id", id, patch);
    return { equipe: _lerEquipe(equipe) };
  });
}

/** equipes.remover -> { id } (desativa logicamente). */
function equipesRemover(data, sessao) {
  const id = data && data.id;
  _equipeDoUsuario(id, sessao.usuario_id);
  return comLock(function () {
    repoAtualizar(SCHEMA.EQUIPES, "id", id, { ativo: false, atualizado_em: agoraIso() });
    return { id: id };
  });
}
