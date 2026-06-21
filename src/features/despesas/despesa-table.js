/**
 * <despesa-table> — Tabela de despesas (largura total, células proporcionais).
 * Reutiliza <ui-data-table> (fluido + clicavel) e <category-badge>.
 *
 * Propriedades: .despesas = [...], .categorias = [{id,nome,cor}]
 * Eventos: "abrir" ({despesa}) ao clicar na linha; "editar"/"remover" ({despesa}).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { totalPago, distribuicao, parseLista, statusPagamento } from "./despesa-split.js";
import { ofertanteNome } from "../orcamentos/orcamento-util.js";
import "../../components/ui-data-table.js";
import "./category-badge.js";

/** Nome da empresa (fornecedor) pelo id. */
function _empresaNome(id) {
  if (!id) return "";
  return (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "";
}

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#2563eb", "Serviço": "#7c3aed" };

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
  set participantes(v) {
    this._mapaPart = {};
    (Array.isArray(v) ? v : []).forEach((p) => (this._mapaPart[p.chave] = p.nome));
    this.atualizarTabela();
  }
  get mapaPart() {
    return this._mapaPart || {};
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
      {
        chave: "item",
        titulo: "Item",
        // Item pode ter texto longo → coluna bem larga (evita quebra excessiva).
        largura: "280px",
        // Nome ao vivo do catálogo (reflete renome); `item` denormalizado é fallback.
        formato: (v, linha) => (linha.item_id && (dataStore.item(linha.item_id) || {}).nome) || v || "—",
      },
      {
        chave: "classificacao",
        titulo: "Classificação",
        formato: (v) =>
          v
            ? `<category-badge nome="${v}" cor="${COR_CLASSIFICACAO[v] || "var(--cor-neutro)"}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "categoria_id",
        titulo: "Subclassificação",
        formato: (id) =>
          this.mapaCat[id]
            ? `<category-badge nome="${this.mapaCat[id].nome}" cor="${this.mapaCat[id].cor}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "ofertante_contato_id",
        titulo: "Ofertante",
        // Ofertante ao vivo: equipe (se houver) ou contato; "—" p/ despesas legadas.
        formato: (_, linha) => {
          const id = linha.ofertante_contato_id || linha.ofertante_equipe_id;
          return id
            ? ofertanteNome(linha.ofertante_contato_id, linha.ofertante_equipe_id)
            : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      {
        chave: "fornecedor_id",
        titulo: "Empresa",
        formato: (id) =>
          _empresaNome(id) || `<span style="color:var(--cor-texto-fraco)">—</span>`,
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
      {
        chave: "pagamentos_realizados",
        titulo: "Status",
        // Status derivado dos pagamentos lançados: A pagar / Em pagamento / Pago.
        formato: (_, linha) => {
          const st = statusPagamento(linha);
          const cor = st === "Pago" ? "var(--cor-sucesso)" : st === "Em pagamento" ? "var(--cor-aviso)" : "var(--cor-neutro)";
          return `<category-badge nome="${st}" cor="${cor}"></category-badge>`;
        },
      },
      {
        chave: "pagamentos",
        titulo: "Pagamento",
        alinhar: "dir",
        formato: (_, linha) => {
          const t = totalPago(linha);
          return t > 0 ? moeda(t) : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      {
        chave: "pagamentos",
        titulo: "Distribuição",
        formato: (_, linha) => {
          const d = distribuicao(linha);
          if (d === "distribuido")
            return `<category-badge nome="Distribuído" cor="var(--cor-info)"></category-badge>`;
          if (d === "unico")
            return `<category-badge nome="Único" cor="var(--cor-neutro)"></category-badge>`;
          return `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      {
        chave: "responsaveis",
        titulo: "Responsabilidade",
        formato: (_, linha) => {
          const rs = parseLista(linha.responsaveis);
          if (!rs.length) return `<span style="color:var(--cor-texto-fraco)">—</span>`;
          return rs
            .map((r) => {
              const nome = this.mapaPart[r.chave] || "—";
              return `<category-badge nome="${nome} · ${Number(r.pct) || 0}%" cor="var(--cor-aviso)"></category-badge>`;
            })
            .join(" ");
        },
      },
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
