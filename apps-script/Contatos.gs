/**
 * Contatos.gs — CRUD de contatos (pessoas) do próprio usuário.
 *
 * Um contato pode (opcionalmente) pertencer a um fornecedor (empresa) via
 * fornecedor_id. As ofertas de uma cotação são feitas por contatos. Mesmo
 * padrão de Fornecedores.gs: validação + comLock + remoção lógica.
 */

/** Verdadeiro se o contato está ativo (aceita boolean ou texto). */
function _contatoAtivo(c) {
  return c.ativo === true || c.ativo === "TRUE" || c.ativo === "true";
}

/** Lista os contatos ativos do usuário. */
function listarContatosUsuario(usuarioId) {
  const lista = repoFiltrar(SCHEMA.CONTATOS, function (c) {
    return _contatoAtivo(c) && String(c.usuario_id) === String(usuarioId);
  });
  lista.sort(function (a, b) {
    return String(a.nome).localeCompare(String(b.nome));
  });
  return lista;
}

/** Garante que o contato é do usuário; senão lança. */
function _contatoDoUsuario(contatoId, usuarioId) {
  const c = repoEncontrar(SCHEMA.CONTATOS, function (x) {
    return String(x.id) === String(contatoId);
  });
  if (!c || String(c.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Contato não pode ser alterado.");
  }
  return c;
}

/** contatos.listar -> { contatos: [...] }. */
function contatosListar(data, sessao) {
  return { contatos: listarContatosUsuario(sessao.usuario_id) };
}

/** contatos.criar -> { contato }. */
function contatosCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome do contato.");

  const fornecedorId = String((data && data.fornecedor_id) || "");
  if (fornecedorId) _fornecedorDoUsuario(fornecedorId, sessao.usuario_id);

  return comLock(function () {
    const agora = agoraIso();
    const contato = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      telefone: String((data && data.telefone) || ""),
      email: String((data && data.email) || ""),
      cargo: String((data && data.cargo) || ""),
      fornecedor_id: fornecedorId,
      observacao: String((data && data.observacao) || ""),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
    };
    repoInserir(SCHEMA.CONTATOS, contato);
    return { contato: contato };
  });
}

/** contatos.atualizar -> { contato }. */
function contatosAtualizar(data, sessao) {
  const id = data && data.id;
  _contatoDoUsuario(id, sessao.usuario_id);

  const patch = { atualizado_em: agoraIso() };
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
    patch.nome = nome;
  }
  if (data.telefone !== undefined) patch.telefone = String(data.telefone);
  if (data.email !== undefined) patch.email = String(data.email);
  if (data.cargo !== undefined) patch.cargo = String(data.cargo);
  if (data.fornecedor_id !== undefined) {
    const fornecedorId = String(data.fornecedor_id || "");
    if (fornecedorId) _fornecedorDoUsuario(fornecedorId, sessao.usuario_id);
    patch.fornecedor_id = fornecedorId;
  }
  if (data.observacao !== undefined) patch.observacao = String(data.observacao);
  if (data.ativo !== undefined) patch.ativo = data.ativo === true;

  return comLock(function () {
    const contato = repoAtualizar(SCHEMA.CONTATOS, "id", id, patch);
    return { contato: contato };
  });
}

/** contatos.remover -> { id } (desativa logicamente). */
function contatosRemover(data, sessao) {
  const id = data && data.id;
  _contatoDoUsuario(id, sessao.usuario_id);

  return comLock(function () {
    repoAtualizar(SCHEMA.CONTATOS, "id", id, {
      ativo: false,
      atualizado_em: agoraIso(),
    });
    return { id: id };
  });
}
