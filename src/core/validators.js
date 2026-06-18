/**
 * validators.js — Validações reutilizáveis (princípio nº 7: reuso).
 * Cada função retorna string de erro (mensagem) ou "" quando válido.
 */

export function obrigatorio(valor, rotulo = "Campo") {
  return String(valor || "").trim() ? "" : `${rotulo} é obrigatório.`;
}

export function email(valor) {
  const v = String(valor || "").trim();
  if (!v) return "Informe o e-mail.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "E-mail inválido.";
}

export function senhaMinima(valor, minimo = 6) {
  const v = String(valor || "");
  return v.length >= minimo ? "" : `A senha deve ter ao menos ${minimo} caracteres.`;
}

export function valorPositivo(valor) {
  const n = Number(valor);
  return n > 0 ? "" : "Informe um valor maior que zero.";
}

/** Aplica um conjunto de regras; retorna o primeiro erro encontrado ou "". */
export function primeiroErro(...erros) {
  return erros.find((e) => e) || "";
}
