/**
 * <app-shell> — Layout raiz: <app-header> persistente + <app-sidebar> + <main>
 * outlet onde o roteador renderiza a view ativa.
 *
 * Header e sidebar só aparecem com sessão (somem no login). O outlet é estável
 * (nunca destruído ao alternar auth) — apenas o roteador mexe no seu conteúdo.
 */
import { BaseElement } from "../components/base-element.js";
import { auth } from "../core/auth-store.js";
import { bus, EVENTOS } from "../core/event-bus.js";
import "./app-header.js";
import "./app-sidebar.js";

class AppShell extends BaseElement {
  estilos() {
    return `
      /* Altura de viewport fixa: o conteúdo (main) rola internamente, então a
         sidebar tem altura CONSTANTE em todas as telas (não estica por página). */
      :host { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
      app-header { flex: none; }
      .corpo { flex: 1; display: flex; align-items: stretch; min-height: 0; overflow: hidden; }
      main { flex: 1; min-width: 0; min-height: 0; overflow: auto; }
    `;
  }

  template() {
    return `
      <app-header id="hdr" hidden></app-header>
      <div class="corpo">
        <app-sidebar id="sb" hidden></app-sidebar>
        <main id="outlet"></main>
      </div>
    `;
  }

  /** O roteador renderiza as views aqui. */
  get outlet() {
    return this.$("#outlet");
  }

  aoConectar() {
    this.refletirAuth();
    this.aoLimpar(bus.on(EVENTOS.AUTH, () => this.refletirAuth()));
    // Reage também à troca de rota: no login, o AUTH dispara ANTES de carregar
    // os dados e navegar; gatear pela rota evita o header surgir sozinho sobre a
    // tela de login (header/sidebar aparecem junto com o conteúdo interno).
    const onRota = () => this.refletirAuth();
    window.addEventListener("rotamudou", onRota);
    this.aoLimpar(() => window.removeEventListener("rotamudou", onRota));

    const hdr = this.$("#hdr");
    const sb = this.$("#sb");

    // Restaura a preferência de recolhimento (desktop).
    try {
      if (localStorage.getItem("obras.sidebar") === "recolhido")
        sb.setAttribute("recolhido", "");
    } catch (e) {}

    hdr.addEventListener("toggle-sidebar", () => {
      if (window.matchMedia("(max-width: 820px)").matches) {
        sb.toggleAttribute("aberto"); // mobile: abre/fecha o drawer
      } else {
        const recolhido = sb.toggleAttribute("recolhido"); // desktop: recolhe/expande
        try {
          localStorage.setItem("obras.sidebar", recolhido ? "recolhido" : "expandido");
        } catch (e) {}
      }
    });
    sb.addEventListener("navegou", () => sb.removeAttribute("aberto"));
  }

  refletirAuth() {
    // Header: nas telas internas (autenticado) E na pública (modo somente-leitura,
    // mesmo componente) — some apenas no login. Sidebar: só nas telas internas.
    // Durante o carregamento pós-login a rota ainda é /login, então ficam ocultos
    // até o conteúdo interno renderizar.
    const path = location.pathname || "/";
    const ehLogin = path === "/login";
    const ehPublico = path.startsWith("/publico");
    const autenticado = auth.estaAutenticado();
    const mostrarHeader = !ehLogin && (autenticado || ehPublico);
    const mostrarSidebar = autenticado && !ehLogin && !ehPublico;
    this.$("#hdr").hidden = !mostrarHeader;
    this.$("#sb").hidden = !mostrarSidebar;
    if (!mostrarSidebar) this.$("#sb").removeAttribute("aberto");
  }
}

customElements.define("app-shell", AppShell);
