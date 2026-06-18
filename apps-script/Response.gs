/**
 * Response.gs — Helpers para padronizar a saída JSON.
 *
 * Princípio nº 9: a resposta é SEMPRE HTTP 200 com ContentService JSON.
 * O sucesso/erro é semântico no corpo ({ ok: true|false }). Isso evita que
 * páginas de erro HTML do Google quebrem o parse no cliente e mantém o
 * comportamento de CORS previsível (simple request + redirect 302).
 */

/** Códigos de erro padronizados, reutilizados por todos os handlers. */
const ERRO = {
  REQUISICAO_INVALIDA: "REQUISICAO_INVALIDA",
  ACAO_DESCONHECIDA: "ACAO_DESCONHECIDA",
  NAO_AUTENTICADO: "NAO_AUTENTICADO",
  NAO_AUTORIZADO: "NAO_AUTORIZADO",
  CREDENCIAIS_INVALIDAS: "CREDENCIAIS_INVALIDAS",
  NAO_ENCONTRADO: "NAO_ENCONTRADO",
  VALIDACAO: "VALIDACAO",
  CONFLITO: "CONFLITO",
  INTERNO: "INTERNO",
};

/** Monta a saída ContentService a partir de um objeto. */
function _saidaJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/** Resposta de sucesso: { ok: true, data }. */
function ok(data) {
  return _saidaJson({ ok: true, data: data === undefined ? {} : data });
}

/** Resposta de erro: { ok: false, error: { code, message } }. */
function erro(code, message) {
  return _saidaJson({
    ok: false,
    error: { code: code, message: message || code },
  });
}

/**
 * Erro de negócio "lançável": permite que handlers usem throw e o dispatcher
 * converta para a resposta padronizada (ver Code.gs).
 */
function ErroApp(code, message) {
  this.code = code;
  this.message = message || code;
  this.ehErroApp = true;
}

/** Atalho para lançar um ErroApp. */
function lancar(code, message) {
  throw new ErroApp(code, message);
}
