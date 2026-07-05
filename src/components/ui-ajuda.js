/**
 * <ui-ajuda> — Botão "?" que abre um POPOVER curto explicando um termo.
 *
 * Fica ao lado de um rótulo e ajuda quem não conhece o jargão do app.
 *   <ui-ajuda termo="responsabilidade"></ui-ajuda>          (busca no glossário)
 *   <ui-ajuda titulo="X" texto="..."></ui-ajuda>            (texto livre)
 *
 * - **Popover SOBREPOSTO**: portado ao `document.body` com `position: fixed`
 *   (mesmo padrão do `ui-select`) → não é recortado por modais nem empurra o
 *   layout; reposiciona ao rolar/redimensionar; fecha ao clicar fora / Esc /
 *   clicar de novo no "?".
 * - Acessível: `aria-label`, `aria-expanded`, `role="dialog"` no balão.
 */
import { BaseElement } from "./base-element.js";
import { termoGlossario } from "../features/shared/glossario.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS_PORTAL_ID = "uiajuda-portal-css";
function garantirCssPortal() {
  if (document.getElementById(CSS_PORTAL_ID)) return;
  const st = document.createElement("style");
  st.id = CSS_PORTAL_ID;
  st.textContent = `
    .uiajuda-portal { position: fixed; z-index: calc(var(--z-modal, 1000) + 70);
      max-width: 280px; border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-md);
      background: var(--cor-superficie); color: var(--cor-texto); box-shadow: var(--sombra-lg);
      padding: var(--esp-3); font-family: var(--fonte-base); font-size: var(--fs-sm); line-height: 1.5; }
    .uiajuda-portal h4 { margin: 0 0 var(--esp-1); font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto); }
    .uiajuda-portal p { margin: 0; color: var(--cor-texto-suave); }
  `;
  document.head.appendChild(st);
}

class UiAjuda extends BaseElement {
  static get observedAttributes() { return ["termo", "titulo", "texto"]; }
  attributeChangedCallback() {
    if (this.shadowRoot && this.shadowRoot.childElementCount && this._portal) this._pintar();
  }

  _conteudo() {
    const termo = this.getAttribute("termo");
    if (termo) {
      const g = termoGlossario(termo);
      if (g) return g;
    }
    return { titulo: this.getAttribute("titulo") || "Ajuda", texto: this.getAttribute("texto") || "" };
  }

  estilos() {
    return `
      :host { display: inline-flex; vertical-align: middle; }
      button { display: inline-flex; align-items: center; justify-content: center;
        width: 24px; height: 24px; padding: 0; border-radius: 50%; cursor: pointer;
        border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie-2);
        color: var(--cor-texto-suave); font-family: inherit; font-size: 13px; font-weight: var(--peso-semi);
        line-height: 1; transition: background .15s ease, color .15s ease, border-color .15s ease; }
      button:hover { background: var(--cor-primaria-suave); color: var(--cor-primaria-escura); border-color: var(--cor-primaria); }
      button:focus-visible { outline: none; border-color: var(--cor-primaria); box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      :host([aberto]) button { background: var(--cor-primaria-suave); color: var(--cor-primaria-escura); border-color: var(--cor-primaria); }
    `;
  }

  template() {
    const rot = this.getAttribute("titulo") || (termoGlossario(this.getAttribute("termo")) || {}).titulo || "este termo";
    return `<button type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Ajuda sobre ${esc(rot)}">?</button>`;
  }

  aposRender() {
    const b = this.$("button");
    if (b) b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this._alternar(); });
  }

  aoDesconectar() { this._fechar(); }

  _alternar() { if (this._portal) this._fechar(); else this._abrir(); }

  _abrir() {
    if (this._portal) return;
    garantirCssPortal();
    const p = document.createElement("div");
    p.className = "uiajuda-portal";
    p.setAttribute("role", "dialog");
    document.body.appendChild(p);
    this._portal = p;
    this._pintar();
    this._posicionar();

    this.setAttribute("aberto", "");
    const b = this.$("button");
    if (b) b.setAttribute("aria-expanded", "true");

    this._onDoc = (e) => {
      if (this._portal && this._portal.contains(e.target)) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(this) >= 0) return;
      this._fechar();
    };
    document.addEventListener("mousedown", this._onDoc, true);
    this._onKey = (e) => { if (e.key === "Escape") this._fechar(); };
    document.addEventListener("keydown", this._onKey, true);
    this._onScroll = () => this._posicionar();
    window.addEventListener("scroll", this._onScroll, true);
    window.addEventListener("resize", this._onScroll);
  }

  _fechar() {
    if (this._onDoc) { document.removeEventListener("mousedown", this._onDoc, true); this._onDoc = null; }
    if (this._onKey) { document.removeEventListener("keydown", this._onKey, true); this._onKey = null; }
    if (this._onScroll) { window.removeEventListener("scroll", this._onScroll, true); window.removeEventListener("resize", this._onScroll); this._onScroll = null; }
    if (this._portal) { this._portal.remove(); this._portal = null; }
    this.removeAttribute("aberto");
    const b = this.$("button");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  _pintar() {
    if (!this._portal) return;
    const { titulo, texto } = this._conteudo();
    this._portal.innerHTML = `${titulo ? `<h4>${esc(titulo)}</h4>` : ""}<p>${esc(texto)}</p>`;
    this._posicionar();
  }

  _posicionar() {
    const p = this._portal;
    if (!p) return;
    const r = this.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const larg = Math.min(280, p.offsetWidth || 280);
    // Horizontal: alinha à esquerda do "?", mas sem estourar a viewport.
    let left = r.left;
    if (left + larg > vw - 8) left = Math.max(8, vw - 8 - larg);
    p.style.left = Math.round(left) + "px";
    p.style.width = "auto";
    // Vertical: abaixo se couber; senão acima.
    const alt = p.offsetHeight || 120;
    const abaixo = vh - r.bottom;
    if (abaixo >= alt + 8 || abaixo >= r.top) {
      p.style.top = Math.round(r.bottom + 6) + "px";
      p.style.bottom = "auto";
    } else {
      p.style.top = "auto";
      p.style.bottom = Math.round(vh - r.top + 6) + "px";
    }
  }
}

customElements.define("ui-ajuda", UiAjuda);
