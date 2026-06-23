import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveRecebedor,
  recebedorUniforme,
  totalAlocacoes,
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
