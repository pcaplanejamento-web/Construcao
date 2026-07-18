/**
 * cor-id.js — Cor ESTÁVEL derivada de um id/chave (hash → HSL).
 *
 * Mesma entrada → sempre a mesma matiz, sem precisar guardar cor no banco. Usada para
 * segmentar despesas por orçamento (despesa-table) e para colorir as fatias/barras dos
 * gráficos de participante/empresa/item/representante (obra-detail-view e afins).
 *
 * Vivia duplicada em despesa-table.js e obra-detail-view.js (a segunda cópia até
 * comentava que "espelha" a primeira) — fonte única aqui.
 */

/** Cor estável por id/chave. Entradas iguais devolvem sempre a mesma matiz. */
export function corDeId(id) {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${(h * 137) % 360} 62% 46%)`; // ×137 (coprimo de 360) espalha bem as matizes
}
