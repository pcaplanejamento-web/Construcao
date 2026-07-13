/**
 * Testes das regras PURAS de incorporação (fronteira acervo pessoal × obra).
 * Rodar: `node --test test/`. Cobre `jaIncorporado` (7 tipos, +/-) e
 * `filtrarDadosDaObra` (obra_id + preco_id via despesa).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { jaIncorporado, filtrarDadosDaObra, indiceAcervo, jaIncorporadoIdx } from "../src/features/shared/incorporacao.js";

// Acervo do usuário A (own) + itens compartilhados (usuario_id B).
const CAT = {
  meuId: "A",
  contatos: [
    { id: "c1", usuario_id: "B", nome: "João", telefone: "11" }, // compartilhado
    { id: "c2", usuario_id: "A", nome: "João", telefone: "11" }, // minha cópia
    { id: "c3", usuario_id: "A", nome: "Maria", telefone: "22" },
  ],
  fornecedores: [
    { id: "f1", usuario_id: "B", nome: "Const" },
    { id: "f2", usuario_id: "A", nome: "Const" },
  ],
  itens: [
    { id: "i1", usuario_id: "B", nome: "Cimento", classificacao: "Material" },
    { id: "i2", usuario_id: "A", nome: "Cimento", classificacao: "Material" },
  ],
  equipes: [
    { id: "e1", usuario_id: "B", nome: "Equipe X" },
    { id: "e2", usuario_id: "A", nome: "Equipe X" },
  ],
  cargos: [
    { id: "builtin:Pedreiro", nome: "Pedreiro", fixo: true },
    { id: "cg1", usuario_id: "A", nome: "Custom", fixo: false },
    { id: "cg2", usuario_id: "B", nome: "SóDoDono", fixo: false }, // do dono, não meu
  ],
  categorias: [
    { id: "cat1", usuario_id: "B", nome: "Ferro", tipo: "item" },
    { id: "cat2", usuario_id: "A", nome: "Ferro", tipo: "item" },
    { id: "cat3", usuario_id: "A", nome: "Aço", tipo: "fornecedor" },
    { id: "catG", usuario_id: "GLOBAL", nome: "Geral", tipo: "item" },
  ],
};

test("contato: casa por nome + telefone", () => {
  assert.equal(jaIncorporado("contato", { nome: "João", telefone: "11" }, CAT), true);
  assert.equal(jaIncorporado("contato", { nome: "João", telefone: "99" }, CAT), false); // telefone difere
  assert.equal(jaIncorporado("contato", { nome: "Zé", telefone: "00" }, CAT), false);
});

test("contato: case-insensitive no nome", () => {
  assert.equal(jaIncorporado("contato", { nome: "  joão ", telefone: "11" }, CAT), true);
});

test("fornecedor: casa por nome", () => {
  assert.equal(jaIncorporado("fornecedor", { nome: "Const" }, CAT), true);
  assert.equal(jaIncorporado("fornecedor", { nome: "Nova" }, CAT), false);
});

test("item: casa por nome + classificação", () => {
  assert.equal(jaIncorporado("item", { nome: "Cimento", classificacao: "Material" }, CAT), true);
  assert.equal(jaIncorporado("item", { nome: "Cimento", classificacao: "Serviço" }, CAT), false);
});

test("equipe: casa por nome", () => {
  assert.equal(jaIncorporado("equipe", { nome: "Equipe X" }, CAT), true);
  assert.equal(jaIncorporado("equipe", { nome: "Equipe Y" }, CAT), false);
});

test("cargo: fixo OU meu extra (nunca só do dono)", () => {
  assert.equal(jaIncorporado("cargo", { nome: "Pedreiro" }, CAT), true); // fixo
  assert.equal(jaIncorporado("cargo", { nome: "Custom" }, CAT), true); // meu
  assert.equal(jaIncorporado("cargo", { nome: "SóDoDono" }, CAT), false); // só do dono
  assert.equal(jaIncorporado("cargo", { nome: "Novo" }, CAT), false);
});

test("categoria: casa por nome + pool (item vs fornecedor); GLOBAL conta", () => {
  assert.equal(jaIncorporado("categoria-item", { nome: "Ferro" }, CAT), true);
  assert.equal(jaIncorporado("categoria-item", { nome: "Aço" }, CAT), false); // Aço é fornecedor
  assert.equal(jaIncorporado("categoria-fornecedor", { nome: "Aço" }, CAT), true);
  assert.equal(jaIncorporado("categoria-fornecedor", { nome: "Ferro" }, CAT), false); // Ferro é item
  assert.equal(jaIncorporado("categoria-item", { nome: "Geral" }, CAT), true); // GLOBAL
});

test("oferta/cotação/orçamento (escopo=obra) nunca bloqueiam", () => {
  assert.equal(jaIncorporado("oferta", { item_id: "x" }, CAT), false);
  assert.equal(jaIncorporado("cotacao", { descricao: "x" }, CAT), false);
  assert.equal(jaIncorporado("orcamento", { titulo: "x" }, CAT), false);
});

test("entradas inválidas → false", () => {
  assert.equal(jaIncorporado("contato", null, CAT), false);
  assert.equal(jaIncorporado("contato", { nome: "João" }, null), false);
  assert.equal(jaIncorporado("tipo-desconhecido", { nome: "x" }, CAT), false);
});

test("filtrarDadosDaObra: por obra_id + preco_id da despesa", () => {
  const pools = {
    ofertas: [
      { id: "of1", obra_id: "o1" }, // da obra por obra_id
      { id: "of2", obra_id: "" }, // avulsa, MAS referenciada por despesa
      { id: "of3", obra_id: "o2" }, // outra obra
    ],
    cotacoes: [{ id: "ct1", obra_id: "o1" }, { id: "ct2", obra_id: "" }],
    orcamentos: [{ id: "or1", obra_id: "o1" }, { id: "or2", obra_id: "o2" }],
    despesasDaObra: [{ id: "d1", preco_id: "of2" }],
  };
  const r = filtrarDadosDaObra("o1", pools);
  assert.deepEqual(r.ofertas.map((o) => o.id).sort(), ["of1", "of2"]);
  assert.deepEqual(r.cotacoes.map((c) => c.id), ["ct1"]);
  assert.deepEqual(r.orcamentos.map((o) => o.id), ["or1"]);
});

test("filtrarDadosDaObra: pools vazios não quebram", () => {
  const r = filtrarDadosDaObra("o1", {});
  assert.deepEqual(r, { ofertas: [], cotacoes: [], orcamentos: [] });
});

test("origem_id: dedup EXATO resiste a renomear (nome diferente)", () => {
  const cat = {
    meuId: "A",
    contatos: [{ id: "meu", usuario_id: "A", nome: "Renomeado", telefone: "00", origem_id: "src1" }],
    fornecedores: [], itens: [], equipes: [], cargos: [],
    categorias: [{ id: "catMeu", usuario_id: "A", nome: "RenomCat", tipo: "item", origem_id: "srcCat" }],
  };
  // compartilhado src1: nome/telefone DIFERENTES do meu, mas origem_id casa → já incorporado.
  assert.equal(jaIncorporado("contato", { id: "src1", nome: "Original", telefone: "99" }, cat), true);
  assert.equal(jaIncorporado("contato", { id: "outro", nome: "Zé", telefone: "1" }, cat), false);
  assert.equal(jaIncorporado("categoria-item", { id: "srcCat", nome: "Qualquer" }, cat), true);
  // Índice idem (Set global de origem_id).
  const idx = indiceAcervo(cat);
  assert.equal(jaIncorporadoIdx("contato", { id: "src1", nome: "Original", telefone: "99" }, idx), true);
  assert.equal(jaIncorporadoIdx("contato", { id: "outro", nome: "Zé" }, idx), false);
  assert.equal(jaIncorporadoIdx("categoria-item", { id: "srcCat", nome: "Qualquer" }, idx), true);
});

test("jaIncorporadoIdx é EQUIVALENTE a jaIncorporado (índice O(1))", () => {
  const idx = indiceAcervo(CAT);
  const casos = [
    ["contato", { nome: "João", telefone: "11" }],
    ["contato", { nome: "João", telefone: "99" }],
    ["contato", { nome: "  JOÃO ", telefone: "11" }],
    ["contato", { nome: "", telefone: "11" }],
    ["fornecedor", { nome: "Const" }],
    ["fornecedor", { nome: "Nova" }],
    ["item", { nome: "Cimento", classificacao: "Material" }],
    ["item", { nome: "Cimento", classificacao: "Serviço" }],
    ["equipe", { nome: "Equipe X" }],
    ["cargo", { nome: "Pedreiro" }],
    ["cargo", { nome: "SóDoDono" }],
    ["categoria-item", { nome: "Ferro" }],
    ["categoria-item", { nome: "Aço" }],
    ["categoria-fornecedor", { nome: "Aço" }],
    ["categoria-item", { nome: "Geral" }],
    ["oferta", { nome: "x" }],
  ];
  for (const [tipo, x] of casos) {
    assert.equal(
      jaIncorporadoIdx(tipo, x, idx),
      jaIncorporado(tipo, x, CAT),
      `divergência em ${tipo} / ${JSON.stringify(x)}`
    );
  }
});
