/**
 * cotacao-util.js — Cálculos puros do módulo de cotações (reuso entre a lista e
 * o detalhe). Cada OFERTA tem dados próprios: quantidade, valor unitário e valor
 * unitário com desconto. O total final = unitário com desconto (se houver) ×
 * quantidade. Quando a oferta não tem quantidade própria, herda a da cotação.
 */

/** Quantidade da oferta: própria (preço) ou herdada da cotação; mínimo 1. */
export function qtdOferta(preco, cotacao) {
  const q = Number((preco || {}).quantidade);
  if (q > 0) return q;
  return Number((cotacao || {}).quantidade) || 1;
}

/** Valor unitário FINAL (com desconto se houver; senão o cheio). */
export function unitFinalOferta(preco) {
  const d = Number((preco || {}).valor_unit_desconto);
  return d > 0 ? d : Number((preco || {}).valor_unit) || 0;
}

/** Total FINAL de uma oferta = unitário final × quantidade (base da comparação). */
export function totalOferta(preco, cotacao) {
  return unitFinalOferta(preco) * qtdOferta(preco, cotacao);
}

/** Total SEM desconto (valor unitário cheio × quantidade) — p/ a coluna "Total". */
export function totalOfertaCheio(preco, cotacao) {
  return (Number((preco || {}).valor_unit) || 0) * qtdOferta(preco, cotacao);
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
