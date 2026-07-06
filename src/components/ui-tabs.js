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

const INICIO_PX = 10; // move mínimo p/ decidir a direção (horizontal × rolagem vertical)

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

      /* Paginação 2D no toque: o PAINEL é a "janela"; a TRILHA desliza acompanhando
         o dedo e a aba vizinha entra de lado. Em repouso há só uma célula (100%).
         O clip horizontal só é ligado (via JS) durante o arraste — assim o repouso
         não vira contêiner de rolagem (não quebra sticky/overflow do conteúdo). */
      .painel { position: relative; touch-action: pan-y; }
      .trilho { display: flex; }
      .cel { flex: 0 0 auto; width: 100%; box-sizing: border-box; min-width: 0; }
      @media (prefers-reduced-motion: reduce) { .trilho { transition: none !important; } }
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
      <div class="painel"><div class="trilho"><div class="cel"><slot name="${ativo}"></slot></div></div></div>
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
   * PAGINAÇÃO 2D no toque: arrastar o painel desliza a trilha ACOMPANHANDO O DEDO
   * e a aba vizinha entra de lado (sem "virar página" de livro); ao soltar, cai na
   * nova aba ou volta com uma mola suave. Só TOQUE, no `.painel` — assim as linhas
   * de `ui-lista-gestos` (stopPropagation no arraste) VENCEM, e um conteúdo que rola
   * na horizontal (tabela/gráfico) não é sequestrado. Em `ui-tabs` aninhado, só o
   * mais interno pagina (trava compartilhada `UiTabs._paginando`).
   */
  _ligarSwipeAbas() {
    const painel = this.$(".painel");
    if (!painel) return;
    this._sw = null;
    painel.addEventListener("pointerdown", (e) => this._swDown(e, painel));
  }

  _swDown(e, painel) {
    if (e.pointerType !== "touch") return;
    if (this.abas.length < 2) return;
    if (UiTabs._paginando) return; // outra aba (aninhada) já está paginando
    if (this._alvoRolaHorizontal(e.target)) return; // não sequestra rolagem horizontal interna
    const i = this.abas.findIndex((a) => a.id === this.ativo);
    if (i < 0) return;
    const w = painel.clientWidth || painel.getBoundingClientRect().width;
    this._sw = { painel, i, w, x0: e.clientX, y0: e.clientY, dx: 0, off: 0, base: 0,
      vx: 0, xPrev: e.clientX, tPrev: e.timeStamp || 0, pid: e.pointerId, ativo: false };
    this._swMove = (ev) => this._swPMove(ev);
    this._swUp = (ev) => this._swPUp(ev);
    window.addEventListener("pointermove", this._swMove, { passive: false });
    window.addEventListener("pointerup", this._swUp);
    window.addEventListener("pointercancel", this._swUp);
  }

  _swPMove(e) {
    const s = this._sw;
    if (!s) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (!s.ativo) {
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < INICIO_PX && ady < INICIO_PX) return; // indeciso — espera a direção
      if (adx <= ady) { this._swLimpar(); return; }   // vertical → rolagem nativa
      if (UiTabs._paginando && UiTabs._paginando !== this) { this._swLimpar(); return; }
      UiTabs._paginando = this; s.ativo = true;
      this._montarPaginacao(s);
    }
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const t = e.timeStamp || 0;
    if (s.tPrev && t > s.tPrev) s.vx = (e.clientX - s.xPrev) / (t - s.tPrev);
    s.xPrev = e.clientX; s.tPrev = t;
    s.dx = dx;
    let off = s.base + dx;
    // Rubber-band nas pontas (sem vizinho naquele lado): resiste em vez de abrir vazio.
    const min = s.temNext ? s.base - s.w : s.base;
    const max = s.temPrev ? s.base + s.w : s.base;
    if (off < min) off = min + (off - min) * 0.22;
    else if (off > max) off = max + (off - max) * 0.22;
    s.off = off;
    const trilho = this.$(".trilho");
    if (trilho) trilho.style.transform = `translateX(${off}px)`;
  }

  _swPUp(e) {
    const s = this._sw;
    if (!s) return;
    if (!s.ativo) { this._swLimpar(); return; }
    e.stopPropagation();
    const trilho = this.$(".trilho");
    const limiar = Math.max(45, s.w * 0.30);
    const flick = Math.abs(s.vx || 0) >= 0.3 && Math.abs(s.dx) >= 24;
    let destino = 0; // -1 anterior · +1 próxima · 0 fica
    if ((s.dx <= -limiar || (flick && s.dx < 0)) && s.temNext) destino = 1;
    else if ((s.dx >= limiar || (flick && s.dx > 0)) && s.temPrev) destino = -1;
    const alvo = s.base - destino * s.w;
    const novoId = destino === 1 ? this.abas[s.i + 1].id : destino === -1 ? this.abas[s.i - 1].id : null;
    const dur = destino === 0 ? 0.28 : 0.34;
    if (trilho) {
      trilho.style.transition = `transform ${dur}s cubic-bezier(0.22, 1, 0.36, 1)`;
      void trilho.offsetWidth; // reflow → transição a partir do offset atual
      trilho.style.transform = `translateX(${alvo}px)`;
    }
    const finalizar = () => {
      if (UiTabs._paginando === this) UiTabs._paginando = null;
      if (s.painel) s.painel.style.overflow = "";
      if (novoId) {
        try { sessionStorage.setItem(this._chaveCache(), novoId); } catch (err) { /* indisponível */ }
        this.setAttribute("ativo", novoId); // re-render → volta a uma célula
        this.emitir("mudar", { id: novoId });
      } else {
        this.renderizar(); // restaura a célula única
      }
    };
    let feito = false;
    const onEnd = () => { if (feito) return; feito = true; if (trilho) trilho.removeEventListener("transitionend", onEnd); finalizar(); };
    if (trilho) trilho.addEventListener("transitionend", onEnd);
    setTimeout(onEnd, Math.round(dur * 1000) + 80);
    // solta os listeners de janela (mas deixa a transição da trilha correr)
    if (this._swMove) { window.removeEventListener("pointermove", this._swMove, { passive: false }); this._swMove = null; }
    if (this._swUp) { window.removeEventListener("pointerup", this._swUp); window.removeEventListener("pointercancel", this._swUp); this._swUp = null; }
    this._sw = null;
  }

  /** Monta a trilha com a célula atual + as vizinhas existentes; posiciona a atual em 0. */
  _montarPaginacao(s) {
    const trilho = this.$(".trilho");
    if (!trilho) return;
    const abas = this.abas, i = s.i, w = s.w;
    s.temPrev = i > 0;
    s.temNext = i < abas.length - 1;
    const cel = (id) => `<div class="cel" style="width:${w}px"><slot name="${id}"></slot></div>`;
    let html = "";
    if (s.temPrev) html += cel(abas[i - 1].id);
    html += cel(abas[i].id);
    if (s.temNext) html += cel(abas[i + 1].id);
    trilho.style.transition = "none";
    trilho.innerHTML = html;
    s.base = s.temPrev ? -w : 0;
    trilho.style.transform = `translateX(${s.base}px)`;
    s.painel.style.overflow = "hidden"; // clip horizontal só durante o arraste
    try { s.painel.setPointerCapture(s.pid); } catch (err) { /* ok */ }
  }

  /** Aborta o gesto antes de engatar (rolagem vertical) — sem tocar na trilha. */
  _swLimpar() {
    if (this._swMove) { window.removeEventListener("pointermove", this._swMove, { passive: false }); this._swMove = null; }
    if (this._swUp) { window.removeEventListener("pointerup", this._swUp); window.removeEventListener("pointercancel", this._swUp); this._swUp = null; }
    if (UiTabs._paginando === this) UiTabs._paginando = null;
    const s = this._sw;
    if (s && s.painel) s.painel.style.overflow = "";
    this._sw = null;
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

  aoDesconectar() { this._swLimpar(); }
}

customElements.define("ui-tabs", UiTabs);
