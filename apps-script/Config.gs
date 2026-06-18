/**
 * Config.gs — Configurações por usuário (modelo chave-valor), geridas pelo ADMIN.
 *
 * Valores compostos são armazenados como string JSON. Ex.: chave
 * "categorias_padrao" guarda um array JSON; "moeda" guarda "BRL"; "tema" guarda
 * "claro"/"escuro". O front interpreta cada chave conforme necessário.
 */

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
  // Valor pode ser objeto/array -> serializa em JSON; senão grava como string.
  let valor = data.valor;
  if (valor !== null && typeof valor === "object") {
    valor = JSON.stringify(valor);
  } else {
    valor = String(valor === undefined || valor === null ? "" : valor);
  }

  return comLock(function () {
    const existente = repoEncontrar(SCHEMA.CONFIGURACOES, function (c) {
      return (
        String(c.usuario_id) === String(usuarioId) && c.chave === chave
      );
    });
    if (existente) {
      repoAtualizar(SCHEMA.CONFIGURACOES, "id", existente.id, {
        valor: valor,
        atualizado_em: agoraIso(),
      });
    } else {
      repoInserir(SCHEMA.CONFIGURACOES, {
        id: novoId(),
        usuario_id: usuarioId,
        chave: chave,
        valor: valor,
        atualizado_em: agoraIso(),
      });
    }
    return { config: montarConfigUsuario(usuarioId) };
  });
}
