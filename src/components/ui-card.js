/**
 * <ui-card> — Container com superfície, sombra e cabeçalho opcional.
 *
 * Atributos: title (opcional), padded (booleano, padding no corpo — padrão sim)
 * Slots: default (corpo), name="acoes" (canto superior direito), name="rodape"
 */
import { BaseElement } from "./base-element.js";

class UiCard extends BaseElement {
  static get observedAttributes() {
    return ["title"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  estilos() {
    return `
      :host { display: block; }
      .card {
        background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-lg); box-shadow: var(--sombra-sm);
        overflow: hidden;
      }
      header {
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); padding: var(--esp-4) var(--esp-5);
        border-bottom: 1px solid var(--cor-borda);
      }
      h3 { font-size: var(--fs-md); font-weight: var(--peso-semi); }
      .corpo { padding: var(--esp-5); }
      .rodape { padding: var(--esp-4) var(--esp-5); border-top: 1px solid var(--cor-borda); }
      ::slotted([slot="rodape"]) { display: block; }
      slot[name="rodape"]:not(:empty) { display: block; }
    `;
  }

  template() {
    const titulo = this.getAttribute("title");
    return `
      <div class="card">
        ${
          titulo
            ? `<header><h3>${titulo}</h3><div><slot name="acoes"></slot></div></header>`
            : ""
        }
        <div class="corpo"><slot></slot></div>
      </div>
    `;
  }
}

customElements.define("ui-card", UiCard);
