/**
 * Testes do fechamento transitivo de compartilhamento (função PURA, sem browser).
 * Rodar: `node --test test/`. Cobre: contato→empresa/cargo/superior,
 * equipe→membros/líder→(cargo/empresa deles), fornecedor/item→categoria, ciclos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fecharCompartilhado } from "../src/features/shared/compartilhamento-closure.js";

// Grafo de fixture:
//   contato c1 → empresa f1, cargo "Pedreiro"
//   contato c2 → empresa f2, cargo "Mestre", superior c3
//   contato c3 → cargo "Engenheiro"
//   equipe  e1 → líder c1, membros [c2]
//   fornecedor f1 → categoria catF1 ; f2 → catF2
//   item i1 → categoria catI1
const CONT = {
  c1: { id: "c1", nome: "C1", fornecedor_id: "f1", cargo: "Pedreiro", superior_id: "" },
  c2: { id: "c2", nome: "C2", fornecedor_id: "f2", cargo: "Mestre", superior_id: "c3" },
  c3: { id: "c3", nome: "C3", fornecedor_id: "", cargo: "Engenheiro", superior_id: "" },
};
const FORN = { f1: { id: "f1", categoria_id: "catF1" }, f2: { id: "f2", categoria_id: "catF2" } };
const ITEM = { i1: { id: "i1", categoria_id: "catI1" } };
const EQUIPE = { e1: { id: "e1", lider_id: "c1", membros: ["c2"] } };
const ctx = {
  contato: (id) => CONT[id] || null,
  fornecedor: (id) => FORN[id] || null,
  item: (id) => ITEM[id] || null,
  equipe: (id) => EQUIPE[id] || null,
};
const arr = (set) => [...set].sort();

test("contato puxa sua empresa e cargo (1 salto)", () => {
  const r = fecharCompartilhado({ c: ["c1"] }, ctx);
  assert.deepEqual(arr(r.contatos), ["c1"]);
  assert.deepEqual(arr(r.fornecedores), ["f1"]);
  assert.ok(r.cargos.has("pedreiro"));
  assert.deepEqual(arr(r.categorias), ["catF1"]); // empresa → categoria (transitivo)
});

test("contato puxa superior transitivamente e o cargo dele", () => {
  const r = fecharCompartilhado({ c: ["c2"] }, ctx);
  assert.deepEqual(arr(r.contatos), ["c2", "c3"]); // c2 → superior c3
  assert.ok(r.cargos.has("mestre") && r.cargos.has("engenheiro"));
  assert.deepEqual(arr(r.fornecedores), ["f2"]);
  assert.deepEqual(arr(r.categorias), ["catF2"]);
});

test("equipe puxa líder + membros e, transitivamente, empresas/cargos deles (2 saltos)", () => {
  const r = fecharCompartilhado({ e: ["e1"] }, ctx);
  assert.deepEqual(arr(r.equipes), ["e1"]);
  // e1 → c1 (líder) + c2 (membro) → c2.superior c3
  assert.deepEqual(arr(r.contatos), ["c1", "c2", "c3"]);
  assert.deepEqual(arr(r.fornecedores), ["f1", "f2"]);
  assert.deepEqual(arr(r.categorias), ["catF1", "catF2"]);
  assert.ok(r.cargos.has("pedreiro") && r.cargos.has("mestre") && r.cargos.has("engenheiro"));
});

test("item puxa sua categoria", () => {
  const r = fecharCompartilhado({ i: ["i1"] }, ctx);
  assert.deepEqual(arr(r.itens), ["i1"]);
  assert.deepEqual(arr(r.categorias), ["catI1"]);
});

test("ciclo de superior não trava (termina)", () => {
  const c = { a: { id: "a", superior_id: "b", cargo: "X" }, b: { id: "b", superior_id: "a", cargo: "Y" } };
  const r = fecharCompartilhado({ c: ["a"] }, { contato: (id) => c[id] || null });
  assert.deepEqual(arr(r.contatos), ["a", "b"]);
  assert.ok(r.cargos.has("x") && r.cargos.has("y"));
});

test("sementes vazias → conjuntos vazios; ids inexistentes ignorados", () => {
  const r = fecharCompartilhado({}, ctx);
  assert.equal(r.contatos.size, 0);
  const r2 = fecharCompartilhado({ c: ["naoexiste"] }, ctx);
  assert.deepEqual(arr(r2.contatos), ["naoexiste"]); // permanece semeado, sem expandir
  assert.equal(r2.fornecedores.size, 0);
});
