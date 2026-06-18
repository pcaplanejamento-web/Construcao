/**
 * <category-breakdown> — Gastos por categoria em barras proporcionais (CSS puro).
 *
 * Propriedade: .porCategoria = [{ categoria_id, nome, cor, total }]
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, percentual } from "../../core/formatters.js";

class CategoryBreakdown extends BaseElement {
  set porCategoria(v) {
    this._lista = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get porCategoria() {
    return this._lista || [];
  }

  estilos() {
    return `
      :host { display: block; }
      .titulo { font-size: var(--fs-md); font-weight: var(--peso-semi); margin-bottom: var(--esp-4); }
      .linha { margin-bottom: var(--esp-3); }
      .top { display: flex; justify-content: space-between; font-size: var(--fs-sm);
        margin-bottom: 4px; }
      .nome { color: var(--cor-texto); font-weight: var(--peso-medio); }
      .total { color: var(--cor-texto-suave); }
      .barra { height: 10px; background: var(--cor-borda); border-radius: var(--raio-completo); overflow: hidden; }
      .barra > div { height: 100%; border-radius: var(--raio-completo); transition: width .3s; }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    const lista = this.porCategoria;
    if (!lista.length) {
      return `<div class="titulo">Gastos por categoria</div><div class="vazio">Sem despesas ainda.</div>`;
    }
    const total = lista.reduce((s, c) => s + (Number(c.total) || 0), 0);
    const linhas = lista
      .map((c) => {
        const pct = percentual(c.total, total);
        return `
        <div class="linha">
          <div class="top">
            <span class="nome">${c.nome}</span>
            <span class="total">${moeda(c.total)} · ${pct}%</span>
          </div>
          <div class="barra"><div style="width:${pct}%;background:${c.cor || "#94a3b8"}"></div></div>
        </div>`;
      })
      .join("");
    return `<div class="titulo">Gastos por categoria</div>${linhas}`;
  }
}

customElements.define("category-breakdown", CategoryBreakdown);
