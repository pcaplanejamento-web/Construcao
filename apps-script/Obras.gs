/**
 * Obras.gs — CRUD de obras + compartilhamento entre usuários.
 *
 * Modelo de acesso:
 *  - DONO (obra.usuario_id): pode tudo (editar, excluir, compartilhar).
 *  - COMPARTILHADO (linha em Compartilhamentos): pode ver a obra e colaborar
 *    nas despesas, mas NÃO pode editar/excluir a obra nem gerir compartilhamento.
 *
 * Princípio nº 7: o acesso é sempre verificado no servidor a partir da sessão.
 */

/* ----------------------- Helpers de acesso ---------------------------- */

/** Verdadeiro se a obra está compartilhada com o usuário. */
function _temCompartilhamento(obraId, usuarioId) {
  return !!repoEncontrar(SCHEMA.COMPARTILHAMENTOS, function (s) {
    return (
      String(s.obra_id) === String(obraId) &&
      String(s.usuario_id) === String(usuarioId)
    );
  });
}

/** Retorna a obra se o usuário é dono OU tem compartilhamento; senão lança. */
function _obraAcessivel(obraId, usuarioId) {
  const obra = repoEncontrar(SCHEMA.OBRAS, function (o) {
    return String(o.id) === String(obraId);
  });
  if (
    obra &&
    (String(obra.usuario_id) === String(usuarioId) ||
      _temCompartilhamento(obraId, usuarioId))
  ) {
    return obra;
  }
  lancar(ERRO.NAO_ENCONTRADO, "Obra não encontrada.");
}

/** Retorna a obra apenas se o usuário for o DONO; senão lança. */
function _obraDono(obraId, usuarioId) {
  const obra = repoEncontrar(SCHEMA.OBRAS, function (o) {
    return String(o.id) === String(obraId);
  });
  if (!obra || String(obra.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Apenas o dono da obra pode fazer isso.");
  }
  return obra;
}

/** Lista os compartilhamentos de uma obra com nome/e-mail de cada usuário. */
function _listarCompartilhamentos(obraId) {
  const shares = repoFiltrar(SCHEMA.COMPARTILHAMENTOS, function (s) {
    return String(s.obra_id) === String(obraId);
  });
  const usuarios = _mapaUsuarios();
  return shares.map(function (s) {
    const u = usuarios[s.usuario_id] || {};
    return { usuario_id: s.usuario_id, nome: u.nome || "", email: u.email || "" };
  });
}

/** Mapa id -> { nome, email } de todos os usuários (uso interno). */
function _mapaUsuarios() {
  const mapa = {};
  repoListar(SCHEMA.USUARIOS).forEach(function (u) {
    mapa[u.id] = { nome: u.nome, email: u.email };
  });
  return mapa;
}

function _statusValido(status) {
  return STATUS_OBRA.indexOf(status) >= 0 ? status : "ativa";
}

/* ------------------------------ CRUD ---------------------------------- */

/** obras.listar -> { obras: [...] } (próprias + compartilhadas comigo). */
function obrasListar(data, sessao) {
  const uid = sessao.usuario_id;

  const compartilhadasComigo = {};
  repoFiltrar(SCHEMA.COMPARTILHAMENTOS, function (s) {
    return String(s.usuario_id) === String(uid);
  }).forEach(function (s) {
    compartilhadasComigo[s.obra_id] = true;
  });

  const acessiveis = repoFiltrar(SCHEMA.OBRAS, function (o) {
    return String(o.usuario_id) === String(uid) || compartilhadasComigo[o.id];
  });

  // Soma TODAS as despesas de cada obra acessível (independe de quem lançou).
  const idsAcc = {};
  acessiveis.forEach(function (o) {
    idsAcc[o.id] = true;
  });
  const totais = {};
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    if (idsAcc[d.obra_id]) {
      totais[d.obra_id] = (totais[d.obra_id] || 0) + (Number(d.valor) || 0);
    }
  });

  const usuarios = _mapaUsuarios();
  acessiveis.forEach(function (o) {
    o.total_gasto = totais[o.id] || 0;
    o.ehDono = String(o.usuario_id) === String(uid);
    const dono = usuarios[o.usuario_id] || {};
    o.dono_nome = dono.nome || "";
    o.dono_email = dono.email || "";
  });
  return { obras: acessiveis };
}

/** obras.obter -> { obra, categorias, compartilhamentos }. */
function obrasObter(data, sessao) {
  const obra = _obraAcessivel(data && data.id, sessao.usuario_id);
  obra.ehDono = String(obra.usuario_id) === String(sessao.usuario_id);
  const dono = _mapaUsuarios()[obra.usuario_id] || {};
  obra.dono_nome = dono.nome || "";
  obra.dono_email = dono.email || "";
  return {
    obra: obra,
    // Categorias da obra = as do DONO (global + próprias), para que todos os
    // colaboradores vejam/usem o mesmo conjunto de classificações.
    categorias: listarCategoriasUsuario(obra.usuario_id),
    compartilhamentos: obra.ehDono ? _listarCompartilhamentos(obra.id) : [],
  };
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

/** obras.atualizar -> { obra } (apenas o dono). */
function obrasAtualizar(data, sessao) {
  const id = data && data.id;
  _obraDono(id, sessao.usuario_id);

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

/** obras.remover -> { id } (apenas o dono; remove despesas e compartilhamentos). */
function obrasRemover(data, sessao) {
  const id = data && data.id;
  _obraDono(id, sessao.usuario_id);

  return comLock(function () {
    repoFiltrar(SCHEMA.DESPESAS, function (d) {
      return String(d.obra_id) === String(id);
    }).forEach(function (d) {
      repoRemover(SCHEMA.DESPESAS, "id", d.id);
    });
    repoFiltrar(SCHEMA.COMPARTILHAMENTOS, function (s) {
      return String(s.obra_id) === String(id);
    }).forEach(function (s) {
      repoRemover(SCHEMA.COMPARTILHAMENTOS, "id", s.id);
    });
    repoRemover(SCHEMA.OBRAS, "id", id);
    return { id: id };
  });
}

/* ------------------------ Compartilhamento ---------------------------- */

/** obras.compartilhamentos -> { compartilhamentos } (apenas o dono). */
function obrasCompartilhamentos(data, sessao) {
  const obra = _obraDono(data && data.obra_id, sessao.usuario_id);
  return { compartilhamentos: _listarCompartilhamentos(obra.id) };
}

/** obras.compartilhar -> { compartilhamentos } (apenas o dono). */
function obrasCompartilhar(data, sessao) {
  const obra = _obraDono(data && data.obra_id, sessao.usuario_id);
  const alvoId = data && data.usuario_id;
  if (!alvoId) lancar(ERRO.VALIDACAO, "Informe o usuário.");
  if (String(alvoId) === String(sessao.usuario_id)) {
    lancar(ERRO.VALIDACAO, "Você já é o dono desta obra.");
  }
  if (!buscarUsuarioPorId(alvoId)) {
    lancar(ERRO.NAO_ENCONTRADO, "Usuário não encontrado.");
  }

  return comLock(function () {
    if (!_temCompartilhamento(obra.id, alvoId)) {
      repoInserir(SCHEMA.COMPARTILHAMENTOS, {
        id: novoId(),
        obra_id: obra.id,
        usuario_id: alvoId,
        criado_em: agoraIso(),
      });
    }
    return { compartilhamentos: _listarCompartilhamentos(obra.id) };
  });
}

/** obras.descompartilhar -> { compartilhamentos } (apenas o dono). */
function obrasDescompartilhar(data, sessao) {
  const obra = _obraDono(data && data.obra_id, sessao.usuario_id);
  const alvoId = data && data.usuario_id;

  return comLock(function () {
    repoFiltrar(SCHEMA.COMPARTILHAMENTOS, function (s) {
      return (
        String(s.obra_id) === String(obra.id) &&
        String(s.usuario_id) === String(alvoId)
      );
    }).forEach(function (s) {
      repoRemover(SCHEMA.COMPARTILHAMENTOS, "id", s.id);
    });
    return { compartilhamentos: _listarCompartilhamentos(obra.id) };
  });
}

/* --------------------- Link público (somente leitura) ----------------- */

/** Gera um token curto (12 hex) e único entre as obras. */
function _tokenCurtoUnico() {
  for (var i = 0; i < 5; i++) {
    var t = novoId().replace(/-/g, "").substring(0, 12);
    var existe = repoEncontrar(SCHEMA.OBRAS, function (o) {
      return String(o.link_token) === t;
    });
    if (!existe) return t;
  }
  return novoId().replace(/-/g, "").substring(0, 16);
}

/** obras.gerarLink -> { link_token } (apenas o dono). Gera/renova o token curto. */
function obrasGerarLink(data, sessao) {
  const obra = _obraDono(data && data.obra_id, sessao.usuario_id);
  return comLock(function () {
    const token = _tokenCurtoUnico();
    repoAtualizar(SCHEMA.OBRAS, "id", obra.id, { link_token: token });
    return { link_token: token };
  });
}

/** obras.acessosLink -> { total, acessos:[{acessado_em}] } (apenas o dono). */
function obrasAcessosLink(data, sessao) {
  const obra = _obraDono(data && data.obra_id, sessao.usuario_id);
  const acessos = repoFiltrar(SCHEMA.ACESSOS_LINK, function (a) {
    return String(a.obra_id) === String(obra.id);
  });
  acessos.sort(function (a, b) {
    return String(b.acessado_em).localeCompare(String(a.acessado_em));
  });
  return {
    total: acessos.length,
    acessos: acessos.slice(0, 50).map(function (a) {
      return { acessado_em: a.acessado_em };
    }),
  };
}

/** obras.removerLink -> { link_token: "" } (apenas o dono). Desativa o link. */
function obrasRemoverLink(data, sessao) {
  const obra = _obraDono(data && data.obra_id, sessao.usuario_id);
  return comLock(function () {
    repoAtualizar(SCHEMA.OBRAS, "id", obra.id, { link_token: "" });
    return { link_token: "" };
  });
}

/**
 * publico.obra -> visão SOMENTE LEITURA via link público (sem login).
 * data: { token }. Não expõe usuários/observações — só itens e gastos.
 */
function publicoObra(data) {
  const token = data && data.token;
  if (!token) lancar(ERRO.VALIDACAO, "Link inválido.");
  const obra = repoEncontrar(SCHEMA.OBRAS, function (o) {
    return o.link_token && String(o.link_token) === String(token);
  });
  if (!obra) lancar(ERRO.NAO_ENCONTRADO, "Link inválido ou desativado.");

  // Registra o acesso (log do link).
  comLock(function () {
    repoInserir(SCHEMA.ACESSOS_LINK, {
      id: novoId(),
      obra_id: obra.id,
      token: token,
      acessado_em: agoraIso(),
    });
    return true;
  });

  const despesas = repoFiltrar(SCHEMA.DESPESAS, function (d) {
    return String(d.obra_id) === String(obra.id);
  });
  const catMap = mapaCategorias(obra.usuario_id);
  const resumo = _resumoEmMemoria(obra, despesas, catMap); // reusa Snapshot.gs

  const lista = despesas
    .map(function (d) {
      const c = catMap[d.categoria_id] || { nome: "Sem categoria", cor: "#94a3b8" };
      return {
        item: d.item,
        valor: Number(d.valor) || 0,
        data: d.data,
        categoria_nome: c.nome,
        categoria_cor: c.cor,
      };
    })
    .sort(function (a, b) {
      return String(b.data).localeCompare(String(a.data));
    });

  return {
    obra: {
      nome: obra.nome,
      endereco: obra.endereco,
      descricao: obra.descricao,
      orcamento: Number(obra.orcamento) || 0,
      status: obra.status,
    },
    resumo: resumo,
    despesas: lista,
    servidor_em: agoraIso(),
  };
}
