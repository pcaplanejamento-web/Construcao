/**
 * <ui-badge> — Etiqueta colorida (primitivo).
 *
 * Atributos: color (hex da cor de destaque), text (texto exibido).
 * Se não houver text, usa o conteúdo do slot.
 */
import { BaseElement } from "./base-element.js";

class UiBadge extends BaseElement {
  static get observedAttributes() {
    return ["color", "text"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  estilos() {
    const cor = this.getAttribute("color") || "#64748b";
    return `
      :host { display: inline-block; }
      .badge {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 2px 10px; border-radius: var(--raio-completo);
        font-size: var(--fs-xs); font-weight: var(--peso-semi);
        color: ${cor}; background: ${cor}1f; /* cor com ~12% alpha */
        white-space: nowrap;
      }
      .ponto { width: 8px; height: 8px; border-radius: 50%; background: ${cor}; }
    `;
  }

  template() {
    const texto = this.getAttribute("text");
    return `<span class="badge"><span class="ponto"></span>${
      texto != null ? texto : "<slot></slot>"
    }</span>`;
  }
}

customElements.define("ui-badge", UiBadge);
