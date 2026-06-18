/**
 * <dashboard-summary> — Cartões de totais (gasto, orçamento, saldo, qtd).
 *
 * Propriedade: .resumo = { total, qtd, orcamento, saldo }
 * Atualiza em tempo real: a obra-detail-view passa um novo resumo a cada
 * mudança (otimista ou confirmada pelo servidor).
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, numero, percentual } from "../../core/formatters.js";

class DashboardSummary extends BaseElement {
  set resumo(v) {
    this._resumo = v || {};
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get resumo() {
    return this._resumo || {};
  }

  estilos() {
    return `
      :host { display: block; }
      .grid { display: grid; gap: var(--esp-3);
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
      .cartao { background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-lg); padding: var(--esp-4); box-shadow: var(--sombra-sm); }
      .rotulo { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .04em;
        color: var(--cor-texto-suave); font-weight: var(--peso-semi); }
      .valor { font-size: var(--fs-xl); font-weight: var(--peso-forte); margin-top: var(--esp-1); }
      .positivo { color: var(--cor-sucesso); }
      .negativo { color: var(--cor-erro); }
      .dica { font-size: var(--fs-xs); color: var(--cor-texto-fraco); margin-top: 2px; }
    `;
  }

  template() {
    const r = this.resumo;
    const total = Number(r.total) || 0;
    const orcamento = Number(r.orcamento) || 0;
    const saldo = Number(r.saldo != null ? r.saldo : orcamento - total);
    const pct = orcamento ? percentual(total, orcamento) : 0;
    return `
      <div class="grid">
        <div class="cartao">
          <div class="rotulo">Total gasto</div>
          <div class="valor">${moeda(total)}</div>
          ${orcamento ? `<div class="dica">${pct}% do orçamento</div>` : ""}
        </div>
        <div class="cartao">
          <div class="rotulo">Orçamento</div>
          <div class="valor">${orcamento ? moeda(orcamento) : "—"}</div>
        </div>
        <div class="cartao">
          <div class="rotulo">Saldo</div>
          <div class="valor ${saldo < 0 ? "negativo" : "positivo"}">${
      orcamento ? moeda(saldo) : "—"
    }</div>
          ${orcamento && saldo < 0 ? `<div class="dica">Orçamento estourado</div>` : ""}
        </div>
        <div class="cartao">
          <div class="rotulo">Despesas</div>
          <div class="valor">${numero(r.qtd || 0)}</div>
        </div>
      </div>
    `;
  }
}

customElements.define("dashboard-summary", DashboardSummary);
