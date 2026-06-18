/**
 * <despesa-table> — Tabela de despesas. Reutiliza <ui-data-table> e
 * <category-badge>. Recebe despesas + categorias e emite ações de linha.
 *
 * Propriedades: .despesas = [...], .categorias = [{id,nome,cor}]
 * Eventos: "editar" ({ despesa }), "remover" ({ despesa }).
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import "../../components/ui-data-table.js";
import "./category-badge.js";

class DespesaTable extends BaseElement {
  set despesas(v) {
    this._despesas = Array.isArray(v) ? v : [];
    this.atualizarTabela();
  }
  get despesas() {
    return this._despesas || [];
  }
  set categorias(v) {
    this._mapaCat = {};
    (Array.isArray(v) ? v : []).forEach((c) => (this._mapaCat[c.id] = c));
    this.atualizarTabela();
  }
  get mapaCat() {
    return this._mapaCat || {};
  }

  estilos() {
    return `:host { display: block; }`;
  }
  template() {
    return `<ui-data-table id="tabela" empty-text="Nenhuma despesa registrada nesta obra."></ui-data-table>`;
  }

  aposRender() {
    const tabela = this.$("#tabela");
    const mapa = this.mapaCat;
    tabela.columns = [
      { chave: "data", titulo: "Data", formato: (v) => fmtData(v) },
      { chave: "item", titulo: "Item" },
      {
        chave: "categoria_id",
        titulo: "Classificação",
        formato: (id) => {
          const c = mapa[id] || { nome: "Sem categoria", cor: "#94a3b8" };
          return `<category-badge nome="${c.nome}" cor="${c.cor}"></category-badge>`;
        },
      },
      { chave: "valor", titulo: "Valor", alinhar: "dir", formato: (v) => moeda(v) },
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "remover", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.addEventListener("acao", (e) => {
      this.emitir(e.detail.acao, { despesa: e.detail.linha });
    });
    this.atualizarTabela();
  }

  atualizarTabela() {
    const tabela = this.$ ? this.$("#tabela") : null;
    if (tabela) tabela.rows = this.despesas;
  }
}

customElements.define("despesa-table", DespesaTable);
