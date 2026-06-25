/**
 * estoque.js — Helpers PUROS do estoque (livro-razão de movimentos).
 *
 * Cada movimento: { obra_id, item_id, classificacao, categoria_id, unidade, tipo,
 *   quantidade(>0), despesa_id, obra_origem_id, obra_destino_id, par_id, data, ... }
 *
 * A "lista do estoque" e os "consumidos" são SEMPRE derivados por (obra_id, item_id):
 *   adquirido  = Σ entradas − Σ saida_transferencia
 *   consumido  = Σ consumo  − Σ retorno
 *   em_estoque = adquirido − consumido
 * (sem contador mutável — mesmo princípio do resumo financeiro).
 */

/** Tipos que somam ao adquirido (entradas). */
export const TIPOS_ENTRADA = ["entrada_despesa", "entrada_manual", "entrada_transferencia"];

export function parseMovimentos(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

function _qtd(m) {
  return Number(m && m.quantidade) || 0;
}

/** Aplica um movimento aos acumuladores { adquirido, consumido }. */
function _aplicar(acc, m) {
  const q = _qtd(m);
  const t = String((m && m.tipo) || "");
  if (TIPOS_ENTRADA.indexOf(t) >= 0) acc.adquirido += q;
  else if (t === "saida_transferencia") acc.adquirido -= q;
  else if (t === "consumo") acc.consumido += q;
  else if (t === "retorno") acc.consumido -= q;
}

/**
 * Consolida TODOS os movimentos por (obra_id, item_id). Retorna lista de itens com
 * adquirido/consumido/em_estoque + classificacao/categoria_id/unidade e `unidades`
 * (lista distinta — sinaliza divergência de unidade no mesmo item).
 */
export function consolidar(movimentos) {
  const mapa = {};
  (movimentos || []).forEach((m) => {
    if (!m || !m.item_id) return;
    const chave = String(m.obra_id) + "|" + String(m.item_id);
    let it = mapa[chave];
    if (!it) {
      it = mapa[chave] = {
        obra_id: String(m.obra_id || ""),
        item_id: String(m.item_id || ""),
        classificacao: String(m.classificacao || ""),
        categoria_id: String(m.categoria_id || ""),
        unidade: "",
        unidades: [],
        adquirido: 0,
        consumido: 0,
        em_estoque: 0,
      };
    }
    _aplicar(it, m);
    // Classificação/subclasse: preenche a partir do 1º movimento que as tiver.
    if (!it.classificacao && m.classificacao) it.classificacao = String(m.classificacao);
    if (!it.categoria_id && m.categoria_id) it.categoria_id = String(m.categoria_id);
    const u = String(m.unidade || "").trim();
    if (u && it.unidades.indexOf(u) < 0) it.unidades.push(u);
  });
  return Object.keys(mapa).map((k) => {
    const it = mapa[k];
    it.em_estoque = it.adquirido - it.consumido;
    it.unidade = it.unidades[0] || "";
    return it;
  });
}

/** Consolidado de UMA obra (todos os itens com qualquer movimento nela). */
export function consolidarObra(movimentos, obraId) {
  const id = String(obraId || "");
  return consolidar((movimentos || []).filter((m) => String(m.obra_id) === id));
}

/** Itens com saldo EM ESTOQUE (> 0) de uma obra — a "tabela de estoque". */
export function emEstoqueDaObra(movimentos, obraId) {
  return consolidarObra(movimentos, obraId).filter((it) => it.em_estoque > 0.0000001);
}

/** Itens CONSUMIDOS (consumido > 0) de uma obra — a aba "Consumidos". */
export function consumidosDaObra(movimentos, obraId) {
  return consolidarObra(movimentos, obraId).filter((it) => it.consumido > 0.0000001);
}

/** Saldo consolidado de UM (obra, item). */
export function saldoItem(movimentos, obraId, itemId) {
  const oid = String(obraId || "");
  const iid = String(itemId || "");
  const acc = { adquirido: 0, consumido: 0 };
  (movimentos || []).forEach((m) => {
    if (String(m.obra_id) === oid && String(m.item_id) === iid) _aplicar(acc, m);
  });
  return { adquirido: acc.adquirido, consumido: acc.consumido, em_estoque: acc.adquirido - acc.consumido };
}

/** Quanto dá p/ REDUZIR (consumir) de um item = o que há em estoque. */
export function limiteConsumo(movimentos, obraId, itemId) {
  return Math.max(0, saldoItem(movimentos, obraId, itemId).em_estoque);
}

/** Quanto dá p/ AUMENTAR (devolver do consumido) = o consumido atual. */
export function limiteRetorno(movimentos, obraId, itemId) {
  return Math.max(0, saldoItem(movimentos, obraId, itemId).consumido);
}

/** Unidades distintas registradas p/ um item (sinaliza divergência se > 1). */
export function unidadesDoItem(movimentos, obraId, itemId) {
  const oid = String(obraId || "");
  const iid = String(itemId || "");
  const set = [];
  (movimentos || []).forEach((m) => {
    if (String(m.obra_id) !== oid || String(m.item_id) !== iid) return;
    const u = String(m.unidade || "").trim();
    if (u && set.indexOf(u) < 0) set.push(u);
  });
  return set;
}

/**
 * ORIGENS de um item do estoque (item 17): as ENTRADAS daquele (obra, item), mais
 * recentes primeiro. Cada origem traz o tipo (despesa/manual/transferência) e os
 * vínculos (despesa_id / obra_origem_id) p/ a UI montar o "de onde veio".
 */
export function origensDoItem(movimentos, obraId, itemId) {
  const oid = String(obraId || "");
  const iid = String(itemId || "");
  return (movimentos || [])
    .filter(
      (m) =>
        String(m.obra_id) === oid &&
        String(m.item_id) === iid &&
        TIPOS_ENTRADA.indexOf(String(m.tipo)) >= 0
    )
    .map((m) => ({
      id: String(m.id || ""),
      tipo: String(m.tipo || ""),
      quantidade: _qtd(m),
      unidade: String(m.unidade || ""),
      despesa_id: String(m.despesa_id || ""),
      obra_origem_id: String(m.obra_origem_id || ""),
      data: String(m.data || ""),
      criado_em: String(m.criado_em || ""),
      observacao: String(m.observacao || ""),
    }))
    .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
}
