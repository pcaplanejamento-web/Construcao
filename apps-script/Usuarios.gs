/**
 * Usuarios.gs — Gestão de usuários pelo ADMIN.
 *
 * Todas as actions aqui exigem sessão com role admin (verificado no dispatcher
 * via exigirAdmin). Hashes/salts nunca são devolvidos ao cliente.
 */

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
  const senha = String((data && data.senha) || "");
  const role = data && data.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USUARIO;

  if (!email || !nome || !senha) {
    lancar(ERRO.VALIDACAO, "Informe nome, e-mail e senha.");
  }
  if (senha.length < 6) {
    lancar(ERRO.VALIDACAO, "A senha deve ter ao menos 6 caracteres.");
  }
  if (buscarUsuarioPorEmail(email)) {
    lancar(ERRO.CONFLITO, "Já existe um usuário com esse e-mail.");
  }

  return comLock(function () {
    const par = criarHashSenha(senha);
    const usuario = {
      id: novoId(),
      email: email,
      nome: nome,
      senha_hash: par.hash,
      salt: par.salt,
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
  if (data.novaSenha) {
    if (String(data.novaSenha).length < 6) {
      lancar(ERRO.VALIDACAO, "A nova senha deve ter ao menos 6 caracteres.");
    }
    const par = criarHashSenha(String(data.novaSenha));
    patch.senha_hash = par.hash;
    patch.salt = par.salt;
  }

  return comLock(function () {
    const usuario = repoAtualizar(SCHEMA.USUARIOS, "id", id, patch);
    return { usuario: usuarioPublico(usuario) };
  });
}
