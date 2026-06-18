/**
 * SheetRepo.gs — Acesso genérico ao Google Sheets.
 *
 * Trabalha sempre a partir de uma definição do SCHEMA (Schema.gs), montando um
 * mapa nome->índice a partir da linha de cabeçalho. Lê a aba inteira uma vez e
 * filtra em memória (princípio de leitura eficiente). Nenhuma escrita aqui faz
 * lock por conta própria — quem chama deve envolver em comLock() (Lock.gs)
 * quando for mutação.
 */

/** Retorna a planilha-banco. Usa SPREADSHEET_ID das Script Properties; se
 *  ausente, cai para a planilha ativa (caso o script seja vinculado). */
function _planilha() {
  const id = PropertiesService.getScriptProperties().getProperty(
    "SPREADSHEET_ID"
  );
  if (id) return SpreadsheetApp.openById(id);
  const ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) return ativa;
  throw new ErroApp(
    ERRO.INTERNO,
    "SPREADSHEET_ID não configurado nas Script Properties."
  );
}

/** Obtém (ou cria) a aba de um schema, garantindo a linha de cabeçalho. */
function _abaDe(def) {
  const ss = _planilha();
  let aba = ss.getSheetByName(def.aba);
  if (!aba) {
    aba = ss.insertSheet(def.aba);
    aba.appendRow(def.colunas);
    aba.setFrozenRows(1);
  }
  return aba;
}

/** Constrói { nomeColuna: índiceZeroBased } a partir do schema. */
function _indiceColunas(def) {
  const mapa = {};
  def.colunas.forEach(function (nome, i) {
    mapa[nome] = i;
  });
  return mapa;
}

/** Converte uma linha (array) em objeto usando o schema. */
function _linhaParaObjeto(def, linha) {
  const obj = {};
  def.colunas.forEach(function (nome, i) {
    obj[nome] = linha[i];
  });
  return obj;
}

/** Converte um objeto em array ordenado conforme o schema (faltantes => ""). */
function _objetoParaLinha(def, obj) {
  return def.colunas.map(function (nome) {
    const v = obj[nome];
    return v === undefined || v === null ? "" : v;
  });
}

/** Lista todas as linhas de dados como objetos (sem o cabeçalho). */
function repoListar(def) {
  const aba = _abaDe(def);
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return []; // só cabeçalho.
  const valores = aba
    .getRange(2, 1, ultimaLinha - 1, def.colunas.length)
    .getValues();
  return valores.map(function (linha) {
    return _linhaParaObjeto(def, linha);
  });
}

/** Retorna o primeiro objeto que satisfaz o predicado, ou null. */
function repoEncontrar(def, predicado) {
  const linhas = repoListar(def);
  for (let i = 0; i < linhas.length; i++) {
    if (predicado(linhas[i])) return linhas[i];
  }
  return null;
}

/** Retorna todos os objetos que satisfazem o predicado. */
function repoFiltrar(def, predicado) {
  return repoListar(def).filter(predicado);
}

/** Acrescenta um objeto como nova linha. Deve rodar sob comLock(). */
function repoInserir(def, obj) {
  const aba = _abaDe(def);
  aba.appendRow(_objetoParaLinha(def, obj));
  return obj;
}

/**
 * Atualiza a primeira linha cujo `colId` == `valorId`, aplicando `patch`
 * (objeto parcial). Retorna o objeto atualizado ou null se não achou.
 * Deve rodar sob comLock().
 */
function repoAtualizar(def, colId, valorId, patch) {
  const aba = _abaDe(def);
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;
  const idx = _indiceColunas(def);
  const colIdIdx = idx[colId];
  const valores = aba
    .getRange(2, 1, ultimaLinha - 1, def.colunas.length)
    .getValues();

  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][colIdIdx]) === String(valorId)) {
      const atual = _linhaParaObjeto(def, valores[i]);
      const novo = Object.assign({}, atual, patch);
      const linhaPlanilha = i + 2; // +1 cabeçalho, +1 base-1.
      aba
        .getRange(linhaPlanilha, 1, 1, def.colunas.length)
        .setValues([_objetoParaLinha(def, novo)]);
      return novo;
    }
  }
  return null;
}

/**
 * Remove a primeira linha cujo `colId` == `valorId`.
 * Retorna true se removeu. Deve rodar sob comLock().
 */
function repoRemover(def, colId, valorId) {
  const aba = _abaDe(def);
  const ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return false;
  const idx = _indiceColunas(def);
  const colIdIdx = idx[colId];
  const valores = aba
    .getRange(2, 1, ultimaLinha - 1, def.colunas.length)
    .getValues();

  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][colIdIdx]) === String(valorId)) {
      aba.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

/** Gera um identificador único (UUID). */
function novoId() {
  return Utilities.getUuid();
}

/** Carimbo de data/hora ISO no fuso do projeto. */
function agoraIso() {
  return new Date().toISOString();
}
