/**
 * <app-sidebar> — Menu lateral em abas. Reusa <role-guard> para o item admin
 * e <ui-icon> para os ícones (sem emoji).
 *
 * Atributo: aberto (no mobile, controla o drawer).
 * Eventos: "navegou" (após clicar num item — o shell fecha o drawer no mobile).
 * Item ativo destacado por location.hash.
 */
import { BaseElement } from "../components/base-element.js";
import "./role-guard.js";
import "../components/ui-icon.js";

const ITENS = [
  { rota: "#/obras", rotulo: "Minhas obras", icone: "obra" },
  { rota: "#/categorias", rotulo: "Classificações", icone: "tag" },
  { rota: "#/perfil", rotulo: "Meu perfil", icone: "usuario" },
];

class AppSidebar extends BaseElement {
  static get observedAttributes() {
    return ["aberto"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this._atualizarAberto();
  }

  estilos() {
    return `
      :host { display: block; }
      .backdrop { display: none; }
      nav { display: flex; flex-direction: column; gap: var(--esp-1);
        width: 230px; padding: var(--esp-4) var(--esp-3);
        background: var(--cor-superficie); border-right: 1px solid var(--cor-borda);
        min-height: 100%; }
      a { display: flex; align-items: center; gap: var(--esp-3);
        padding: var(--esp-3) var(--esp-3); border-radius: var(--raio-sm);
        color: var(--cor-texto-suave); text-decoration: none;
        font-weight: var(--peso-medio); font-size: var(--fs-sm); }
      a:hover { background: var(--cor-superficie-2); text-decoration: none; }
      a.ativo { color: var(--cor-primaria); background: var(--cor-primaria-suave); }
      a ui-icon { color: inherit; }
      role-guard { display: contents; }
      .sep { height: 1px; background: var(--cor-borda); margin: var(--esp-2) 0; }

      @media (max-width: 820px) {
        :host { position: fixed; inset: 0 auto 0 0; z-index: var(--z-nav);
          transform: translateX(-100%); transition: transform .2s ease; }
        :host([aberto]) { transform: translateX(0); }
        nav { box-shadow: var(--sombra-lg); }
        .backdrop { display: block; position: fixed; inset: 0; z-index: -1;
          background: var(--cor-overlay); opacity: 0; pointer-events: none;
          transition: opacity .2s; }
        :host([aberto]) .backdrop { opacity: 1; pointer-events: auto; }
      }
    `;
  }

  template() {
    const link = (it) =>
      `<a href="${it.rota}" data-rota="${it.rota}"><ui-icon name="${it.icone}" size="18"></ui-icon>${it.rotulo}</a>`;
    return `
      <div class="backdrop" id="backdrop"></div>
      <nav>
        ${link(ITENS[0])}
        ${link(ITENS[1])}
        <role-guard role="admin">
          <a href="#/admin" data-rota="#/admin"><ui-icon name="config" size="18"></ui-icon>Administração</a>
        </role-guard>
        <div class="sep"></div>
        ${link(ITENS[2])}
      </nav>
    `;
  }

  aoConectar() {
    this._onHash = () => this.marcarAtivo();
    window.addEventListener("hashchange", this._onHash);
    this.aoLimpar(() => window.removeEventListener("hashchange", this._onHash));
    this.marcarAtivo();
    this.$$("a").forEach((a) =>
      a.addEventListener("click", () => this.emitir("navegou"))
    );
    this.$("#backdrop").addEventListener("click", () => this.emitir("navegou"));
  }

  _atualizarAberto() {
    // estado refletido via atributo :host([aberto]) no CSS — nada a fazer.
  }

  marcarAtivo() {
    const hash = location.hash || "";
    this.$$("a").forEach((a) => {
      const rota = a.dataset.rota;
      a.classList.toggle("ativo", hash === rota || hash.startsWith(rota + "/"));
    });
  }
}

customElements.define("app-sidebar", AppSidebar);
