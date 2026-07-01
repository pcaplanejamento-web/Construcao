/**
 * marcacoes.js — Deriva as "marcações" datadas de uma obra a partir do data-store
 * (client-side, SEM rede): despesas, transferências/pagamentos, notas e o prazo.
 * Alimenta o calendário e o histórico da agenda, funcionando sem Google.
 * Cada marcação usa a MESMA forma de um evento (campo `inicio`) para caber no
 * `agenda-calendario`. `transferenciasDaObra` já cobre transferências reais +
 * pagamentos avulsos (sintetizados), sem duplicar.
 */
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";

export const CORES_MARCACAO = {
  despesa: "#1d4ed8", // azul
  transferencia: "#7c3aed", // roxo
  nota: "#f59e0b", // âmbar
  prazo: "#dc2626", // vermelho
  evento: "#0ea5e9", // eventos avulsos do Google sem cor própria
};

export const ROTULO_TIPO = {
  despesa: "Despesa",
  transferencia: "Transferência",
  nota: "Nota",
  prazo: "Prazo",
  evento: "Evento",
};

function _dia(v) {
  return String(v || "").slice(0, 10);
}

/** Lista de marcações da obra (ordem indiferente; quem consome ordena). */
export function marcacoesDaObra(obraId) {
  const out = [];
  const obra = dataStore.obra(obraId) || {};

  (dataStore.despesas(obraId) || []).forEach((d) => {
    const nome = d.item || (dataStore.item(d.item_id) || {}).nome || "Despesa";
    out.push({
      id: "desp:" + d.id, inicio: _dia(d.data), diaInteiro: true, tipo: "despesa",
      titulo: nome + " · " + moeda(d.valor), cor: CORES_MARCACAO.despesa,
      ref: { tipo: "despesa", id: d.id }, origem: "app",
    });
  });

  (dataStore.transferenciasDaObra(obraId) || []).forEach((t) => {
    const v = t.valor_total != null ? t.valor_total : t.valor;
    out.push({
      id: "transf:" + t.id, inicio: _dia(t.data), diaInteiro: true, tipo: "transferencia",
      titulo: "Transferência · " + moeda(v), cor: CORES_MARCACAO.transferencia,
      ref: { tipo: "transferencia", id: t.id }, origem: "app",
    });
  });

  (dataStore.notasDaObra(obraId) || []).forEach((n) => {
    const t = (n.titulo || "").trim() ||
      String(n.texto || "").replace(/\s+/g, " ").trim().slice(0, 40) || "Nota";
    out.push({
      id: "nota:" + n.id, inicio: _dia(n.atualizado_em || n.criado_em), diaInteiro: true, tipo: "nota",
      titulo: t, cor: CORES_MARCACAO.nota, ref: { tipo: "nota", id: n.id }, origem: "app",
    });
  });

  if (/^\d{4}-\d{2}-\d{2}$/.test(_dia(obra.prazo))) {
    out.push({
      id: "prazo:" + obraId, inicio: _dia(obra.prazo), diaInteiro: true, tipo: "prazo",
      titulo: "Prazo de entrega — " + (obra.nome || ""), cor: CORES_MARCACAO.prazo,
      ref: { tipo: "prazo", id: obraId }, origem: "app",
    });
  }

  return out.filter((m) => m.inicio);
}
