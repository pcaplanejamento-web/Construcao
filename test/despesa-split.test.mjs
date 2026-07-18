/**
 * Testes dos helpers financeiros puros (sem browser). Rodar: `node --test test/`.
 * Cobrem o modelo paga ↔ recebe (balancos), status/resto e o acerto "quem deve a quem".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  totalRealizado,
  restoDespesa,
  statusPagamento,
  balancos,
  acerto,
  saldoPorDespesa,
} from "../src/features/despesas/despesa-split.js";

const aprox = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} ≈ ${b}`);

test("status / realizado / resto a partir das levas", () => {
  const base = (levas) => ({ valor: 1000, pagamentos_realizados: levas });
  assert.equal(statusPagamento(base([])), "A pagar");
  assert.equal(statusPagamento(base([{ valor: 400 }])), "Em pagamento");
  assert.equal(statusPagamento(base([{ valor: 1000 }])), "Pago");
  assert.equal(statusPagamento(base([{ valor: 600 }, { valor: 400 }])), "Pago");
  aprox(totalRealizado(base([{ valor: 400 }, { valor: 150 }])), 550, "totalRealizado");
  aprox(restoDespesa(base([{ valor: 400 }])), 600, "restoDespesa");
  aprox(restoDespesa(base([{ valor: 1200 }])), 0, "resto nunca negativo");
});

test("balancos — paga ↔ recebe (contato+fornecedor e equipe)", () => {
  const d1 = {
    valor: 1000,
    fornecedor_id: "f1",
    ofertante_contato_id: "c1",
    ofertante_equipe_id: "",
    responsaveis: [{ chave: "u:1", pct: 60 }, { chave: "c:2", pct: 40 }],
    pagamentos_realizados: [{ valor: 400, pagador: "u:1", distribuicao: [] }],
  };
  const d2 = {
    valor: 2000,
    fornecedor_id: "",
    ofertante_contato_id: "",
    ofertante_equipe_id: "e1",
    responsaveis: [{ chave: "u:1", pct: 100 }],
    pagamentos_realizados: [
      { valor: 600, pagador: "c:2", distribuicao: [{ chave: "c:10", valor: 400 }, { chave: "c:11", valor: 200 }] },
    ],
  };
  const { porChave, porFornecedor } = balancos([d1, d2]);

  // Quem paga: deduz Saldo a pagar → vira Pago.
  aprox(porChave["u:1"].pago, 400, "u:1 pago");
  aprox(porChave["u:1"].saldoApagar, 2200, "u:1 saldo a pagar (600+2000-400)");
  aprox(porChave["c:2"].pago, 600, "c:2 pago");
  aprox(porChave["c:2"].saldoApagar, 0, "c:2 pagou mais que o devido → 0");

  // Quem recebe: no Material (contato-vendedor + empresa), o dinheiro vai à EMPRESA, não
  // ao contato-vendedor → c:c1 não aparece como recebedor (payee canônico, sem dupla atribuição).
  assert.equal(porChave["c:c1"], undefined, "contato-vendedor de Material não conta como recebedor");
  // Equipe com distribuição: os R$600 foram TODOS repassados aos integrantes (400+200),
  // então a chave da equipe fica com 0 de recebido (senão contaria 2× = 1200). Só o
  // "a receber" (resto não pago) fica na equipe.
  aprox(porChave["e:e1"].recebido, 0, "grupo recebido (tudo distribuído aos integrantes)");
  aprox(porChave["e:e1"].saldoReceber, 1400, "grupo saldo a receber");
  aprox(porChave["c:10"].recebido, 400, "integrante recebido (distribuição)");
  aprox(porChave["c:11"].recebido, 200, "integrante recebido (distribuição)");

  // Empresa (fornecedor).
  aprox(porFornecedor["f1"].total, 1000, "fornecedor total");
  aprox(porFornecedor["f1"].recebido, 400, "fornecedor recebido");
  aprox(porFornecedor["f1"].saldoReceber, 600, "fornecedor saldo a receber");
});

test("balancos — PESSOA FÍSICA (sem empresa) recebe normalmente", () => {
  // Autônomo/prestador: não há empresa, então o dinheiro é DELE — tem que aparecer
  // em porChave. (O payee canônico só desvia p/ a empresa quando ela existe.)
  const d = {
    valor: 1000,
    fornecedor_id: "",
    ofertante_contato_id: "joao",
    responsaveis: [{ chave: "u:1", pct: 100 }],
    pagamentos_realizados: [{ valor: 700, pagador: "u:1", distribuicao: [] }],
  };
  const { porChave, porRepresentante } = balancos([d]);
  aprox(porChave["c:joao"].recebido, 700, "pessoa física recebeu");
  aprox(porChave["c:joao"].saldoReceber, 300, "pessoa física ainda tem a receber");
  // E também conta como "vendeu p/ nós", sob a chave de empresa vazia (venda direta).
  aprox(porRepresentante["joao"].total, 1000, "pessoa física vendeu 1000");
  aprox(porRepresentante["joao"].empresas[""].recebido, 700, "venda direta (sem empresa)");
});

test("porRepresentante — quanto cada vendedor intermediou (visão COMERCIAL)", () => {
  // Maria vende pela Alfa (o dinheiro vai à Alfa) e também presta serviço por conta
  // própria. As duas vendas somam no total DELA, separadas por empresa.
  const porAlfa = {
    valor: 1000,
    fornecedor_id: "alfa",
    ofertante_contato_id: "maria",
    responsaveis: [{ chave: "u:1", pct: 100 }],
    pagamentos_realizados: [{ valor: 400, pagador: "u:1", distribuicao: [] }],
  };
  const porContaPropria = {
    valor: 500,
    fornecedor_id: "",
    ofertante_contato_id: "maria",
    responsaveis: [{ chave: "u:1", pct: 100 }],
    pagamentos_realizados: [{ valor: 500, pagador: "u:1", distribuicao: [] }],
  };
  const { porChave, porFornecedor, porRepresentante } = balancos([porAlfa, porContaPropria]);

  // Financeiro: os 400 da venda pela Alfa são da ALFA; só os 500 diretos são da Maria.
  aprox(porFornecedor["alfa"].recebido, 400, "empresa recebeu a venda intermediada");
  aprox(porChave["c:maria"].recebido, 500, "Maria só recebe o que vendeu direto");

  // Comercial: a Maria vendeu 1500 no total (1000 pela Alfa + 500 direto).
  const m = porRepresentante["maria"];
  aprox(m.total, 1500, "total vendido pela Maria");
  aprox(m.recebido, 900, "já pago através da Maria (400 + 500)");
  aprox(m.saldoReceber, 600, "ainda a pagar pelas vendas da Maria");
  aprox(m.empresas["alfa"].total, 1000, "vendido representando a Alfa");
  aprox(m.empresas[""].total, 500, "vendido como pessoa física");
});

test("porRepresentante — equipe ofertante não gera representante", () => {
  const d = {
    valor: 800,
    ofertante_equipe_id: "e1",
    responsaveis: [{ chave: "u:1", pct: 100 }],
    pagamentos_realizados: [],
  };
  assert.deepEqual(balancos([d]).porRepresentante, {}, "equipe não tem vendedor pessoa");
});

test("balancos — sem pagamento: tudo a pagar / a receber", () => {
  const d = {
    valor: 8000,
    ofertante_equipe_id: "e9",
    responsaveis: [{ chave: "u:1", pct: 100 }],
    pagamentos_realizados: [],
  };
  const { porChave } = balancos([d]);
  aprox(porChave["u:1"].saldoApagar, 8000, "responsável deve tudo");
  aprox(porChave["e:e9"].saldoReceber, 8000, "grupo a receber tudo");
  aprox(porChave["e:e9"].recebido, 0, "grupo nada recebido");
});

test("acerto — quem deve a quem (reembolso entre participantes)", () => {
  const despesas = [
    {
      valor: 1000,
      pagamentos: [{ chave: "u:1", valor: 1000 }],
      responsaveis: [{ chave: "u:1", pct: 50 }, { chave: "c:2", pct: 50 }],
    },
  ];
  const participantes = [{ chave: "u:1", nome: "A" }, { chave: "c:2", nome: "B" }];
  const { acertos } = acerto(despesas, participantes);
  assert.equal(acertos.length, 1, "um acerto");
  assert.equal(acertos[0].de, "c:2", "devedor");
  assert.equal(acertos[0].para, "u:1", "credor");
  aprox(acertos[0].valor, 500, "valor do reembolso");
});

test("saldoPorDespesa — origem do saldo de uma chave (quem deve a quem)", () => {
  const despesas = [
    {
      id: "d1",
      item: "Cimento",
      valor: 1000,
      pagamentos: [{ chave: "u:1", valor: 1000 }],
      responsaveis: [{ chave: "u:1", pct: 50 }, { chave: "c:2", pct: 50 }],
    },
    {
      id: "d2",
      item: "Areia",
      valor: 200,
      pagamentos: [{ chave: "c:2", valor: 200 }],
      responsaveis: [{ chave: "c:2", pct: 100 }],
    },
    { id: "d3", item: "Outro", valor: 300, pagamentos: [], responsaveis: [{ chave: "u:1", pct: 100 }] },
  ];
  // Credor u:1: pagou 1000 em d1 (devido 500) e é responsável por 300 em d3.
  const oU1 = saldoPorDespesa(despesas, "u:1");
  assert.equal(oU1.length, 2, "u:1 aparece em d1 e d3, não em d2");
  const d1 = oU1.find((x) => x.despesa_id === "d1");
  aprox(d1.pago, 1000, "u:1 pagou em d1");
  aprox(d1.devido, 500, "u:1 devia 500 em d1");
  aprox(d1.saldo, 500, "saldo de u:1 em d1");
  assert.ok(!oU1.some((x) => x.despesa_id === "d2"), "u:1 não entra em d2");
  // Devedor c:2: responsável por 500 em d1 (não pagou) + pagou/deve 200 em d2 (zera).
  const oC2 = saldoPorDespesa(despesas, "c:2");
  const c2d1 = oC2.find((x) => x.despesa_id === "d1");
  aprox(c2d1.devido, 500, "c:2 devia 500 em d1");
  aprox(c2d1.pago, 0, "c:2 não pagou d1");
  aprox(c2d1.saldo, -500, "saldo negativo de c:2 em d1");
});
