/**
 * <ui-empty-state> — Estado vazio reutilizável.
 * Atributos: icone (nome do <ui-icon>, padrão "vazio"), titulo, texto.
 * Slot: name="acao" (botão de ação opcional).
 */
import { BaseElement } from "./base-element.js";
import "./ui-icon.js";

class UiEmptyState extends BaseElement {
  static get observedAttributes() {
    return ["icone", "titulo", "texto"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  estilos() {
    return `
      :host { display: block; }
      .box { text-align: center; padding: var(--esp-8) var(--esp-4);
        color: var(--cor-texto-suave); }
      .icone { color: var(--cor-texto-fraco); margin-bottom: var(--esp-2); }
      h3 { font-size: var(--fs-lg); font-weight: var(--peso-semi);
        color: var(--cor-texto); margin-bottom: var(--esp-1); }
      p { max-width: 380px; margin: 0 auto var(--esp-4); }
      .acao { display: flex; justify-content: center; }
    `;
  }

  template() {
    const icone = this.getAttribute("icone") || "vazio";
    const titulo = this.getAttribute("titulo") || "Nada por aqui";
    const texto = this.getAttribute("texto") || "";
    return `
      <div class="box">
        <div class="icone"><ui-icon name="${icone}" size="44"></ui-icon></div>
        <h3>${titulo}</h3>
        ${texto ? `<p>${texto}</p>` : ""}
        <div class="acao"><slot name="acao"></slot></div>
      </div>
    `;
  }
}

customElements.define("ui-empty-state", UiEmptyState);
