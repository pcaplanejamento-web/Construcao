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

test("XLS — binário OLE2/BIFF8 válido (abre limpo no Excel)", () => {
  const u8 = gerarXLS(dados);
  assert.ok(u8 instanceof Uint8Array && u8.length > 0);
  // Assinatura do contêiner OLE2/CFB.
  assert.deepEqual(Array.from(u8.slice(0, 8)), [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  assert.equal(u8.length % 512, 0, "tamanho múltiplo de 512 (setores)");
  // O stream Workbook está após cabeçalho + FAT(1) + diretório(1) = setor 2 → offset 512*3.
  const wbInicio = 512 * 3;
  const rd16 = (o) => u8[o] | (u8[o + 1] << 8);
  const rd32 = (o) => u8[o] | (u8[o + 1] << 8) | (u8[o + 2] << 16) | (u8[o + 3] << 24);
  assert.equal(rd16(wbInicio), 0x0809, "Workbook começa com BOF");
  assert.equal(rd16(wbInicio + 4), 0x0600, "versão BIFF8");
  // BOUNDSHEET (0x0085) aponta o offset onde há OUTRO BOF (a planilha).
  const s = Array.from(u8.slice(wbInicio), (b) => String.fromCharCode(b)).join("");
  // o nome da planilha (Latin-1) aparece literal no stream
  assert.ok(s.includes("Mesa com despesas da obra".slice(0, 31)), "nome da planilha presente");
  // texto das células (LABEL comprimido = Latin-1) aparece literal
  assert.ok(s.includes("Cimento CP-II"), "célula de texto presente");
  // localiza o BOUNDSHEET e valida que o lbPlyPos aponta para um BOF
  let off = wbInicio;
  let achou = -1;
  while (off < u8.length - 4) {
    const tipo = rd16(off);
    const len = rd16(off + 2);
    if (tipo === 0x0085) { achou = rd32(off + 4); break; }
    if (tipo === 0 && len === 0) break;
    off += 4 + len;
  }
  assert.ok(achou > 0, "BOUNDSHEET encontrado");
  assert.equal(rd16(wbInicio + achou), 0x0809, "lbPlyPos aponta para o BOF da planilha");
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
  assert.ok(s.includes("/BaseFont /Courier"), "fonte monoespaçada (largura exata)");
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
