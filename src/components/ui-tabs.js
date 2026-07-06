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
  // Chave de cache da aba ativa: por rota + assinatura das abas (não colide com
  // abas de outro conjunto na mesma rota, ex.: modais/forms).
  _chaveCache() {
    return "aba:" + (location.pathname || "/") + "#" + this.abas.map((a) => a.id).join(",");
  }
  get ativo() {
    const attr = this.getAttribute("ativo");
    if (attr) return attr;
    // Restaura a aba ativa salva (estado da página ao voltar).
    try {
      const s = sessionStorage.getItem(this._chaveCache());
      if (s && this.abas.some((a) => a.id === s)) return s;
    } catch (e) {
      /* sessionStorage indisponível */
    }
    return (this.abas[0] || {}).id || "";
  }

  estilos() {
    return `
      :host { display: block; }
      /* Em telas estreitas as abas NÃO quebram: rolam na horizontal (sem barra
         de rolagem visível) — o conteúdo nunca estoura a proporção da tela.
         Um DEGRADÊ nas bordas sinaliza que há mais abas para rolar (some quando
         chega ao início/fim). */
      .abas-wrap { position: relative; }
      .barra { display: flex; gap: var(--esp-1); border-bottom: 1px solid var(--cor-borda);
        margin-bottom: var(--esp-5); flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden;
        -webkit-overflow-scrolling: touch; scrollbar-width: none; touch-action: pan-x; }
      .barra::-webkit-scrollbar { display: none; }
      .fade { position: absolute; top: 0; bottom: 0; width: 28px; pointer-events: none;
        opacity: 0; transition: opacity .15s ease; z-index: 1; }
      .fade-esq { left: 0; background: linear-gradient(to right, var(--cor-fundo), transparent); }
      .fade-dir { right: 0; background: linear-gradient(to left, var(--cor-fundo), transparent); }
      .abas-wrap.tem-esq .fade-esq, .abas-wrap.tem-dir .fade-dir { opacity: 1; }
      @media (prefers-reduced-motion: reduce) { .fade { transition: none; } }
      button { display: inline-flex; align-items: center; gap: var(--esp-2); flex: none;
        white-space: nowrap; background: none; border: none; cursor: pointer;
        padding: var(--esp-3) var(--esp-4);
        font-size: var(--fs-sm); font-weight: var(--peso-medio); color: var(--cor-texto-suave);
        border-bottom: 2.5px solid transparent; margin-bottom: -1px; }
      button:hover { color: var(--cor-texto); }
      /* Ativo: muda APENAS a cor (texto + ícone via currentColor) e a barra
         inferior. Sem alterar font-weight/size → não há reflow nem deslocamento. */
      button.ativo { color: var(--cor-primaria); border-bottom-color: var(--cor-primaria); }
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
      <div class="abas-wrap">
        <div class="barra" role="tablist">${botoes}</div>
        <span class="fade fade-esq"></span>
        <span class="fade fade-dir"></span>
      </div>
      <div class="painel"><slot name="${ativo}"></slot></div>
    `;
  }

  aposRender() {
    this.$$("button").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.id === this.ativo) return;
        try {
          sessionStorage.setItem(this._chaveCache(), b.dataset.id); // lembra a aba (estado da página)
        } catch (e) {
          /* sessionStorage indisponível */
        }
        this.setAttribute("ativo", b.dataset.id); // dispara re-render
        this.emitir("mudar", { id: b.dataset.id });
      })
    );

    // Indicador de rolagem: degradê nas bordas quando há abas fora de vista.
    const barra = this.$(".barra");
    if (barra) {
      barra.addEventListener("scroll", () => this._atualizarFades(), { passive: true });
      if (!this._onResize) {
        this._onResize = () => this._atualizarFades();
        window.addEventListener("resize", this._onResize);
        this.aoLimpar(() => window.removeEventListener("resize", this._onResize));
      }
      this._centralizarAtiva();
      this._atualizarFades();
    }

    this._ligarSwipeAbas();
  }

  /**
   * Swipe horizontal no PAINEL troca de aba (anterior/próxima). Usa eventos de
   * PONTEIRO só de TOQUE, no elemento `.painel` — assim as linhas de
   * `ui-lista-gestos` (que dão stopPropagation no arraste horizontal) VENCEM: um
   * swipe na linha edita/exclui e NÃO troca de aba. Também ignora quando o dedo
   * começou sobre um conteúdo que rola na horizontal (tabela/gráfico).
   */
  _ligarSwipeAbas() {
    const painel = this.$(".painel");
    if (!painel) return;
    let x0 = 0, y0 = 0, valido = false, scroller = false;
    painel.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") { valido = false; return; }
      x0 = e.clientX; y0 = e.clientY; valido = true;
      scroller = this._alvoRolaHorizontal(e.target);
    });
    const fim = (e) => {
      if (!valido || e.pointerType !== "touch") return;
      valido = false;
      if (scroller) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) this._irAba(dx < 0 ? 1 : -1);
    };
    painel.addEventListener("pointerup", fim);
    painel.addEventListener("pointercancel", () => { valido = false; });
  }

  /** Algum ancestral (até o painel) rola na horizontal? (não sequestrar a rolagem dele). */
  _alvoRolaHorizontal(alvo) {
    const painel = this.$(".painel");
    let n = alvo;
    while (n && n !== painel && n !== this) {
      if (n.scrollWidth && n.clientWidth && n.scrollWidth > n.clientWidth + 4) {
        const ovx = getComputedStyle(n).overflowX;
        if (ovx === "auto" || ovx === "scroll") return true;
      }
      n = n.assignedSlot || (n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode);
    }
    return false;
  }

  /** Vai para a aba deslocada por `delta` (sem loop nas pontas). */
  _irAba(delta) {
    const abas = this.abas;
    if (abas.length < 2) return;
    const i = abas.findIndex((a) => a.id === this.ativo);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= abas.length) return;
    const id = abas[j].id;
    try { sessionStorage.setItem(this._chaveCache(), id); } catch (e) { /* indisponível */ }
    this.setAttribute("ativo", id);
    this.emitir("mudar", { id });
  }

  /** Mostra/esconde o degradê conforme a posição da rolagem. */
  _atualizarFades() {
    const barra = this.$(".barra");
    const wrap = this.$(".abas-wrap");
    if (!barra || !wrap) return;
    const max = barra.scrollWidth - barra.clientWidth;
    wrap.classList.toggle("tem-esq", barra.scrollLeft > 1);
    wrap.classList.toggle("tem-dir", max > 1 && barra.scrollLeft < max - 1);
  }

  /** Rola a aba ativa para dentro da vista (sem mexer na rolagem vertical da página). */
  _centralizarAtiva() {
    const barra = this.$(".barra");
    const at = this.$("button.ativo");
    if (!barra || !at) return;
    const bRect = barra.getBoundingClientRect();
    const aRect = at.getBoundingClientRect();
    const delta = (aRect.left - bRect.left) - (barra.clientWidth - at.clientWidth) / 2;
    barra.scrollLeft += delta;
  }
}

customElements.define("ui-tabs", UiTabs);
