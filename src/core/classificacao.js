/**
 * classificacao.js — FONTE ÚNICA das classificações de item/despesa/oferta/orçamento.
 *
 * Classificações: **Material**, **Serviço**, **Documentação**, **Inicial** e **Comissão**.
 * Regra de PAGADOR/RECEBEDOR por classificação (usada nas validações dos forms + backend):
 *  - Material  → exige EMPRESA (fornecedor); entra em ESTOQUE ao quitar.
 *  - Serviço   → exige OFERTANTE (contato/equipe).
 *  - "Documentação"/"Inicial"/"Comissão" (e qualquer outra não-padrão) → FLEXÍVEL: aceita
 *    EMPRESA **ou** OFERTANTE (ao menos um); NÃO entra em estoque (só Material entra).
 *
 * Este módulo centraliza a lista + as cores + as regras — antes duplicadas em vários
 * componentes. O backend (Apps Script) mantém sua própria cópia em `Schema.gs`
 * (`CLASSIFICACOES_ITEM`/`CLASSIFICACAO_COR`) por ser outro runtime — manter em sincronia.
 */

export const CLASSIFICACOES = ["Material", "Serviço", "Documentação", "Inicial", "Comissão"];

/** Cor do badge por classificação (espelha o backend `CLASSIFICACAO_COR`). */
export const COR_CLASSIFICACAO = {
  Material: "#1d4ed8",
  "Serviço": "#6d28d9",
  "Documentação": "#0d9488",
  "Inicial": "#ea580c",
  "Comissão": "#db2777",
};

/** Cor da classificação com fallback neutro. */
export function corClassificacao(cl) {
  return COR_CLASSIFICACAO[cl] || "var(--cor-neutro)";
}

/** Material exige empresa (fornecedor) e é a ÚNICA que entra em estoque. */
export function exigeEmpresa(cl) {
  return String(cl) === "Material";
}

/** Serviço exige um ofertante (contato/equipe). */
export function exigeOfertante(cl) {
  return String(cl) === "Serviço";
}

/** Nem Material nem Serviço → aceita empresa OU ofertante (ao menos um). */
export function ehFlexivel(cl) {
  const s = String(cl);
  return s !== "Material" && s !== "Serviço";
}
