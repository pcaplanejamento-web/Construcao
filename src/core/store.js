/**
 * store.js — Store reativo mínimo (estado + assinatura).
 *
 * Usado por views para manter dados (lista de obras, despesas, resumo) e
 * notificar componentes quando mudam, sem framework.
 */

/** Cria um store com um estado inicial. */
export function criarStore(inicial = {}) {
  let estado = { ...inicial };
  const ouvintes = new Set();

  function notificar() {
    ouvintes.forEach((fn) => fn(estado));
  }

  return {
    /** Retorna o estado atual (imutável por convenção). */
    get() {
      return estado;
    },

    /** Substitui o estado por um novo objeto (merge raso). */
    set(parcial) {
      estado = { ...estado, ...parcial };
      notificar();
    },

    /** Atualiza via função (recebe estado atual, retorna parcial). */
    update(fn) {
      estado = { ...estado, ...fn(estado) };
      notificar();
    },

    /** Inscreve ouvinte; chama imediatamente com o estado atual. Retorna unsub. */
    subscribe(fn) {
      ouvintes.add(fn);
      fn(estado);
      return () => ouvintes.delete(fn);
    },
  };
}
