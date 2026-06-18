/**
 * api-client.js — ÚNICO ponto do front que fala com o backend.
 *
 * Princípio nº 2: toda requisição é uma "simple request" — POST com corpo JSON
 * e SEM header Content-Type customizado, para não disparar preflight CORS no
 * Web App do Apps Script. O token de sessão vai no corpo, nunca em header.
 *
 * O servidor responde sempre HTTP 200 com { ok, data | error }. Aqui
 * convertemos erro de negócio e erro de rede em ApiError, que as views tratam.
 */
import { CONFIG, API_NAO_CONFIGURADA } from "./config.js";

/** Erro padronizado da camada de API. */
export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "ApiError";
    this.code = code;
  }
}

/** Lê o token persistido (definido pelo auth-store). */
function tokenAtual() {
  try {
    return localStorage.getItem(CONFIG.STORAGE.TOKEN) || "";
  } catch (e) {
    return "";
  }
}

/**
 * Executa uma action no backend.
 * @param {string} action  ex.: "obras.criar"
 * @param {object} data    payload específico da action
 * @returns {Promise<object>} o campo `data` da resposta
 */
export async function call(action, data = {}) {
  if (API_NAO_CONFIGURADA) {
    throw new ApiError(
      "CONFIG",
      "API não configurada. Defina API_URL em src/core/config.js (veja docs/SETUP-E-DEPLOY.md)."
    );
  }

  const payload = { action, token: tokenAtual(), data };

  let resp;
  try {
    resp = await fetch(CONFIG.API_URL, {
      method: "POST",
      // Sem 'Content-Type': mantém simple request (sem preflight OPTIONS).
      body: JSON.stringify(payload),
      redirect: "follow",
    });
  } catch (e) {
    throw new ApiError("REDE", "Falha de conexão com o servidor.");
  }

  let json;
  try {
    json = await resp.json();
  } catch (e) {
    throw new ApiError("RESPOSTA", "Resposta inválida do servidor.");
  }

  if (!json || json.ok !== true) {
    const err = (json && json.error) || {};
    throw new ApiError(err.code || "ERRO", err.message || "Erro desconhecido.");
  }
  return json.data;
}

export const api = { call };
