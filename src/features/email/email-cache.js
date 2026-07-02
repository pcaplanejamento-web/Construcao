/**
 * email-cache.js — Cache leve da caixa de e-mail. O Gmail é AO VIVO, então não
 * entra no snapshot do data-store; este cache (nível de módulo, sobrevive à
 * recriação da view pelo roteador) permite abrir a aba **instantâneo** e
 * atualizar em segundo plano. A Entrada e os remetentes também são espelhados
 * em localStorage (instantâneo entre reloads).
 */
const CHAVE = "dattaobra.email.cache.v1";
const mem = { caixas: {}, remetentes: null };

function _lerLocal() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { return {}; }
}
function _gravarLocal(obj) {
  try { localStorage.setItem(CHAVE, JSON.stringify(obj)); } catch (e) { /* storage cheio/indisponível */ }
}

// Hidrata a memória a partir do localStorage no carregamento do módulo.
(() => {
  const l = _lerLocal();
  if (Array.isArray(l.inbox)) mem.caixas.inbox = { threads: l.inbox, ts: l.ts || 0 };
  if (l.remetentes) mem.remetentes = l.remetentes;
})();

export const emailCache = {
  /** Lista em cache de uma caixa (ou null). */
  getLista(caixa) { const c = mem.caixas[caixa]; return c ? c.threads : null; },
  /** Guarda a lista de uma caixa (Entrada também vai p/ o localStorage). */
  setLista(caixa, threads) {
    mem.caixas[caixa] = { threads: threads, ts: Date.now() };
    if (caixa === "inbox") { const l = _lerLocal(); l.inbox = threads; l.ts = Date.now(); _gravarLocal(l); }
  },
  /** Invalida uma caixa (ou todas, sem argumento). */
  invalidar(caixa) { if (caixa) delete mem.caixas[caixa]; else mem.caixas = {}; },
  getRemetentes() { return mem.remetentes; },
  setRemetentes(r) { mem.remetentes = r; const l = _lerLocal(); l.remetentes = r; _gravarLocal(l); },
};
