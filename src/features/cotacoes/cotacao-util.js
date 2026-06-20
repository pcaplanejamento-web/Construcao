/**
 * cotacao-util.js — Cálculos puros do módulo de cotações (reuso entre a lista e
 * o detalhe). O total de uma oferta = valor unitário × quantidade da cotação;
 * quando a quantidade não é informada (0), compara-se o valor unitário direto.
 */

/** Total de uma oferta para a cotação dada. */
export function totalOferta(preco, cotacao) {
  const qtd = Number((cotacao || {}).quantidade) || 1;
  return (Number((preco || {}).valor_unit) || 0) * qtd;
}

/** Menor total entre as ofertas (ou null se não houver ofertas). */
export function melhorTotal(precos, cotacao) {
  const lista = Array.isArray(precos) ? precos : [];
  if (!lista.length) return null;
  return Math.min.apply(
    null,
    lista.map((p) => totalOferta(p, cotacao))
  );
}
