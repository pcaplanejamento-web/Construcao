/**
 * <category-badge> — Etiqueta de categoria de despesa (componente de domínio).
 * Reutiliza o primitivo <ui-badge>. Atributos: nome, cor.
 */
import { BaseElement } from "../../components/base-element.js";
import "../../components/ui-badge.js";

class CategoryBadge extends BaseElement {
  static get observedAttributes() {
    return ["nome", "cor"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  estilos() {
    return `:host { display: inline-block; }`;
  }
  template() {
    const nome = this.getAttribute("nome") || "Sem categoria";
    const cor = this.getAttribute("cor") || "var(--cor-neutro)";
    return `<ui-badge color="${cor}" text="${nome}"></ui-badge>`;
  }
}

customElements.define("category-badge", CategoryBadge);
