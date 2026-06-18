/**
 * Lock.gs — Serialização de escritas no Sheets.
 *
 * Princípio nº 8: toda mutação ocorre sob LockService + flush(). Sem isso,
 * escritas concorrentes em `appendRow`/`getLastRow` corrompem linhas (race).
 *
 * Uso:
 *   return comLock(function () {
 *     ... leituras e escritas ...
 *     return resultado;
 *   });
 */
function comLock(fn) {
  const lock = LockService.getScriptLock();
  // Espera até 20s para adquirir o lock; lança se não conseguir.
  const adquiriu = lock.tryLock(20000);
  if (!adquiriu) {
    lancar(ERRO.CONFLITO, "Sistema ocupado, tente novamente em instantes.");
  }
  try {
    const resultado = fn();
    // Garante que tudo foi efetivamente gravado antes de liberar o lock.
    SpreadsheetApp.flush();
    return resultado;
  } finally {
    lock.releaseLock();
  }
}
