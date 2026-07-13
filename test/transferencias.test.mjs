import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveRecebedor,
  recebedorUniforme,
  totalAlocacoes,
  pagamentosSemTransferencia,
} from "../src/features/pagamentos/transferencia-regra.js";

test("chaveRecebedor: contato + fornecedor", () => {
  assert.equal(chaveRecebedor({ ofertante_contato_id: "k1", fornecedor_id: "f1" }), "c:k1|f:f1");
});

test("chaveRecebedor: equipe ignora fornecedor (recebe via líder)", () => {
  assert.equal(chaveRecebedor({ ofertante_equipe_id: "e1", fornecedor_id: "f1" }), "e:e1");
});

test("recebedorUniforme: mesmo contato + empresa → true", () => {
  const ds = [
    { ofertante_contato_id: "k1", fornecedor_id: "f1" },
    { ofertante_contato_id: "k1", fornecedor_id: "f1" },
  ];
  assert.equal(recebedorUniforme(ds), true);
});

test("recebedorUniforme: empresas diferentes → false", () => {
  const ds = [
    { ofertante_contato_id: "k1", fornecedor_id: "f1" },
    { ofertante_contato_id: "k1", fornecedor_id: "f2" },
  ];
  assert.equal(recebedorUniforme(ds), false);
});

test("recebedorUniforme: contato vs equipe → false", () => {
  const ds = [{ ofertante_contato_id: "k1" }, { ofertante_equipe_id: "e1" }];
  assert.equal(recebedorUniforme(ds), false);
});

test("recebedorUniforme: lista vazia ou única → true", () => {
  assert.equal(recebedorUniforme([]), true);
  assert.equal(recebedorUniforme([{ ofertante_contato_id: "k9" }]), true);
});

test("totalAlocacoes soma os valores", () => {
  assert.equal(totalAlocacoes([{ valor: 1500 }, { valor: 300.5 }, { valor: "x" }]), 1800.5);
  assert.equal(totalAlocacoes([]), 0);
});

test("pagamentosSemTransferencia: cobertos pelo REVERSO (pagamento_ids) não sintetizam", () => {
  const reais = [{ id: "t1", pagamento_ids: ["p1", "p2"] }];
  // p1/p2 cobertos pelo reverso mesmo com transferencia_id VAZIO (bug da duplicação).
  const pagamentos = [
    { id: "p1", transferencia_id: "" },
    { id: "p2", transferencia_id: "" },
    { id: "p3", transferencia_id: "" }, // sem transferência real → sintetiza
  ];
  const out = pagamentosSemTransferencia(reais, pagamentos);
  assert.deepEqual(out.map((p) => p.id), ["p3"]);
});

test("pagamentosSemTransferencia: cobertos pelo link direto (transferencia_id) não sintetizam", () => {
  const reais = [{ id: "t9", pagamento_ids: [] }]; // reverso vazio; vale o link direto
  const pagamentos = [
    { id: "pa", transferencia_id: "t9" }, // aponta a real → não sintetiza
    { id: "pb", transferencia_id: "" }, // descoberto → sintetiza
  ];
  const out = pagamentosSemTransferencia(reais, pagamentos);
  assert.deepEqual(out.map((p) => p.id), ["pb"]);
});

test("pagamentosSemTransferencia: sem transferências reais → todos sintetizam", () => {
  const pagamentos = [{ id: "x1" }, { id: "x2" }];
  assert.deepEqual(pagamentosSemTransferencia([], pagamentos).map((p) => p.id), ["x1", "x2"]);
  assert.deepEqual(pagamentosSemTransferencia(null, []).length, 0);
});
