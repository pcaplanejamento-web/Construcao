/**
 * <category-breakdown> — Valores em barras (CSS puro). Preenche a altura do
 * cartão; com muitos itens, rola verticalmente. O título é configurável via o
 * atributo `titulo` (padrão "Gastos por categoria") p/ reuso em outros contextos.
 *
 * Propriedade: .porCategoria = [{ nome, cor, total, ...ref }]
 *   .formato = (item, totalGeral) => string  (opcional; formata o VALOR — padrão
 *              "R$ x · y%"; use p/ valores não-monetários, ex.: quantidade em estoque).
 *   .aoSelecionar = (item, indice) => void   (opcional; ao clicar numa barra abre
 *              o banner de origem — item 4. Sem o callback, as barras não clicam.)
 * Atributos: titulo, vazio (texto do estado vazio)
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, percentual } from "../../core/formatters.js";

class CategoryBreakdown extends BaseElement {
  static get observedAttributes() {
    return ["titulo", "vazio"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  set porCategoria(v) {
    this._lista = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get porCategoria() {
    return this._lista || [];
  }
  /** Formatador do VALOR (opcional). Defina ANTES de `porCategoria` (que dispara o render). */
  set formato(fn) {
    this._formato = typeof fn === "function" ? fn : null;
  }
  /** Callback de clique numa barra (opcional). Habilita a interação. */
  set aoSelecionar(fn) {
    this._aoSel = typeof fn === "function" ? fn : null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get titulo() {
    return this.getAttribute("titulo") || "Gastos por categoria";
  }
  get vazioTexto() {
    return this.getAttribute("vazio") || "Sem despesas ainda.";
  }

  estilos() {
    return `
      :host { display: flex; flex-direction: column; height: 100%; }
      .titulo { font-size: var(--fs-md); font-weight: var(--peso-semi);
        margin-bottom: var(--esp-4); flex: none; }
      .lista { flex: 1; min-height: 0; overflow-y: auto; padding-right: var(--esp-2); }
      .linha { margin-bottom: var(--esp-3); }
      .top { display: flex; justify-content: space-between; font-size: var(--fs-sm);
        margin-bottom: 4px; gap: var(--esp-2); }
      .nome { color: var(--cor-texto); font-weight: var(--peso-medio);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .total { color: var(--cor-texto-suave); white-space: nowrap; }
      .barra { height: 10px; background: var(--cor-borda); border-radius: var(--raio-completo); overflow: hidden; }
      .barra > div { height: 100%; border-radius: var(--raio-completo); transition: width .3s; }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      /* Interativo (item 4): barra clicável abre o banner de origem. */
      .lista.clicavel .linha { cursor: pointer; border-radius: var(--raio-sm); padding: 2px 4px; margin: 0 -4px var(--esp-3); }
      .lista.clicavel .linha:hover { background: var(--cor-superficie-2); }
    `;
  }

  template() {
    const lista = this.porCategoria;
    if (!lista.length) {
      return `<div class="titulo">${this.titulo}</div><div class="vazio">${this.vazioTexto}</div>`;
    }
    const total = lista.reduce((s, c) => s + (Number(c.total) || 0), 0);
    const linhas = lista
      .map((c, i) => {
        const pct = percentual(c.total, total);
        const valTxt = this._formato ? this._formato(c, total) : `${moeda(c.total)} · ${pct}%`;
        return `
        <div class="linha" data-i="${i}">
          <div class="top">
            <span class="nome">${c.nome}</span>
            <span class="total">${valTxt}</span>
          </div>
          <div class="barra"><div style="width:${pct}%;background:${c.cor || "var(--cor-neutro)"}"></div></div>
        </div>`;
      })
      .join("");
    return `<div class="titulo">${this.titulo}</div><div class="lista ${this._aoSel ? "clicavel" : ""}">${linhas}</div>`;
  }

  aposRender() {
    if (!this._aoSel) return;
    this.$$(".linha").forEach((el) =>
      el.addEventListener("click", () => {
        const i = Number(el.dataset.i);
        const datum = this.porCategoria[i];
        if (datum) this._aoSel(datum, i);
      })
    );
  }
}

customElements.define("category-breakdown", CategoryBreakdown);
