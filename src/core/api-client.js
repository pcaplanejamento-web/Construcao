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

// --- Trava GLOBAL de somente-leitura (link público) -------------------------
// Defesa em profundidade: no link compartilhado (sem sessão) NENHUMA edição pode
// sair daqui. O data-store liga esta trava ao hidratar a visão pública
// (`hidratarPublico`) e a desliga ao voltar p/ a sessão autenticada. Só as LEITURAS
// públicas (`publico.*` — obra/grupo/grupoObra, usadas pelo link e pelo prefetch de
// grupo) passam; qualquer outra action (toda mutação) é BLOQUEADA antes da rede,
// mesmo que algum componente escape do gating de UI. É o backstop de "proteja as edições".
let _modoSomenteLeitura = false;
const _ACAO_LEITURA_PUBLICA = /^publico\./; // publico.obra / publico.grupo / publico.grupoObra
/** Liga/desliga a trava (chamado pelo data-store nas 4 transições de estado). */
export function definirModoSomenteLeitura(v) {
  _modoSomenteLeitura = !!v;
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

  // Trava de somente-leitura: no link público, só passam as leituras `publico.*`.
  // Toda outra action (mutação) é barrada aqui — nada de edição sai do front.
  if (_modoSomenteLeitura && !_ACAO_LEITURA_PUBLICA.test(String(action || ""))) {
    throw new ApiError("SOMENTE_LEITURA", "Este é um link somente-leitura — edições não são permitidas.");
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
    const code = err.code || "ERRO";
    // Sessão inválida/expirada COM token enviado: avisa o app p/ encerrar limpo e
    // levar ao login (evita "travar" numa ação e um erro solto). Sem token (ex.:
    // auth.me no boot) NÃO dispara — é só o fluxo normal de não-autenticado.
    if (code === "NAO_AUTENTICADO" && payload.token) {
      try {
        window.dispatchEvent(new CustomEvent("sessao-invalida"));
      } catch (e) {
        /* ambiente sem window (testes) — ignora */
      }
    }
    throw new ApiError(code, err.message || "Erro desconhecido.");
  }
  return json.data;
}

export const api = { call, definirModoSomenteLeitura };
