/**
 * Itens.gs — Catálogo de itens do usuário. Cada item é classificado como
 * Material ou Serviço (CLASSIFICACOES_ITEM). Despesas e cotações referenciam um
 * item (Fase 2). Mesmo padrão de Fornecedores.gs: validação + comLock + remoção
 * lógica (ativo = false) para preservar histórico.
 */

/** Verdadeiro se o item está ativo (aceita boolean ou texto). */
function _itemAtivo(i) {
  return i.ativo === true || i.ativo === "TRUE" || i.ativo === "true";
}

/** Normaliza a classificação para um valor válido (Material|Serviço). */
function _classificacaoValida(v) {
  return CLASSIFICACOES_ITEM.indexOf(v) >= 0 ? v : CLASSIFICACOES_ITEM[0];
}

/** Lista os itens ativos do usuário (ordenados por nome). */
function listarItensUsuario(usuarioId) {
  const lista = repoFiltrar(SCHEMA.ITENS, function (i) {
    return _itemAtivo(i) && String(i.usuario_id) === String(usuarioId);
  });
  lista.sort(function (a, b) {
    return String(a.nome).localeCompare(String(b.nome));
  });
  return lista;
}

/** Garante que o item é do usuário; senão lança. */
function _itemDoUsuario(itemId, usuarioId) {
  const i = repoEncontrar(SCHEMA.ITENS, function (x) {
    return String(x.id) === String(itemId);
  });
  if (!i || String(i.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Item não pode ser alterado.");
  }
  return i;
}

/** Item ATIVO do usuário por id (ou lança). Usado por despesas/cotações. */
function _itemPorId(itemId, usuarioId) {
  const i = _itemDoUsuario(itemId, usuarioId);
  if (!_itemAtivo(i)) lancar(ERRO.VALIDACAO, "Item inválido.");
  return i;
}

/** itens.listar -> { itens: [...] }. */
function itensListar(data, sessao) {
  return { itens: listarItensUsuario(sessao.usuario_id) };
}

/** itens.criar -> { item }. */
function itensCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome do item.");

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const item = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      classificacao: _classificacaoValida(data && data.classificacao),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.ITENS, item);
    return { item: item };
  });
}

/** itens.atualizar -> { item }. */
function itensAtualizar(data, sessao) {
  const id = data && data.id;
  _itemDoUsuario(id, sessao.usuario_id);

  const patch = { atualizado_em: agoraIso() };
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
    patch.nome = nome;
  }
  if (data.classificacao !== undefined) patch.classificacao = _classificacaoValida(data.classificacao);
  if (data.ativo !== undefined) patch.ativo = data.ativo === true;
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const item = repoAtualizar(SCHEMA.ITENS, "id", id, patch);
    return { item: item };
  });
}

/** Verdadeiro se o item está vinculado a alguma despesa ou cotação. */
function _itemEmUso(itemId) {
  const naDespesa = repoEncontrar(SCHEMA.DESPESAS, function (d) {
    return String(d.item_id) === String(itemId);
  });
  if (naDespesa) return true;
  return !!repoEncontrar(SCHEMA.COTACOES, function (c) {
    return String(c.item_id) === String(itemId);
  });
}

/** itens.remover -> { id } (desativa logicamente). Bloqueia se vinculado. */
function itensRemover(data, sessao) {
  const id = data && data.id;
  _itemDoUsuario(id, sessao.usuario_id);
  if (_itemEmUso(id)) {
    lancar(ERRO.VALIDACAO, "Item vinculado a despesas/cotações; remova os vínculos primeiro.");
  }

  return comLock(function () {
    repoAtualizar(SCHEMA.ITENS, "id", id, { ativo: false, atualizado_em: agoraIso() });
    return { id: id };
  });
}
