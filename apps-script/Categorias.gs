/**
 * Categorias.gs — Categorias globais (GLOBAL) + categorias do próprio usuário.
 *
 * A listagem para um usuário = categorias GLOBAL + as criadas por ele.
 * Usa cache (invalidado em cada mutação).
 */

/** Verdadeiro se a categoria está ativa (aceita boolean ou texto). */
function _categoriaAtiva(c) {
  return c.ativo === true || c.ativo === "TRUE" || c.ativo === "true";
}

/** Lista (objetos) de categorias acessíveis ao usuário: GLOBAL + próprias. */
function listarCategoriasUsuario(usuarioId) {
  const emCache = cacheGet(chaveCategorias(usuarioId));
  if (emCache) return emCache;

  const todas = repoFiltrar(SCHEMA.CATEGORIAS, function (c) {
    return (
      _categoriaAtiva(c) &&
      (String(c.usuario_id) === CATEGORIA_GLOBAL ||
        String(c.usuario_id) === String(usuarioId))
    );
  });
  cachePut(chaveCategorias(usuarioId), todas, 3600);
  return todas;
}

/** Mapa categoria_id -> { nome, cor } para o usuário (usado no resumo). */
function mapaCategorias(usuarioId) {
  const mapa = {};
  listarCategoriasUsuario(usuarioId).forEach(function (c) {
    mapa[c.id] = { nome: c.nome, cor: c.cor };
  });
  return mapa;
}

/** categorias.listar -> { categorias: [...] }. */
function categoriasListar(data, sessao) {
  return { categorias: listarCategoriasUsuario(sessao.usuario_id) };
}

/** categorias.criar -> { categoria }. */
function categoriasCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome da categoria.");

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const categoria = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      cor: String((data && data.cor) || "#64748b"),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
      // Pool: "fornecedor" (classificação de fornecedor) ou "item" (subclassificação).
      tipo: String((data && data.tipo) || "") === "fornecedor" ? "fornecedor" : "item",
    };
    repoInserir(SCHEMA.CATEGORIAS, categoria);
    cacheRemove(chaveCategorias(sessao.usuario_id));
    return { categoria: categoria };
  });
}

/**
 * Garante que a subclassificação é editável pelo usuário: ou é dele, ou é uma
 * padrão GLOBAL (compartilhada e editável por qualquer usuário). Retorna a linha.
 */
function _categoriaEditavel(catId, usuarioId) {
  const c = repoEncontrar(SCHEMA.CATEGORIAS, function (x) {
    return String(x.id) === String(catId);
  });
  const dono = c && String(c.usuario_id);
  if (!c || (dono !== String(usuarioId) && dono !== CATEGORIA_GLOBAL)) {
    lancar(ERRO.NAO_AUTORIZADO, "Subclassificação não pode ser alterada.");
  }
  return c;
}

/** Invalida o cache após mudança: GLOBAL afeta todos; própria só o usuário. */
function _invalidarCacheCategoria(ehGlobal, usuarioId) {
  if (ehGlobal) bumpVersaoCategorias();
  else cacheRemove(chaveCategorias(usuarioId));
}

/** categorias.atualizar -> { categoria }. */
function categoriasAtualizar(data, sessao) {
  const id = data && data.id;
  const atual = _categoriaEditavel(id, sessao.usuario_id);
  const ehGlobal = String(atual.usuario_id) === CATEGORIA_GLOBAL;

  const patch = {};
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
    patch.nome = nome;
  }
  if (data.cor !== undefined) patch.cor = String(data.cor);
  if (data.ativo !== undefined) patch.ativo = data.ativo === true;
  patch.atualizado_em = agoraIso();
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const categoria = repoAtualizar(SCHEMA.CATEGORIAS, "id", id, patch);
    _invalidarCacheCategoria(ehGlobal, sessao.usuario_id);
    return { categoria: categoria };
  });
}

/** Verdadeiro se a subclassificação está vinculada a despesa/cotação/fornecedor. */
function _categoriaEmUso(catId) {
  const naDespesa = repoEncontrar(SCHEMA.DESPESAS, function (d) {
    return String(d.categoria_id) === String(catId);
  });
  if (naDespesa) return true;
  const naCotacao = repoEncontrar(SCHEMA.COTACOES, function (c) {
    return String(c.categoria_id) === String(catId);
  });
  if (naCotacao) return true;
  return !!repoEncontrar(SCHEMA.FORNECEDORES, function (f) {
    return (
      String(f.categoria_id) === String(catId) &&
      (f.ativo === true || f.ativo === "TRUE" || f.ativo === "true")
    );
  });
}

/** categorias.remover -> { id } (desativa logicamente). Bloqueia se vinculada. */
function categoriasRemover(data, sessao) {
  const id = data && data.id;
  const atual = _categoriaEditavel(id, sessao.usuario_id);
  const ehGlobal = String(atual.usuario_id) === CATEGORIA_GLOBAL;
  if (_categoriaEmUso(id)) {
    lancar(ERRO.VALIDACAO, "Subclassificação vinculada a despesas/cotações/empresas; remova os vínculos primeiro.");
  }

  return comLock(function () {
    repoAtualizar(SCHEMA.CATEGORIAS, "id", id, { ativo: false });
    _invalidarCacheCategoria(ehGlobal, sessao.usuario_id);
    return { id: id };
  });
}
