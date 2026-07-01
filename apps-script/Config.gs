/**
 * Config.gs — Configurações por usuário (modelo chave-valor), geridas pelo ADMIN.
 *
 * Valores compostos são armazenados como string JSON. Ex.: chave
 * "categorias_padrao" guarda um array JSON; "moeda" guarda "BRL"; "tema" guarda
 * "claro"/"escuro". O front interpreta cada chave conforme necessário.
 */

/**
 * config.publico -> { googleClientId }. Pública (sem token): o botão "Entrar com
 * Google" no login precisa do Client ID (que é público) ANTES de autenticar. Lê
 * das Script Properties, então o dono configura em UM lugar só (nada no front).
 */
function configPublico(data) {
  return {
    googleClientId:
      PropertiesService.getScriptProperties().getProperty("GOOGLE_CLIENT_ID") || "",
  };
}

/** admin.config.obter -> { config: { chave: valor } }. */
function adminConfigObter(data, sessao) {
  exigirAdmin(sessao);
  const usuarioId = data && data.usuario_id;
  if (!usuarioId) lancar(ERRO.VALIDACAO, "Informe o usuário.");
  if (!buscarUsuarioPorId(usuarioId)) {
    lancar(ERRO.NAO_ENCONTRADO, "Usuário não encontrado.");
  }
  return { config: montarConfigUsuario(usuarioId) };
}

/** admin.config.definir -> { config } (upsert de uma chave). */
function adminConfigDefinir(data, sessao) {
  exigirAdmin(sessao);
  const usuarioId = data && data.usuario_id;
  const chave = String((data && data.chave) || "").trim();
  if (!usuarioId || !chave) {
    lancar(ERRO.VALIDACAO, "Informe usuário e chave.");
  }
  if (!buscarUsuarioPorId(usuarioId)) {
    lancar(ERRO.NAO_ENCONTRADO, "Usuário não encontrado.");
  }
  return comLock(function () {
    _definirConfig(usuarioId, chave, data.valor);
    return { config: montarConfigUsuario(usuarioId) };
  });
}

/** Chaves que o PRÓPRIO usuário pode gravar via config.definir (allowlist). */
const CONFIG_CHAVES_USUARIO = { sync_agenda: true, sync_notas: true };

/**
 * config.definir -> { config }. O próprio usuário grava UMA das suas chaves
 * permitidas (allowlist — nunca chaves sensíveis/de terceiros).
 */
function configDefinir(data, sessao) {
  const chave = String((data && data.chave) || "").trim();
  if (!CONFIG_CHAVES_USUARIO[chave]) {
    lancar(ERRO.NAO_AUTORIZADO, "Configuração não permitida.");
  }
  return comLock(function () {
    _definirConfig(sessao.usuario_id, chave, (data && data.valor) === true);
    return { config: montarConfigUsuario(sessao.usuario_id) };
  });
}

/**
 * Upsert interno de UMA configuração (usuario_id + chave). SEM verificação de
 * admin e SEM lock próprio — o chamador DEVE estar dentro de comLock(). Reusado
 * por adminConfigDefinir (após exigirAdmin) e pelos fluxos Google (Auth/Google).
 * Valor objeto/array vira string JSON; demais viram string.
 */
function _definirConfig(usuarioId, chave, valor) {
  const ch = String(chave || "").trim();
  if (!usuarioId || !ch) lancar(ERRO.VALIDACAO, "Informe usuário e chave.");
  let v = valor;
  if (v !== null && typeof v === "object") {
    v = JSON.stringify(v);
  } else {
    v = String(v === undefined || v === null ? "" : v);
  }
  const existente = repoEncontrar(SCHEMA.CONFIGURACOES, function (c) {
    return String(c.usuario_id) === String(usuarioId) && c.chave === ch;
  });
  if (existente) {
    repoAtualizar(SCHEMA.CONFIGURACOES, "id", existente.id, {
      valor: v,
      atualizado_em: agoraIso(),
    });
  } else {
    repoInserir(SCHEMA.CONFIGURACOES, {
      id: novoId(),
      usuario_id: usuarioId,
      chave: ch,
      valor: v,
      atualizado_em: agoraIso(),
    });
  }
}

/**
 * Lê UMA configuração (usuario_id + chave) direto do repo, INCLUSIVE segredos
 * (ex.: google_refresh_token) que montarConfigUsuario omite do cliente. Uso
 * apenas server-side. Retorna a string armazenada ou null se ausente.
 */
function _lerConfig(usuarioId, chave) {
  const ch = String(chave || "").trim();
  const linha = repoEncontrar(SCHEMA.CONFIGURACOES, function (c) {
    return String(c.usuario_id) === String(usuarioId) && c.chave === ch;
  });
  return linha ? linha.valor : null;
}
