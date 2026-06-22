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
      /* card em coluna ocupando 100% da altura do host (quando o host tem
         altura definida, ex.: grade de gráficos) — corpo flexível e rolável. */
      .card {
        background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-lg); box-shadow: var(--sombra-md);
        overflow: hidden; display: flex; flex-direction: column; height: 100%;
      }
      header {
        display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); padding: var(--esp-4) var(--esp-5); flex: none;
        border-bottom: 1px solid var(--cor-borda);
      }
      /* título ocupa o espaço e QUEBRA se for longo; ações coladas à direita. */
      h3 { font-size: var(--fs-md); font-weight: var(--peso-semi);
        flex: 1; min-width: 0; overflow-wrap: anywhere; }
      header > div { flex: none; }
      .corpo { padding: var(--esp-5); flex: 1; min-height: 0; }
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
