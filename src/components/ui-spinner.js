/**
 * <ui-spinner> — Indicador de carregamento (primitivo).
 * Atributos: text (rótulo opcional ao lado), centro (booleano: centraliza).
 */
import { BaseElement } from "./base-element.js";

class UiSpinner extends BaseElement {
  static get observedAttributes() {
    return ["text", "centro"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  estilos() {
    return `
      :host { display: inline-block; }
      :host([centro]) { display: flex; justify-content: center; padding: var(--esp-6); }
      .box { display: inline-flex; align-items: center; gap: var(--esp-2);
        color: var(--cor-texto-suave); }
      .sp { width: 22px; height: 22px; border-radius: 50%;
        border: 3px solid var(--cor-borda); border-top-color: var(--cor-primaria);
        animation: girar .7s linear infinite; }
      @keyframes girar { to { transform: rotate(360deg); } }
    `;
  }

  template() {
    const t = this.getAttribute("text");
    return `<div class="box"><span class="sp"></span>${t ? `<span>${t}</span>` : ""}</div>`;
  }
}

customElements.define("ui-spinner", UiSpinner);
