/**
 * router.js — Roteador hash-based + gating de rota (UX).
 *
 * Hash (#/...) é obrigatório no GitHub Pages (evita 404 em refresh, sem
 * servidor para reescrever paths). O gating aqui é só UX; a autorização real
 * é server-side (princípio nº 7).
 *
 * Uso:
 *   const router = criarRouter(outletEl);
 *   router.adicionar("#/login", "login-view", { somentePublico: true });
 *   router.adicionar("#/obras", "obras-list-view", { protegida: true });
 *   router.adicionar("#/obras/:id", "obra-detail-view", { protegida: true });
 *   router.adicionar("#/admin", "admin-view", { protegida: true, admin: true });
 *   router.iniciar();
 */
import { auth } from "./auth-store.js";
import { toastAviso } from "./event-bus.js";

export function criarRouter(outlet) {
  const rotas = [];

  /** Converte "#/obras/:id" em { regex, params: ["id"], ... }. */
  function compilar(caminho) {
    const params = [];
    // Escapa regex EXCETO ':' (usado para marcar parâmetros).
    const escapado = caminho.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const padrao = escapado.replace(/:([A-Za-z0-9_]+)/g, (_, nome) => {
      params.push(nome);
      return "([^/]+)";
    });
    return { regex: new RegExp("^" + padrao + "$"), params };
  }

  function adicionar(caminho, tag, opcoes = {}) {
    const { regex, params } = compilar(caminho);
    rotas.push({ caminho, tag, opcoes, regex, params });
    return apiRouter;
  }

  function navegar(hash) {
    if (location.hash === hash) resolver();
    else location.hash = hash;
  }

  function casar(hash) {
    for (const r of rotas) {
      const m = r.regex.exec(hash);
      if (m) {
        const valores = {};
        r.params.forEach((nome, i) => (valores[nome] = decodeURIComponent(m[i + 1])));
        return { rota: r, params: valores };
      }
    }
    return null;
  }

  function renderizar(tag, params) {
    const el = document.createElement(tag);
    // Parâmetros de rota viram atributos kebab (ex.: :id -> obra-id se mapeado).
    Object.keys(params).forEach((k) => el.setAttribute(k, params[k]));
    outlet.replaceChildren(el);
  }

  function resolver() {
    const hash = location.hash || "#/";
    const casado = casar(hash);

    // Sem rota: manda para a inicial conforme autenticação.
    if (!casado) {
      navegar(auth.estaAutenticado() ? "#/obras" : "#/login");
      return;
    }

    const { rota, params } = casado;
    const op = rota.opcoes;

    // Guarda: rota protegida exige sessão.
    if (op.protegida && !auth.estaAutenticado()) {
      navegar("#/login");
      return;
    }
    // Guarda: rota admin exige role admin.
    if (op.admin && !auth.ehAdmin()) {
      toastAviso("Acesso restrito a administradores.");
      navegar("#/obras");
      return;
    }
    // Já autenticado não fica na tela de login.
    if (op.somentePublico && auth.estaAutenticado()) {
      navegar("#/obras");
      return;
    }

    renderizar(rota.tag, params);
  }

  function iniciar() {
    window.addEventListener("hashchange", resolver);
    resolver();
  }

  const apiRouter = { adicionar, navegar, iniciar, resolver };
  return apiRouter;
}
