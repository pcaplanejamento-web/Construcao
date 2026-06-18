/**
 * Code.gs — Ponto de entrada do Web App (doGet/doPost).
 *
 * Princípio nº 2 (CORS): o cliente envia "simple requests" (POST com corpo
 * JSON, SEM header Content-Type custom). O Web App responde 302 -> echo, e a
 * resposta final é ContentService JSON com CORS liberado. Por isso NÃO há
 * doOptions, NÃO usamos headers customizados e a resposta é sempre JSON.
 *
 * Princípio nº 9: um único doPost faz o dispatch por `action`. Sempre HTTP 200;
 * o sucesso/erro é semântico no corpo.
 */

/** doGet — health-check (útil para validar o deploy abrindo a URL no browser). */
function doGet(e) {
  return ok({
    service: "gestao-obras",
    status: "online",
    versao: 1,
    horario: agoraIso(),
  });
}

/** doPost — recebe { action, token, data } e despacha. */
function doPost(e) {
  // Parse defensivo do corpo.
  let corpo;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return erro(ERRO.REQUISICAO_INVALIDA, "Corpo da requisição ausente.");
    }
    corpo = JSON.parse(e.postData.contents);
  } catch (parseErr) {
    return erro(ERRO.REQUISICAO_INVALIDA, "JSON inválido.");
  }

  const action = corpo && corpo.action;
  if (!action) {
    return erro(ERRO.REQUISICAO_INVALIDA, "Campo 'action' obrigatório.");
  }

  // Executa o handler, convertendo erros em resposta padronizada.
  try {
    const resultado = despacharAcao(action, corpo.token, corpo.data);
    return ok(resultado);
  } catch (ex) {
    if (ex && ex.ehErroApp) {
      return erro(ex.code, ex.message);
    }
    // Erro inesperado: loga e devolve genérico (não vaza stack ao cliente).
    console.error("Erro em " + action + ": " + (ex && ex.stack ? ex.stack : ex));
    return erro(ERRO.INTERNO, "Erro interno ao processar a requisição.");
  }
}
