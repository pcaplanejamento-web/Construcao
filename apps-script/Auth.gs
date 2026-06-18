/**
 * Auth.gs — Autenticação, hashing de senha e sessões.
 *
 * Hashing: SHA-256 de (salt + senha), com salt aleatório por usuário.
 * Observação de segurança: SHA-256+salt foi o método pedido. O Apps Script não
 * traz bcrypt/PBKDF2 nativos; o canal é HTTPS. Para produção de alto risco,
 * considerar derivação de chave mais forte. (Ver PRINCIPIOS-DE-EXECUCAO.md.)
 *
 * Sessões: token UUID gravado na aba Sessoes (fonte de verdade) e espelhado no
 * CacheService para validação rápida. Expiração absoluta de SESSAO_HORAS.
 */

/* ----------------------------- Hashing -------------------------------- */

function _bytesParaHex(bytes) {
  return bytes
    .map(function (b) {
      const v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? "0" + v : v;
    })
    .join("");
}

function _gerarSalt() {
  // 16 bytes de aleatoriedade derivados de dois UUIDs.
  const fonte = Utilities.getUuid() + Utilities.getUuid();
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    fonte
  );
  return _bytesParaHex(digest).substring(0, 32);
}

function _hashSenha(senha, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + senha,
    Utilities.Charset.UTF_8
  );
  return _bytesParaHex(digest);
}

/** Cria um par {hash, salt} para uma senha em texto puro. */
function criarHashSenha(senha) {
  const salt = _gerarSalt();
  return { hash: _hashSenha(senha, salt), salt: salt };
}

/** Verifica se a senha confere com o hash/salt armazenados. */
function verificarSenha(senha, hash, salt) {
  return _hashSenha(senha, salt) === hash;
}

/* ----------------------------- Usuários ------------------------------- */

/** Remove campos sensíveis antes de devolver um usuário ao cliente. */
function usuarioPublico(u) {
  return {
    id: u.id,
    email: u.email,
    nome: u.nome,
    role: u.role,
    ativo: u.ativo === true || u.ativo === "TRUE" || u.ativo === "true",
  };
}

/** Busca usuário por e-mail (case-insensitive). */
function buscarUsuarioPorEmail(email) {
  const alvo = String(email || "").trim().toLowerCase();
  return repoEncontrar(SCHEMA.USUARIOS, function (u) {
    return String(u.email).trim().toLowerCase() === alvo;
  });
}

/** Busca usuário por id. */
function buscarUsuarioPorId(id) {
  return repoEncontrar(SCHEMA.USUARIOS, function (u) {
    return String(u.id) === String(id);
  });
}

/** Monta { chave: valor } com as configurações de um usuário. */
function montarConfigUsuario(usuarioId) {
  const linhas = repoFiltrar(SCHEMA.CONFIGURACOES, function (c) {
    return String(c.usuario_id) === String(usuarioId);
  });
  const cfg = {};
  linhas.forEach(function (c) {
    cfg[c.chave] = c.valor;
  });
  return cfg;
}

/* ----------------------------- Sessões -------------------------------- */

function _criarSessao(usuario) {
  const token = novoId();
  const agora = new Date();
  const expira = new Date(agora.getTime() + SESSAO_HORAS * 3600 * 1000);
  const sessao = {
    token: token,
    usuario_id: usuario.id,
    role: usuario.role,
    criado_em: agora.toISOString(),
    expira_em: expira.toISOString(),
    ultimo_acesso: agora.toISOString(),
  };
  repoInserir(SCHEMA.SESSOES, sessao);
  cachePut(chaveSessao(token), {
    usuario_id: sessao.usuario_id,
    role: sessao.role,
    expira_em: sessao.expira_em,
  });
  return sessao;
}

/**
 * Valida um token e retorna { usuario_id, role } ou lança NAO_AUTENTICADO.
 * Tenta o cache primeiro; recai para a aba Sessoes.
 */
function validarToken(token) {
  if (!token) lancar(ERRO.NAO_AUTENTICADO, "Sessão ausente.");

  let dados = cacheGet(chaveSessao(token));
  if (!dados) {
    const sessao = repoEncontrar(SCHEMA.SESSOES, function (s) {
      return String(s.token) === String(token);
    });
    if (!sessao) lancar(ERRO.NAO_AUTENTICADO, "Sessão inválida.");
    dados = {
      usuario_id: sessao.usuario_id,
      role: sessao.role,
      expira_em: sessao.expira_em,
    };
    cachePut(chaveSessao(token), dados);
  }

  if (new Date(dados.expira_em).getTime() < Date.now()) {
    cacheRemove(chaveSessao(token));
    lancar(ERRO.NAO_AUTENTICADO, "Sessão expirada.");
  }
  return dados;
}

/** Garante que a sessão é de um admin. */
function exigirAdmin(sessao) {
  if (sessao.role !== ROLES.ADMIN) {
    lancar(ERRO.NAO_AUTORIZADO, "Ação restrita a administradores.");
  }
}

/* ------------------------------ Actions ------------------------------- */

/** auth.login — { email, senha } -> { token, usuario, config }. */
function authLogin(data) {
  const email = data && data.email;
  const senha = data && data.senha;
  if (!email || !senha) {
    lancar(ERRO.VALIDACAO, "Informe e-mail e senha.");
  }
  const u = buscarUsuarioPorEmail(email);
  if (!u || !verificarSenha(senha, u.senha_hash, u.salt)) {
    lancar(ERRO.CREDENCIAIS_INVALIDAS, "E-mail ou senha incorretos.");
  }
  const ativo = u.ativo === true || u.ativo === "TRUE" || u.ativo === "true";
  if (!ativo) {
    lancar(ERRO.NAO_AUTORIZADO, "Usuário desativado. Contate o administrador.");
  }

  return comLock(function () {
    const sessao = _criarSessao(u);
    return {
      token: sessao.token,
      usuario: usuarioPublico(u),
      config: montarConfigUsuario(u.id),
    };
  });
}

/** auth.logout — encerra a sessão atual. */
function authLogout(data, sessao, token) {
  cacheRemove(chaveSessao(token));
  return comLock(function () {
    repoRemover(SCHEMA.SESSOES, "token", token);
    return { encerrada: true };
  });
}

/** auth.me — revalida o token e devolve usuário + config (boot do SPA). */
function authMe(data, sessao) {
  const u = buscarUsuarioPorId(sessao.usuario_id);
  if (!u) lancar(ERRO.NAO_AUTENTICADO, "Usuário não encontrado.");
  return {
    usuario: usuarioPublico(u),
    config: montarConfigUsuario(u.id),
  };
}

/** auth.alterarSenha — o próprio usuário troca a senha. */
function authAlterarSenha(data, sessao) {
  const senhaAtual = data && data.senhaAtual;
  const novaSenha = String((data && data.novaSenha) || "");
  const u = buscarUsuarioPorId(sessao.usuario_id);
  if (!u) lancar(ERRO.NAO_AUTENTICADO, "Usuário não encontrado.");
  if (!verificarSenha(senhaAtual, u.senha_hash, u.salt)) {
    lancar(ERRO.CREDENCIAIS_INVALIDAS, "Senha atual incorreta.");
  }
  if (novaSenha.length < 6) {
    lancar(ERRO.VALIDACAO, "A nova senha deve ter ao menos 6 caracteres.");
  }
  return comLock(function () {
    const par = criarHashSenha(novaSenha);
    repoAtualizar(SCHEMA.USUARIOS, "id", u.id, {
      senha_hash: par.hash,
      salt: par.salt,
    });
    return { alterada: true };
  });
}
