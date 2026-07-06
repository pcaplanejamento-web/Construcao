/**
 * <ui-select> — Combobox PESQUISÁVEL, o dropdown padrão de TODO o sistema.
 *
 * - **Painel sobreposto** (overlay): a lista é portada para o `document.body`
 *   com `position: fixed` (posicionada pelo retângulo do campo) → **não altera a
 *   largura/altura** do container nem é recortada por modais (que têm
 *   `overflow`/`backdrop-filter`). Reposiciona ao rolar/redimensionar; fecha ao
 *   clicar fora / Esc.
 * - **Seta**: aponta para BAIXO fechado e para CIMA aberto; clicável em qualquer
 *   estado (abre/fecha, mesmo após a seleção).
 * - **Busca** (filtra por rótulo), teclado (↑/↓/Enter/Esc), alvos ≥44px.
 * - Acoes por opcao: se a opcao traz `editavel`/`removivel`, mostra icones de
 *   editar/excluir; ao clicar emite os eventos `editar`/`excluir` ({value}) — o
 *   pai decide o que fazer (abrir o form / remover, com as regras de vinculo).
 * - Opcional `criar` (rótulo) → linha "+ <rótulo>" + evento `criar`.
 *
 * API retrocompatível: `.options=[{value,label,editavel?,removivel?}]`, `.value`
 * (lê/escreve), atributos `label`/`name`/`value`/`placeholder`/`error`/`criar`,
 * eventos `change` ({value,name}), `criar`, `editar`, `excluir`.
 */
import { BaseElement } from "./base-element.js";
import "./ui-ajuda.js";
import { vibrar, pulso, HAPTICO } from "./haptic.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SVG_EDIT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>`;
const SVG_TRASH = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6"/></svg>`;

const CSS_PORTAL_ID = "uisel-portal-css";
function garantirCssPortal() {
  if (document.getElementById(CSS_PORTAL_ID)) return;
  const st = document.createElement("style");
  st.id = CSS_PORTAL_ID;
  st.textContent = `
    .uisel-portal { position: fixed; z-index: calc(var(--z-modal, 1000) + 60);
      border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
      background: var(--cor-superficie); box-shadow: var(--sombra-lg); overflow: hidden;
      display: flex; flex-direction: column; font-family: var(--fonte-base); }
    .uisel-lista { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .uisel-row { display: flex; align-items: stretch; }
    .uisel-op { flex: 1; min-width: 0; text-align: left; border: none; background: none; cursor: pointer;
      padding: var(--esp-2) var(--esp-3); min-height: 44px; color: var(--cor-texto); font-family: inherit; font-size: var(--fs-md);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .uisel-op:hover, .uisel-row.hi .uisel-op { background: var(--cor-superficie-2); }
    .uisel-op.sel { color: var(--cor-primaria-escura); font-weight: var(--peso-semi); }
    .uisel-acoes { display: flex; align-items: center; gap: 2px; padding-right: 6px; flex: none; }
    .uisel-ic { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px;
      border: none; background: none; cursor: pointer; color: var(--cor-texto-fraco); border-radius: var(--raio-sm); }
    .uisel-ic:hover { background: var(--cor-superficie); color: var(--cor-texto); }
    .uisel-ic.uisel-excluir:hover { color: var(--cor-erro); }
    .uisel-vazio { padding: var(--esp-3); color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    .uisel-criar { display: flex; align-items: center; gap: 6px; width: 100%; text-align: left; border: none; cursor: pointer;
      border-top: 1px solid var(--cor-divisor); background: var(--cor-superficie-2); color: var(--cor-primaria); flex: none;
      padding: var(--esp-2) var(--esp-3); min-height: 44px; font-family: inherit; font-size: var(--fs-sm); font-weight: var(--peso-semi); }
    .uisel-criar:hover { background: var(--cor-primaria-suave); }
  `;
  document.head.appendChild(st);
}

class UiSelect extends BaseElement {
  static get observedAttributes() { return ["label", "placeholder", "criar", "value", "ajuda", "ajuda-titulo", "ajuda-texto", "required"]; }
  attributeChangedCallback(nome, ant, novo) {
    if (!this.shadowRoot || !this.shadowRoot.childElementCount) return;
    if (nome === "value") { this._value = novo == null ? "" : String(novo); this._sincronizarLabel(); this._refletirCampo(); return; }
    if (nome === "placeholder") { this._refletirCampo(); return; }
    this.renderizar();
  }

  set options(lista) {
    this._options = Array.isArray(lista) ? lista : [];
    this._sincronizarLabel();
    if (this.shadowRoot.childElementCount) { this._refletirCampo(); if (this._aberto) this._pintarLista(); }
  }
  get options() { return this._options || []; }

  get value() {
    if (this._value == null) { const av = this.getAttribute("value"); return av == null ? "" : av; }
    return this._value;
  }
  set value(v) {
    this._value = v == null ? "" : String(v);
    this._sincronizarLabel();
    this._refletirCampo();
  }

  _labelDe(v) {
    const o = this.options.find((x) => String(x.value) === String(v == null ? "" : v));
    return o ? o.label : "";
  }
  _sincronizarLabel() { this._selLabel = this._labelDe(this.value); }

  estilos() {
    return `
      :host { display: block; }
      label { display: block; font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); }
      label ui-ajuda { margin-left: 4px; }
      label .obrig { color: var(--cor-erro); margin-left: 2px; font-weight: var(--peso-semi); }
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
      .chev svg { display: block; transition: transform .15s ease; }
      :host([aberto]) .chev svg { transform: rotate(180deg); }
      .erro { color: var(--cor-erro); font-size: var(--fs-xs); margin-top: var(--esp-1); }
    `;
  }

  template() {
    const label = this.getAttribute("label");
    const erro = this.getAttribute("error") || "";
    const aT = this.getAttribute("ajuda"), aTit = this.getAttribute("ajuda-titulo"), aTxt = this.getAttribute("ajuda-texto");
    const ajuda = (aT || aTit || aTxt)
      ? `<ui-ajuda${aT ? ` termo="${esc(aT)}"` : ""}${aTit ? ` titulo="${esc(aTit)}"` : ""}${aTxt ? ` texto="${esc(aTxt)}"` : ""}></ui-ajuda>`
      : "";
    const obrig = this.hasAttribute("required") ? `<span class="obrig" aria-hidden="true">*</span>` : "";
    const ariaReq = this.hasAttribute("required") ? ` aria-required="true"` : "";
    return `
      ${label ? `<label>${esc(label)}${obrig}${ajuda}</label>` : ""}
      <div class="wrap">
        <input class="campo" type="text" autocomplete="off" role="combobox" aria-expanded="false"${ariaReq}>
        <span class="chev" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
      </div>
      ${erro ? `<div class="erro" role="alert">${esc(erro)}</div>` : ""}`;
  }

  aposRender() {
    const inp = this.$(".campo");
    if (!inp) return;
    if (this._value == null) {
      const av = this.getAttribute("value");
      if (av != null) { this._value = av; this._sincronizarLabel(); }
    }
    this._refletirCampo();
    inp.addEventListener("focus", () => this._abrir());
    inp.addEventListener("input", () => { this._q = inp.value; this._hi = 0; this._pintarLista(); });
    inp.addEventListener("keydown", (e) => this._teclado(e));
    const chev = this.$(".chev");
    if (chev) chev.addEventListener("mousedown", (e) => { e.preventDefault(); if (this._aberto) this._fechar(); else this._abrir(); });
  }

  aoDesconectar() { this._fechar(); }

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

  /* ------------------------------ Abrir/fechar ------------------------------ */
  _abrir() {
    if (this._aberto) return;
    this._aberto = true;
    this._q = "";
    this._hi = 0;
    this.setAttribute("aberto", "");
    const inp = this.$(".campo");
    if (inp) { inp.focus(); inp.value = ""; inp.setAttribute("aria-expanded", "true"); }

    garantirCssPortal();
    const p = document.createElement("div");
    p.className = "uisel-portal";
    const criar = this.getAttribute("criar");
    p.innerHTML = `<div class="uisel-lista"></div>${criar ? `<button class="uisel-criar" type="button">+ ${esc(criar)}</button>` : ""}`;
    document.body.appendChild(p);
    this._portal = p;
    const btnCriar = p.querySelector(".uisel-criar");
    if (btnCriar) btnCriar.addEventListener("mousedown", (e) => { e.preventDefault(); this._fechar(); this.emitir("criar"); });

    this._pintarLista();
    this._posicionar();

    this._onDoc = (e) => {
      if (this._portal && this._portal.contains(e.target)) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(this) >= 0) return;
      this._fechar();
    };
    document.addEventListener("mousedown", this._onDoc, true);
    this._onScroll = () => this._posicionar();
    window.addEventListener("scroll", this._onScroll, true);
    window.addEventListener("resize", this._onScroll);
    // Teclado do celular: a `visualViewport` encolhe (o `innerHeight` não) — ao
    // abrir/fechar o teclado, reposiciona a lista ACIMA dele e mantém o CAMPO
    // visível (rola até ele se ficar atrás do teclado).
    this._onVV = () => { this._posicionar(); this._garantirCampoVisivel(); };
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", this._onVV);
      window.visualViewport.addEventListener("scroll", this._onVV);
    }
    this._garantirCampoVisivel();
  }

  _fechar() {
    this.removeAttribute("aberto");
    const inp = this.$(".campo");
    if (inp) inp.setAttribute("aria-expanded", "false");
    if (this._onDoc) { document.removeEventListener("mousedown", this._onDoc, true); this._onDoc = null; }
    if (this._onScroll) { window.removeEventListener("scroll", this._onScroll, true); window.removeEventListener("resize", this._onScroll); this._onScroll = null; }
    if (this._onVV && window.visualViewport) { window.visualViewport.removeEventListener("resize", this._onVV); window.visualViewport.removeEventListener("scroll", this._onVV); }
    this._onVV = null;
    if (this._portal) { this._portal.remove(); this._portal = null; }
    if (!this._aberto) { this._refletirCampo(); return; }
    this._aberto = false;
    this._refletirCampo();
  }

  _posicionar() {
    const p = this._portal;
    if (!p) return;
    const r = this.getBoundingClientRect();
    p.style.left = Math.round(r.left) + "px";
    p.style.width = Math.round(r.width) + "px";
    // Usa a `visualViewport` (área REAL acima do teclado) — o `innerHeight` não
    // encolhe quando o teclado abre no celular, então a lista abriria escondida.
    const vv = window.visualViewport;
    const vTop = vv ? vv.offsetTop : 0;
    const vH = vv ? vv.height : (window.innerHeight || document.documentElement.clientHeight);
    const ih = window.innerHeight || document.documentElement.clientHeight;
    const gap = 4;
    const teto = 280;
    const abaixo = (vTop + vH) - r.bottom; // espaço visível abaixo do campo
    const acima = r.top - vTop;            // espaço visível acima do campo
    // NUNCA sobre o campo: a lista é ancorada pela borda que ENCOSTA no campo —
    // abaixo → `top` no rodapé do campo; acima → `bottom` no topo do campo. Assim
    // ela é sempre ANTES ou DEPOIS, jamais cobrindo o campo de escrita.
    if (abaixo >= 160 || abaixo >= acima) {
      p.style.top = Math.round(r.bottom + gap) + "px";
      p.style.bottom = "auto";
      p.style.maxHeight = Math.max(96, Math.min(teto, abaixo - gap - 4)) + "px";
    } else {
      p.style.top = "auto";
      p.style.bottom = Math.round(ih - r.top + gap) + "px";
      p.style.maxHeight = Math.max(96, Math.min(teto, acima - gap - 4)) + "px";
    }
  }

  /** Mantém o CAMPO visível acima do teclado (rola até ele se estiver coberto). */
  _garantirCampoVisivel() {
    const vv = window.visualViewport;
    if (!vv || typeof this.scrollIntoView !== "function") return;
    const r = this.getBoundingClientRect();
    const margem = 12;
    if (r.bottom > vv.offsetTop + vv.height - margem || r.top < vv.offsetTop + margem) {
      this.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  /* -------------------------------- Lista --------------------------------- */
  _pintarLista() {
    const p = this._portal;
    if (!p) return;
    const box = p.querySelector(".uisel-lista");
    const cs = this._opcoesFiltradas();
    if (this._hi == null || this._hi >= cs.length) this._hi = 0;
    box.innerHTML = cs.length ? cs.map((o, i) => this._rowHtml(o, i)).join("") : `<div class="uisel-vazio">Nada encontrado.</div>`;
    box.querySelectorAll(".uisel-op").forEach((b) =>
      b.addEventListener("mousedown", (e) => { e.preventDefault(); this._escolher(b.dataset.v); })
    );
    box.querySelectorAll(".uisel-editar").forEach((b) =>
      b.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); this._acao("editar", b.dataset.v); })
    );
    box.querySelectorAll(".uisel-excluir").forEach((b) =>
      b.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); this._acao("excluir", b.dataset.v); })
    );
  }

  _rowHtml(o, i) {
    const sel = String(o.value) === String(this.value) ? "sel" : "";
    const acoes = (o.editavel || o.removivel)
      ? `<span class="uisel-acoes">${o.editavel ? `<button class="uisel-ic uisel-editar" type="button" data-v="${esc(o.value)}" title="Editar" aria-label="Editar">${SVG_EDIT}</button>` : ""}${o.removivel ? `<button class="uisel-ic uisel-excluir" type="button" data-v="${esc(o.value)}" title="Excluir" aria-label="Excluir">${SVG_TRASH}</button>` : ""}</span>`
      : "";
    return `<div class="uisel-row ${i === this._hi ? "hi" : ""}"><button class="uisel-op ${sel}" type="button" data-v="${esc(o.value)}">${esc(o.label)}</button>${acoes}</div>`;
  }

  _escolher(v) {
    const val = v == null ? "" : String(v);
    this._value = val;
    this._sincronizarLabel();
    this._fechar();
    // Clique tátil (onde há vibração) + pulso visual no controle (iOS não vibra).
    vibrar(HAPTICO.selecionar);
    pulso(this.$(".campo") || this.$("button") || this, 0.97);
    this.emitir("change", { value: val, name: this.getAttribute("name") || "" });
  }

  _acao(tipo, v) {
    this._fechar();
    this.emitir(tipo, { value: v == null ? "" : String(v) });
  }

  _teclado(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!this._aberto) { this._abrir(); return; }
      const n = this._opcoesFiltradas().length;
      if (!n) return;
      this._hi = e.key === "ArrowDown" ? Math.min(n - 1, (this._hi || 0) + 1) : Math.max(0, (this._hi || 0) - 1);
      this._pintarLista();
      const hi = this._portal && this._portal.querySelector(".uisel-row.hi");
      if (hi && hi.scrollIntoView) hi.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (!this._aberto) return;
      e.preventDefault();
      const o = this._opcoesFiltradas()[this._hi || 0];
      if (o) this._escolher(o.value);
    } else if (e.key === "Escape") {
      if (this._aberto) { e.preventDefault(); this._fechar(); }
    } else if (e.key === "Tab") {
      if (this._aberto) this._fechar();
    }
  }
}

customElements.define("ui-select", UiSelect);
