/**
 * <ui-select> — Lista suspensa reutilizável.
 *
 * Atributos: label, name, value, placeholder, error
 * Propriedade: .options = [{ value, label }]  (define as opções)
 * Propriedade: .value (lê/escreve)
 * Evento: "change" ({ value, name }).
 */
import { BaseElement } from "./base-element.js";

class UiSelect extends BaseElement {
  static get observedAttributes() {
    return ["label", "value", "placeholder", "error"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  set options(lista) {
    this._options = Array.isArray(lista) ? lista : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get options() {
    return this._options || [];
  }

  get value() {
    const s = this.$("select");
    return s ? s.value : this.getAttribute("value") || "";
  }
  set value(v) {
    this.setAttribute("value", v == null ? "" : v);
  }

  estilos() {
    return `
      :host { display: block; }
      label { display: block; font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); }
      .wrap { position: relative; }
      select {
        width: 100%; height: 42px; padding: 0 40px 0 var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        background: var(--cor-superficie); color: var(--cor-texto);
        font-family: inherit; font-size: var(--fs-md); appearance: none;
      }
      select:focus { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      :host([error]) select { border-color: var(--cor-erro); }
      /* Seta maior e com a cor do tema (currentColor) em vez de um SVG minúsculo. */
      .chev { position: absolute; right: 10px; top: 0; height: 42px; display: flex; align-items: center;
        pointer-events: none; color: var(--cor-texto-suave); }
      .chev svg { display: block; }
      .erro { color: var(--cor-erro); font-size: var(--fs-xs); margin-top: var(--esp-1); }
    `;
  }

  template() {
    const label = this.getAttribute("label");
    const valor = this.getAttribute("value") || "";
    const ph = this.getAttribute("placeholder");
    const erro = this.getAttribute("error") || "";
    const opcoes = this.options
      .map(
        (o) =>
          `<option value="${o.value}" ${
            String(o.value) === String(valor) ? "selected" : ""
          }>${o.label}</option>`
      )
      .join("");
    return `
      ${label ? `<label>${label}</label>` : ""}
      <div class="wrap">
        <select>
          ${ph ? `<option value="" ${valor ? "" : "selected"} disabled>${ph}</option>` : ""}
          ${opcoes}
        </select>
        <span class="chev" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
      </div>
      ${erro ? `<div class="erro">${erro}</div>` : ""}
    `;
  }

  aposRender() {
    const s = this.$("select");
    if (!s) return;
    const nome = this.getAttribute("name") || "";
    s.addEventListener("change", () => {
      this.setAttribute("value", s.value);
      this.emitir("change", { value: s.value, name: nome });
    });
  }
}

customElements.define("ui-select", UiSelect);
