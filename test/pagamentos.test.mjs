/**
 * Testes de Pagamentos (entidade própria): balanço por coleção, cobrindo várias
 * despesas, e EQUIVALÊNCIA com o caminho legado (espelho embutido). `node --test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { balancos, balancosDePagamentos } from "../src/features/despesas/despesa-split.js";

const aprox = (a, b, msg) => assert.ok(Math.abs((a || 0) - b) < 0.01, `${msg}: ${a} ≈ ${b}`);

test("balancosDePagamentos — 1 pagamento cobrindo 2 despesas", () => {
  const despesas = [
    { id: "d1", valor: 1000, ofertante_contato_id: "kA", responsaveis: [] },
    { id: "d2", valor: 500, ofertante_contato_id: "kB", responsaveis: [] },
  ];
  const pagamentos = [
    {
      id: "p1",
      pagador_chave: "c:payer",
      valor: 900,
      distribuicao: [],
      alocacoes: [
        { despesa_id: "d1", valor: 600 },
        { despesa_id: "d2", valor: 300 },
      ],
    },
  ];
  const { porChave } = balancosDePagamentos(despesas, pagamentos);
  aprox(porChave["c:payer"].pago, 900, "pagador pagou o total do pagamento");
  aprox(porChave["c:kA"].recebido, 600, "kA recebeu o alocado em d1");
  aprox(porChave["c:kA"].saldoReceber, 400, "kA ainda tem a receber de d1");
  aprox(porChave["c:kB"].recebido, 300, "kB recebeu o alocado em d2");
  aprox(porChave["c:kB"].saldoReceber, 200, "kB ainda tem a receber de d2");
});

test("balancosDePagamentos ≡ balancos (espelho de despesa única)", () => {
  // Despesa com leva embutida + pagamento equivalente (1 alocação) → mesmo resultado.
  const despesas = [
    {
      id: "d1",
      valor: 1000,
      ofertante_contato_id: "k1",
      fornecedor_id: "f1",
      responsaveis: [{ chave: "c:k1", pct: 100 }],
      pagamentos_realizados: [{ id: "lv1", valor: 600, pagador: "c:k2", distribuicao: [] }],
    },
  ];
  const pagamentos = [
    {
      id: "p1",
      pagador_chave: "c:k2",
      valor: 600,
      distribuicao: [],
      alocacoes: [{ despesa_id: "d1", valor: 600 }],
    },
  ];
  const legado = balancos(despesas);
  const novo = balancosDePagamentos(despesas, pagamentos);
  assert.deepEqual(novo, legado, "coleção de pagamentos deve bater com o espelho embutido");
});
