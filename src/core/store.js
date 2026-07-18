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

  // Cada assinante é ISOLADO: se um componente lançar ao repintar, os IRMÃOS ainda
  // atualizam e a EXCEÇÃO NÃO sobe pelo `set()` que a disparou (senão o try/catch de uma
  // mutação faria rollback de uma gravação que o servidor já aceitou). Loga p/ diagnóstico.
  function _seguro(fn) {
    try {
      fn(estado);
    } catch (e) {
      try { console.error("[store] assinante falhou ao repintar:", e); } catch (e2) {}
    }
  }

  function notificar() {
    ouvintes.forEach(_seguro);
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
      _seguro(fn); // a chamada imediata também é isolada
      return () => ouvintes.delete(fn);
    },
  };
}
