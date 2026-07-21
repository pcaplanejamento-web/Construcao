/**
 * Grupos.gs — Grupos (pastas) de obras. Um grupo organiza obras do PRÓPRIO
 * usuário (OBRAS.grupo_id) e pode ter UM link público de GRUPO: o visitante abre
 * o link e ESCOLHE qual obra ver todos os dados (publico.grupo → publico.grupoObra,
 * que reusa `_payloadObra` de Obras.gs). Só o dono do grupo gere/compartilha.
 */

/** Garante que o grupo é do usuário; senão lança. */
function _grupoDoUsuario(grupoId, usuarioId) {
  const g = repoEncontrar(SCHEMA.GRUPOS, function (x) {
    return String(x.id) === String(grupoId);
  });
  if (!g || String(g.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Grupo não pode ser alterado.");
  }
  return g;
}

/** Valida um grupo_id p/ atribuir a uma obra (vazio = sem grupo; senão do usuário). */
function _grupoIdValido(grupoId, usuarioId) {
  const gid = String(grupoId || "");
  if (!gid) return "";
  _grupoDoUsuario(gid, usuarioId); // lança se não for do usuário
  return gid;
}

/** Lista os grupos do usuário (ordenados por nome). */
function listarGruposUsuario(usuarioId) {
  const lista = repoFiltrar(SCHEMA.GRUPOS, function (g) {
    return String(g.usuario_id) === String(usuarioId);
  });
  lista.sort(function (a, b) {
    return String(a.nome).localeCompare(String(b.nome));
  });
  return lista;
}

/** Token curto (12 hex) único entre os GRUPOS. */
function _tokenGrupoUnico() {
  for (var i = 0; i < 5; i++) {
    var t = novoId().replace(/-/g, "").substring(0, 12);
    var existe = repoEncontrar(SCHEMA.GRUPOS, function (g) {
      return String(g.link_token) === t;
    });
    if (!existe) return t;
  }
  return novoId().replace(/-/g, "").substring(0, 16);
}

/* ------------------------------- Rotas ------------------------------- */

/** grupos.listar -> { grupos }. */
function gruposListar(data, sessao) {
  return { grupos: listarGruposUsuario(sessao.usuario_id) };
}

/** grupos.criar -> { grupo }. */
function gruposCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome do grupo.");
  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const grupo = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      link_token: "",
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.GRUPOS, grupo);
    return { grupo: grupo };
  });
}

/** grupos.atualizar -> { grupo } (renomear). */
function gruposAtualizar(data, sessao) {
  const id = data && data.id;
  _grupoDoUsuario(id, sessao.usuario_id);
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "O nome não pode ficar vazio.");
  return comLock(function () {
    const grupo = repoAtualizar(SCHEMA.GRUPOS, "id", id, {
      nome: nome,
      atualizado_em: agoraIso(),
      editor_nome: (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "",
    });
    return { grupo: grupo };
  });
}

/** grupos.remover -> { id }. Desvincula as obras (grupo_id="") e apaga o grupo. */
function gruposRemover(data, sessao) {
  const id = data && data.id;
  _grupoDoUsuario(id, sessao.usuario_id);
  return comLock(function () {
    repoFiltrar(SCHEMA.OBRAS, function (o) {
      return String(o.grupo_id) === String(id);
    }).forEach(function (o) {
      repoAtualizar(SCHEMA.OBRAS, "id", o.id, { grupo_id: "" });
    });
    repoRemover(SCHEMA.GRUPOS, "id", id);
    return { id: id };
  });
}

/** grupos.gerarLink -> { link_token }. Gera/renova o token público do grupo. */
function gruposGerarLink(data, sessao) {
  _grupoDoUsuario(data && data.id, sessao.usuario_id);
  return comLock(function () {
    const token = _tokenGrupoUnico();
    repoAtualizar(SCHEMA.GRUPOS, "id", data.id, { link_token: token });
    return { link_token: token };
  });
}

/** grupos.removerLink -> { link_token: "" }. Desativa o link do grupo. */
function gruposRemoverLink(data, sessao) {
  _grupoDoUsuario(data && data.id, sessao.usuario_id);
  return comLock(function () {
    repoAtualizar(SCHEMA.GRUPOS, "id", data.id, { link_token: "" });
    return { link_token: "" };
  });
}

/* --------------------------- Público (grupo) ------------------------- */

/** Acha o grupo pelo token público (ou lança). */
function _grupoPorToken(token) {
  if (!token) lancar(ERRO.VALIDACAO, "Link inválido.");
  const g = repoEncontrar(SCHEMA.GRUPOS, function (x) {
    return x.link_token && String(x.link_token) === String(token);
  });
  if (!g) lancar(ERRO.NAO_ENCONTRADO, "Link inválido ou desativado.");
  return g;
}

/**
 * publico.grupo -> { grupo:{nome}, obras:[{id,nome,endereco,status,orcamento,total_gasto}] }.
 * Lista das obras do grupo p/ o visitante ESCOLHER (sem os dados detalhados).
 */
function publicoGrupo(data) {
  const grupo = _grupoPorToken(data && data.token);
  const obras = repoFiltrar(SCHEMA.OBRAS, function (o) {
    return String(o.grupo_id) === String(grupo.id);
  });
  const idsAcc = {};
  obras.forEach(function (o) { idsAcc[o.id] = true; });
  const totais = {};
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    if (idsAcc[d.obra_id]) totais[d.obra_id] = (totais[d.obra_id] || 0) + (Number(d.valor) || 0);
  });
  obras.sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
  return {
    grupo: { nome: grupo.nome },
    obras: obras.map(function (o) {
      return {
        id: o.id,
        nome: o.nome,
        endereco: o.endereco,
        status: o.status,
        orcamento: Number(o.orcamento) || 0,
        total_gasto: totais[o.id] || 0,
      };
    }),
  };
}

/** publico.grupoObra -> payload COMPLETO de uma obra do grupo (a que o visitante escolheu). */
function publicoGrupoObra(data) {
  const grupo = _grupoPorToken(data && data.token);
  const obraId = String((data && data.obra_id) || "");
  const obra = repoEncontrar(SCHEMA.OBRAS, function (o) {
    return String(o.id) === obraId && String(o.grupo_id) === String(grupo.id);
  });
  if (!obra) lancar(ERRO.NAO_ENCONTRADO, "Obra não encontrada neste grupo.");
  _logAcessoLink(obra.id, data.token);
  return _payloadObra(obra);
}
