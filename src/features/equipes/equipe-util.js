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
