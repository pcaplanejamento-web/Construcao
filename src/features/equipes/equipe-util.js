/**
 * equipe-util.js — Helpers do módulo Equipes (sem componente novo).
 * Uma equipe = líder (contato Mestre de Obra/Engenheiro/Gestor) + membros + obras.
 */
import { dataStore } from "../../core/data-store.js";

/** Cargos que podem ser líder (espelha CARGOS_LIDER do backend). */
export const CARGOS_LIDER = ["Mestre de Obra", "Engenheiro", "Gestor"];

/** Nome do líder (ao vivo) de uma equipe. */
export function liderNome(equipe) {
  const c = dataStore.contatos().find((x) => String(x.id) === String((equipe || {}).lider_id));
  return c ? c.nome : "—";
}

/**
 * Integrantes da equipe (líder + membros) como participantes [{chave, nome}]
 * para o <split-editor> (chave `c:<contato_id>`). Reusado no registro e na
 * edição da despesa p/ distribuir o valor recebido por cada integrante.
 */
export function integrantesDaEquipe(equipeId) {
  const e = dataStore.equipe(equipeId);
  if (!e) return [];
  const ids = [];
  if (e.lider_id) ids.push(String(e.lider_id));
  (Array.isArray(e.membros) ? e.membros : []).forEach((m) => {
    const id = String(m);
    if (id && ids.indexOf(id) < 0) ids.push(id);
  });
  return ids.map((id) => {
    const c = dataStore.contatos().find((x) => String(x.id) === id) || {};
    return { chave: "c:" + id, nome: c.nome || "—" };
  });
}
