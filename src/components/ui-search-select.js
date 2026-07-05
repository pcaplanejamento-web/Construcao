/**
 * <ui-search-select> — Lista suspensa PESQUISÁVEL. Drop-in do <ui-select> para
 * listas grandes (itens, contatos, empresas…): mesma API pública —
 *   Propriedade `.options = [{ value, label }]`, `.value` (lê/escreve),
 *   atributos `label`/`placeholder`/`error`/`name`, evento "change" ({ value }).
 * Extra: atributo `criar` (rótulo) → mostra uma linha "+ <rótulo>" no fim da lista
 * e emite o evento "criar" (para o pai abrir o cadastro correspondente).
 *
 * O painel expande EM FLUXO (empurra o conteúdo, sem recortar dentro de modais
 * com overflow) e rola para ficar visível ao abrir. Teclado: ↑/↓ navega, Enter
 * escolhe, Esc fecha. Alvos de toque ≥ 44px.
 */
import { BaseElement } from "./base-element.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

class UiSearchSelect extends BaseElement {
  static get observedAttributes() {
    return ["label", "placeholder", "criar"];
  }
  attributeChangedCallback(nome) {
    if (!this.shadowRoot || !this.shadowRoot.childElementCount) return;
    if (nome === "placeholder") { this._refletirCampo(); return; }
    this.renderizar();
  }

  set options(lista) {
    this._options = Array.isArray(lista) ? lista : [];
    this._sincronizarLabel();
    if (this.shadowRoot.childElementCount) { this._refletirCampo(); this._pintarLista(); }
  }
  get options() { return this._options || []; }

  get value() { return this._value == null ? "" : this._value; }
  set value(v) {
    this._value = v == null ? "" : String(v);
    this._sincronizarLabel();
    this._refletirCampo();
  }

  _labelDe(v) {
    const o = this.options.find((x) => String(x.value) === String(v == null ? "" : v));
    return o ? o.label : "";
  }
  _sincronizarLabel() { this._selLabel = this._labelDe(this._value); }

  estilos() {
    return `
      :host { display: block; position: relative; }
      label { display: block; font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); }
      .wrap { position: relative; }
      .campo { width: 100%; height: 42px; padding: 0 40px 0 var(--esp-3); box-sizing: border-box;
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        background: var(--cor-superficie); color: var(--cor-texto); font-family: inherit; font-size: var(--fs-md);
        text-overflow: ellipsis; }
      .campo::placeholder { color: var(--cor-texto-fraco); }
      .campo:focus { outline: none; border-color: var(--cor-primaria); box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      :host([error]) .campo { border-color: var(--cor-erro); }
      .chev { position: absolute; right: 10px; top: 0; height: 42px; display: flex; align-items: center;
        color: var(--cor-texto-suave); cursor: pointer; }
      .chev svg { display: block; }
      .painel { margin-top: var(--esp-1); border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        background: var(--cor-superficie); box-shadow: var(--sombra-lg); overflow: hidden; }
      .lista { max-height: 240px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
      .op { display: block; width: 100%; text-align: left; border: none; background: none; cursor: pointer;
        padding: var(--esp-2) var(--esp-3); min-height: 44px; color: var(--cor-texto); font-family: inherit; font-size: var(--fs-md);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .op:hover, .op.hi { background: var(--cor-superficie-2); }
      .op.sel { color: var(--cor-primaria-escura); font-weight: var(--peso-semi); }
      .vazio { padding: var(--esp-3); color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      .criar { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; border: none; cursor: pointer;
        border-top: 1px solid var(--cor-divisor); background: var(--cor-superficie-2); color: var(--cor-primaria);
        padding: var(--esp-2) var(--esp-3); min-height: 44px; font-family: inherit; font-size: var(--fs-sm); font-weight: var(--peso-semi); }
      .criar:hover { background: var(--cor-primaria-suave); }
    `;
  }

  template() {
    const label = this.getAttribute("label");
    const criar = this.getAttribute("criar");
    return `
      ${label ? `<label>${esc(label)}</label>` : ""}
      <div class="wrap">
        <input class="campo" type="text" autocomplete="off" role="combobox" aria-expanded="false">
        <span class="chev" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
      </div>
      <div class="painel" hidden>
        <div class="lista" id="lista"></div>
        ${criar ? `<button class="criar" type="button">+ ${esc(criar)}</button>` : ""}
      </div>`;
  }

  aposRender() {
    const inp = this.$(".campo");
    if (!inp) return;
    this._refletirCampo();
    inp.addEventListener("focus", () => this._abrir());
    inp.addEventListener("input", () => { this._q = inp.value; this._hi = 0; this._pintarLista(); });
    inp.addEventListener("keydown", (e) => this._teclado(e));
    inp.addEventListener("blur", () => { this._blurT = setTimeout(() => this._fechar(), 160); });
    const chev = this.$(".chev");
    if (chev) chev.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (this._aberto) inp.blur();
      else inp.focus();
    });
    const criar = this.$(".criar");
    if (criar) criar.addEventListener("mousedown", (e) => {
      e.preventDefault();
      clearTimeout(this._blurT);
      this._fechar();
      this.emitir("criar");
    });
    this._pintarLista();
  }

  _refletirCampo() {
    const inp = this.$(".campo");
    if (!inp) return;
    if (!this._aberto) inp.value = this._selLabel || "";
    inp.setAttribute("placeholder", this._selLabel ? this._selLabel : (this.getAttribute("placeholder") || "Selecione…"));
  }

  _opcoesFiltradas() {
    const q = String(this._q || "").trim().toLowerCase();
    return this.options.filter((o) => !q || String(o.label).toLowerCase().includes(q));
  }

  _pintarLista() {
    const box = this.$("#lista");
    if (!box) return;
    const cs = this._opcoesFiltradas();
    if (this._hi == null || this._hi >= cs.length) this._hi = 0;
    box.innerHTML = cs.length
      ? cs.map((o, i) => `<button class="op ${String(o.value) === String(this._value) ? "sel" : ""} ${i === this._hi ? "hi" : ""}" type="button" data-v="${esc(o.value)}">${esc(o.label)}</button>`).join("")
      : `<div class="vazio">Nada encontrado.</div>`;
    box.querySelectorAll(".op").forEach((b) =>
      b.addEventListener("mousedown", (e) => { e.preventDefault(); clearTimeout(this._blurT); this._escolher(b.dataset.v); })
    );
  }

  _abrir() {
    if (this._aberto) return;
    this._aberto = true;
    this._q = "";
    this._hi = 0;
    const inp = this.$(".campo");
    if (inp) { inp.value = ""; inp.setAttribute("aria-expanded", "true"); }
    const p = this.$(".painel");
    if (p) p.hidden = false;
    this._pintarLista();
    if (p && p.scrollIntoView) { try { p.scrollIntoView({ block: "nearest" }); } catch (e) { /* noop */ } }
  }

  _fechar() {
    if (!this._aberto) return;
    this._aberto = false;
    const p = this.$(".painel");
    if (p) p.hidden = true;
    const inp = this.$(".campo");
    if (inp) inp.setAttribute("aria-expanded", "false");
    this._refletirCampo();
  }

  _escolher(v) {
    const val = v == null ? "" : String(v);
    this._value = val;
    this._sincronizarLabel();
    this._fechar();
    this.emitir("change", { value: val, name: this.getAttribute("name") || "" });
  }

  _teclado(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!this._aberto) { this.$(".campo").focus(); return; }
      const n = this._opcoesFiltradas().length;
      if (!n) return;
      this._hi = e.key === "ArrowDown" ? Math.min(n - 1, (this._hi || 0) + 1) : Math.max(0, (this._hi || 0) - 1);
      this._pintarLista();
      const hi = this.$(".op.hi");
      if (hi && hi.scrollIntoView) hi.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (!this._aberto) return;
      e.preventDefault();
      const cs = this._opcoesFiltradas();
      const o = cs[this._hi || 0];
      if (o) this._escolher(o.value);
    } else if (e.key === "Escape") {
      if (this._aberto) { e.preventDefault(); this.$(".campo").blur(); }
    }
  }
}

customElements.define("ui-search-select", UiSearchSelect);
