/**
 * AuthSenha.gs — Fluxo de PIN por e-mail para PRIMEIRO ACESSO e REDEFINIÇÃO de
 * senha (login e perfil usam o mesmo caminho). Rotas PÚBLICAS (o usuário está
 * deslogado): por isso há rate-limit, validade curta e limite de tentativas.
 *
 * Passos:
 *   1) auth.solicitarPin { email }              → envia um PIN de 6 caracteres.
 *   2) auth.confirmarPin { email, pin }         → devolve um resetToken (uso único).
 *   3) auth.definirSenha { resetToken, novaSenha } → grava a senha e faz LOGIN.
 *
 * Armazenamento (CacheService, via Cache.gs):
 *   pin:<email>        = { pin, tentativas }   (10 min)
 *   pin_wait:<email>   = 1                      (60 s — cooldown de reenvio)
 *   reset:<resetToken> = <email>               (10 min — pós-confirmação)
 */

const _PIN_TTL = 600;        // 10 min de validade do código
const _PIN_COOLDOWN = 60;    // 60 s entre pedidos de código
const _PIN_MAX_TENTATIVAS = 5;
// Charset sem caracteres ambíguos (sem O/0, I/1, L) → fácil de ler/digitar.
const _PIN_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Gera um PIN aleatório de 6 caracteres alfanuméricos (charset sem ambíguos). */
function _gerarPin() {
  var s = "";
  for (var i = 0; i < 6; i++) {
    s += _PIN_ALFABETO.charAt(Math.floor(Math.random() * _PIN_ALFABETO.length));
  }
  return s;
}

function _pinChave(email) { return "pin:" + email; }
function _pinEsperaChave(email) { return "pin_wait:" + email; }
function _resetChave(token) { return "reset:" + token; }

/**
 * auth.solicitarPin — { email } -> { enviado: true }.
 * PÚBLICA. Envia o PIN por e-mail (Resend). Nunca devolve o PIN ao cliente.
 */
function authSolicitarPin(data) {
  const email = String((data && data.email) || "").trim().toLowerCase();
  if (!email) lancar(ERRO.VALIDACAO, "Informe o e-mail.");
  const u = buscarUsuarioPorEmail(email);
  if (!u) lancar(ERRO.NAO_ENCONTRADO, "E-mail não cadastrado. Peça ao administrador para criar seu acesso.");

  // Cooldown: evita reenvios em rajada.
  if (cacheGet(_pinEsperaChave(email))) {
    lancar(ERRO.CONFLITO, "Já enviamos um código. Aguarde alguns segundos antes de pedir outro.");
  }

  const pin = _gerarPin();
  cachePut(_pinChave(email), { pin: pin, tentativas: 0 }, _PIN_TTL);
  cachePut(_pinEsperaChave(email), 1, _PIN_COOLDOWN);

  enviarEmailResend(email, "Seu código de acesso — Dattaobra", _emailPinHtml(pin, u.nome));
  return { enviado: true };
}

/**
 * auth.confirmarPin — { email, pin } -> { resetToken }.
 * PÚBLICA. Valida o PIN e troca por um resetToken de uso único.
 */
function authConfirmarPin(data) {
  const email = String((data && data.email) || "").trim().toLowerCase();
  const pin = String((data && data.pin) || "").trim().toUpperCase();
  if (!email || !pin) lancar(ERRO.VALIDACAO, "Informe o e-mail e o código.");

  const reg = cacheGet(_pinChave(email));
  if (!reg || !reg.pin) lancar(ERRO.VALIDACAO, "Código expirado. Peça um novo.");
  if ((reg.tentativas || 0) >= _PIN_MAX_TENTATIVAS) {
    cacheRemove(_pinChave(email));
    lancar(ERRO.VALIDACAO, "Muitas tentativas. Peça um novo código.");
  }
  if (String(reg.pin).toUpperCase() !== pin) {
    cachePut(_pinChave(email), { pin: reg.pin, tentativas: (reg.tentativas || 0) + 1 }, _PIN_TTL);
    lancar(ERRO.CREDENCIAIS_INVALIDAS, "Código inválido.");
  }

  cacheRemove(_pinChave(email));
  const resetToken = novoId();
  cachePut(_resetChave(resetToken), email, _PIN_TTL);
  return { resetToken: resetToken };
}

/**
 * auth.definirSenha — { resetToken, novaSenha } -> { token, usuario, config }.
 * PÚBLICA. Grava a nova senha e já cria a sessão (LOGIN AUTOMÁTICO).
 */
function authDefinirSenha(data) {
  const resetToken = String((data && data.resetToken) || "").trim();
  const novaSenha = String((data && data.novaSenha) || "");
  if (!resetToken) lancar(ERRO.VALIDACAO, "Sessão inválida. Refaça o processo.");
  const email = cacheGet(_resetChave(resetToken));
  if (!email) lancar(ERRO.VALIDACAO, "Sessão expirada. Refaça o processo.");
  if (novaSenha.length < 6) lancar(ERRO.VALIDACAO, "A nova senha deve ter ao menos 6 caracteres.");

  const u = buscarUsuarioPorEmail(email);
  if (!u) lancar(ERRO.NAO_ENCONTRADO, "Usuário não encontrado.");

  return comLock(function () {
    const par = criarHashSenha(novaSenha);
    repoAtualizar(SCHEMA.USUARIOS, "id", u.id, {
      senha_hash: par.hash,
      salt: par.salt,
      ativo: true,
    });
    cacheRemove(_resetChave(resetToken));
    const atualizado = buscarUsuarioPorId(u.id) || u;
    const sessao = _criarSessao(atualizado);
    return {
      token: sessao.token,
      usuario: usuarioPublico(atualizado),
      config: montarConfigUsuario(atualizado.id),
    };
  });
}

/** HTML do e-mail com o PIN (marca Dattaobra; sem imagem externa p/ não ser bloqueada). */
function _emailPinHtml(pin, nome) {
  const ola = nome ? "Olá, " + _escaparHtml(String(nome).split(" ")[0]) + "!" : "Olá!";
  return "" +
    "<div style=\"font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f1f5f9;padding:24px\">" +
    "<div style=\"max-width:460px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0\">" +
    "<div style=\"background:#0e9c92;padding:18px 24px;color:#fff;font-size:18px;font-weight:700\">Dattaobra</div>" +
    "<div style=\"padding:28px 24px;color:#0f172a\">" +
    "<p style=\"margin:0 0 6px;font-size:15px\">" + ola + "</p>" +
    "<p style=\"margin:0 0 18px;font-size:14px;color:#475569\">Use o código abaixo para definir sua senha de acesso:</p>" +
    "<div style=\"background:#f0fdfa;border:1px dashed #0e9c92;border-radius:10px;padding:16px;text-align:center;" +
    "font-size:30px;font-weight:800;letter-spacing:8px;color:#0b8f86\">" + _escaparHtml(pin) + "</div>" +
    "<p style=\"margin:18px 0 0;font-size:12px;color:#64748b\">O código expira em 10 minutos. Se você não pediu isto, ignore este e-mail.</p>" +
    "</div></div>" +
    "<p style=\"text-align:center;color:#94a3b8;font-size:11px;margin:14px 0 0\">Dattaobra · Gestão de Obras</p>" +
    "</div>";
}
