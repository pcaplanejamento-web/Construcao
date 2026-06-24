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
import "../../components/ui-modal.js";
import "../../components/ui-button.js";

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
        cursor: pointer; border: none; text-align: left; width: 100%; font: inherit;
        transition: transform var(--transicao), box-shadow var(--transicao);
      }
      .cartao:hover { transform: translateY(-3px); box-shadow: var(--sombra-lg); }
      .cartao:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      /* dica de "clique p/ ver origem" */
      .lupa { position: absolute; top: var(--esp-3); right: var(--esp-3); z-index: 1;
        opacity: .8; display: flex; }
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

  cartao(chave, cor, icone, rotulo, valor, dica) {
    return `
      <button type="button" class="cartao ${cor}" data-kpi="${chave}" title="Clique para ver de onde vem este número">
        <span class="lupa"><ui-icon name="info" size="16"></ui-icon></span>
        <span class="icone"><ui-icon name="${icone}" size="20"></ui-icon></span>
        <span class="rotulo">${rotulo}</span>
        <span class="valor">${valor}</span>
        ${dica ? `<span class="dica">${dica}</span>` : ""}
      </button>`;
  }

  template() {
    const r = this.resumo;
    const total = Number(r.total) || 0;
    const orcamento = Number(r.orcamento) || 0;
    const saldo = Number(r.saldo != null ? r.saldo : orcamento - total);
    const pct = orcamento ? percentual(total, orcamento) : 0;
    return `
      <div class="grid">
        ${this.cartao("total", "azul", "cifrao", "Total gasto", moeda(total), orcamento ? `${pct}% do orçamento` : "")}
        ${this.cartao("orcamento", "laranja", "carteira", "Orçamento", orcamento ? moeda(orcamento) : "—", "")}
        ${this.cartao(
          "saldo",
          orcamento && saldo < 0 ? "vermelho" : "verde",
          "tendencia",
          "Saldo",
          orcamento ? moeda(saldo) : "—",
          orcamento && saldo < 0 ? "Orçamento estourado" : ""
        )}
        ${this.cartao("despesas", "roxo", "recibo", "Despesas", numero(r.qtd || 0), "itens")}
      </div>
    `;
  }

  aposRender() {
    this.$$(".cartao").forEach((b) =>
      b.addEventListener("click", () => this._detalhe(b.dataset.kpi))
    );
  }

  /** Banner flutuante (ui-modal) explicando DE ONDE vem o número da KPI + composição. */
  _detalhe(chave) {
    const r = this.resumo;
    const total = Number(r.total) || 0;
    const orc = Number(r.orcamento) || 0;
    const saldo = Number(r.saldo != null ? r.saldo : orc - total);
    const porCls = Array.isArray(r.por_classificacao) ? r.por_classificacao : [];
    const porSub = Array.isArray(r.por_subclassificacao)
      ? r.por_subclassificacao
      : Array.isArray(r.por_categoria)
      ? r.por_categoria
      : [];
    // O resumo do backend usa o campo `total` (Σ valor por classificação/subclassificação);
    // `valor` é fallback p/ payloads antigos. Sem isto cada linha mostrava R$ 0,00.
    const valorDe = (x) => Number(x.total != null ? x.total : x.valor) || 0;
    const linhas = (arr) =>
      arr.length
        ? arr
            .map(
              (x) =>
                `<div class="kpi-row"><span>${x.nome || "—"}</span><strong>${moeda(valorDe(x))}</strong></div>`
            )
            .join("")
        : `<p class="kpi-vazio">Sem dados.</p>`;
    const SEC = {
      total: {
        titulo: "Total gasto",
        html: `<p class="kpi-exp">Soma do <b>valor de todas as despesas registradas</b> na obra (independe de já ter sido pago).</p>
          <div class="kpi-sec"><label>Por classificação</label>${linhas(porCls)}</div>
          ${porSub.length ? `<div class="kpi-sec"><label>Por subclassificação</label>${linhas(porSub)}</div>` : ""}
          <div class="kpi-tot"><span>Total</span><strong>${moeda(total)}</strong></div>`,
      },
      orcamento: {
        titulo: "Orçamento",
        html: `<p class="kpi-exp">Valor <b>definido na obra</b> (botão "Editar obra"). É a meta de gasto.</p>
          <div class="kpi-row"><span>Orçamento</span><strong>${orc ? moeda(orc) : "—"}</strong></div>
          <div class="kpi-row"><span>Já gasto</span><strong>${moeda(total)}</strong></div>
          ${orc ? `<div class="kpi-row"><span>% gasto</span><strong>${percentual(total, orc)}%</strong></div>` : ""}`,
      },
      saldo: {
        titulo: "Saldo",
        html: `<p class="kpi-exp">Quanto ainda resta do orçamento: <b>Orçamento − Total gasto</b>.</p>
          <div class="kpi-row"><span>Orçamento</span><strong>${orc ? moeda(orc) : "—"}</strong></div>
          <div class="kpi-row"><span>− Total gasto</span><strong>${moeda(total)}</strong></div>
          <div class="kpi-tot"><span>= Saldo</span><strong>${moeda(saldo)}</strong></div>`,
      },
      despesas: {
        titulo: "Despesas",
        html: `<p class="kpi-exp"><b>${numero(r.qtd || 0)}</b> despesa(s) registrada(s). Valores por classificação:</p>
          ${linhas(porCls)}`,
      },
    };
    const sec = SEC[chave] || SEC.total;
    const modal = document.createElement("ui-modal");
    modal.setAttribute("open", "");
    modal.setAttribute("title", sec.titulo);
    const corpo = document.createElement("div");
    corpo.innerHTML = `
      <style>
        .kpi-det { display: flex; flex-direction: column; gap: var(--esp-4); }
        .kpi-exp { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
        .kpi-sec label { display: block; font-size: var(--fs-xs); text-transform: uppercase;
          letter-spacing: .05em; color: var(--cor-texto-suave); font-weight: var(--peso-semi); margin-bottom: var(--esp-1); }
        .kpi-row { display: flex; justify-content: space-between; padding: var(--esp-2) 0; border-bottom: 1px solid var(--cor-divisor); }
        .kpi-row strong { font-family: var(--fonte-titulo); }
        .kpi-tot { display: flex; justify-content: space-between; padding-top: var(--esp-2); margin-top: var(--esp-1);
          border-top: 2px solid var(--cor-borda-forte); font-family: var(--fonte-titulo); font-weight: var(--peso-forte); }
        .kpi-vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      </style>
      <div class="kpi-det">${sec.html}</div>`;
    modal.appendChild(corpo);
    const rod = document.createElement("div");
    rod.setAttribute("slot", "rodape");
    const btn = document.createElement("ui-button");
    btn.textContent = "Fechar";
    btn.addEventListener("click", () => modal.remove());
    rod.appendChild(btn);
    modal.appendChild(rod);
    modal.addEventListener("fechar", () => modal.remove());
    document.body.appendChild(modal);
  }
}

customElements.define("dashboard-summary", DashboardSummary);
