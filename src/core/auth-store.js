/**
 * auth-store.js — Estado de sessão (token, usuário, config) + persistência.
 *
 * Fonte única de verdade da sessão no front. Persiste em localStorage para
 * sobreviver a refresh e revalida no boot via auth.me. Emite EVENTOS.AUTH.
 */
import { api } from "./api-client.js";
import { CONFIG } from "./config.js";
import { bus, EVENTOS } from "./event-bus.js";

let estado = { token: null, usuario: null, config: {} };

// "Manter-me conectado": false = localStorage (persiste entre sessões, padrão);
// true = sessionStorage (some ao fechar a aba). Inferido no boot por lerStorage.
let usarSessao = false;

function _store() {
  return usarSessao ? sessionStorage : localStorage;
}

function _limparStorages() {
  const s = CONFIG.STORAGE;
  [localStorage, sessionStorage].forEach((st) => {
    try {
      st.removeItem(s.TOKEN);
      st.removeItem(s.USUARIO);
      st.removeItem(s.CONFIG_USUARIO);
    } catch (e) {
      /* indisponível */
    }
  });
}

function persistir() {
  try {
    const s = CONFIG.STORAGE;
    if (!estado.token) {
      _limparStorages();
      return;
    }
    const st = _store();
    st.setItem(s.TOKEN, estado.token);
    st.setItem(s.USUARIO, JSON.stringify(estado.usuario || null));
    st.setItem(s.CONFIG_USUARIO, JSON.stringify(estado.config || {}));
    // Remove do storage que NÃO deve guardar (ao alternar lembrar ↔ sessão).
    const outra = usarSessao ? localStorage : sessionStorage;
    outra.removeItem(s.TOKEN);
    outra.removeItem(s.USUARIO);
    outra.removeItem(s.CONFIG_USUARIO);
  } catch (e) {
    /* storage indisponível: segue só em memória. */
  }
}

function lerStorage() {
  try {
    const s = CONFIG.STORAGE;
    // localStorage (lembrar) tem prioridade; senão sessionStorage.
    let token = localStorage.getItem(s.TOKEN);
    let st = localStorage;
    if (token) {
      usarSessao = false;
    } else {
      token = sessionStorage.getItem(s.TOKEN);
      st = sessionStorage;
      usarSessao = !!token;
    }
    if (!token) return;
    estado.token = token;
    estado.usuario = JSON.parse(st.getItem(s.USUARIO) || "null");
    estado.config = JSON.parse(st.getItem(s.CONFIG_USUARIO) || "{}");
  } catch (e) {
    /* ignora storage corrompido */
  }
}

export const auth = {
  estado: () => estado,
  token: () => estado.token,
  usuario: () => estado.usuario,
  config: () => estado.config,
  estaAutenticado: () => !!estado.token,
  ehAdmin: () => !!(estado.usuario && estado.usuario.role === "admin"),

  /**
   * Autentica e popula a sessão.
   * @param {boolean} lembrar  true (padrão) → persiste em localStorage;
   *                           false → sessionStorage (some ao fechar a aba).
   */
  async login(email, senha, lembrar = true) {
    const data = await api.call("auth.login", { email, senha });
    usarSessao = !lembrar;
    estado = {
      token: data.token,
      usuario: data.usuario,
      config: data.config || {},
    };
    persistir();
    bus.emit(EVENTOS.AUTH, { autenticado: true, usuario: data.usuario });
    return data.usuario;
  },

  /** Altera a própria senha (exige a senha atual). */
  async alterarSenha(senhaAtual, novaSenha) {
    return api.call("auth.alterarSenha", { senhaAtual, novaSenha });
  },

  /** Encerra a sessão (server-side e local). */
  async logout() {
    try {
      await api.call("auth.logout");
    } catch (e) {
      /* mesmo se o servidor falhar, limpamos localmente */
    }
    estado = { token: null, usuario: null, config: {} };
    persistir();
    bus.emit(EVENTOS.AUTH, { autenticado: false });
  },

  /**
   * Restaura a sessão no boot: lê o storage e revalida via auth.me.
   * @returns {Promise<boolean>} true se a sessão é válida.
   */
  async restaurar() {
    lerStorage();
    if (!estado.token) return false;
    try {
      const data = await api.call("auth.me");
      estado.usuario = data.usuario;
      estado.config = data.config || {};
      persistir();
      // Avisa a UI (shell/header/sidebar) que há sessão ativa. Emitido ANTES de
      // app.js assinar AUTH, então não dispara recarga/navegação — só atualiza o layout.
      bus.emit(EVENTOS.AUTH, { autenticado: true, usuario: estado.usuario });
      return true;
    } catch (e) {
      estado = { token: null, usuario: null, config: {} };
      persistir();
      return false;
    }
  },
};
