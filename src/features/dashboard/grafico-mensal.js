/**
 * <grafico-mensal> — Barras verticais do gasto por mês (CSS). Preenche a altura
 * do cartão; com muitos meses, rola horizontalmente.
 * Propriedade: .despesas = [{ valor, data }]
 *   .aoSelecionar = ({ mes:"AAAA-MM", rotulo, total }) => void  (opcional; ao clicar
 *              numa coluna abre o banner de origem — item 4).
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
  /** Callback de clique numa coluna (opcional). Habilita a interação. */
  set aoSelecionar(fn) {
    this._aoSel = typeof fn === "function" ? fn : null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  estilos() {
    return `
      :host { display: flex; flex-direction: column; height: 100%; }
      .titulo { font-size: var(--fs-md); font-weight: var(--peso-semi);
        margin-bottom: var(--esp-4); flex: none; }
      .grafico { flex: 1; min-height: 0; display: flex; align-items: flex-end;
        gap: var(--esp-3); padding-top: var(--esp-4); overflow-x: auto; }
      .col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
        gap: var(--esp-1); flex: 1; min-width: 44px; height: 100%; }
      .val { font-size: var(--fs-xs); color: var(--cor-texto-suave); white-space: nowrap; }
      .barra-wrap { flex: 1; min-height: 0; width: 70%; display: flex; align-items: flex-end; }
      .barra { width: 100%; background: var(--cor-primaria);
        border-radius: var(--raio-sm) var(--raio-sm) 0 0; min-height: 2px; transition: height .3s; }
      .rotulo { font-size: var(--fs-xs); color: var(--cor-texto-fraco); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      /* Interativo (item 4): coluna clicável abre o banner de origem. */
      .grafico.clicavel .col { cursor: pointer; border-radius: var(--raio-sm); }
      .grafico.clicavel .col:hover { background: var(--cor-superficie-2); }
    `;
  }

  template() {
    const acc = {};
    this.despesas.forEach((d) => {
      const ym = String(d.data || "").substring(0, 7);
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
          <div class="col" data-mes="${ym}" data-rotulo="${rotulo}" title="${rotulo}: ${moeda(acc[ym])}">
            <div class="val">${moeda(acc[ym])}</div>
            <div class="barra-wrap"><div class="barra" style="height:${altura}%"></div></div>
            <div class="rotulo">${rotulo}</div>
          </div>`;
      })
      .join("");
    return `<div class="titulo">Gasto por mês</div><div class="grafico ${this._aoSel ? "clicavel" : ""}">${barras}</div>`;
  }

  aposRender() {
    if (!this._aoSel) return;
    this.$$(".col").forEach((el) =>
      el.addEventListener("click", () => {
        const mes = el.dataset.mes;
        const total = this.despesas
          .filter((d) => String(d.data || "").startsWith(mes))
          .reduce((s, d) => s + (Number(d.valor) || 0), 0);
        this._aoSel({ mes, rotulo: el.dataset.rotulo, total });
      })
    );
  }
}

customElements.define("grafico-mensal", GraficoMensal);
