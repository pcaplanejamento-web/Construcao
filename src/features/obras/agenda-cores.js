/**
 * agenda-cores.js — Cores de evento do Google Calendar (colorId → hex), reusadas
 * pelo formulário e pela grade do calendário. Fonte ÚNICA das cores da agenda.
 */
export const CORES_EVENTO = {
  "": "#039be5", // padrão quando o evento não tem colorId
  "1": "#7986cb", // Lavanda
  "2": "#33b679", // Sálvia
  "3": "#8e24aa", // Uva
  "4": "#e67c73", // Flamingo
  "5": "#f6bf26", // Banana
  "6": "#f4511e", // Tangerina
  "7": "#039be5", // Pavão
  "8": "#616161", // Grafite
  "9": "#3f51b5", // Mirtilo
  "10": "#0b8043", // Manjericão
  "11": "#d50000", // Tomate
};

export const CORES_NOMES = {
  "1": "Lavanda", "2": "Sálvia", "3": "Uva", "4": "Flamingo", "5": "Banana",
  "6": "Tangerina", "7": "Pavão", "8": "Grafite", "9": "Mirtilo",
  "10": "Manjericão", "11": "Tomate",
};

/** IDs de cor selecionáveis (na ordem do Google Calendar). */
export const IDS_COR = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

/** Cor de uma marcação/evento: aceita hex direto (#…) ou um colorId do Google. */
export function corEvento(valor) {
  const v = String(valor == null ? "" : valor);
  if (v.charAt(0) === "#") return v; // já é um hex (marcações derivadas)
  return CORES_EVENTO[v] || CORES_EVENTO[""];
}
