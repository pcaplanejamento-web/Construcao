/**
 * Testes dos helpers PUROS do estoque (livro-razão). Rodar: `node --test test/`.
 * Cobrem a consolidação, origens, limites (item 10) e os cenários de exclusão
 * (itens 18/19), além das bordas: unidades divergentes e item sem subclassificação.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consolidarObra,
  emEstoqueDaObra,
  consumidosDaObra,
  saldoItem,
  limiteConsumo,
  limiteRetorno,
  unidadesDoItem,
  origensDoItem,
} from "../src/features/estoque/estoque.js";

const aprox = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.0001, `${msg}: ${a} ≈ ${b}`);

// Movimentos de exemplo: obra O1, item I1 (cimento), comprado 100 + manual 20,
// consumido 30 (e devolvido 5). Mais um item I2 só consumido parcialmente.
const movs = [
  { id: "m1", obra_id: "O1", item_id: "I1", classificacao: "Material", categoria_id: "C1", unidade: "saco", tipo: "entrada_despesa", quantidade: 100, despesa_id: "D1", criado_em: "2026-01-01" },
  { id: "m2", obra_id: "O1", item_id: "I1", classificacao: "Material", categoria_id: "C1", unidade: "saco", tipo: "entrada_manual", quantidade: 20, criado_em: "2026-01-02" },
  { id: "m3", obra_id: "O1", item_id: "I1", classificacao: "Material", categoria_id: "C1", unidade: "saco", tipo: "consumo", quantidade: 30, criado_em: "2026-01-03" },
  { id: "m4", obra_id: "O1", item_id: "I1", classificacao: "Material", categoria_id: "C1", unidade: "saco", tipo: "retorno", quantidade: 5, criado_em: "2026-01-04" },
];

test("saldoItem — adquirido/consumido/em_estoque derivados", () => {
  const s = saldoItem(movs, "O1", "I1");
  aprox(s.adquirido, 120, "adquirido = 100 + 20");
  aprox(s.consumido, 25, "consumido = 30 − 5");
  aprox(s.em_estoque, 95, "em_estoque = 120 − 25");
});

test("consolidarObra + abas Estoque/Consumidos", () => {
  const lista = consolidarObra(movs, "O1");
  assert.equal(lista.length, 1);
  const it = lista[0];
  assert.equal(it.item_id, "I1");
  assert.equal(it.classificacao, "Material");
  aprox(it.em_estoque, 95, "em_estoque");
  assert.equal(emEstoqueDaObra(movs, "O1").length, 1, "tem item em estoque");
  assert.equal(consumidosDaObra(movs, "O1").length, 1, "tem item consumido");
});

test("limites (item 10): consumir ≤ em_estoque; devolver ≤ consumido", () => {
  aprox(limiteConsumo(movs, "O1", "I1"), 95, "limite de redução = em_estoque");
  aprox(limiteRetorno(movs, "O1", "I1"), 25, "limite de aumento = consumido");
});

test("origensDoItem (item 17): só entradas, recentes primeiro", () => {
  const ori = origensDoItem(movs, "O1", "I1");
  assert.equal(ori.length, 2, "2 entradas (despesa + manual)");
  assert.equal(ori[0].tipo, "entrada_manual", "mais recente primeiro");
  assert.equal(ori[1].despesa_id, "D1", "entrada de despesa carrega despesa_id");
});

test("regra de exclusão (itens 18/19): só cabe se em_estoque ≥ qtd da entrada", () => {
  // Entrada de despesa = 100; consumido = 25 → em_estoque = 95 < 100 → NÃO cabe.
  const s1 = saldoItem(movs, "O1", "I1");
  assert.ok(s1.em_estoque < 100, "consumido demais: bloqueia exclusão da despesa de 100");
  // Item 19: se consumir menos (só 10), em_estoque = 110 ≥ 100 → cabe.
  const movs2 = movs.filter((m) => m.tipo !== "consumo" && m.tipo !== "retorno")
    .concat([{ obra_id: "O1", item_id: "I1", tipo: "consumo", quantidade: 10 }]);
  const s2 = saldoItem(movs2, "O1", "I1");
  assert.ok(s2.em_estoque >= 100, "consumo pequeno: a despesa de 100 ainda cabe → libera");
});

test("borda: unidades divergentes sinalizadas", () => {
  const m = [
    { obra_id: "O1", item_id: "I9", tipo: "entrada_manual", quantidade: 5, unidade: "kg" },
    { obra_id: "O1", item_id: "I9", tipo: "entrada_manual", quantidade: 3, unidade: "saco" },
  ];
  assert.deepEqual(unidadesDoItem(m, "O1", "I9"), ["kg", "saco"]);
  assert.equal(consolidarObra(m, "O1")[0].unidades.length, 2, "consolidação expõe divergência");
});

test("borda: item sem subclassificação (categoria_id vazio)", () => {
  const m = [{ obra_id: "O1", item_id: "I7", tipo: "entrada_manual", quantidade: 2, categoria_id: "" }];
  const it = consolidarObra(m, "O1")[0];
  assert.equal(it.categoria_id, "", "tolera categoria vazia");
  aprox(it.em_estoque, 2, "em_estoque ok");
});

test("transferência move só o em_estoque (saida reduz adquirido)", () => {
  const m = movs.concat([
    { obra_id: "O1", item_id: "I1", tipo: "saida_transferencia", quantidade: 40, obra_destino_id: "O2", par_id: "P1" },
    { obra_id: "O2", item_id: "I1", tipo: "entrada_transferencia", quantidade: 40, obra_origem_id: "O1", par_id: "P1" },
  ]);
  aprox(saldoItem(m, "O1", "I1").em_estoque, 55, "origem perde 40 (95 − 40)");
  aprox(saldoItem(m, "O2", "I1").em_estoque, 40, "destino ganha 40");
});
