/**
 * despesa-split.js — Helpers puros da divisão de pagamento/responsabilidade de
 * uma despesa. (Fase 2 acrescenta aqui o algoritmo de acerto entre participantes.)
 *
 * pagamentos: [{ chave, valor }]   responsaveis: [{ chave, pct }]
 * (o backend já devolve arrays; parseLista é tolerante a string/vazio.)
 */

export function parseLista(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

/** Soma do que foi pago (todos os pagamentos da despesa). */
export function totalPago(despesa) {
  return parseLista(despesa && despesa.pagamentos).reduce(
    (s, p) => s + (Number(p.valor) || 0),
    0
  );
}

/** "nenhum" | "unico" | "distribuido" conforme o nº de pagantes com valor > 0. */
export function distribuicao(despesa) {
  const n = parseLista(despesa && despesa.pagamentos).filter((p) => Number(p.valor) > 0).length;
  return n === 0 ? "nenhum" : n === 1 ? "unico" : "distribuido";
}

/** Rótulo amigável da origem de um participante. */
export function rotuloOrigem(origem) {
  return origem === "dono" ? "Dono" : origem === "compartilhado" ? "Compartilhado" : "Contato";
}
