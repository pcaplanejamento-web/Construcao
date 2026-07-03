/**
 * <ui-input> — Campo de formulário com rótulo, validação e mensagem de erro.
 *
 * Atributos: label, name, type, value, placeholder, error, required, step, min, autocomplete
 * Propriedade: .value (lê/escreve o valor atual)
 * Eventos: "input" e "change" ({ value, name }); "enter" (Enter pressionado).
 *
 * `type="password"` ganha automaticamente um botão de **olho** (revelar/ocultar).
 *
 * O evento "enter" permite que formulários submetam sem depender de <form>
 * nativo (o <input> real vive no Shadow DOM deste componente).
 */
import { BaseElement } from "./base-element.js";
import "./ui-icon.js";

class UiInput extends BaseElement {
  static get observedAttributes() {
    return ["label", "type", "value", "placeholder", "error", "required", "step", "min"];
  }
  attributeChangedCallback(nome, anterior, atual) {
    if (!this.shadowRoot.childElementCount) return;
    if (nome === "value") {
      const inp = this.$("input");
      if (inp && inp.value !== atual) inp.value = atual || "";
    } else if (nome === "error") {
      this.renderizar();
    } else {
      this.renderizar();
    }
  }

  get value() {
    const inp = this.$("input");
    return inp ? inp.value : this.getAttribute("value") || "";
  }
  set value(v) {
    this.setAttribute("value", v == null ? "" : v);
    const inp = this.$("input");
    if (inp) inp.value = v == null ? "" : v;
  }

  estilos() {
    return `
      :host { display: block; }
      label { display: block; font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); }
      input {
        width: 100%; height: 42px; padding: 0 var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        background: var(--cor-superficie); color: var(--cor-texto);
        transition: var(--transicao);
      }
      input:focus { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      :host([error]) input { border-color: var(--cor-erro); }
      .erro { color: var(--cor-erro); font-size: var(--fs-xs); margin-top: var(--esp-1); }
      .wrap { position: relative; }
      input.com-olho { padding-right: 42px; }
      .olho { position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
        border: none; background: none; cursor: pointer; color: var(--cor-texto-fraco);
        width: 34px; height: 34px; border-radius: var(--raio-sm); display: inline-flex;
        align-items: center; justify-content: center; padding: 0; }
      .olho:hover { color: var(--cor-primaria); background: var(--cor-superficie-2); }
    `;
  }

  template() {
    const label = this.getAttribute("label");
    const tipo = this.getAttribute("type") || "text";
    const senha = tipo === "password";
    const valor = this.getAttribute("value") || "";
    const ph = this.getAttribute("placeholder") || "";
    const erro = this.getAttribute("error") || "";
    const extra = [];
    if (this.hasAttribute("step")) extra.push(`step="${this.getAttribute("step")}"`);
    if (this.hasAttribute("min")) extra.push(`min="${this.getAttribute("min")}"`);
    if (this.hasAttribute("required")) extra.push("required");
    const input = `<input type="${tipo}" class="${senha ? "com-olho" : ""}" value="${String(valor).replace(/"/g, "&quot;")}"
             placeholder="${ph}" ${extra.join(" ")} />`;
    const campo = senha
      ? `<div class="wrap">${input}<button class="olho" type="button" tabindex="-1" aria-label="Mostrar senha"><ui-icon name="olho" size="18"></ui-icon></button></div>`
      : input;
    return `
      ${label ? `<label>${label}</label>` : ""}
      ${campo}
      ${erro ? `<div class="erro">${erro}</div>` : ""}
    `;
  }

  aposRender() {
    const inp = this.$("input");
    if (!inp) return;
    const nome = this.getAttribute("name") || "";
    inp.addEventListener("input", () =>
      this.emitir("input", { value: inp.value, name: nome })
    );
    inp.addEventListener("change", () =>
      this.emitir("change", { value: inp.value, name: nome })
    );
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.emitir("enter", { value: inp.value, name: nome });
    });
    const olho = this.$(".olho");
    if (olho) {
      olho.addEventListener("click", () => {
        const revelar = inp.type === "password";
        inp.type = revelar ? "text" : "password";
        olho.setAttribute("aria-label", revelar ? "Ocultar senha" : "Mostrar senha");
        inp.focus();
      });
    }
  }
}

customElements.define("ui-input", UiInput);
