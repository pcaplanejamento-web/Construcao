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

// Dock flutuante (mobile + desktop): atalhos rápidos. Cada tile com um acento de
// cor (estilo iOS), mantendo nossos tokens. Obras usa o verde da marca.
const BB_ITENS = [
  { rota: "/contatos", rotulo: "Contatos", icone: "contato", cor: "info" },
  { rota: "/fornecedores", rotulo: "Empresas", icone: "fornecedor", cor: "roxo" },
  { rota: "/obras", rotulo: "Obras", icone: "obra", cor: "primaria" },
  { rota: "/pagamentos", rotulo: "Transf.", icone: "carteira", cor: "aviso" },
  { rota: "/orcamentos", rotulo: "Orçam.", icone: "recibo", cor: "sucesso" },
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
      /* Quando há dock flutuante, o conteúdo ganha folga p/ não ficar atrás dele. */
      :host([com-barra]) main { padding-bottom: calc(104px + env(safe-area-inset-bottom)); }

      /* DOCK FLUTUANTE (estilo iOS) — atalhos rápidos, FLUTUANDO centralizado acima do
         conteúdo, em MOBILE e DESKTOP. Só aparece autenticado (some no login e no
         link público). Pílula de vidro (blur), tiles com acento de cor por item. */
      .bottombar { display: none; }
      :host([com-barra]) .bottombar {
        display: flex; align-items: stretch; gap: var(--esp-1);
        position: fixed; left: 50%; transform: translateX(-50%);
        bottom: calc(var(--esp-4) + env(safe-area-inset-bottom));
        z-index: var(--z-nav); max-width: calc(100vw - var(--esp-5));
        padding: var(--esp-2) var(--esp-3);
        background: color-mix(in srgb, var(--cor-superficie) 86%, transparent);
        -webkit-backdrop-filter: blur(16px) saturate(1.5); backdrop-filter: blur(16px) saturate(1.5);
        border: 1px solid var(--cor-borda); border-radius: 26px; box-shadow: var(--sombra-lg);
        transition: transform var(--transicao), opacity var(--transicao);
      }
      /* iOS 26: ao ROLAR PARA BAIXO o dock desliza e some; reaparece ao subir. */
      :host([com-barra]) .bottombar.oculto {
        transform: translateX(-50%) translateY(180%); opacity: 0; pointer-events: none;
      }
      .bb-item { display: flex; flex-direction: column; align-items: center; gap: 4px;
        padding: var(--esp-1) var(--esp-2); text-decoration: none; color: var(--cor-texto-suave);
        border-radius: var(--raio-md); transition: transform var(--transicao); }
      .bb-item:hover { transform: translateY(-2px); }
      .bb-ico { width: 44px; height: 44px; border-radius: var(--raio-md);
        display: flex; align-items: center; justify-content: center;
        background: var(--bi-suave); color: var(--bi);
        transition: box-shadow var(--transicao); }
      .bb-lbl { font-size: 11px; font-weight: var(--peso-medio); white-space: nowrap;
        line-height: 1; }
      .bb-item.ativo .bb-ico { box-shadow: 0 0 0 2px var(--bi); }
      .bb-item.ativo .bb-lbl { color: var(--bi); font-weight: var(--peso-semi); }
    `;
  }

  template() {
    const bbLink = (it) =>
      `<a class="bb-item" href="${it.rota}" data-rota="${it.rota}" title="${it.rotulo}"
          style="--bi: var(--cor-${it.cor}); --bi-suave: var(--cor-${it.cor}-suave)">
        <span class="bb-ico"><ui-icon name="${it.icone}" size="22"></ui-icon></span>
        <span class="bb-lbl">${it.rotulo}</span>
      </a>`;
    return `
      <app-header id="hdr" hidden></app-header>
      <div class="corpo">
        <app-sidebar id="sb" hidden></app-sidebar>
        <main id="outlet"></main>
      </div>
      <nav class="bottombar" id="bottombar">${BB_ITENS.map(bbLink).join("")}</nav>
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

    // iOS 26: o dock some ao rolar p/ baixo e reaparece ao subir (ou no topo).
    const outlet = this.$("#outlet");
    const bb = this.$("#bottombar");
    this._bbLastY = 0;
    outlet.addEventListener(
      "scroll",
      () => {
        const y = outlet.scrollTop;
        if (y > this._bbLastY + 6 && y > 48) bb.classList.add("oculto");
        else if (y < this._bbLastY - 6 || y <= 8) bb.classList.remove("oculto");
        this._bbLastY = y;
      },
      { passive: true }
    );
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
    // Dock flutuante: só nas telas internas (mobile + desktop); some no login e no público.
    this.toggleAttribute("com-barra", mostrarSidebar);
    // Ao trocar de rota o dock reaparece (e recalibra o scroll).
    const bb = this.$("#bottombar");
    if (bb) bb.classList.remove("oculto");
    this._bbLastY = (this.$("#outlet") || {}).scrollTop || 0;
    this._marcarBottom();
  }
}

customElements.define("app-shell", AppShell);
