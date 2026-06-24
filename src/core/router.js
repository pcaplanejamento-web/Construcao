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

// Caminho-base da implantação: vazio ("") no domínio próprio (Cloudflare, na
// raiz) e "/Construcao" no GitHub Pages (página de projeto). Vem do <base href>
// definido no index.html, então o mesmo código serve a raiz e o subcaminho.
// Toda navegação interna usa rotas SEM o base (ex.: "/obras"); o roteador
// adiciona/remove o BASE ao falar com a History API e com location.pathname.
export const BASE = new URL(document.baseURI).pathname.replace(/\/+$/, "");
/** URL absoluta de uma rota interna, respeitando o base (links compartilháveis). */
export function urlAbsoluta(caminho) {
  return location.origin + BASE + caminho;
}

// Navegação programática global (ligada ao router ativo em iniciar()). Antes do
// boot cai num pushState simples — não deve ocorrer na prática.
let _navegar = (caminho) => history.pushState({}, "", BASE + caminho);
export function irPara(caminho) {
  _navegar(caminho);
}

// Rótulos das rotas (para o texto do link "voltar" refletir o destino real).
const ROTULOS = {
  "/obras": "Minhas obras",
  "/financeiro": "Financeiro",
  "/fornecedores": "Empresas",
  "/contatos": "Contatos",
  "/cotacoes": "Cotações",
  "/itens": "Itens",
  "/perfil": "Meu perfil",
  "/admin": "Administração",
};
function rotuloDaRota(caminho) {
  if (!caminho) return "Voltar";
  if (ROTULOS[caminho]) return ROTULOS[caminho];
  const base = "/" + (caminho.split("/")[1] || "");
  return ROTULOS[base] || "Voltar";
}
// Texto do link "voltar": destino real (página anterior se houve navegação
// interna; senão o pai habitual = fallback). Ligado ao router em iniciar().
let _rotuloVoltar = (fallback) => rotuloDaRota(fallback);
export function rotuloVoltar(fallback) {
  return _rotuloVoltar(fallback);
}

export function criarRouter(outlet) {
  const rotas = [];
  // Houve navegação interna (pushState) nesta sessão da aba? Define se o link
  // "voltar" retorna à página anterior (de onde o usuário veio) ou ao pai habitual.
  let _navegouInterno = false;
  let _atual = null; // caminho renderizado atualmente
  let _anterior = null; // caminho anterior (de onde o usuário veio)
  const _scroll = {}; // posição de rolagem por caminho (restaura ao voltar)

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

  // Rota interna atual = pathname SEM o caminho-base da implantação.
  function rotaAtual() {
    let p = location.pathname || "/";
    if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length) || "/";
    return p;
  }

  function navegar(caminho) {
    if (rotaAtual() === caminho) resolver();
    else {
      history.pushState({}, "", BASE + caminho);
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

  /** Texto do link "voltar": rótulo do destino real (anterior ou pai habitual). */
  function rotuloVoltarInterno(fallback) {
    return _navegouInterno && _anterior ? rotuloDaRota(_anterior) : rotuloDaRota(fallback);
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

    // Memória de navegação ANTES de renderizar — a view lê o "anterior" correto
    // ao montar (ex.: texto do link "voltar" = rótulo da página de onde veio).
    if (caminho !== _atual) {
      _anterior = _atual;
      _atual = caminho;
    }
    // Captura a rolagem salva ANTES de renderizar (o render reseta scrollTop→0,
    // cujo evento sobrescreveria o valor salvo se lido depois).
    const y = _scroll[caminho] || 0;
    renderizar(rota.tag, params);
    requestAnimationFrame(() => {
      outlet.scrollTop = y;
    });
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
    _rotuloVoltar = rotuloVoltarInterno; // liga rotuloVoltar() a este router
    // Compat: links antigos com #/rota (bookmarks, links públicos) → /rota.
    if (location.hash.startsWith("#/")) {
      history.replaceState({}, "", BASE + location.hash.slice(1));
    }
    window.addEventListener("popstate", resolver);
    document.addEventListener("click", onClickGlobal);
    // Memoriza a rolagem da página atual continuamente (restaurada ao voltar).
    outlet.addEventListener("scroll", () => {
      if (_atual) _scroll[_atual] = outlet.scrollTop;
    });
    resolver();
  }

  const apiRouter = { adicionar, navegar, iniciar, resolver, rotaAtual };
  return apiRouter;
}
