/**
 * sync-agenda.js — Envia (push idempotente) as marcações do app para o Google
 * Calendar, quando o usuário liga a sincronização no perfil. O cliente calcula
 * as marcações (marcacoes.js) e o backend faz o upsert tagueado.
 */
import { dataStore } from "../../core/data-store.js";
import { auth } from "../../core/auth-store.js";
import { api } from "../../core/api-client.js";
import { marcacoesDaObra } from "./marcacoes.js";

function _liga(v) {
  return v === true || v === "TRUE" || v === "true";
}

/** A sincronização da agenda está ligada? */
export function syncAgendaLigada() {
  return _liga((auth.config() || {}).sync_agenda);
}

/** A conta Google está conectada? (derivado no config — lido do CACHE, sem rede). */
export function googleConectado() {
  return _liga((auth.config() || {}).google_conectado);
}

/** Sincroniza as marcações de UMA obra para o Google (respeita sync_notas). */
export async function sincronizarObraGoogle(obraId) {
  const cfg = auth.config() || {};
  let marc = marcacoesDaObra(obraId);
  if (!_liga(cfg.sync_notas)) marc = marc.filter((m) => m.tipo !== "nota");
  const marcacoes = marc.map((m) => ({ ref: m.ref, titulo: m.titulo, inicio: m.inicio, tipo: m.tipo }));
  return api.call("google.agenda.sincronizarObra", { obraId, marcacoes });
}

/** Sincroniza TODAS as obras acessíveis (usado ao ligar o interruptor). */
export async function sincronizarTodasObrasGoogle() {
  const obras = dataStore.obras() || [];
  for (const o of obras) {
    try {
      await sincronizarObraGoogle(o.id);
    } catch (e) {
      /* segue para a próxima obra */
    }
  }
}
