/**
 * <category-breakdown> — Valores em barras (CSS puro). Preenche a altura do
 * cartão; com muitos itens, rola verticalmente. O título é configurável via o
 * atributo `titulo` (padrão "Gastos por categoria") p/ reuso em outros contextos.
 *
 * Propriedade: .porCategoria = [{ nome, cor, total }]
 * Atributo: titulo
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, percentual } from "../../core/formatters.js";

class CategoryBreakdown extends BaseElement {
  static get observedAttributes() {
    return ["titulo"];
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
  get titulo() {
    return this.getAttribute("titulo") || "Gastos por categoria";
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
    `;
  }

  template() {
    const lista = this.porCategoria;
    if (!lista.length) {
      return `<div class="titulo">${this.titulo}</div><div class="vazio">Sem despesas ainda.</div>`;
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
          <div class="barra"><div style="width:${pct}%;background:${c.cor || "var(--cor-neutro)"}"></div></div>
        </div>`;
      })
      .join("");
    return `<div class="titulo">${this.titulo}</div><div class="lista">${linhas}</div>`;
  }
}

customElements.define("category-breakdown", CategoryBreakdown);
