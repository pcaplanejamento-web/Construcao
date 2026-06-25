/**
 * Testes dos geradores de exportação (puros). Rodar: `node --test test/`.
 * Cobrem CSV (escape/separador), XLS (HTML+MIME), XLSX (ZIP válido com o conteúdo)
 * e PDF (estrutura mínima válida + texto). Não tocam o DOM.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gerarCSV,
  gerarXLS,
  gerarXLSX,
  gerarPDF,
  nomeArquivo,
} from "../src/features/shared/exportar-tabela.js";

const dados = {
  titulo: "Mesa com despesas da obra",
  colunas: ["Item", "Valor", "Obs"],
  linhas: [
    ["Cimento CP-II", "R$ 1.234,56", 'com "aspas"; e ponto-e-vírgula'],
    ["Areia média", "R$ 300,00", "linha\nquebrada"],
  ],
};

const latin1 = (u8) => Array.from(u8, (b) => String.fromCharCode(b)).join("");

test("CSV — cabeçalho + escape de aspas/separador/quebra", () => {
  const csv = gerarCSV(dados);
  const linhas = csv.split("\r\n");
  assert.equal(linhas[0], "Item;Valor;Obs");
  assert.ok(linhas[1].includes('"R$ 1.234,56"') === false, "valor sem ; não é citado");
  assert.ok(csv.includes('"com ""aspas""; e ponto-e-vírgula"'), "aspas e ; são citados/escapados");
  assert.ok(csv.includes('"linha\nquebrada"'), "quebra de linha é citada");
});

test("XLS — documento HTML com tabela e MIME do Excel", () => {
  const xls = gerarXLS(dados);
  assert.ok(xls.startsWith("<html"), "é documento HTML");
  assert.ok(xls.includes("<th>Item</th>"), "cabeçalho presente");
  assert.ok(xls.includes("Cimento CP-II"), "linha presente");
  assert.ok(xls.includes("&quot;aspas&quot;"), "HTML-escape de aspas");
  assert.ok(xls.includes("urn:schemas-microsoft-com:office:excel"), "namespace do Excel");
});

test("XLSX — ZIP válido (PK) contendo a planilha e os valores", () => {
  const u8 = gerarXLSX(dados);
  assert.ok(u8 instanceof Uint8Array && u8.length > 0);
  assert.equal(u8[0], 0x50); // 'P'
  assert.equal(u8[1], 0x4b); // 'K'
  const s = latin1(u8);
  assert.ok(s.includes("[Content_Types].xml"), "tem Content_Types");
  assert.ok(s.includes("xl/worksheets/sheet1.xml"), "tem a planilha");
  assert.ok(s.includes("<sheetData>"), "tem sheetData");
  assert.ok(s.includes("Cimento CP-II"), "valor presente (inlineStr, stored)");
  assert.ok(s.includes("PK"), "tem EOCD (fim do ZIP)");
});

test("PDF — estrutura 1.4 mínima válida + título e dados", () => {
  const u8 = gerarPDF(dados);
  const s = latin1(u8);
  assert.ok(s.startsWith("%PDF-1."), "cabeçalho %PDF");
  assert.ok(s.includes("/Type /Catalog"), "catálogo");
  assert.ok(s.includes("/Type /Pages"), "páginas");
  assert.ok(s.includes("/BaseFont /Helvetica"), "fonte");
  assert.ok(s.includes("Mesa com despesas da obra"), "título desenhado");
  assert.ok(s.includes("Cimento"), "dado desenhado");
  assert.ok(s.trimEnd().endsWith("%%EOF"), "termina com %%EOF");
  assert.ok(s.includes("\nxref\n") && s.includes("startxref"), "tem xref");
});

test("PDF — muitas linhas paginam (mais de uma página)", () => {
  const muitas = { titulo: "T", colunas: ["A"], linhas: Array.from({ length: 200 }, (_, i) => ["v" + i]) };
  const s = latin1(gerarPDF(muitas));
  const nPaginas = (s.match(/\/Type \/Page[^s]/g) || []).length;
  assert.ok(nPaginas >= 2, "deve quebrar em várias páginas: " + nPaginas);
});

test("nomeArquivo — slug sem acento/espaço", () => {
  assert.equal(nomeArquivo("Mesa com despesas da obra"), "mesa-com-despesas-da-obra");
  assert.equal(nomeArquivo("Cotações · Itens!"), "cotacoes-itens");
  assert.equal(nomeArquivo(""), "tabela");
});

test("XLSX — colunas além de Z (AA) ok", () => {
  const cols = Array.from({ length: 28 }, (_, i) => "C" + i);
  const u8 = gerarXLSX({ titulo: "X", colunas: cols, linhas: [cols.map((_, i) => "v" + i)] });
  const s = latin1(u8);
  assert.ok(s.includes('r="AA1"'), "coluna 27 = AA");
  assert.ok(s.includes('r="AB1"'), "coluna 28 = AB");
});
