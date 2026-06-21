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
    const item = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      classificacao: _classificacaoValida(data && data.classificacao),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
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

  return comLock(function () {
    const item = repoAtualizar(SCHEMA.ITENS, "id", id, patch);
    return { item: item };
  });
}

/** itens.remover -> { id } (desativa logicamente). */
function itensRemover(data, sessao) {
  const id = data && data.id;
  _itemDoUsuario(id, sessao.usuario_id);

  return comLock(function () {
    repoAtualizar(SCHEMA.ITENS, "id", id, { ativo: false, atualizado_em: agoraIso() });
    return { id: id };
  });
}
