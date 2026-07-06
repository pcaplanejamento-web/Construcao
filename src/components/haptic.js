/**
 * haptic.js — Feedback TÁTIL leve para gestos de toque (primitivo compartilhado).
 *
 * `vibrar(ms)` dá um toque curto no motor de vibração do aparelho — a "sensação"
 * de selecionar/editar um componente. É best-effort: onde a Vibration API não
 * existe (ex.: iOS Safari, desktop) vira no-op silencioso, sem erro.
 *
 * Padrões nomeados (curtos, discretos — "leve vibramento"):
 *   toque      → tique ao cruzar o limiar de uma ação (arraste "armado")
 *   selecionar → entrar em modo seleção (segurar)
 *   acao       → disparar editar/excluir
 *   aba        → trocar de aba (paginação)
 */
export const HAPTICO = { toque: 8, selecionar: 14, acao: 20, aba: 10 };

export function vibrar(ms = HAPTICO.toque) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch (_) {
    /* Vibration API indisponível/bloqueada — ignora. */
  }
}
