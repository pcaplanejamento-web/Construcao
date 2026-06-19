/**
 * <grafico-rosca> — Donut (SVG, sem dependência) da distribuição por categoria.
 * Propriedade: .porCategoria = [{ nome, cor, total }]
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, percentual } from "../../core/formatters.js";

class GraficoRosca extends BaseElement {
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
      .wrap { display: flex; gap: var(--esp-5); align-items: center; flex-wrap: wrap; }
      svg { width: 140px; height: 140px; flex: none; }
      .centro { font-size: 5px; fill: var(--cor-texto); font-weight: 700; }
      .legenda { display: flex; flex-direction: column; gap: var(--esp-2); min-width: 140px; }
      .li { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-sm); }
      .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
      .li .nome { color: var(--cor-texto); }
      .li .val { margin-left: auto; color: var(--cor-texto-suave); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    const lista = this.porCategoria;
    const total = lista.reduce((s, c) => s + (Number(c.total) || 0), 0);
    if (!total) {
      return `<div class="titulo">Distribuição por categoria</div><div class="vazio">Sem despesas ainda.</div>`;
    }

    let acc = 0;
    const segmentos = lista
      .map((c) => {
        const pct = (Number(c.total) || 0) / total * 100;
        const seg = `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${c.cor || "var(--cor-neutro)"}"
          stroke-width="5" stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}"
          stroke-dashoffset="${(25 - acc).toFixed(2)}"></circle>`;
        acc += pct;
        return seg;
      })
      .join("");

    const legenda = lista
      .map(
        (c) =>
          `<div class="li"><span class="dot" style="background:${c.cor || "var(--cor-neutro)"}"></span>
           <span class="nome">${c.nome}</span>
           <span class="val">${percentual(c.total, total)}%</span></div>`
      )
      .join("");

    return `
      <div class="titulo">Distribuição por categoria</div>
      <div class="wrap">
        <svg viewBox="0 0 42 42" role="img" aria-label="Distribuição por categoria">
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--cor-borda)" stroke-width="5"></circle>
          ${segmentos}
          <text class="centro" x="21" y="22" text-anchor="middle">${moeda(total)}</text>
        </svg>
        <div class="legenda">${legenda}</div>
      </div>
    `;
  }
}

customElements.define("grafico-rosca", GraficoRosca);
