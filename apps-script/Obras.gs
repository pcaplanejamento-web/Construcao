/**
 * Obras.gs — CRUD de obras + compartilhamento entre usuários.
 *
 * Modelo de acesso:
 *  - DONO (obra.usuario_id): pode tudo, INCLUSIVE EXCLUIR a obra.
 *  - COMPARTILHADO (linha em Compartilhamentos): pode ver, colaborar nas despesas
 *    E editar a obra (nome/orçamento/status/prazo), finalizar/reabrir e gerir o
 *    compartilhamento (convidar/link). SÓ NÃO pode EXCLUIR a obra (dono-só).
 *    A posse (obra.usuario_id) nunca é transferida → o dono continua dono.
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

/**
 * Reúne o conjunto FECHADO (transitivo) de referências das obras ACESSÍVEIS ao
 * usuário (próprias + compartilhadas) — mesma fronteira de privacidade do
 * snapshot. Coleta as sementes diretas (despesas/compras/financeiro/repasses/
 * orçamentos/cotações/participantes) e roda `_fecharRefsCompartilhadas` (contato→
 * empresa/cargo/superior, equipe→membros, empresa/item→categoria). Base dos guards
 * de "incorporar"; assim um membro de equipe referenciado SÓ transitivamente
 * também pode ser incorporado. Roda raro (clique em "Incorporar").
 */
function _refsAcessiveis(usuarioId) {
  const refF = {}, refC = {}, refE = {}, refI = {}, refCat = {}, refCargoNome = {};
  const idsAcc = {};
  obrasListar({}, { usuario_id: usuarioId }).obras.forEach(function (o) { idsAcc[o.id] = true; });
  function _addChaveRef(ch) {
    const s = String(ch || "");
    if (s.indexOf("c:") === 0) refC[s.slice(2)] = true;
    else if (s.indexOf("e:") === 0) refE[s.slice(2)] = true;
  }
  repoListar(SCHEMA.DESPESAS).forEach(function (row) {
    if (!idsAcc[row.obra_id]) return;
    const d = _lerDespesa(row);
    if (d.item_id) refI[String(d.item_id)] = true;
    if (d.fornecedor_id) refF[String(d.fornecedor_id)] = true;
    if (d.ofertante_contato_id) refC[String(d.ofertante_contato_id)] = true;
    if (d.ofertante_equipe_id) refE[String(d.ofertante_equipe_id)] = true;
    if (d.categoria_id) refCat[String(d.categoria_id)] = true;
    (d.responsaveis || []).forEach(function (r) { _addChaveRef(r.chave); });
    (d.pagamentos || []).forEach(function (p) { _addChaveRef(p.chave); });
    (d.pagamentos_realizados || []).forEach(function (lv) {
      if (lv.contato_id) refC[String(lv.contato_id)] = true;
      if (lv.fornecedor_id) refF[String(lv.fornecedor_id)] = true;
      _addChaveRef(lv.pagador);
      (lv.distribuicao || []).forEach(function (x) { _addChaveRef(x.chave); });
    });
  });
  repoListar(SCHEMA.COTACAO_PRECOS).forEach(function (p) {
    if (!idsAcc[p.obra_id]) return;
    if (p.item_id) refI[String(p.item_id)] = true;
    if (p.fornecedor_id) refF[String(p.fornecedor_id)] = true;
    if (p.contato_id) refC[String(p.contato_id)] = true;
    if (p.equipe_id) refE[String(p.equipe_id)] = true;
  });
  repoListar(SCHEMA.TRANSFERENCIAS).forEach(function (t) {
    if (!idsAcc[t.obra_id]) return;
    if (t.fornecedor_id) refF[String(t.fornecedor_id)] = true;
    if (t.recebedor_contato_id) refC[String(t.recebedor_contato_id)] = true;
    if (t.recebedor_equipe_id) refE[String(t.recebedor_equipe_id)] = true;
    _addChaveRef(t.pagador_chave);
  });
  repoListar(SCHEMA.PAGAMENTOS).forEach(function (p) {
    if (!idsAcc[p.obra_id]) return;
    if (p.fornecedor_id) refF[String(p.fornecedor_id)] = true;
    if (p.recebedor_contato_id) refC[String(p.recebedor_contato_id)] = true;
    if (p.recebedor_equipe_id) refE[String(p.recebedor_equipe_id)] = true;
    _addChaveRef(p.pagador_chave);
  });
  repoListar(SCHEMA.REPASSES).forEach(function (row) {
    if (!idsAcc[row.obra_id]) return;
    const r = _lerRepasse(row);
    if (r.recebedor_contato_id) refC[String(r.recebedor_contato_id)] = true;
    (r.contatos_repassados || []).forEach(function (cid) { refC[String(cid)] = true; });
  });
  repoListar(SCHEMA.ORCAMENTOS).forEach(function (o) {
    if (!(o.obra_id && idsAcc[o.obra_id])) return;
    if (o.fornecedor_id) refF[String(o.fornecedor_id)] = true;
    if (o.contato_id) refC[String(o.contato_id)] = true;
    if (o.equipe_id) refE[String(o.equipe_id)] = true;
  });
  repoListar(SCHEMA.COTACOES).forEach(function (c) {
    if (!(c.obra_id && idsAcc[c.obra_id])) return;
    if (c.item_id) refI[String(c.item_id)] = true;
    if (c.categoria_id) refCat[String(c.categoria_id)] = true;
  });
  repoListar(SCHEMA.OBRA_PARTICIPANTES).forEach(function (pt) {
    if (!idsAcc[pt.obra_id]) return;
    if (String(pt.tipo) === "contato") refC[String(pt.ref_id)] = true;
    else if (String(pt.tipo) === "equipe") refE[String(pt.ref_id)] = true;
  });
  // Mapas do catálogo (1 leitura/aba) + equipe por N:N obras → fechamento.
  const mapaC = {}, mapaF = {}, mapaI = {}, mapaE = {};
  repoListar(SCHEMA.CONTATOS).forEach(function (c) { mapaC[String(c.id)] = c; });
  repoListar(SCHEMA.FORNECEDORES).forEach(function (f) { mapaF[String(f.id)] = f; });
  repoListar(SCHEMA.ITENS).forEach(function (i) { mapaI[String(i.id)] = i; });
  repoListar(SCHEMA.EQUIPES).forEach(function (e) {
    mapaE[String(e.id)] = e;
    _parseJsonLista(e.obras).forEach(function (oid) { if (idsAcc[oid]) refE[String(e.id)] = true; });
  });
  _fecharRefsCompartilhadas(
    { refC: refC, refF: refF, refI: refI, refE: refE, refCat: refCat, refCargoNome: refCargoNome },
    { contato: mapaC, fornecedor: mapaF, item: mapaI, equipe: mapaE }
  );
  return { refC: refC, refF: refF, refI: refI, refE: refE, refCat: refCat, refCargoNome: refCargoNome };
}

/**
 * Guard do "incorporar": um id (contato/empresa/item/equipe) só pode ser
 * incorporado se estiver no conjunto FECHADO de referências das obras acessíveis.
 */
function _idReferenciadoEmObraAcessivel(alvoId, usuarioId) {
  const sid = String(alvoId || "");
  if (!sid) return false;
  const refs = _refsAcessiveis(usuarioId);
  return !!(refs.refC[sid] || refs.refF[sid] || refs.refI[sid] || refs.refE[sid]);
}

/** Guard do "incorporar" para CATEGORIAS (id ∈ classificações referenciadas). */
function _categoriaReferenciadaEmObraAcessivel(catId, usuarioId) {
  const sid = String(catId || "");
  if (!sid) return false;
  return !!_refsAcessiveis(usuarioId).refCat[sid];
}

/** Guard do "incorporar" para CARGOS (nome ∈ cargos referenciados por contatos). */
function _cargoNomeReferenciadoEmObraAcessivel(nome, usuarioId) {
  const n = String(nome || "").trim().toLowerCase();
  if (!n) return false;
  return !!_refsAcessiveis(usuarioId).refCargoNome[n];
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
    // Colaborador também gere o compartilhamento → lista para qualquer acessível.
    compartilhamentos: _listarCompartilhamentos(obra.id),
  };
}

/** obras.criar -> { obra }. */
function obrasCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome da obra.");

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const obra = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      endereco: String((data && data.endereco) || ""),
      descricao: String((data && data.descricao) || ""),
      orcamento: Number((data && data.orcamento) || 0) || 0,
      status: _statusValido(data && data.status),
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
      prazo: String((data && data.prazo) || "").slice(0, 10),
      finalizada: (data && data.finalizada) === true,
      finalizada_em: (data && data.finalizada) === true ? agora : "",
      grupo_id: _grupoIdValido(data && data.grupo_id, sessao.usuario_id),
    };
    repoInserir(SCHEMA.OBRAS, obra);
    return { obra: obra };
  });
}

/** obras.atualizar -> { obra } (dono ou compartilhado; posse não muda). */
function obrasAtualizar(data, sessao) {
  const id = data && data.id;
  _obraAcessivel(id, sessao.usuario_id); // colaborador também edita; `usuario_id` nunca entra no patch

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
  if (data.prazo !== undefined) patch.prazo = String(data.prazo || "").slice(0, 10);
  if (data.finalizada !== undefined) {
    patch.finalizada = data.finalizada === true;
    patch.finalizada_em = data.finalizada === true ? agoraIso() : "";
  }
  if (data.grupo_id !== undefined) patch.grupo_id = _grupoIdValido(data.grupo_id, sessao.usuario_id);
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

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

/** obras.compartilhamentos -> { compartilhamentos } (dono ou compartilhado). */
function obrasCompartilhamentos(data, sessao) {
  const obra = _obraAcessivel(data && data.obra_id, sessao.usuario_id);
  return { compartilhamentos: _listarCompartilhamentos(obra.id) };
}

/** obras.compartilhar -> { compartilhamentos } (dono ou compartilhado). */
function obrasCompartilhar(data, sessao) {
  const obra = _obraAcessivel(data && data.obra_id, sessao.usuario_id);
  const alvoId = data && data.usuario_id;
  if (!alvoId) lancar(ERRO.VALIDACAO, "Informe o usuário.");
  if (String(alvoId) === String(obra.usuario_id)) {
    lancar(ERRO.VALIDACAO, "Esse usuário é o dono desta obra.");
  }
  if (String(alvoId) === String(sessao.usuario_id)) {
    lancar(ERRO.VALIDACAO, "Você já tem acesso a esta obra.");
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

/** obras.descompartilhar -> { compartilhamentos } (dono ou compartilhado). */
function obrasDescompartilhar(data, sessao) {
  const obra = _obraAcessivel(data && data.obra_id, sessao.usuario_id);
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

/** obras.gerarLink -> { link_token } (dono ou compartilhado). Gera/renova o token curto. */
function obrasGerarLink(data, sessao) {
  const obra = _obraAcessivel(data && data.obra_id, sessao.usuario_id);
  return comLock(function () {
    const token = _tokenCurtoUnico();
    repoAtualizar(SCHEMA.OBRAS, "id", obra.id, { link_token: token });
    return { link_token: token };
  });
}

/** obras.acessosLink -> { total, acessos:[{acessado_em}] } (dono ou compartilhado). */
function obrasAcessosLink(data, sessao) {
  const obra = _obraAcessivel(data && data.obra_id, sessao.usuario_id);
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

/** obras.removerLink -> { link_token: "" } (dono ou compartilhado). Desativa o link. */
function obrasRemoverLink(data, sessao) {
  const obra = _obraAcessivel(data && data.obra_id, sessao.usuario_id);
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
  _logAcessoLink(obra.id, token);
  return _payloadObra(obra);
}

/** Registra um acesso ao link público (obra ou grupo→obra). */
function _logAcessoLink(obraId, token) {
  comLock(function () {
    repoInserir(SCHEMA.ACESSOS_LINK, {
      id: novoId(),
      obra_id: obraId,
      token: token,
      acessado_em: agoraIso(),
    });
    return true;
  });
}

/**
 * Monta o payload PÚBLICO (somente leitura) de UMA obra. Reusado por publico.obra
 * (link da obra) e publico.grupoObra (link do grupo → obra escolhida pelo visitante).
 *
 * Retorna um SNAPSHOT no MESMO formato do autenticado (via `_montarSnapshot`,
 * Snapshot.gs), porém escopado a ESTA obra + o que a norteia: entidades
 * referenciadas (contatos/empresas/equipes/itens, com fechamento transitivo),
 * categorias, cotações/ofertas dos orçamentos da obra, financeiro e estoque. Assim
 * a <publico-view> hidrata o data-store e monta os MESMOS componentes internos
 * (despesa-table, orçamento, equipe, participantes, estoque, notas…) — sem réplicas.
 * `opcoes.publico` omite dados do dono não essenciais (config/grupos/usuários).
 * `obra`/`resumo` no topo servem o cabeçalho da view e o modo grupo.
 */
function _payloadObra(obra) {
  const dono = buscarUsuarioPorId(obra.usuario_id) || { id: obra.usuario_id, nome: "", email: "" };

  // Enriquece a obra como `obrasListar` (total_gasto/ehDono/dono_*) — é um snapshot
  // de 1 obra, então somamos as despesas dela aqui.
  var totalGasto = 0;
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    if (String(d.obra_id) === String(obra.id)) totalGasto += Number(d.valor) || 0;
  });
  obra.total_gasto = totalGasto;
  obra.ehDono = false; // o visitante público nunca é dono
  obra.dono_nome = dono.nome || "";
  obra.dono_email = dono.email || "";

  const snap = _montarSnapshot(dono, [obra], { publico: true });
  // Conveniência p/ o cabeçalho da <publico-view> e o modo grupo (obra escolhida).
  snap.obra = obra;
  snap.resumo = (snap.resumos || {})[obra.id] || null;
  return snap;
}
