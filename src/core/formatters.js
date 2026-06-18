/**
 * formatters.js — Formatação de moeda, datas e números em pt-BR.
 * Funções puras e reutilizáveis (princípio nº 11: tudo em pt-BR).
 */

const fmtMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const fmtNumero = new Intl.NumberFormat("pt-BR");

/** 1234.5 -> "R$ 1.234,50". Aceita string ou número. */
export function moeda(valor) {
  const n = Number(valor) || 0;
  return fmtMoeda.format(n);
}

/** Número inteiro/decimal com separadores pt-BR. */
export function numero(valor) {
  return fmtNumero.format(Number(valor) || 0);
}

/** "2026-06-17" -> "17/06/2026". Aceita ISO date/datetime. */
export function data(iso) {
  if (!iso) return "—";
  const txt = String(iso).substring(0, 10);
  const partes = txt.split("-");
  if (partes.length !== 3) return String(iso);
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/** Data de hoje em ISO curto (YYYY-MM-DD), útil para inputs date. */
export function hojeIso() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Calcula percentual (0–100) com teto opcional. */
export function percentual(parte, total) {
  if (!total) return 0;
  return Math.round((Number(parte) / Number(total)) * 100);
}
