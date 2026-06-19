/**
 * <despesa-table> — Tabela de despesas (largura total, células proporcionais).
 * Reutiliza <ui-data-table> (fluido + clicavel) e <category-badge>.
 *
 * Propriedades: .despesas = [...], .categorias = [{id,nome,cor}]
 * Eventos: "abrir" ({despesa}) ao clicar na linha; "editar"/"remover" ({despesa}).
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
    return `<ui-data-table id="tabela" fluido clicavel
      empty-text="Nenhuma despesa registrada nesta obra."></ui-data-table>`;
  }

  aposRender() {
    const tabela = this.$("#tabela");
    tabela.columns = [
      { chave: "data", titulo: "Data", formato: (v) => fmtData(v) },
      { chave: "item", titulo: "Item" },
      {
        chave: "categoria_id",
        titulo: "Classificação",
        formato: (id) => {
          const c = this.mapaCat[id] || { nome: "Sem categoria", cor: "var(--cor-neutro)" };
          return `<category-badge nome="${c.nome}" cor="${c.cor}"></category-badge>`;
        },
      },
      {
        chave: "criado_em",
        titulo: "Adicionado",
        formato: (criadoEm, linha) =>
          criadoEm
            ? `<div>${fmtData(criadoEm)}</div><small style="color:var(--cor-texto-fraco)">por ${
                linha.autor_nome || "—"
              }</small>`
            : "—",
      },
      {
        chave: "editor_nome",
        titulo: "Editado por",
        formato: (editor, linha) => {
          const editou =
            editor && linha.atualizado_em && String(linha.atualizado_em) !== String(linha.criado_em);
          return editou
            ? `<div>${editor}</div><small style="color:var(--cor-texto-fraco)">${fmtData(
                linha.atualizado_em
              )}</small>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      { chave: "valor", titulo: "Valor", alinhar: "dir", formato: (v) => moeda(v) },
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "remover", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.addEventListener("acao", (e) =>
      this.emitir(e.detail.acao, { despesa: e.detail.linha })
    );
    tabela.addEventListener("linha", (e) =>
      this.emitir("abrir", { despesa: e.detail.linha })
    );
    this.atualizarTabela();
  }

  atualizarTabela() {
    const tabela = this.$ ? this.$("#tabela") : null;
    if (tabela) tabela.rows = this.despesas;
  }
}

customElements.define("despesa-table", DespesaTable);
