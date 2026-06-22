/**
 * router.js — Roteador por path (History API) + gating de rota (UX).
 *
 * URLs limpas: /obras, /obras/:id (sem #). O servidor faz fallback SPA (serve
 * index.html em qualquer path) — ver wrangler.jsonc (not_found_handling) e, no
 * preview, .claude/serve.js. Links internos <a href="/..."> são interceptados
 * globalmente; o composedPath atravessa o Shadow DOM, então funciona com os
 * Web Components. O gating aqui é só UX; a autorização real é server-side
 * (princípio nº 7).
 *
 * Navegação programática: importe { irPara } e chame irPara("/obras/" + id).
 * Quem precisa reagir à troca de rota escuta o evento window "rotamudou".
 *
 * Uso:
 *   const router = criarRouter(outletEl);
 *   router.adicionar("/login", "login-view", { somentePublico: true });
 *   router.adicionar("/obras", "obras-list-view", { protegida: true });
 *   router.adicionar("/obras/:id", "obra-detail-view", { protegida: true });
 *   router.iniciar();
 */
import { auth } from "./auth-store.js";
import { toastAviso } from "./event-bus.js";

// Navegação programática global (ligada ao router ativo em iniciar()). Antes do
// boot cai num pushState simples — não deve ocorrer na prática.
let _navegar = (caminho) => history.pushState({}, "", caminho);
export function irPara(caminho) {
  _navegar(caminho);
}

export function criarRouter(outlet) {
  const rotas = [];
  // Houve navegação interna (pushState) nesta sessão da aba? Define se o link
  // "voltar" retorna à página anterior (de onde o usuário veio) ou ao pai habitual.
  let _navegouInterno = false;

  /** Converte "/obras/:id" em { regex, params: ["id"], ... }. */
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

  function rotaAtual() {
    return location.pathname || "/";
  }

  function navegar(caminho) {
    if (rotaAtual() === caminho) resolver();
    else {
      history.pushState({}, "", caminho);
      _navegouInterno = true;
      resolver();
    }
  }

  /**
   * Voltar do link "← X": se o usuário chegou aqui navegando dentro do app,
   * retorna à página ANTERIOR (de onde veio — mesmo que não seja a habitual);
   * se entrou direto (link/refresh), vai ao pai habitual (fallback = href).
   */
  function voltar(fallback) {
    if (_navegouInterno) history.back();
    else navegar(fallback || "/");
  }

  function casar(caminho) {
    for (const r of rotas) {
      const m = r.regex.exec(caminho);
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
    // Parâmetros de rota viram atributos (ex.: :id -> id).
    Object.keys(params).forEach((k) => el.setAttribute(k, params[k]));
    outlet.replaceChildren(el);
  }

  function resolver() {
    const caminho = rotaAtual();
    const casado = casar(caminho);

    // Sem rota: manda para a inicial conforme autenticação.
    if (!casado) {
      navegar(auth.estaAutenticado() ? "/obras" : "/login");
      return;
    }

    const { rota, params } = casado;
    const op = rota.opcoes;

    // Guarda: rota protegida exige sessão.
    if (op.protegida && !auth.estaAutenticado()) {
      navegar("/login");
      return;
    }
    // Guarda: rota admin exige role admin.
    if (op.admin && !auth.ehAdmin()) {
      toastAviso("Acesso restrito a administradores.");
      navegar("/obras");
      return;
    }
    // Já autenticado não fica na tela de login.
    if (op.somentePublico && auth.estaAutenticado()) {
      navegar("/obras");
      return;
    }

    renderizar(rota.tag, params);
    // Avisa quem marca navegação ativa (ex.: app-sidebar) — substitui hashchange.
    window.dispatchEvent(new CustomEvent("rotamudou", { detail: { caminho } }));
  }

  // Intercepta cliques em links internos (<a href="/...">) e navega via SPA.
  function onClickGlobal(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.composedPath().find((el) => el && el.tagName === "A");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || !href.startsWith("/")) return; // só rotas internas absolutas
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;
    e.preventDefault();
    if (a.classList.contains("voltar")) voltar(href);
    else navegar(href);
  }

  function iniciar() {
    _navegar = navegar; // liga irPara() a este router
    // Compat: links antigos com #/rota (bookmarks, links públicos) → /rota.
    if (location.hash.startsWith("#/")) {
      history.replaceState({}, "", location.hash.slice(1));
    }
    window.addEventListener("popstate", resolver);
    document.addEventListener("click", onClickGlobal);
    resolver();
  }

  const apiRouter = { adicionar, navegar, iniciar, resolver, rotaAtual };
  return apiRouter;
}
