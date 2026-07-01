/**
 * <ui-switch> — Interruptor (toggle) reutilizável (primitivo).
 *
 * Atributos: checked (booleano), disabled, label
 * Propriedade: .checked (lê/escreve)
 * Evento: "change" ({ checked }).
 * Alvo de toque ≥44px (mobile).
 */
import { BaseElement } from "./base-element.js";

class UiSwitch extends BaseElement {
  static get observedAttributes() {
    return ["disabled", "label"]; // `checked` NÃO é observado (o CSS :host([checked]) já reage)
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  get checked() {
    return this.hasAttribute("checked");
  }
  set checked(v) {
    if (v) this.setAttribute("checked", "");
    else this.removeAttribute("checked");
    const inp = this.$("input");
    if (inp) inp.checked = !!v;
  }

  estilos() {
    return `
      :host { display: inline-flex; }
      label { display: inline-flex; align-items: center; gap: var(--esp-3); cursor: pointer;
        user-select: none; min-height: 44px; font-size: var(--fs-md); color: var(--cor-texto); }
      :host([disabled]) label { opacity: .55; cursor: not-allowed; }
      .trilho { position: relative; width: 46px; height: 26px; border-radius: 999px; flex: none;
        background: var(--cor-borda-forte); transition: background var(--transicao); }
      .bolinha { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%;
        background: #fff; box-shadow: var(--sombra-sm); transition: transform var(--transicao); }
      :host([checked]) .trilho { background: var(--cor-primaria); }
      :host([checked]) .bolinha { transform: translateX(20px); }
      input { position: absolute; opacity: 0; width: 0; height: 0; }
    `;
  }

  template() {
    const label = this.getAttribute("label") || "";
    return `
      <label>
        <span class="trilho"><span class="bolinha"></span></span>
        <input type="checkbox" ${this.checked ? "checked" : ""} ${this.hasAttribute("disabled") ? "disabled" : ""} />
        ${label ? `<span class="txt">${label}</span>` : "<slot></slot>"}
      </label>
    `;
  }

  aposRender() {
    const inp = this.$("input");
    inp.addEventListener("change", () => {
      if (this.hasAttribute("disabled")) {
        inp.checked = this.checked;
        return;
      }
      if (inp.checked) this.setAttribute("checked", "");
      else this.removeAttribute("checked");
      this.emitir("change", { checked: inp.checked });
    });
  }
}

customElements.define("ui-switch", UiSwitch);
