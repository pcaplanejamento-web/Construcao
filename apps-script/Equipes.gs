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

/**
 * Find-or-create de uma cópia PESSOAL de um contato (usado na incorporação de
 * equipe): se já for do usuário, devolve o próprio id; se já houver uma cópia
 * pessoal ATIVA com mesmo nome+telefone, reusa (dedupe); senão cria uma nova (FKs
 * do dono limpas). SEM lock próprio — roda dentro do comLock de equipesIncorporar.
 * Empilha as linhas NOVAS em `criadosOut` (para o front mesclar nos contatos).
 */
function _copiaPessoalContato(origemId, usuarioId, nomeUsuario, agora, criadosOut) {
  const origem = repoEncontrar(SCHEMA.CONTATOS, function (x) { return String(x.id) === String(origemId); });
  if (!origem) return "";
  if (String(origem.usuario_id) === String(usuarioId)) return String(origem.id);
  const nomeKey = String(origem.nome || "").trim().toLowerCase();
  const telKey = String(origem.telefone || "").trim();
  const existente = repoEncontrar(SCHEMA.CONTATOS, function (c) {
    return (
      String(c.usuario_id) === String(usuarioId) &&
      String(c.nome || "").trim().toLowerCase() === nomeKey &&
      String(c.telefone || "").trim() === telKey &&
      (c.ativo === true || c.ativo === "TRUE" || c.ativo === "true")
    );
  });
  if (existente) return String(existente.id);
  const novo = {
    id: novoId(),
    usuario_id: usuarioId,
    nome: origem.nome,
    telefone: origem.telefone || "",
    email: origem.email || "",
    cargo: origem.cargo || "",
    fornecedor_id: "", // vínculo do dono não vale p/ mim
    observacao: origem.observacao || "",
    ativo: true,
    criado_em: agora,
    atualizado_em: agora,
    superior_id: "",
    autor_nome: nomeUsuario,
    editor_nome: nomeUsuario,
  };
  repoInserir(SCHEMA.CONTATOS, novo);
  if (criadosOut) criadosOut.push(novo);
  return String(novo.id);
}

/**
 * equipes.incorporar -> { equipe, contatos } — COPIA PROFUNDA de uma equipe de
 * obra compartilhada para o acervo PESSOAL: cria/reusa cópias pessoais do líder e
 * dos membros (dedupe nome+telefone) e remapeia; a equipe nova é do usuário e não
 * pertence a nenhuma obra (obras:"[]"). Devolve também os contatos novos para o
 * front mesclar (senão os nomes de líder/membros ficariam "—" até recarregar).
 */
function equipesIncorporar(data, sessao) {
  const id = String((data && data.id) || "");
  const origem = repoEncontrar(SCHEMA.EQUIPES, function (x) { return String(x.id) === id; });
  if (!origem) lancar(ERRO.NAO_ENCONTRADO, "Equipe não encontrada.");
  if (String(origem.usuario_id) === String(sessao.usuario_id)) lancar(ERRO.VALIDACAO, "Esta equipe já é sua.");
  if (!_idReferenciadoEmObraAcessivel(id, sessao.usuario_id)) lancar(ERRO.NAO_AUTORIZADO, "Equipe não disponível para incorporar.");
  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const criados = [];
    const liderNovo = _copiaPessoalContato(origem.lider_id, sessao.usuario_id, nomeUsuario, agora, criados);
    const membrosNovos = [];
    _parseJsonLista(origem.membros).forEach(function (m) {
      const nid = _copiaPessoalContato(m, sessao.usuario_id, nomeUsuario, agora, criados);
      if (nid && membrosNovos.indexOf(nid) < 0) membrosNovos.push(nid);
    });
    const equipe = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: origem.nome,
      lider_id: liderNovo,
      membros: JSON.stringify(membrosNovos),
      obras: "[]",
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.EQUIPES, equipe);
    return { equipe: _lerEquipe(equipe), contatos: criados };
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
