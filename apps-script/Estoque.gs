/**
 * Estoque.gs — Controle de estoque por obra, como LIVRO-RAZÃO de movimentos
 * (tabela SCHEMA.ESTOQUE, append-only). A "lista do estoque" e os "consumidos" são
 * sempre DERIVADOS por (obra_id, item_id) — nunca um contador mutável (mesmo
 * princípio do resumo financeiro), o que evita divergência.
 *
 * tipo do movimento:
 *  - entrada_despesa        (+ adquirido) — automático ao QUITAR despesa Material
 *  - entrada_manual         (+ adquirido) — item 15
 *  - entrada_transferencia  (+ adquirido) — chega de outra obra (obra_origem_id)
 *  - saida_transferencia    (− adquirido) — sai p/ outra obra (obra_destino_id)
 *  - consumo                (+ consumido) — reduzir o estoque (item 5/6)
 *  - retorno                (− consumido) — aumentar de volta (item 7)
 *
 * em_estoque = adquirido − consumido. (Fase 1: leitura + gatilho automático;
 * as rotas de operação/transferência entram nas fases seguintes.)
 */

/** Normaliza um movimento (quantidade numérica). */
function _lerMovimento(m) {
  if (!m) return m;
  return Object.assign({}, m, { quantidade: Number(m.quantidade) || 0 });
}

/** Movimentos das obras acessíveis (mapa { obraId: true }) — usado no snapshot. */
function listarMovimentosDeObras(idsObra) {
  return repoFiltrar(SCHEMA.ESTOQUE, function (m) {
    return idsObra && idsObra[String(m.obra_id)];
  }).map(_lerMovimento);
}

/** Movimentos cujo usuario_id = dono (fallback simples). */
function listarEstoqueUsuario(usuarioId) {
  return repoFiltrar(SCHEMA.ESTOQUE, function (m) {
    return String(m.usuario_id) === String(usuarioId);
  }).map(_lerMovimento);
}

/** Saldo consolidado (adquirido/consumido/em_estoque) de UM (obra, item). */
function _saldoEstoque(obraId, itemId) {
  let adquirido = 0;
  let consumido = 0;
  repoListar(SCHEMA.ESTOQUE).forEach(function (m) {
    if (String(m.obra_id) !== String(obraId) || String(m.item_id) !== String(itemId)) return;
    const q = Number(m.quantidade) || 0;
    const t = String(m.tipo || "");
    if (t === "entrada_despesa" || t === "entrada_manual" || t === "entrada_transferencia") adquirido += q;
    else if (t === "saida_transferencia") adquirido -= q;
    else if (t === "consumo") consumido += q;
    else if (t === "retorno") consumido -= q;
  });
  return { adquirido: adquirido, consumido: consumido, em_estoque: adquirido - consumido };
}

/** Entrada de estoque (entrada_despesa) de uma despesa Material já quitada. */
function _entradaDespesaExistente(despesaId) {
  const did = String(despesaId || "");
  if (!did) return null;
  return repoEncontrar(SCHEMA.ESTOQUE, function (m) {
    return String(m.tipo) === "entrada_despesa" && String(m.despesa_id) === did;
  });
}

/**
 * Gatilho automático (itens 2/11): ao QUITAR (pago=true) uma despesa Material com
 * quantidade > 0, cria a entrada_despesa (idempotente — 1 por despesa_id). Ao
 * DESPAGAR (pago=false), remove a entrada SÓ se ainda couber no estoque (em_estoque
 * ≥ quantidade); senão mantém (a remoção segura ocorre ao devolver o consumido, ou
 * é bloqueada na exclusão da despesa — Fase 5). NUNCA lança (roda no fluxo de
 * pagamento, sob o comLock do chamador).
 */
function _sincronizarEstoqueDaDespesa(desp, pago) {
  if (!desp) return;
  if (String(desp.classificacao || "") !== "Material") return;
  const despesaId = String(desp.id || "");
  const existente = _entradaDespesaExistente(despesaId);
  if (pago) {
    const qtd = Number(desp.quantidade) || 0;
    if (qtd <= 0 || existente) return; // sem quantitativo ou já criada
    const agora = agoraIso();
    repoInserir(SCHEMA.ESTOQUE, {
      id: novoId(),
      usuario_id: desp.usuario_id,
      obra_id: desp.obra_id,
      item_id: desp.item_id,
      classificacao: desp.classificacao,
      categoria_id: desp.categoria_id || "",
      unidade: desp.unidade || "",
      tipo: "entrada_despesa",
      quantidade: qtd,
      despesa_id: despesaId,
      obra_origem_id: "",
      obra_destino_id: "",
      par_id: "",
      data: String(desp.data || agora.substring(0, 10)),
      observacao: "",
      criado_em: agora,
      autor_nome: desp.autor_nome || "",
      atualizado_em: agora,
      editor_nome: "",
    });
  } else if (existente) {
    const saldo = _saldoEstoque(desp.obra_id, desp.item_id);
    if (saldo.em_estoque >= (Number(existente.quantidade) || 0)) {
      repoRemover(SCHEMA.ESTOQUE, "id", existente.id);
    }
  }
}
