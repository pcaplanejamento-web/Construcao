/**
 * <dashboard-summary> — KPIs em cartões com gradiente e ícone (estilo PCA).
 *
 * Propriedade: .resumo = { total, qtd, orcamento, saldo }
 * Atualiza em tempo real: obra-detail-view passa um novo resumo a cada mudança.
 * Reusa <ui-icon> e os tokens de gradiente (--grad-*).
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, numero, percentual } from "../../core/formatters.js";
import "../../components/ui-icon.js";

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
      .grid { display: grid; gap: var(--esp-5);
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
      /* Mobile: KPIs sempre em grade 2 colunas (2×2), com gap menor. */
      @media (max-width: 600px) { .grid { grid-template-columns: repeat(2, 1fr); gap: var(--esp-3); } }
      .cartao {
        position: relative; overflow: hidden; color: #fff;
        border-radius: var(--raio-lg); padding: var(--esp-5);
        box-shadow: var(--sombra-md); min-height: 132px;
        display: flex; flex-direction: column; gap: var(--esp-2);
      }
      /* círculo decorativo sutil */
      .cartao::after { content: ""; position: absolute; top: -28px; right: -28px;
        width: 110px; height: 110px; border-radius: 50%;
        background: rgba(255, 255, 255, .12); }
      .azul { background: var(--grad-azul); }
      .verde { background: var(--grad-verde); }
      .laranja { background: var(--grad-laranja); }
      .roxo { background: var(--grad-roxo); }
      .vermelho { background: var(--grad-vermelho); }
      .icone { width: 40px; height: 40px; border-radius: var(--raio-md);
        background: rgba(255, 255, 255, .18); display: flex; align-items: center;
        justify-content: center; position: relative; z-index: 1; }
      .rotulo { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .05em;
        font-weight: var(--peso-semi); opacity: .9; position: relative; z-index: 1; }
      .valor { font-size: var(--fs-2xl); font-weight: var(--peso-forte); line-height: 1.1;
        font-family: var(--fonte-titulo); letter-spacing: -.02em;
        position: relative; z-index: 1; }
      .dica { font-size: var(--fs-xs); opacity: .85; position: relative; z-index: 1; }
    `;
  }

  cartao(cor, icone, rotulo, valor, dica) {
    return `
      <div class="cartao ${cor}">
        <div class="icone"><ui-icon name="${icone}" size="20"></ui-icon></div>
        <div class="rotulo">${rotulo}</div>
        <div class="valor">${valor}</div>
        ${dica ? `<div class="dica">${dica}</div>` : ""}
      </div>`;
  }

  template() {
    const r = this.resumo;
    const total = Number(r.total) || 0;
    const orcamento = Number(r.orcamento) || 0;
    const saldo = Number(r.saldo != null ? r.saldo : orcamento - total);
    const pct = orcamento ? percentual(total, orcamento) : 0;
    return `
      <div class="grid">
        ${this.cartao("azul", "cifrao", "Total gasto", moeda(total), orcamento ? `${pct}% do orçamento` : "")}
        ${this.cartao("laranja", "carteira", "Orçamento", orcamento ? moeda(orcamento) : "—", "")}
        ${this.cartao(
          orcamento && saldo < 0 ? "vermelho" : "verde",
          "tendencia",
          "Saldo",
          orcamento ? moeda(saldo) : "—",
          orcamento && saldo < 0 ? "Orçamento estourado" : ""
        )}
        ${this.cartao("roxo", "recibo", "Despesas", numero(r.qtd || 0), "itens")}
      </div>
    `;
  }
}

customElements.define("dashboard-summary", DashboardSummary);
