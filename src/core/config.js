/**
 * Configuração central do frontend.
 *
 * IMPORTANTE: depois de fazer o deploy do Web App do Apps Script, cole aqui a
 * URL terminada em "/exec". É o ÚNICO ponto do front que conhece o backend.
 * Veja docs/SETUP-E-DEPLOY.md.
 */
export const CONFIG = {
  /** URL do Web App do Apps Script (deployment "/exec"). */
  API_URL:
    "https://script.google.com/macros/s/AKfycbxDCNTuP8GLFU3grKNDtYXf_CjpHq5INgB2EJdbGyckCLec0ricpmmBWbAMh5W8X0gxFg/exec",

  /**
   * Client ID do OAuth do Google (habilita "Entrar com Google"). NÃO precisa
   * preencher aqui: o front busca o valor do backend (`config.publico`), que lê
   * das Script Properties — assim o dono configura em UM lugar só (lado Google).
   * Deixe "" para usar o backend; preencha apenas se quiser fixar no front.
   * Veja docs/SETUP-E-DEPLOY.md (origens e redirect a autorizar no GCP).
   */
  GOOGLE_CLIENT_ID: "",

  /** Chaves usadas no localStorage para persistir a sessão. */
  STORAGE: {
    TOKEN: "obras.token",
    USUARIO: "obras.usuario",
    CONFIG_USUARIO: "obras.config",
  },

  /** Intervalo (ms) do polling leve de resumo na tela de detalhe da obra. */
  POLLING_RESUMO_MS: 45000,

  /** Rota inicial padrão após login. */
  ROTA_INICIAL: "/obras",
};

/** Verdadeiro enquanto a API_URL não foi configurada (ajuda o onboarding). */
export const API_NAO_CONFIGURADA = CONFIG.API_URL.includes("COLE_AQUI");
