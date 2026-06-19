/**
 * <grafico-mensal> — Barras verticais do gasto por mês (CSS, sem dependência).
 * Propriedade: .despesas = [{ valor, data }]
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda } from "../../core/formatters.js";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

class GraficoMensal extends BaseElement {
  set despesas(v) {
    this._despesas = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get despesas() {
    return this._despesas || [];
  }

  estilos() {
    return `
      :host { display: block; }
      .titulo { font-size: var(--fs-md); font-weight: var(--peso-semi); margin-bottom: var(--esp-4); }
      .grafico { display: flex; align-items: flex-end; gap: var(--esp-3);
        height: 150px; padding-top: var(--esp-4); overflow-x: auto; }
      .col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
        gap: var(--esp-1); flex: 1; min-width: 36px; height: 100%; }
      .val { font-size: var(--fs-xs); color: var(--cor-texto-suave); white-space: nowrap; }
      .barra-wrap { flex: 1; width: 70%; display: flex; align-items: flex-end; }
      .barra { width: 100%; background: var(--cor-primaria); border-radius: var(--raio-sm) var(--raio-sm) 0 0;
        min-height: 2px; transition: height .3s; }
      .rotulo { font-size: var(--fs-xs); color: var(--cor-texto-fraco); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    const acc = {};
    this.despesas.forEach((d) => {
      const ym = String(d.data || "").substring(0, 7); // YYYY-MM
      if (ym.length === 7) acc[ym] = (acc[ym] || 0) + (Number(d.valor) || 0);
    });
    const meses = Object.keys(acc).sort();
    if (!meses.length) {
      return `<div class="titulo">Gasto por mês</div><div class="vazio">Sem despesas ainda.</div>`;
    }
    const max = Math.max(...meses.map((m) => acc[m]));
    const barras = meses
      .map((ym) => {
        const partes = ym.split("-");
        const rotulo = `${MESES[Number(partes[1]) - 1] || partes[1]}/${partes[0].slice(2)}`;
        const altura = max ? Math.round((acc[ym] / max) * 100) : 0;
        return `
          <div class="col" title="${rotulo}: ${moeda(acc[ym])}">
            <div class="val">${moeda(acc[ym])}</div>
            <div class="barra-wrap"><div class="barra" style="height:${altura}%"></div></div>
            <div class="rotulo">${rotulo}</div>
          </div>`;
      })
      .join("");
    return `<div class="titulo">Gasto por mês</div><div class="grafico">${barras}</div>`;
  }
}

customElements.define("grafico-mensal", GraficoMensal);
