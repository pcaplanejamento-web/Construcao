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
import { irPara } from "../core/router.js";
import "../components/ui-icon.js";
import "./app-header.js";
import "./app-sidebar.js";

// Barra inferior (mobile): atalhos rápidos. Centro = FAB de Obras.
const BB_ITENS = [
  { rota: "/contatos", rotulo: "Contatos", icone: "contato" },
  { rota: "/fornecedores", rotulo: "Fornec.", icone: "fornecedor" },
  { rota: "/obras", rotulo: "Obras", icone: "obra", fab: true },
  { rota: "/pagamentos", rotulo: "Transf.", icone: "carteira" },
  { rota: "/orcamentos", rotulo: "Orçam.", icone: "recibo" },
];

class AppShell extends BaseElement {
  estilos() {
    return `
      /* Altura de viewport fixa: o conteúdo (main) rola internamente, então a
         sidebar tem altura CONSTANTE em todas as telas (não estica por página). */
      /* 100dvh (dynamic viewport): acompanha a barra transparente do Safari iOS que
         aparece/some — o header fica SEMPRE fixo no topo e o conteúdo rola no <main>. */
      :host { display: flex; flex-direction: column; height: 100vh; height: 100dvh; overflow: hidden; }
      app-header { flex: none; }
      .corpo { flex: 1; display: flex; align-items: stretch; min-height: 0; overflow: hidden; }
      main { flex: 1; min-width: 0; min-height: 0; overflow: auto;
        padding-bottom: env(safe-area-inset-bottom); }

      /* BARRA INFERIOR (só mobile autenticado; some no desktop, login e link público).
         Atalhos: Contatos · Fornecedores · [OBRAS] · Transferências · Orçamentos. */
      .bottombar { display: none; }
      @media (max-width: 820px) {
        .bottombar:not([hidden]) { display: flex; align-items: flex-end; justify-content: space-around;
          flex: none; gap: var(--esp-1); background: var(--cor-superficie);
          border-top: 1px solid var(--cor-borda); box-shadow: 0 -2px 12px rgba(16,24,40,.10);
          padding: var(--esp-1) var(--esp-2);
          padding-bottom: calc(var(--esp-1) + env(safe-area-inset-bottom)); }
        .bb-item { display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; flex: 1; min-height: 48px; padding: var(--esp-1) 0; text-decoration: none;
          color: var(--cor-texto-suave); font-size: 10px; font-weight: var(--peso-medio); }
        .bb-item.ativo { color: var(--cor-primaria); }
        .bb-item span { white-space: nowrap; }
        /* Centro: botão circular maior, verde da marca, elevado acima da barra. */
        .bb-fab { flex: none; width: 60px; height: 60px; border-radius: var(--raio-completo);
          background: var(--grad-primaria); color: #fff; display: flex; align-items: center;
          justify-content: center; margin-top: -26px; box-shadow: var(--sombra-lg);
          border: 4px solid var(--cor-superficie); }
        .bb-fab.ativo { color: #fff; }
      }
    `;
  }

  template() {
    const bbLink = (it) =>
      it.fab
        ? `<a class="bb-fab" href="${it.rota}" data-rota="${it.rota}" title="${it.rotulo}" aria-label="${it.rotulo}"><ui-icon name="${it.icone}" size="26"></ui-icon></a>`
        : `<a class="bb-item" href="${it.rota}" data-rota="${it.rota}"><ui-icon name="${it.icone}" size="22"></ui-icon><span>${it.rotulo}</span></a>`;
    return `
      <app-header id="hdr" hidden></app-header>
      <div class="corpo">
        <app-sidebar id="sb" hidden></app-sidebar>
        <main id="outlet"></main>
      </div>
      <nav class="bottombar" id="bottombar" hidden>${BB_ITENS.map(bbLink).join("")}</nav>
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

    // Barra inferior (mobile): navega via roteador (SPA) e fecha o drawer.
    this.$$("#bottombar a").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        sb.removeAttribute("aberto");
        irPara(a.dataset.rota);
      })
    );
    this._marcarBottom();
  }

  /** Marca o item ativo da barra inferior pela rota atual. */
  _marcarBottom() {
    const atual = location.pathname || "/";
    this.$$("#bottombar a").forEach((a) => {
      const rota = a.dataset.rota;
      a.classList.toggle("ativo", atual === rota || atual.startsWith(rota + "/"));
    });
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
    // Barra inferior: só nas telas internas (mobile); some no login e no link público.
    this.$("#bottombar").hidden = !mostrarSidebar;
    this._marcarBottom();
  }
}

customElements.define("app-shell", AppShell);
