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

/**
 * Valida os vínculos do contato conforme o cargo (lança se inválido):
 *  - Vendedor exige fornecedor_id (de um fornecedor do usuário);
 *  - Pedreiro exige superior_id de um contato Mestre de Obra/Engenheiro do usuário.
 */
function _validarVinculosContato(cargo, fornecedorId, superiorId, usuarioId) {
  if (cargo === "Vendedor") {
    if (!fornecedorId) lancar(ERRO.VALIDACAO, "Vendedor deve ser vinculado a um fornecedor.");
    _fornecedorDoUsuario(fornecedorId, usuarioId);
  } else if (fornecedorId) {
    _fornecedorDoUsuario(fornecedorId, usuarioId); // permitido, mas valida posse
  }
  if (cargo === "Pedreiro") {
    if (!superiorId) lancar(ERRO.VALIDACAO, "Pedreiro deve ser vinculado a um Mestre de Obra ou Engenheiro.");
    const sup = _contatoDoUsuario(superiorId, usuarioId);
    if (sup.cargo !== "Mestre de Obra" && sup.cargo !== "Engenheiro") {
      lancar(ERRO.VALIDACAO, "O vínculo do Pedreiro deve ser um Mestre de Obra ou Engenheiro.");
    }
  }
}

/** contatos.criar -> { contato }. */
function contatosCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome do contato.");

  const cargo = String((data && data.cargo) || "").trim();
  const fornecedorId = String((data && data.fornecedor_id) || "");
  const superiorId = String((data && data.superior_id) || "");
  _validarVinculosContato(cargo, fornecedorId, superiorId, sessao.usuario_id);

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const contato = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      telefone: String((data && data.telefone) || ""),
      email: String((data && data.email) || ""),
      cargo: cargo,
      fornecedor_id: fornecedorId,
      observacao: String((data && data.observacao) || ""),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
      superior_id: superiorId,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.CONTATOS, contato);
    return { contato: contato };
  });
}

/** contatos.atualizar -> { contato }. */
function contatosAtualizar(data, sessao) {
  const id = data && data.id;
  const atual = _contatoDoUsuario(id, sessao.usuario_id);
  const patch = { atualizado_em: agoraIso() };
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
    patch.nome = nome;
  }
  if (data.telefone !== undefined) patch.telefone = String(data.telefone);
  if (data.email !== undefined) patch.email = String(data.email);
  if (data.cargo !== undefined) patch.cargo = String(data.cargo);
  if (data.fornecedor_id !== undefined) patch.fornecedor_id = String(data.fornecedor_id || "");
  if (data.superior_id !== undefined) patch.superior_id = String(data.superior_id || "");
  if (data.observacao !== undefined) patch.observacao = String(data.observacao);
  if (data.ativo !== undefined) patch.ativo = data.ativo === true;

  // Valida os vínculos com os valores EFETIVOS (novos ou atuais).
  const cargoEf = patch.cargo !== undefined ? patch.cargo : atual.cargo;
  const fornEf = patch.fornecedor_id !== undefined ? patch.fornecedor_id : atual.fornecedor_id;
  const supEf = patch.superior_id !== undefined ? patch.superior_id : atual.superior_id;
  _validarVinculosContato(cargoEf, String(fornEf || ""), String(supEf || ""), sessao.usuario_id);
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const contato = repoAtualizar(SCHEMA.CONTATOS, "id", id, patch);
    return { contato: contato };
  });
}

/** Verdadeiro se o contato está vinculado (oferta, participação ou como superior). */
function _contatoEmUso(contatoId) {
  const ehBool = function (v) {
    return v === true || v === "TRUE" || v === "true";
  };
  const naOferta = repoEncontrar(SCHEMA.COTACAO_PRECOS, function (p) {
    return String(p.contato_id) === String(contatoId);
  });
  if (naOferta) return true;
  const naObra = repoEncontrar(SCHEMA.OBRA_PARTICIPANTES, function (p) {
    return p.tipo === "contato" && String(p.ref_id) === String(contatoId);
  });
  if (naObra) return true;
  return !!repoEncontrar(SCHEMA.CONTATOS, function (c) {
    return String(c.superior_id) === String(contatoId) && ehBool(c.ativo);
  });
}

/** contatos.remover -> { id } (desativa logicamente). Bloqueia se vinculado. */
function contatosRemover(data, sessao) {
  const id = data && data.id;
  _contatoDoUsuario(id, sessao.usuario_id);
  if (_contatoEmUso(id)) {
    lancar(ERRO.VALIDACAO, "Contato vinculado (ofertas/obras/equipe); remova os vínculos primeiro.");
  }

  return comLock(function () {
    repoAtualizar(SCHEMA.CONTATOS, "id", id, {
      ativo: false,
      atualizado_em: agoraIso(),
    });
    return { id: id };
  });
}
