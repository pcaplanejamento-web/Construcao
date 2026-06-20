/**
 * Fornecedores.gs — CRUD de fornecedores (empresas/lojas) do próprio usuário.
 *
 * Cada fornecedor pertence ao usuário que o cadastrou (usuario_id). Espelha o
 * padrão de Categorias.gs: validação antes do lock; mutações sob comLock();
 * remoção lógica (ativo = false) para preservar histórico de cotações.
 */

/** Verdadeiro se o fornecedor está ativo (aceita boolean ou texto). */
function _fornecedorAtivo(f) {
  return f.ativo === true || f.ativo === "TRUE" || f.ativo === "true";
}

/** Lista os fornecedores ativos do usuário. */
function listarFornecedoresUsuario(usuarioId) {
  const lista = repoFiltrar(SCHEMA.FORNECEDORES, function (f) {
    return _fornecedorAtivo(f) && String(f.usuario_id) === String(usuarioId);
  });
  lista.sort(function (a, b) {
    return String(a.nome).localeCompare(String(b.nome));
  });
  return lista;
}

/** Garante que o fornecedor é do usuário; senão lança. */
function _fornecedorDoUsuario(fornecedorId, usuarioId) {
  const f = repoEncontrar(SCHEMA.FORNECEDORES, function (x) {
    return String(x.id) === String(fornecedorId);
  });
  if (!f || String(f.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Fornecedor não pode ser alterado.");
  }
  return f;
}

/** fornecedores.listar -> { fornecedores: [...] }. */
function fornecedoresListar(data, sessao) {
  return { fornecedores: listarFornecedoresUsuario(sessao.usuario_id) };
}

/** fornecedores.criar -> { fornecedor }. */
function fornecedoresCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome do fornecedor.");

  return comLock(function () {
    const agora = agoraIso();
    const fornecedor = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      telefone: String((data && data.telefone) || ""),
      email: String((data && data.email) || ""),
      cnpj: String((data && data.cnpj) || ""),
      categoria_id: String((data && data.categoria_id) || ""),
      observacao: String((data && data.observacao) || ""),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
    };
    repoInserir(SCHEMA.FORNECEDORES, fornecedor);
    return { fornecedor: fornecedor };
  });
}

/** fornecedores.atualizar -> { fornecedor }. */
function fornecedoresAtualizar(data, sessao) {
  const id = data && data.id;
  _fornecedorDoUsuario(id, sessao.usuario_id);

  const patch = { atualizado_em: agoraIso() };
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
    patch.nome = nome;
  }
  if (data.telefone !== undefined) patch.telefone = String(data.telefone);
  if (data.email !== undefined) patch.email = String(data.email);
  if (data.cnpj !== undefined) patch.cnpj = String(data.cnpj);
  if (data.categoria_id !== undefined)
    patch.categoria_id = String(data.categoria_id);
  if (data.observacao !== undefined) patch.observacao = String(data.observacao);
  if (data.ativo !== undefined) patch.ativo = data.ativo === true;

  return comLock(function () {
    const fornecedor = repoAtualizar(SCHEMA.FORNECEDORES, "id", id, patch);
    return { fornecedor: fornecedor };
  });
}

/** fornecedores.remover -> { id } (desativa logicamente). */
function fornecedoresRemover(data, sessao) {
  const id = data && data.id;
  _fornecedorDoUsuario(id, sessao.usuario_id);

  return comLock(function () {
    repoAtualizar(SCHEMA.FORNECEDORES, "id", id, {
      ativo: false,
      atualizado_em: agoraIso(),
    });
    return { id: id };
  });
}
