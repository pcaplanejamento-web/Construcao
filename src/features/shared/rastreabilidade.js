/**
 * rastreabilidade.js — Derivação REVERSA pura das vinculações entre entidades.
 *
 * "Quem aponta para X" calculado SÓ a partir dos FKs diretos existentes — nada é
 * guardado duplicado (decisão de projeto: derivar, não denormalizar). Módulo puro
 * (sem browser/data-store) → testável com `node --test` como despesa-split.js.
 *
 * Cada função recebe um `ctx` com as coleções (arrays simples) e devolve as listas
 * de entidades vinculadas. A obra de uma OFERTA é resolvida em cascata
 * (própria → cotação → orçamento), o que cobre inclusive ofertas avulsas.
 *
 * ctx = { obras, despesas, ofertas, cotacoes, orcamentos, contatos, fornecedores,
 *         itens, equipes, participantes:[{obra_id, chave, eh_responsavel}] }
 */

const eq = (a, b) => String(a) === String(b);
const temId = (v) => v != null && String(v) !== "";

/** Resolve o obra_id de uma oferta: própria → cotação → orçamento. */
export function obraIdDaOferta(oferta, ctx) {
  if (!oferta) return "";
  if (temId(oferta.obra_id)) return String(oferta.obra_id);
  if (temId(oferta.cotacao_id)) {
    const c = (ctx.cotacoes || []).find((x) => eq(x.id, oferta.cotacao_id));
    if (c && temId(c.obra_id)) return String(c.obra_id);
  }
  if (temId(oferta.orcamento_id)) {
    const o = (ctx.orcamentos || []).find((x) => eq(x.id, oferta.orcamento_id));
    if (o && temId(o.obra_id)) return String(o.obra_id);
  }
  return "";
}

/** Mapeia um conjunto de ids de obra para os objetos obra do ctx. */
function _obrasPorIds(ids, ctx) {
  return (ctx.obras || []).filter((o) => ids.has(String(o.id)));
}

export function rastrearContato(id, ctx) {
  const ofertas = (ctx.ofertas || []).filter((o) => eq(o.contato_id, id));
  const despesas = (ctx.despesas || []).filter((d) => eq(d.ofertante_contato_id, id));
  const equipes = (ctx.equipes || []).filter(
    (e) => eq(e.lider_id, id) || (e.membros || []).some((m) => eq(m, id))
  );
  const ids = new Set();
  despesas.forEach((d) => temId(d.obra_id) && ids.add(String(d.obra_id)));
  ofertas.forEach((o) => { const ob = obraIdDaOferta(o, ctx); if (ob) ids.add(ob); });
  equipes.forEach((e) => (e.obras || []).forEach((ob) => temId(ob) && ids.add(String(ob))));
  (ctx.participantes || []).forEach((p) => {
    if (String(p.chave || "") === "c:" + id && temId(p.obra_id)) ids.add(String(p.obra_id));
  });
  const pagamentos = (ctx.pagamentos || []).filter(
    (p) => eq(p.pagador_contato_id, id) || eq(p.recebedor_contato_id, id)
  );
  const repasses = (ctx.repasses || []).filter(
    (r) => eq(r.recebedor_contato_id, id) || (r.contatos_repassados || []).some((c) => eq(c, id))
  );
  return { ofertas, despesas, equipes, obras: _obrasPorIds(ids, ctx), pagamentos, repasses };
}

export function rastrearFornecedor(id, ctx) {
  const contatos = (ctx.contatos || []).filter((c) => eq(c.fornecedor_id, id));
  const ofertas = (ctx.ofertas || []).filter((o) => eq(o.fornecedor_id, id));
  const despesas = (ctx.despesas || []).filter((d) => eq(d.fornecedor_id, id));
  const ids = new Set();
  despesas.forEach((d) => temId(d.obra_id) && ids.add(String(d.obra_id)));
  ofertas.forEach((o) => { const ob = obraIdDaOferta(o, ctx); if (ob) ids.add(ob); });
  const pagamentos = (ctx.pagamentos || []).filter((p) => eq(p.fornecedor_id, id));
  return { contatos, ofertas, despesas, obras: _obrasPorIds(ids, ctx), pagamentos };
}

export function rastrearItem(id, ctx) {
  const ofertas = (ctx.ofertas || []).filter((o) => eq(o.item_id, id));
  const despesas = (ctx.despesas || []).filter((d) => eq(d.item_id, id));
  const cotacoes = (ctx.cotacoes || []).filter((c) => eq(c.item_id, id));
  const ids = new Set();
  despesas.forEach((d) => temId(d.obra_id) && ids.add(String(d.obra_id)));
  ofertas.forEach((o) => { const ob = obraIdDaOferta(o, ctx); if (ob) ids.add(ob); });
  return { ofertas, despesas, cotacoes, obras: _obrasPorIds(ids, ctx) };
}

export function rastrearSubclassificacao(id, ctx) {
  const itens = (ctx.itens || []).filter((i) => eq(i.categoria_id, id));
  const despesas = (ctx.despesas || []).filter((d) => eq(d.categoria_id, id));
  const cotacoes = (ctx.cotacoes || []).filter((c) => eq(c.categoria_id, id));
  const fornecedores = (ctx.fornecedores || []).filter((f) => eq(f.categoria_id, id));
  return { itens, despesas, cotacoes, fornecedores };
}

export function rastrearEquipe(id, ctx) {
  const ofertas = (ctx.ofertas || []).filter((o) => eq(o.equipe_id, id));
  const despesas = (ctx.despesas || []).filter((d) => eq(d.ofertante_equipe_id, id));
  const orcamentos = (ctx.orcamentos || []).filter((o) => eq(o.equipe_id, id));
  const eqp = (ctx.equipes || []).find((e) => eq(e.id, id)) || {};
  const ids = new Set((eqp.obras || []).map(String));
  despesas.forEach((d) => temId(d.obra_id) && ids.add(String(d.obra_id)));
  ofertas.forEach((o) => { const ob = obraIdDaOferta(o, ctx); if (ob) ids.add(ob); });
  const pagamentos = (ctx.pagamentos || []).filter((p) => eq(p.recebedor_equipe_id, id));
  return { ofertas, despesas, orcamentos, obras: _obrasPorIds(ids, ctx), pagamentos };
}

export function rastrearObra(id, ctx) {
  const despesas = (ctx.despesas || []).filter((d) => eq(d.obra_id, id));
  const cotacoes = (ctx.cotacoes || []).filter((c) => eq(c.obra_id, id));
  const ofertas = (ctx.ofertas || []).filter((o) => eq(obraIdDaOferta(o, ctx), id));
  const orcamentos = (ctx.orcamentos || []).filter((o) => eq(o.obra_id, id));
  const equipes = (ctx.equipes || []).filter((e) => (e.obras || []).some((ob) => eq(ob, id)));
  const pagamentos = (ctx.pagamentos || []).filter((p) => eq(p.obra_id, id));
  const repasses = (ctx.repasses || []).filter((r) => eq(r.obra_id, id));
  return { despesas, cotacoes, ofertas, orcamentos, equipes, pagamentos, repasses };
}

export function rastrearOferta(oferta, ctx) {
  const despesas =
    oferta && temId(oferta.despesa_id)
      ? (ctx.despesas || []).filter((d) => eq(d.id, oferta.despesa_id))
      : [];
  return { despesas };
}
