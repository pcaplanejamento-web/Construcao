/**
 * Testes da camada de rastreabilidade pura (sem browser). Rodar: `node --test test/`.
 * Cobrem cada direção reversa + a resolução em cascata da obra de uma oferta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  obraIdDaOferta,
  rastrearContato,
  rastrearFornecedor,
  rastrearItem,
  rastrearSubclassificacao,
  rastrearEquipe,
  rastrearObra,
  rastrearOferta,
} from "../src/features/shared/rastreabilidade.js";

const ids = (arr) => (arr || []).map((x) => String(x.id)).sort();

// Grafo de fixture cobrindo todas as direções.
const ctx = {
  obras: [{ id: "ob1", nome: "Obra 1" }, { id: "ob2", nome: "Obra 2" }],
  fornecedores: [{ id: "f1", nome: "Forn 1", categoria_id: "" }],
  contatos: [
    { id: "k1", nome: "K1", fornecedor_id: "f1" },
    { id: "k2", nome: "K2", fornecedor_id: "" },
  ],
  itens: [
    { id: "it1", nome: "Item 1", categoria_id: "sub1" },
    { id: "it2", nome: "Item 2", categoria_id: "sub1" },
  ],
  equipes: [{ id: "e1", lider_id: "k2", membros: ["k1"], obras: ["ob2"] }],
  cotacoes: [{ id: "c1", item_id: "it1", obra_id: "ob1", categoria_id: "sub1" }],
  orcamentos: [{ id: "orc1", obra_id: "ob2", fornecedor_id: "f1", contato_id: "k1", equipe_id: "" }],
  ofertas: [
    { id: "of1", cotacao_id: "c1", contato_id: "k1", fornecedor_id: "f1", item_id: "it1", despesa_id: "d1", obra_id: "" },
    { id: "of2", orcamento_id: "orc1", contato_id: "k1", fornecedor_id: "f1", item_id: "it2", obra_id: "" },
    { id: "of3", contato_id: "k2", item_id: "it1", obra_id: "ob1" },
    { id: "of4", equipe_id: "e1", item_id: "it2", obra_id: "" },
  ],
  despesas: [
    { id: "d1", obra_id: "ob1", item_id: "it1", categoria_id: "sub1", ofertante_contato_id: "k1", fornecedor_id: "f1", preco_id: "of1" },
    { id: "d2", obra_id: "ob2", item_id: "it2", ofertante_equipe_id: "e1" },
  ],
  participantes: [{ obra_id: "ob1", chave: "c:k1" }],
};

test("obraIdDaOferta — cascata própria → cotação → orçamento", () => {
  assert.equal(obraIdDaOferta(ctx.ofertas[0], ctx), "ob1"); // via cotação
  assert.equal(obraIdDaOferta(ctx.ofertas[1], ctx), "ob2"); // via orçamento
  assert.equal(obraIdDaOferta(ctx.ofertas[2], ctx), "ob1"); // própria
  assert.equal(obraIdDaOferta(ctx.ofertas[3], ctx), ""); // avulsa sem obra
});

test("rastrearContato", () => {
  const r = rastrearContato("k1", ctx);
  assert.deepEqual(ids(r.ofertas), ["of1", "of2"]);
  assert.deepEqual(ids(r.despesas), ["d1"]);
  assert.deepEqual(ids(r.equipes), ["e1"]); // membro
  assert.deepEqual(ids(r.obras), ["ob1", "ob2"]);
});

test("rastrearFornecedor", () => {
  const r = rastrearFornecedor("f1", ctx);
  assert.deepEqual(ids(r.contatos), ["k1"]);
  assert.deepEqual(ids(r.ofertas), ["of1", "of2"]);
  assert.deepEqual(ids(r.despesas), ["d1"]);
  assert.deepEqual(ids(r.obras), ["ob1", "ob2"]);
});

test("rastrearItem", () => {
  const r = rastrearItem("it1", ctx);
  assert.deepEqual(ids(r.ofertas), ["of1", "of3"]);
  assert.deepEqual(ids(r.despesas), ["d1"]);
  assert.deepEqual(ids(r.cotacoes), ["c1"]);
  assert.deepEqual(ids(r.obras), ["ob1"]);
});

test("rastrearSubclassificacao", () => {
  const r = rastrearSubclassificacao("sub1", ctx);
  assert.deepEqual(ids(r.itens), ["it1", "it2"]);
  assert.deepEqual(ids(r.despesas), ["d1"]);
  assert.deepEqual(ids(r.cotacoes), ["c1"]);
  assert.deepEqual(ids(r.fornecedores), []);
});

test("rastrearEquipe", () => {
  const r = rastrearEquipe("e1", ctx);
  assert.deepEqual(ids(r.ofertas), ["of4"]);
  assert.deepEqual(ids(r.despesas), ["d2"]);
  assert.deepEqual(ids(r.orcamentos), []);
  assert.deepEqual(ids(r.obras), ["ob2"]);
});

test("rastrearObra", () => {
  const r = rastrearObra("ob1", ctx);
  assert.deepEqual(ids(r.despesas), ["d1"]);
  assert.deepEqual(ids(r.cotacoes), ["c1"]);
  assert.deepEqual(ids(r.ofertas), ["of1", "of3"]); // of1 via cotação, of3 própria
  assert.deepEqual(ids(r.orcamentos), []);
  assert.deepEqual(ids(r.equipes), []);
});

test("rastrearOferta — despesa registrada", () => {
  assert.deepEqual(ids(rastrearOferta(ctx.ofertas[0], ctx).despesas), ["d1"]);
  assert.deepEqual(ids(rastrearOferta(ctx.ofertas[1], ctx).despesas), []); // sem despesa_id
});
