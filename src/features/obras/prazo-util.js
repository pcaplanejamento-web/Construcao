/**
 * prazo-util.js — Cálculo do prazo/atraso da obra (funções PURAS), reusado no
 * detalhe da obra (banner de contagem regressiva), no card da lista e nas
 * marcações do calendário. Fonte única da conta de dias.
 */

/** A obra está marcada como finalizada? (aceita bool ou "TRUE"/"true" do Sheets). */
export function ehFinalizada(obra) {
  const v = obra && obra.finalizada;
  return v === true || v === "TRUE" || v === "true";
}

/** Dias até o prazo: >0 faltam, 0 hoje, <0 atrasada. null se sem prazo válido. */
export function diasRestantes(prazo) {
  const p = String(prazo || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(p + "T00:00:00");
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

/** "concluida" | "sem-prazo" | "atrasada" | "hoje" | "no-prazo". */
export function statusPrazo(obra) {
  if (ehFinalizada(obra)) return "concluida";
  const d = diasRestantes(obra && obra.prazo);
  if (d === null) return "sem-prazo";
  if (d < 0) return "atrasada";
  if (d === 0) return "hoje";
  return "no-prazo";
}

/** Texto completo (banner do detalhe). */
export function textoPrazo(obra) {
  const s = statusPrazo(obra);
  if (s === "concluida") return "Concluída";
  if (s === "sem-prazo") return "";
  const d = diasRestantes(obra.prazo);
  if (s === "atrasada") {
    const n = Math.abs(d);
    return "Atrasada " + n + " dia" + (n !== 1 ? "s" : "");
  }
  if (s === "hoje") return "Vence hoje";
  return "Faltam " + d + " dia" + (d !== 1 ? "s" : "");
}

/** Texto curto (badge do card). */
export function textoPrazoCurto(obra) {
  const s = statusPrazo(obra);
  if (s === "concluida") return "Concluída";
  if (s === "sem-prazo") return "";
  const d = diasRestantes(obra.prazo);
  if (s === "atrasada") return "Atrasada " + Math.abs(d) + "d";
  if (s === "hoje") return "Vence hoje";
  return "Faltam " + d + "d";
}

/** Cor (token) por status do prazo. */
export function corPrazo(obra) {
  const s = statusPrazo(obra);
  if (s === "concluida") return "var(--cor-sucesso)";
  if (s === "atrasada") return "var(--cor-erro)";
  if (s === "hoje") return "var(--cor-aviso)";
  return "var(--cor-info)";
}

/** Ícone (ui-icon) por status do prazo. */
export function iconePrazo(obra) {
  const s = statusPrazo(obra);
  if (s === "concluida") return "sucesso";
  if (s === "atrasada") return "aviso";
  return "relogio";
}
