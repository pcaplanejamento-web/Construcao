/**
 * <publico-view> — Visão SOMENTE LEITURA de uma obra via link público.
 *
 * Rota: /publico/:token (sem login). Busca publico.obra(token) e mostra o
 * dashboard, o gasto por categoria e a lista de itens — sem ações de edição.
 * Reusa dashboard-summary, category-breakdown, ui-data-table, category-badge.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import "../../components/ui-card.js";
import "../../components/ui-icon.js";
import "../../components/ui-spinner.js";
import "../../components/ui-data-table.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../despesas/category-badge.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };

class PublicoView extends BaseElement {
  get token() {
    return this.getAttribute("token");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; align-items: center; gap: var(--esp-1); }
      .colunas { display: grid; gap: var(--esp-5); grid-template-columns: 2fr 1fr; }
      .colunas > * { min-width: 0; }
      @media (max-width: 860px) { .colunas { grid-template-columns: 1fr; } }
    `;
  }

  template() {
    return `<div class="area" id="conteudo"><ui-spinner centro text="Carregando..."></ui-spinner></div>`;
  }

  aoConectar() {
    this.carregar();
  }

  async carregar() {
    const alvo = this.$("#conteudo");
    try {
      const d = await api.call("publico.obra", { token: this.token });
      this.pintar(d);
    } catch (e) {
      alvo.innerHTML = `<ui-card title="Link indisponível"><p>${
        e.message || "Este link não está mais válido."
      }</p></ui-card>`;
    }
  }

  pintar(d) {
    const o = d.obra || {};
    this.$("#conteudo").innerHTML = `
      <div>
        <h1>${o.nome || "Obra"}</h1>
        <div class="meta">${
          o.endereco ? `<ui-icon name="local" size="14"></ui-icon> ${o.endereco}` : ""
        }${o.descricao ? (o.endereco ? " · " : "") + o.descricao : ""}</div>
      </div>
      <dashboard-summary id="dash"></dashboard-summary>
      <div class="colunas">
        <ui-card title="Itens"><ui-data-table id="tabela" fluido empty-text="Nenhuma despesa registrada."></ui-data-table></ui-card>
        <ui-card><category-breakdown id="break" titulo="Gastos por subclassificação"></category-breakdown></ui-card>
      </div>
    `;
    this.$("#dash").resumo = d.resumo || {};
    this.$("#break").porCategoria =
      (d.resumo && (d.resumo.por_subclassificacao || d.resumo.por_categoria)) || [];
    const tabela = this.$("#tabela");
    tabela.columns = [
      { chave: "data", titulo: "Data", formato: (v) => fmtData(v) },
      { chave: "item", titulo: "Item" },
      {
        chave: "classificacao",
        titulo: "Classificação",
        formato: (v) =>
          v
            ? `<category-badge nome="${v}" cor="${COR_CLASSIFICACAO[v] || "var(--cor-neutro)"}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "categoria_nome",
        titulo: "Subclassificação",
        formato: (nome, linha) =>
          nome
            ? `<category-badge nome="${nome}" cor="${linha.categoria_cor || ""}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      { chave: "valor", titulo: "Valor", alinhar: "dir", formato: (v) => moeda(v) },
    ];
    tabela.rows = d.despesas || [];
  }
}

customElements.define("publico-view", PublicoView);
