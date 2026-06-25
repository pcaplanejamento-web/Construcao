/**
 * exportar-tabela.js — Exporta uma tabela (mesa) em CSV, XLS, XLSX e PDF.
 *
 * SEM dependências externas (mantém a arquitetura vanilla / served-raw):
 *  - CSV  → texto (RFC 4180, com BOM p/ acentos no Excel).
 *  - XLS  → tabela HTML com MIME do Excel (abre no Excel/LibreOffice).
 *  - XLSX → OOXML real, zipado por um escritor ZIP "stored" (CRC32) próprio.
 *  - PDF  → PDF 1.4 real (Helvetica/WinAnsi), paisagem A4, com paginação.
 *
 * A camada de GERAÇÃO é pura (recebe { titulo, colunas:[string], linhas:[[string]] }
 * e devolve string/Uint8Array) — testável com `node --test`. Só `baixarTabela`
 * toca o DOM (cria o Blob + dispara o download).
 */

/* ------------------------------ Utilidades --------------------------------- */

const _te = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
function _utf8(s) {
  if (_te) return _te.encode(s);
  // Fallback simples (ambientes sem TextEncoder).
  const arr = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) arr.push(c);
    else if (c < 2048) arr.push(192 | (c >> 6), 128 | (c & 63));
    else arr.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
  }
  return Uint8Array.from(arr);
}

function _xmlEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Nome de arquivo seguro a partir do título da mesa. */
export function nomeArquivo(titulo) {
  const base = String(titulo || "tabela")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return base || "tabela";
}

/* --------------------------------- CSV ------------------------------------- */

export function gerarCSV({ colunas, linhas }) {
  const sep = ";"; // Excel pt-BR usa ; como separador de lista (vírgula = decimal)
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /["\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const linha = (arr) => arr.map(esc).join(sep);
  return [linha(colunas), ...linhas.map(linha)].join("\r\n");
}

/* --------------------------------- XLS ------------------------------------- */
// Tabela HTML com MIME do Excel — abre como planilha no Excel/LibreOffice.

export function gerarXLS({ titulo, colunas, linhas }) {
  const th = colunas.map((c) => `<th>${_xmlEscape(c)}</th>`).join("");
  const trs = linhas
    .map((r) => `<tr>${r.map((v) => `<td>${_xmlEscape(v)}</td>`).join("")}</tr>`)
    .join("");
  return (
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
    "<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
    `<x:Name>${_xmlEscape(_sheetName(titulo))}</x:Name>` +
    "<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>" +
    "</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->" +
    "<style>th{background:#eef;font-weight:bold;text-align:left}td,th{border:1px solid #ccc;padding:4px}</style>" +
    `</head><body><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`
  );
}

function _sheetName(titulo) {
  return String(titulo || "Planilha").replace(/[\[\]:*?/\\]/g, " ").slice(0, 31) || "Planilha";
}

/* --------------------------------- XLSX ------------------------------------ */
// OOXML real + ZIP "stored" próprio (sem libs).

let _crcTabela = null;
function _crc32(bytes) {
  if (!_crcTabela) {
    _crcTabela = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      _crcTabela[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ _crcTabela[(crc ^ bytes[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

/** Escritor ZIP no método STORED (sem compressão). files: [{name, data:Uint8Array}]. */
function _zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (a, v) => a.push(v & 0xff, (v >>> 8) & 0xff);
  const u32 = (a, v) => a.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  files.forEach((f) => {
    const nome = _utf8(f.name);
    const crc = _crc32(f.data);
    const local = [];
    u32(local, 0x04034b50);
    u16(local, 20);
    u16(local, 0x0800); // UTF-8
    u16(local, 0); // método 0 = stored
    u16(local, 0); // hora
    u16(local, 0x21); // data 1980-01-01
    u32(local, crc);
    u32(local, f.data.length);
    u32(local, f.data.length);
    u16(local, nome.length);
    u16(local, 0);
    nome.forEach((b) => local.push(b));
    const localBytes = Uint8Array.from(local);
    chunks.push(localBytes, f.data);
    const cd = [];
    u32(cd, 0x02014b50);
    u16(cd, 20);
    u16(cd, 20);
    u16(cd, 0x0800);
    u16(cd, 0);
    u16(cd, 0);
    u16(cd, 0x21);
    u32(cd, crc);
    u32(cd, f.data.length);
    u32(cd, f.data.length);
    u16(cd, nome.length);
    u16(cd, 0);
    u16(cd, 0);
    u16(cd, 0);
    u16(cd, 0);
    u32(cd, 0);
    u32(cd, offset);
    nome.forEach((b) => cd.push(b));
    central.push(Uint8Array.from(cd));
    offset += localBytes.length + f.data.length;
  });
  const cdInicio = offset;
  let cdTam = 0;
  central.forEach((c) => {
    chunks.push(c);
    cdTam += c.length;
    offset += c.length;
  });
  const eocd = [];
  const e16 = (v) => eocd.push(v & 0xff, (v >>> 8) & 0xff);
  const e32 = (v) => eocd.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  e32(0x06054b50);
  e16(0);
  e16(0);
  e16(files.length);
  e16(files.length);
  e32(cdTam);
  e32(cdInicio);
  e16(0);
  chunks.push(Uint8Array.from(eocd));
  let total = 0;
  chunks.forEach((c) => (total += c.length));
  const out = new Uint8Array(total);
  let p = 0;
  chunks.forEach((c) => {
    out.set(c, p);
    p += c.length;
  });
  return out;
}

function _colLetra(n) {
  let s = "";
  let i = n + 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

export function gerarXLSX({ titulo, colunas, linhas }) {
  const todas = [colunas, ...linhas];
  const linhasXml = todas
    .map((arr, r) => {
      const cels = arr
        .map((v, c) => {
          const ref = _colLetra(c) + (r + 1);
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${_xmlEscape(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cels}</row>`;
    })
    .join("");
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${linhasXml}</sheetData></worksheet>`;
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${_xmlEscape(_sheetName(titulo))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const wbRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  return _zip([
    { name: "[Content_Types].xml", data: _utf8(contentTypes) },
    { name: "_rels/.rels", data: _utf8(rels) },
    { name: "xl/workbook.xml", data: _utf8(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: _utf8(wbRels) },
    { name: "xl/worksheets/sheet1.xml", data: _utf8(sheet) },
  ]);
}

/* --------------------------------- PDF ------------------------------------- */
// PDF 1.4 real (Helvetica/WinAnsi), paisagem A4, com paginação.

function _pdfEscape(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
// Bytes WinAnsi (cada char vira 1 byte; >255 → "?"). Acentos pt-BR (0xC0–0xFF) batem.
function _winAnsiBytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    out[i] = c <= 255 ? c : 63;
  }
  return out;
}

export function gerarPDF({ titulo, colunas, linhas }) {
  const W = 842;
  const H = 595;
  const M = 36;
  const usable = W - 2 * M;
  const ncol = Math.max(1, colunas.length);
  const fs = 8; // corpo
  const fsH = 9; // cabeçalho
  const charW = fs * 0.5; // largura média aprox. (Helvetica)
  const lh = 13; // altura da linha
  // Larguras proporcionais ao maior conteúdo de cada coluna (limitado).
  const compr = colunas.map((t, i) => {
    let max = String(t || "").length;
    linhas.forEach((r) => (max = Math.max(max, String(r[i] == null ? "" : r[i]).length)));
    return Math.max(4, Math.min(max, 40));
  });
  const somaC = compr.reduce((a, b) => a + b, 0) || 1;
  const colW = compr.map((c) => (usable * c) / somaC);
  const colX = [];
  let acc = M;
  for (let i = 0; i < ncol; i++) {
    colX.push(acc);
    acc += colW[i];
  }
  const maxCh = colW.map((w) => Math.max(2, Math.floor((w - 4) / charW)));
  const corta = (v, i) => {
    const s = String(v == null ? "" : v);
    return s.length > maxCh[i] ? s.slice(0, maxCh[i]) : s;
  };

  // Monta as páginas (cada uma é um content stream).
  const paginas = [];
  let conteudo = "";
  let y = 0;
  const novaPagina = (primeira) => {
    if (conteudo) paginas.push(conteudo);
    conteudo = "";
    y = H - M;
    if (primeira && titulo) {
      conteudo += `BT /F1 14 Tf ${M} ${y - 12} Td (${_pdfEscape(titulo)}) Tj ET\n`;
      y -= 28;
    }
    // Cabeçalho da tabela.
    colunas.forEach((t, i) => {
      conteudo += `BT /F1 ${fsH} Tf ${colX[i].toFixed(1)} ${(y - 10).toFixed(1)} Td (${_pdfEscape(corta(t, i))}) Tj ET\n`;
    });
    y -= 14;
    conteudo += `${M} ${y.toFixed(1)} m ${(W - M).toFixed(1)} ${y.toFixed(1)} l S\n`; // linha sob o cabeçalho
    y -= 4;
  };
  novaPagina(true);
  linhas.forEach((r) => {
    if (y < M + lh) novaPagina(false);
    for (let i = 0; i < ncol; i++) {
      conteudo += `BT /F1 ${fs} Tf ${colX[i].toFixed(1)} ${(y - 10).toFixed(1)} Td (${_pdfEscape(corta(r[i], i))}) Tj ET\n`;
    }
    y -= lh;
  });
  if (conteudo) paginas.push(conteudo);
  if (!paginas.length) paginas.push("");

  // Monta os objetos do PDF.
  const nPag = paginas.length;
  const objs = []; // strings dos objetos (1-based, índice 0 vazio)
  const fonteNum = 3;
  const pageNum = (p) => 4 + 2 * p;
  const contNum = (p) => 5 + 2 * p;
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = paginas.map((_, p) => `${pageNum(p)} 0 R`).join(" ");
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${nPag} >>`;
  objs[fonteNum] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  paginas.forEach((c, p) => {
    objs[pageNum(p)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      `/Resources << /Font << /F1 ${fonteNum} 0 R >> >> /Contents ${contNum(p)} 0 R >>`;
    objs[contNum(p)] = { stream: c };
  });

  // Serializa com xref (offsets em bytes; cada char vira 1 byte → length = bytes).
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = pdf.length;
    const o = objs[i];
    if (o && o.stream != null) {
      const s = o.stream;
      pdf += `${i} 0 obj\n<< /Length ${s.length} >>\nstream\n${s}endstream\nendobj\n`;
    } else {
      pdf += `${i} 0 obj\n${o}\nendobj\n`;
    }
  }
  const xrefPos = pdf.length;
  const n = objs.length; // inclui o slot 0
  pdf += `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 1; i < n; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return _winAnsiBytes(pdf);
}

/* ------------------------------ Download ----------------------------------- */

const _MIME = {
  csv: "text/csv;charset=utf-8",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** Gera o conteúdo do formato pedido (string | Uint8Array). */
export function gerarConteudo(formato, dados) {
  if (formato === "csv") return "﻿" + gerarCSV(dados); // BOM p/ acento no Excel
  if (formato === "xls") return gerarXLS(dados);
  if (formato === "xlsx") return gerarXLSX(dados);
  if (formato === "pdf") return gerarPDF(dados);
  throw new Error("Formato desconhecido: " + formato);
}

/** Dispara o download (DOM). dados = { titulo, colunas:[string], linhas:[[string]] }. */
export function baixarTabela(formato, dados) {
  const conteudo = gerarConteudo(formato, dados);
  const blob = new Blob([conteudo], { type: _MIME[formato] || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo(dados.titulo) + "." + formato;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
