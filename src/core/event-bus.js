/**
 * event-bus.js — Barramento de eventos global (pub/sub).
 *
 * Princípio nº 4: componentes irmãos não se acoplam; comunicam-se por eventos
 * de aplicação publicados aqui. Estado compartilhado mora no `core/`.
 *
 * Construído sobre EventTarget + CustomEvent (plataforma nativa, sem libs).
 */

/** Canais de evento conhecidos da aplicação. */
export const EVENTOS = {
  AUTH: "auth:changed", // login/logout
  OBRAS: "obras:changed", // CRUD de obras
  DESPESAS: "despesas:changed", // CRUD de despesas
  TOAST: "toast", // notificação para o usuário
};

const alvo = new EventTarget();

export const bus = {
  /** Inscreve um ouvinte; retorna função para cancelar a inscrição. */
  on(evento, handler) {
    const wrapper = (e) => handler(e.detail, e);
    alvo.addEventListener(evento, wrapper);
    return () => alvo.removeEventListener(evento, wrapper);
  },

  /** Publica um evento com um payload (detail). */
  emit(evento, detail) {
    alvo.dispatchEvent(new CustomEvent(evento, { detail }));
  },
};

/* ------------------------- Atalhos de toast --------------------------- */

/** Emite uma notificação. tipo: sucesso | erro | info | aviso. */
export function notificar(tipo, mensagem) {
  bus.emit(EVENTOS.TOAST, { tipo, mensagem });
}

export const toastSucesso = (m) => notificar("sucesso", m);
export const toastErro = (m) => notificar("erro", m);
export const toastInfo = (m) => notificar("info", m);
export const toastAviso = (m) => notificar("aviso", m);

/** Converte um erro (ApiError ou Error) em toast amigável (princípio nº 12). */
export function notificarErro(e) {
  const msg = (e && e.message) || "Ocorreu um erro inesperado.";
  toastErro(msg);
}
