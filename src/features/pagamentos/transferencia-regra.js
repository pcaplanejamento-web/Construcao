/**
 * transferencia-regra.js — Regras PURAS da transferência (testáveis sem DOM).
 *
 * Espelham a derivação `_recebedorDaDespesa` do backend (Transferencias.gs): uma
 * transferência só agrupa despesas com o MESMO recebedor + empresa.
 */

/** Chave canônica de recebedor+empresa de uma despesa (equipe → "e:<id>"; senão "c:<contato>|f:<forn>"). */
export function chaveRecebedor(despesa) {
  const d = despesa || {};
  const eq = String(d.ofertante_equipe_id || "");
  if (eq) return "e:" + eq; // equipe recebe via líder; empresa vazia
  return "c:" + String(d.ofertante_contato_id || "") + "|f:" + String(d.fornecedor_id || "");
}

/** Todas as despesas têm o MESMO recebedor + empresa (regra de ouro da transferência)? */
export function recebedorUniforme(despesas) {
  const chaves = (despesas || []).map(chaveRecebedor);
  return chaves.length <= 1 || chaves.every((k) => k === chaves[0]);
}

/** Soma das alocações [{despesa_id, valor}]. */
export function totalAlocacoes(alocacoes) {
  return (alocacoes || []).reduce((s, a) => s + (Number(a && a.valor) || 0), 0);
}
