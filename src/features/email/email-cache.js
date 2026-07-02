/**
 * email-cache.js — Cache leve da caixa de e-mail. O Gmail é AO VIVO, então não
 * entra no snapshot do data-store; este cache (nível de módulo, sobrevive à
 * recriação da view pelo roteador) permite abrir a aba **instantâneo** e
 * atualizar em segundo plano.
 *
 * - `caixas`: lista de cada pasta (Entrada, Enviados, Com estrela, Rascunhos,
 *   Lixeira, marcadores). TODAS são espelhadas em localStorage → instantâneo
 *   entre reloads. O <email-view> ainda faz **prefetch** das outras pastas ao
 *   entrar, para que trocar de aba não tenha espera.
 * - `conversas`: corpo já lido de uma thread (por threadId). Só em memória
 *   (corpos podem ser grandes) → reabrir um e-mail é instantâneo na sessão.
 */
const CHAVE = "dattaobra.email.cache.v1";
const mem = { caixas: {}, conversas: {}, remetentes: null };

function _lerLocal() {
  try { return JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { return {}; }
}
function _gravarLocal(obj) {
  try { localStorage.setItem(CHAVE, JSON.stringify(obj)); } catch (e) { /* storage cheio/indisponível */ }
}

// Hidrata a memória a partir do localStorage no carregamento do módulo.
(() => {
  const l = _lerLocal();
  if (l.caixas && typeof l.caixas === "object") {
    Object.keys(l.caixas).forEach((k) => {
      if (Array.isArray(l.caixas[k])) mem.caixas[k] = { threads: l.caixas[k], ts: l.ts || 0 };
    });
  }
  if (Array.isArray(l.inbox) && !mem.caixas.inbox) mem.caixas.inbox = { threads: l.inbox, ts: l.ts || 0 }; // compat v0
  if (l.remetentes) mem.remetentes = l.remetentes;
})();

function _persistir() {
  const l = _lerLocal();
  const caixas = {};
  Object.keys(mem.caixas).forEach((k) => { caixas[k] = mem.caixas[k].threads; });
  l.caixas = caixas; l.ts = Date.now();
  delete l.inbox; // migrou para caixas.inbox
  _gravarLocal(l);
}

export const emailCache = {
  /* ---- Listas por pasta (persistidas) ---- */
  getLista(caixa) { const c = mem.caixas[caixa]; return c ? c.threads : null; },
  setLista(caixa, threads) { mem.caixas[caixa] = { threads: threads, ts: Date.now() }; _persistir(); },
  invalidar(caixa) { if (caixa) delete mem.caixas[caixa]; else mem.caixas = {}; _persistir(); },

  /* ---- Conversas lidas (só memória) ---- */
  getConversa(id) { const c = id && mem.conversas[id]; return c ? c.dados : null; },
  setConversa(id, dados) { if (id) mem.conversas[id] = { dados: dados, ts: Date.now() }; },
  invalidarConversa(id) { if (id) delete mem.conversas[id]; else mem.conversas = {}; },

  /* ---- Remetentes (persistidos) ---- */
  getRemetentes() { return mem.remetentes; },
  setRemetentes(r) { mem.remetentes = r; const l = _lerLocal(); l.remetentes = r; _gravarLocal(l); },
};
