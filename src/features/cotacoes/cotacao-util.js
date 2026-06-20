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

/** Resumo das ofertas ATUAIS (sobre os totais): nº, menor, média, maior, economia. */
export function resumoOfertas(precos, cotacao) {
  const lista = Array.isArray(precos) ? precos : [];
  const totais = lista.map((p) => totalOferta(p, cotacao));
  const num = totais.length;
  if (!num) return { num: 0, menor: 0, media: 0, maior: 0, economia: 0 };
  const menor = Math.min.apply(null, totais);
  const maior = Math.max.apply(null, totais);
  const soma = totais.reduce((s, v) => s + v, 0);
  return { num, menor, media: soma / num, maior, economia: maior - menor };
}

/** Paleta fixa para identificar contatos em gráficos/legendas (tema-agnóstica). */
export const PALETA_CONTATOS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

/** Mapa estável contato_id -> cor (mesma cor no gráfico de evolução e na comparação). */
export function coresPorContato(ids) {
  const mapa = {};
  (Array.isArray(ids) ? ids : []).forEach((id, i) => {
    if (id != null && mapa[id] === undefined) {
      mapa[id] = PALETA_CONTATOS[i % PALETA_CONTATOS.length];
    }
  });
  return mapa;
}
