/**
 * <ui-input> — Campo de formulário com rótulo, validação e mensagem de erro.
 *
 * Atributos: label, name, type, value, placeholder, error, required, step, min,
 *   autocomplete, e o opcional **`formato`** (máscara):
 *   - `formato="moeda"`  → teclado decimal; formata "R$ 1.234,50" enquanto digita
 *     (acumulador de centavos); **`.value` devolve o NÚMERO** (ex.: `"1234.5"`),
 *     então `Number(el.value)` segue funcionando. `.numero` devolve o Number.
 *   - `formato="telefone"` → máscara `(00) 00000-0000`; `.value` = texto mascarado.
 *   - `formato="cnpj"`     → máscara `00.000.000/0000-00`; `.value` = texto mascarado.
 *   Sem `formato`, o comportamento é idêntico ao de antes.
 * Propriedade: `.value` (lê/escreve). Eventos: "input"/"change" ({value,name}); "enter".
 * `type="password"` ganha um botão de olho (revelar/ocultar).
 */
import { BaseElement } from "./base-element.js";
import { moeda } from "../core/formatters.js";
import "./ui-icon.js";

function soDigitos(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }

/** Valor (número cru ou string formatada) -> centavos inteiros, ou null se vazio. */
function centavosDe(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!isNaN(n) && String(v).indexOf("R$") < 0) return Math.round(n * 100);
  const d = soDigitos(v);
  return d === "" ? null : Number(d);
}

function mascaraTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function mascaraCnpj(v) {
  const d = soDigitos(v).slice(0, 14);
  let s = d;
  if (d.length > 2) s = d.slice(0, 2) + "." + d.slice(2);
  if (d.length > 5) s = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5);
  if (d.length > 8) s = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8);
  if (d.length > 12) s = d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
  return s;
}

class UiInput extends BaseElement {
  static get observedAttributes() {
    return ["label", "type", "value", "placeholder", "error", "required", "step", "min", "formato"];
  }
  attributeChangedCallback(nome, anterior, atual) {
    if (!this.shadowRoot.childElementCount) return;
    if (nome === "value") { this._aplicarValorDisplay(atual); return; }
    this.renderizar();
  }

  _formato() { return this.getAttribute("formato") || ""; }

  get value() {
    if (this._formato() === "moeda") return this._cents == null ? "" : String(this._cents / 100);
    const inp = this.$("input");
    return inp ? inp.value : this.getAttribute("value") || "";
  }
  set value(v) {
    this.setAttribute("value", v == null ? "" : v);
    this._aplicarValorDisplay(v == null ? "" : v);
  }
  /** Número (só p/ formato="moeda"); senão Number(.value). */
  get numero() {
    if (this._formato() === "moeda") return this._cents == null ? null : this._cents / 100;
    return Number(this.value) || 0;
  }

  /** Sincroniza o texto exibido no <input> a partir de um valor (respeitando o formato). */
  _aplicarValorDisplay(v) {
    const inp = this.$("input");
    if (!inp) return;
    const f = this._formato();
    if (f === "moeda") { this._cents = centavosDe(v); inp.value = this._cents == null ? "" : moeda(this._cents / 100); }
    else if (f === "telefone") inp.value = mascaraTelefone(v || "");
    else if (f === "cnpj") inp.value = mascaraCnpj(v || "");
    else if (inp.value !== (v || "")) inp.value = v || "";
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
      input:focus-visible { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
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
    const formato = this._formato();
    let tipo = this.getAttribute("type") || "text";
    let inputmode = "";
    if (formato === "moeda") { tipo = "text"; inputmode = "decimal"; }
    else if (formato === "telefone" || formato === "cnpj") { tipo = "text"; inputmode = "numeric"; }
    const senha = tipo === "password";
    const valor = this.getAttribute("value") || "";
    const ph = this.getAttribute("placeholder") || "";
    const erro = this.getAttribute("error") || "";
    const extra = [];
    if (this.hasAttribute("step") && !formato) extra.push(`step="${this.getAttribute("step")}"`);
    if (this.hasAttribute("min") && !formato) extra.push(`min="${this.getAttribute("min")}"`);
    if (this.hasAttribute("required")) extra.push("required");
    if (inputmode) extra.push(`inputmode="${inputmode}"`);
    const input = `<input type="${tipo}" class="${senha ? "com-olho" : ""}" value="${String(valor).replace(/"/g, "&quot;")}"
             placeholder="${ph}" ${extra.join(" ")} />`;
    const campo = senha
      ? `<div class="wrap">${input}<button class="olho" type="button" tabindex="-1" aria-label="Mostrar senha"><ui-icon name="olho" size="18"></ui-icon></button></div>`
      : input;
    return `
      ${label ? `<label>${label}</label>` : ""}
      ${campo}
      ${erro ? `<div class="erro" role="alert">${erro}</div>` : ""}
    `;
  }

  aposRender() {
    const inp = this.$("input");
    if (!inp) return;
    const nome = this.getAttribute("name") || "";
    // Formata o valor inicial conforme o formato.
    if (this._formato()) this._aplicarValorDisplay(this.getAttribute("value") || "");

    inp.addEventListener("input", () => this._onInput());
    inp.addEventListener("change", () =>
      this.emitir("change", { value: this.value, name: nome })
    );
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.emitir("enter", { value: this.value, name: nome });
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

  _onInput() {
    const inp = this.$("input");
    if (!inp) return;
    const f = this._formato();
    if (f === "moeda") {
      const d = soDigitos(inp.value);
      this._cents = d === "" ? null : Number(d);
      inp.value = this._cents == null ? "" : moeda(this._cents / 100);
      const p = inp.value.length;
      try { inp.setSelectionRange(p, p); } catch (e) { /* alguns navegadores */ }
    } else if (f === "telefone") {
      inp.value = mascaraTelefone(inp.value);
    } else if (f === "cnpj") {
      inp.value = mascaraCnpj(inp.value);
    }
    this.emitir("input", { value: this.value, name: this.getAttribute("name") || "" });
  }
}

customElements.define("ui-input", UiInput);
