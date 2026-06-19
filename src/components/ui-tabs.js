/**
 * <ui-tabs> — Abas reutilizáveis (primitivo). Mostra o conteúdo da aba ativa via
 * slots nomeados; o consumidor fornece um elemento por aba com slot="<id>".
 *
 * Propriedade: .abas = [{ id, rotulo, icone? }]
 * Atributo: ativo (id da aba ativa; padrão = primeira)
 * Evento: "mudar" ({ id }).
 *
 * Uso:
 *   <ui-tabs id="t">
 *     <div slot="a">...</div>
 *     <div slot="b">...</div>
 *   </ui-tabs>
 *   t.abas = [{id:"a",rotulo:"A"},{id:"b",rotulo:"B"}];
 */
import { BaseElement } from "./base-element.js";
import "./ui-icon.js";

class UiTabs extends BaseElement {
  static get observedAttributes() {
    return ["ativo"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  set abas(v) {
    this._abas = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get abas() {
    return this._abas || [];
  }
  get ativo() {
    return this.getAttribute("ativo") || (this.abas[0] || {}).id || "";
  }

  estilos() {
    return `
      :host { display: block; }
      .barra { display: flex; gap: var(--esp-1); border-bottom: 1px solid var(--cor-borda);
        margin-bottom: var(--esp-5); }
      button { display: inline-flex; align-items: center; gap: var(--esp-2);
        background: none; border: none; cursor: pointer; padding: var(--esp-3) var(--esp-4);
        font-size: var(--fs-sm); font-weight: var(--peso-medio); color: var(--cor-texto-suave);
        border-bottom: 2px solid transparent; margin-bottom: -1px; }
      button:hover { color: var(--cor-texto); }
      button.ativo { color: var(--cor-primaria); border-bottom-color: var(--cor-primaria);
        font-weight: var(--peso-semi); }
    `;
  }

  template() {
    const ativo = this.ativo;
    const botoes = this.abas
      .map(
        (a) =>
          `<button data-id="${a.id}" class="${a.id === ativo ? "ativo" : ""}">${
            a.icone ? `<ui-icon name="${a.icone}" size="16"></ui-icon>` : ""
          }${a.rotulo}</button>`
      )
      .join("");
    return `
      <div class="barra" role="tablist">${botoes}</div>
      <div class="painel"><slot name="${ativo}"></slot></div>
    `;
  }

  aposRender() {
    this.$$("button").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.id === this.ativo) return;
        this.setAttribute("ativo", b.dataset.id); // dispara re-render
        this.emitir("mudar", { id: b.dataset.id });
      })
    );
  }
}

customElements.define("ui-tabs", UiTabs);
