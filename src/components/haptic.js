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

/**
 * `pulso(el)` — micro-animação de "press" (afunda e volta, estilo iOS) para dar
 * o feedback VISUAL de toque onde a vibração não existe (ex.: iPhone, que não
 * expõe a Vibration API à web). Usa a Web Animations API → funciona dentro de
 * qualquer Shadow DOM sem CSS extra. Respeita `prefers-reduced-motion` e é no-op
 * silencioso onde `element.animate` não existe.
 */
export function pulso(el, escala = 0.94, ms = 200) {
  try {
    if (!el || typeof el.animate !== "function") return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [{ transform: "scale(1)" }, { transform: `scale(${escala})`, offset: 0.35 }, { transform: "scale(1)" }],
      { duration: ms, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
  } catch (_) {
    /* WAAPI indisponível — ignora. */
  }
}

/** Feedback de toque PADRÃO: vibração (onde há) + pulso visual (em todo lugar). */
export function feedbackToque(el, ms = HAPTICO.toque, escala = 0.94) {
  vibrar(ms);
  pulso(el, escala);
}
