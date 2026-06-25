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
// .xls BINÁRIO real (BIFF8) dentro de um contêiner OLE2/CFB — abre LIMPO no Excel
// (sem o aviso "formato e extensão não conferem" do antigo truque HTML-as-xls).

/** Escritor de bytes little-endian (array → Uint8Array). */
function _bytes() {
  const a = [];
  return {
    a,
    u8: (v) => a.push(v & 0xff),
    u16: (v) => a.push(v & 0xff, (v >>> 8) & 0xff),
    u32: (v) => a.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff),
    push: (arr) => arr.forEach((b) => a.push(b & 0xff)),
    /** string Latin-1 (1 byte/char; >255 → "?"). */
    latin1: (s) => {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        a.push(c <= 255 ? c : 63);
      }
    },
  };
}
const _latin1Bytes = (s) => {
  const w = _bytes();
  w.latin1(String(s || ""));
  return w.a;
};
/** Registro BIFF: tipo(2) + tamanho(2) + dados. */
const _biffRec = (tipo, dados) => {
  const w = _bytes();
  w.u16(tipo);
  w.u16(dados.length);
  w.push(dados);
  return w.a;
};

/** Monta o stream "Workbook" (BIFF8): globais (BOF/WINDOW1/FONT/16×XF/BOUNDSHEET/EOF) + planilha. */
function _xlsWorkbook(nomePlanilha, colunas, linhas) {
  const bof = (dt) => {
    const w = _bytes();
    w.u16(0x0600); // versão BIFF8
    w.u16(dt); // 0x0005 globais | 0x0010 worksheet
    w.u16(0);
    w.u16(0);
    w.u32(0);
    w.u32(0);
    return _biffRec(0x0809, w.a);
  };
  const EOF = _biffRec(0x000a, []);

  // ---- Globais (menos o offset do BOUNDSHEET, calculado depois) ----
  const window1 = (() => {
    const w = _bytes();
    [0, 0, 0x4000, 0x2000, 0x38, 0, 0, 1, 0x0258].forEach((v) => w.u16(v));
    return _biffRec(0x003d, w.a);
  })();
  const font = (() => {
    const w = _bytes();
    w.u16(200); // altura
    w.u16(0);
    w.u16(0x7fff); // cor automática
    w.u16(400); // peso normal
    w.u16(0);
    w.u8(0);
    w.u8(0);
    w.u8(0);
    w.u8(0);
    const nome = "Arial";
    w.u8(nome.length);
    w.u8(0); // string comprimida (1 byte/char)
    w.latin1(nome);
    return _biffRec(0x0031, w.a);
  })();
  const xf = (estilo) => {
    const w = _bytes();
    w.u16(0); // ifnt
    w.u16(0); // ifmt
    w.u16(estilo ? 0xfff4 : 0x0000); // fStyle + ixfParent (estilo) | XF de célula
    w.u8(0);
    w.u8(0);
    w.u8(0);
    w.u8(0);
    w.u32(0);
    w.u16(0);
    w.u16(0);
    w.u16(0);
    return _biffRec(0x00e0, w.a);
  };
  const xfs = [];
  for (let i = 0; i < 16; i++) xfs.push(xf(i < 15)); // 15 XF de estilo + 1 de célula (índice 15)

  const nomeBytes = _latin1Bytes(nomePlanilha);
  const boundsheetLen = 4 + (4 + 2 + 1 + 1 + nomeBytes.length); // header + dados
  const globaisAntesLen =
    bof(0x0005).length + window1.length + font.length + xfs.reduce((s, r) => s + r.length, 0);
  const sheetOffset = globaisAntesLen + boundsheetLen + EOF.length; // onde começa o BOF da planilha

  const boundsheet = (() => {
    const w = _bytes();
    w.u32(sheetOffset); // lbPlyPos (offset absoluto do BOF da planilha no stream)
    w.u16(0); // grbit: visível, worksheet
    w.u8(nomeBytes.length);
    w.u8(0); // string comprimida
    w.push(nomeBytes);
    return _biffRec(0x0085, w.a);
  })();

  // ---- Planilha ----
  const nRows = Math.min(linhas.length + 1, 65536); // +1 = cabeçalho
  const nCols = Math.min(colunas.length, 256);
  const dimension = (() => {
    const w = _bytes();
    w.u32(0); // rwMic
    w.u32(nRows); // rwMac (última linha + 1)
    w.u16(0); // colMic
    w.u16(nCols); // colMac (última coluna + 1)
    w.u16(0);
    return _biffRec(0x0200, w.a);
  })();
  const label = (r, c, texto) => {
    const s = String(texto == null ? "" : texto).slice(0, 255);
    const sb = _latin1Bytes(s);
    const w = _bytes();
    w.u16(r);
    w.u16(c);
    w.u16(15); // ixfe = XF de célula
    w.u16(sb.length); // cch
    w.u8(0); // grbit: comprimida (Latin-1)
    w.push(sb);
    return _biffRec(0x0204, w.a);
  };
  const celulas = [];
  const linha0 = [colunas, ...linhas];
  for (let r = 0; r < nRows; r++) {
    const arr = linha0[r] || [];
    for (let c = 0; c < nCols; c++) celulas.push(label(r, c, arr[c]));
  }

  // ---- Junta tudo ----
  const out = _bytes();
  out.push(bof(0x0005));
  out.push(window1);
  out.push(font);
  xfs.forEach((r) => out.push(r));
  out.push(boundsheet);
  out.push(EOF);
  out.push(bof(0x0010));
  out.push(dimension);
  celulas.forEach((r) => out.push(r));
  out.push(EOF);
  return Uint8Array.from(out.a);
}

/** Empacota um stream "Workbook" num arquivo OLE2/CFB (.xls). */
function _ole2Workbook(workbook) {
  const SETOR = 512;
  const NOSTREAM = 0xffffffff;
  const ENDOFCHAIN = 0xfffffffe;
  const FATSECT = 0xfffffffd;
  const FREESECT = 0xffffffff;
  const nData = Math.max(1, Math.ceil(workbook.length / SETOR));
  // Quantos setores de FAT são necessários (itera até estabilizar).
  let nFAT = 1;
  for (;;) {
    const total = nFAT + 1 + nData; // FAT + diretório + dados
    const need = Math.ceil(total / 128);
    if (need <= nFAT) break;
    nFAT = need;
  }
  const dirSetor = nFAT;
  const dataInicio = nFAT + 1;

  // FAT
  const fat = new Array(nFAT * 128).fill(FREESECT);
  for (let i = 0; i < nFAT; i++) fat[i] = FATSECT;
  fat[dirSetor] = ENDOFCHAIN;
  for (let i = 0; i < nData; i++) {
    const s = dataInicio + i;
    fat[s] = i === nData - 1 ? ENDOFCHAIN : s + 1;
  }

  // Cabeçalho (512 bytes)
  const H = _bytes();
  H.push([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  for (let i = 0; i < 16; i++) H.u8(0); // CLSID
  H.u16(0x003e);
  H.u16(0x0003); // versão 3 (setores de 512)
  H.u16(0xfffe); // byte order
  H.u16(0x0009); // sectorShift (512)
  H.u16(0x0006); // miniSectorShift (64)
  H.u16(0);
  H.u32(0); // reservado (6 bytes)
  H.u32(0); // numDirSectors (0 na v3)
  H.u32(nFAT);
  H.u32(dirSetor);
  H.u32(0); // transaction sig
  H.u32(0x1000); // corte do mini-stream (4096)
  H.u32(ENDOFCHAIN); // 1º setor mini-FAT (nenhum)
  H.u32(0); // num mini-FAT
  H.u32(ENDOFCHAIN); // 1º DIFAT
  H.u32(0); // num DIFAT
  for (let i = 0; i < 109; i++) H.u32(i < nFAT ? i : FREESECT); // DIFAT inline

  // Setores de FAT
  const F = _bytes();
  fat.forEach((v) => F.u32(v));

  // Diretório (1 setor = 4 entradas × 128)
  const entrada = (nome, tipo, startSec, tam, child) => {
    const e = _bytes();
    for (let i = 0; i < 32; i++) e.u16(i < nome.length ? nome.charCodeAt(i) : 0);
    e.u16(nome.length ? (nome.length + 1) * 2 : 0); // nameLen (com terminador)
    e.u8(tipo); // 5=root, 2=stream, 0=vazio
    e.u8(1); // cor preta
    e.u32(NOSTREAM); // irmão esq.
    e.u32(NOSTREAM); // irmão dir.
    e.u32(child); // filho
    for (let i = 0; i < 16; i++) e.u8(0); // CLSID
    e.u32(0); // state
    e.u32(0);
    e.u32(0); // creation
    e.u32(0);
    e.u32(0); // modified
    e.u32(startSec);
    e.u32(tam);
    e.u32(0); // streamSize hi
    return e.a;
  };
  const D = _bytes();
  D.push(entrada("Root Entry", 5, ENDOFCHAIN, 0, 1)); // child = Workbook (índice 1)
  D.push(entrada("Workbook", 2, dataInicio, workbook.length, NOSTREAM));
  D.push(entrada("", 0, ENDOFCHAIN, 0, NOSTREAM));
  D.push(entrada("", 0, ENDOFCHAIN, 0, NOSTREAM));

  // Monta o arquivo: cabeçalho + FAT + diretório + dados (padded).
  const total = SETOR + nFAT * SETOR + SETOR + nData * SETOR;
  const buf = new Uint8Array(total);
  let p = 0;
  const escreve = (arr) => {
    buf.set(Uint8Array.from(arr), p);
    p += arr.length;
  };
  escreve(H.a); // 512
  escreve(F.a); // nFAT*512
  escreve(D.a); // 512
  buf.set(workbook, p); // dados (resto fica 0 = padding)
  return buf;
}

export function gerarXLS({ titulo, colunas, linhas }) {
  const workbook = _xlsWorkbook(_sheetName(titulo), colunas, linhas);
  return _ole2Workbook(workbook);
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
  const W = 842; // A4 paisagem
  const H = 595;
  const M = 36;
  const usable = W - 2 * M;
  const ncol = Math.max(1, colunas.length);
  const fs = 8.5; // corpo
  const fsH = 8.5; // cabeçalho
  const lh = 13; // altura da linha
  const pad = 3; // recuo interno de cada coluna
  // COURIER é monoespaçada: cada glifo = 600/1000 em → largura EXATA por caractere.
  // Assim a truncagem por nº de caracteres NUNCA estoura a célula (nada fora dela).
  const larguraChar = (size) => size * 0.6;
  // Larguras proporcionais ao maior conteúdo de cada coluna (limitado p/ não dominar).
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
  // Máx. de caracteres por coluna (e por tamanho de fonte) que CABEM na largura útil.
  const maxCh = (i, size) => Math.max(1, Math.floor((colW[i] - 2 * pad) / larguraChar(size)));
  const corta = (v, i, size) => {
    const s = String(v == null ? "" : v);
    const m = maxCh(i, size);
    return s.length > m ? s.slice(0, m) : s;
  };
  const cortaTitulo = (s) => {
    const m = Math.max(1, Math.floor(usable / larguraChar(13)));
    s = String(s || "");
    return s.length > m ? s.slice(0, m) : s;
  };

  // Monta as páginas (cada uma é um content stream). F1=Courier (corpo), F2=Courier-Bold.
  const paginas = [];
  let conteudo = "";
  let y = 0;
  const novaPagina = (primeira) => {
    if (conteudo) paginas.push(conteudo);
    conteudo = "";
    y = H - M;
    if (primeira && titulo) {
      conteudo += `BT /F2 13 Tf ${M} ${(y - 12).toFixed(1)} Td (${_pdfEscape(cortaTitulo(titulo))}) Tj ET\n`;
      y -= 28;
    }
    colunas.forEach((t, i) => {
      conteudo += `BT /F2 ${fsH} Tf ${(colX[i] + pad).toFixed(1)} ${(y - 10).toFixed(1)} Td (${_pdfEscape(corta(t, i, fsH))}) Tj ET\n`;
    });
    y -= 14;
    conteudo += `${M} ${y.toFixed(1)} m ${(W - M).toFixed(1)} ${y.toFixed(1)} l S\n`; // linha sob o cabeçalho
    y -= 4;
  };
  novaPagina(true);
  linhas.forEach((r) => {
    if (y < M + lh) novaPagina(false);
    for (let i = 0; i < ncol; i++) {
      conteudo += `BT /F1 ${fs} Tf ${(colX[i] + pad).toFixed(1)} ${(y - 10).toFixed(1)} Td (${_pdfEscape(corta(r[i], i, fs))}) Tj ET\n`;
    }
    y -= lh;
  });
  if (conteudo) paginas.push(conteudo);
  if (!paginas.length) paginas.push("");

  // Monta os objetos do PDF.
  const nPag = paginas.length;
  const objs = []; // strings dos objetos (1-based, índice 0 vazio)
  const pageNum = (p) => 5 + 2 * p;
  const contNum = (p) => 6 + 2 * p;
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = paginas.map((_, p) => `${pageNum(p)} 0 R`).join(" ");
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${nPag} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>";
  paginas.forEach((c, p) => {
    objs[pageNum(p)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contNum(p)} 0 R >>`;
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
