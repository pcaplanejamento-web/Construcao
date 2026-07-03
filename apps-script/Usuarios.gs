/**
 * Usuarios.gs — Gestão de usuários pelo ADMIN.
 *
 * Todas as actions aqui exigem sessão com role admin (verificado no dispatcher
 * via exigirAdmin). Hashes/salts nunca são devolvidos ao cliente.
 */

/**
 * usuarios.listar -> { usuarios: [{id,nome,email}] }.
 * Disponível a qualquer usuário autenticado (usado no seletor de
 * compartilhamento). Retorna só ativos, exceto o próprio usuário, e nunca
 * expõe hash/salt.
 */
function usuariosListar(data, sessao) {
  const usuarios = repoFiltrar(SCHEMA.USUARIOS, function (u) {
    const ativo = u.ativo === true || u.ativo === "TRUE" || u.ativo === "true";
    return ativo && String(u.id) !== String(sessao.usuario_id);
  }).map(function (u) {
    return { id: u.id, nome: u.nome, email: u.email };
  });
  return { usuarios: usuarios };
}

/** admin.usuarios.listar -> { usuarios: [...] }. */
function adminUsuariosListar(data, sessao) {
  exigirAdmin(sessao);
  const usuarios = repoListar(SCHEMA.USUARIOS).map(usuarioPublico);
  return { usuarios: usuarios };
}

/** admin.usuarios.criar -> { usuario }. */
function adminUsuariosCriar(data, sessao) {
  exigirAdmin(sessao);
  const email = String((data && data.email) || "").trim().toLowerCase();
  const nome = String((data && data.nome) || "").trim();
  const role = data && data.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USUARIO;

  if (!email || !nome) {
    lancar(ERRO.VALIDACAO, "Informe nome e e-mail.");
  }
  if (buscarUsuarioPorEmail(email)) {
    lancar(ERRO.CONFLITO, "Já existe um usuário com esse e-mail.");
  }

  // SEM senha: o próprio usuário a define no PRIMEIRO ACESSO (AuthSenha.gs).
  // senha_hash vazio = "ainda não definiu" (authLogin bloqueia com SENHA_NAO_DEFINIDA).
  return comLock(function () {
    const usuario = {
      id: novoId(),
      email: email,
      nome: nome,
      senha_hash: "",
      salt: "",
      role: role,
      ativo: true,
      criado_em: agoraIso(),
      criado_por: sessao.usuario_id,
    };
    repoInserir(SCHEMA.USUARIOS, usuario);
    return { usuario: usuarioPublico(usuario) };
  });
}

/** admin.usuarios.atualizar -> { usuario }. (nome, role, ativo, novaSenha) */
function adminUsuariosAtualizar(data, sessao) {
  exigirAdmin(sessao);
  const id = data && data.id;
  const alvo = buscarUsuarioPorId(id);
  if (!alvo) lancar(ERRO.NAO_ENCONTRADO, "Usuário não encontrado.");

  const patch = {};
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
    patch.nome = nome;
  }
  if (data.role !== undefined) {
    patch.role = data.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USUARIO;
  }
  if (data.ativo !== undefined) patch.ativo = data.ativo === true;
  // Senha NÃO é definida pelo admin: só o próprio usuário, via PIN (AuthSenha.gs).

  return comLock(function () {
    const usuario = repoAtualizar(SCHEMA.USUARIOS, "id", id, patch);
    return { usuario: usuarioPublico(usuario) };
  });
}
