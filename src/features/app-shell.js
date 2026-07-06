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

// Dock flutuante (mobile + desktop): atalhos rápidos numa CÁPSULA ESCURA translúcida
// (estilo iOS/Instagram), só ícones monocromáticos; o item ATIVO ganha uma "pílula"
// clara atrás. `rotulo` vira o title (tooltip/acessibilidade).
const BB_ITENS = [
  { rota: "/contatos", rotulo: "Contatos", icone: "contato" },
  { rota: "/fornecedores", rotulo: "Empresas", icone: "fornecedor" },
  { rota: "/obras", rotulo: "Obras", icone: "obra" },
  { rota: "/pagamentos", rotulo: "Transferências", icone: "carteira" },
  { rota: "/orcamentos", rotulo: "Orçamentos", icone: "recibo" },
];

/**
 * Preferência (por dispositivo) de exibir o dock flutuante, SEPARADA para
 * desktop e mobile. Guardada em localStorage — como a preferência de recolhimento
 * da sidebar (`obras.sidebar`) — para ser local ao aparelho e instantânea.
 * Padrão: **desktop desativado, mobile ativado**. A tela de Perfil edita via
 * `dockPref.definir(...)`, que emite "dock-pref" para o shell reagir na hora.
 */
const DOCK_CHAVE = { desktop: "obras.dock.desktop", mobile: "obras.dock.mobile" };
const DOCK_PADRAO = { desktop: false, mobile: true };
export const dockPref = {
  ligado(qual) {
    try {
      const v = localStorage.getItem(DOCK_CHAVE[qual]);
      return v == null ? DOCK_PADRAO[qual] : v === "1";
    } catch (e) { return DOCK_PADRAO[qual]; }
  },
  definir(qual, on) {
    try { localStorage.setItem(DOCK_CHAVE[qual], on ? "1" : "0"); } catch (e) {}
    window.dispatchEvent(new CustomEvent("dock-pref"));
  },
  /** Deve exibir o dock AGORA (conforme a largura atual da viewport). */
  ativoAgora() {
    const mobile = window.matchMedia("(max-width: 820px)").matches;
    return this.ligado(mobile ? "mobile" : "desktop");
  },
};

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
        /* Trava a navegação nativa (voltar/avançar) por gesto horizontal DENTRO do
           scroller — reforça o overscroll-behavior-x do documento (reset.css). */
        overscroll-behavior-x: none;
        padding-bottom: env(safe-area-inset-bottom); }
      /* Quando há dock flutuante, o conteúdo ganha folga p/ não ficar atrás dele. */
      :host([com-barra]) main { padding-bottom: calc(104px + env(safe-area-inset-bottom)); }
      /* Rota "cheia" (E-mail): o conteúdo ocupa 100% do main SEM rolagem própria (a
         view gerencia a rolagem interna) e o dock flutuante some — cliente em tela cheia. */
      :host([cheio]) main { overflow: hidden; padding-bottom: 0; }
      :host([cheio]) .bottombar { display: none; }

      /* DOCK FLUTUANTE (estilo iOS/Instagram) — CÁPSULA ESCURA translúcida, FLUTUANDO
         centralizada acima do conteúdo, em MOBILE e DESKTOP. Só aparece autenticado
         (some no login e no link público). Vidro escuro (blur) + ícones monocromáticos;
         o item ATIVO ganha uma "pílula" clara atrás. */
      .bottombar { display: none; }
      :host([com-barra]) .bottombar {
        display: flex; align-items: center; gap: var(--esp-1);
        position: fixed; left: 50%; transform: translateX(-50%);
        bottom: calc(var(--esp-4) + env(safe-area-inset-bottom));
        z-index: var(--z-nav); max-width: calc(100vw - var(--esp-5));
        padding: var(--esp-2);
        background: var(--dock-fundo);
        -webkit-backdrop-filter: var(--vidro-blur); backdrop-filter: var(--vidro-blur);
        border: 1px solid var(--dock-borda); border-radius: var(--raio-completo);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), var(--sombra-lg);
        transform-origin: bottom center;
        transition: transform var(--transicao), opacity var(--transicao);
      }
      /* Ao ROLAR PARA BAIXO o dock apenas ENCOLHE (não some) e volta ao subir/topo. */
      :host([com-barra]) .bottombar.reduzido {
        transform: translateX(-50%) scale(0.78);
      }
      /* Só ícone; o item é o alvo de toque e vira a "pílula" quando ativo. */
      .bb-item { display: flex; align-items: center; justify-content: center;
        width: 56px; height: 44px; flex: none; border-radius: var(--raio-completo);
        text-decoration: none; color: var(--dock-ico-fraco);
        transition: background var(--transicao), color var(--transicao); }
      .bb-item:hover { color: var(--dock-ico); }
      .bb-ico { display: flex; align-items: center; justify-content: center; }
      .bb-item.ativo { background: var(--dock-ativo); color: var(--dock-ico);
        box-shadow: var(--dock-ativo-sombra); }
    `;
  }

  template() {
    const bbLink = (it) =>
      `<a class="bb-item" href="${it.rota}" data-rota="${it.rota}" title="${it.rotulo}" aria-label="${it.rotulo}">
        <span class="bb-ico"><ui-icon name="${it.icone}" size="24"></ui-icon></span>
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

    // Ao rolar p/ baixo o dock ENCOLHE (não some) e volta ao tamanho ao subir/topo.
    const outlet = this.$("#outlet");
    const bb = this.$("#bottombar");
    this._bbLastY = 0;
    outlet.addEventListener(
      "scroll",
      () => {
        const y = outlet.scrollTop;
        if (y > this._bbLastY + 6 && y > 48) bb.classList.add("reduzido");
        else if (y < this._bbLastY - 6 || y <= 8) bb.classList.remove("reduzido");
        this._bbLastY = y;
      },
      { passive: true }
    );

    // Reavalia o dock ao cruzar o breakpoint mobile↔desktop (a preferência muda)
    // e quando o usuário altera a preferência no Perfil (evento "dock-pref").
    const mq = window.matchMedia("(max-width: 820px)");
    const onViewport = () => this._refletirDock();
    if (mq.addEventListener) mq.addEventListener("change", onViewport);
    else mq.addListener(onViewport);
    this.aoLimpar(() => {
      if (mq.removeEventListener) mq.removeEventListener("change", onViewport);
      else mq.removeListener(onViewport);
    });
    const onDockPref = () => this._refletirDock();
    window.addEventListener("dock-pref", onDockPref);
    this.aoLimpar(() => window.removeEventListener("dock-pref", onDockPref));
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
    // Rota "cheia": E-mail ocupa toda a altura (sem rolagem do main nem dock).
    this.toggleAttribute("cheio", mostrarSidebar && path === "/email");
    this._mostrarSidebar = mostrarSidebar;
    this._refletirDock();
  }

  /**
   * Exibe o dock flutuante só nas telas internas E se a preferência do
   * dispositivo atual (desktop/mobile) estiver ligada. Reavaliado ao trocar de
   * rota, ao cruzar o breakpoint e ao mudar a preferência no Perfil.
   */
  _refletirDock() {
    // Some no login/público; caso contrário respeita a preferência da viewport.
    this.toggleAttribute("com-barra", !!this._mostrarSidebar && dockPref.ativoAgora());
    const bb = this.$("#bottombar");
    if (bb) bb.classList.remove("reduzido");
    this._bbLastY = (this.$("#outlet") || {}).scrollTop || 0;
    this._marcarBottom();
  }
}

customElements.define("app-shell", AppShell);
