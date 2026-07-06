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
import "../../components/ui-lista-gestos.js";
import { injetarBuscaNoCard } from "../../components/ui-busca.js";
import "./category-badge.js";

/** Nome da empresa (fornecedor) pelo id. */
function _empresaNome(id) {
  if (!id) return "";
  return (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "";
}

function _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };

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
    return `
      :host { display: block; }
      #lista { display: none; }
      /* Mobile: some a tabela e mostra a lista de gestos (mesmo dado, mesmos eventos). */
      @media (max-width: 820px) {
        #tabela { display: none; }
        #lista { display: block; }
      }
    `;
  }
  template() {
    return `<ui-data-table id="tabela" fluido clicavel
        empty-text="Nenhuma despesa registrada nesta obra."></ui-data-table>
      <ui-lista-gestos id="lista"></ui-lista-gestos>`;
  }

  /** Card compacto da despesa no mobile (sem legendas/checkbox/botões). */
  _cardDespesa(d) {
    const item = (d.item_id && (dataStore.item(d.item_id) || {}).nome) || d.item || "—";
    const emp = _empresaNome(d.fornecedor_id) ||
      ((d.ofertante_contato_id || d.ofertante_equipe_id) ? ofertanteNome(d.ofertante_contato_id, d.ofertante_equipe_id) : "");
    const st = statusPagamento(d);
    const corSt = st === "Pago" ? "var(--cor-sucesso)" : st === "Em pagamento" ? "var(--cor-aviso)" : "var(--cor-neutro)";
    const corCl = COR_CLASSIFICACAO[d.classificacao] || "var(--cor-neutro)";
    return `<div style="display:flex;flex-direction:column;gap:4px;width:100%;min-width:0">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
          <span style="font-weight:var(--peso-semi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(item)}</span>
          <span style="font-family:var(--fonte-titulo);font-weight:700;white-space:nowrap">${moeda(Number(d.valor) || 0)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:var(--fs-sm);color:var(--cor-texto-suave);min-width:0">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(emp) || "—"}</span>
          <span style="display:inline-flex;gap:4px;flex:none">${d.classificacao ? `<category-badge nome="${_esc(d.classificacao)}" cor="${corCl}"></category-badge>` : ""}<category-badge nome="${st}" cor="${corSt}"></category-badge></span>
        </div>
        <small style="color:var(--cor-texto-fraco)">${fmtData(d.data)}</small>
      </div>`;
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
        titulo: "Categoria",
        secundaria: true,
        formato: (id) =>
          this.mapaCat[id]
            ? `<category-badge nome="${this.mapaCat[id].nome}" cor="${this.mapaCat[id].cor}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "ofertante_contato_id",
        titulo: "Ofertante",
        secundaria: true,
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
        secundaria: true,
        formato: (id) =>
          _empresaNome(id) || `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "criado_em",
        titulo: "Adicionado",
        secundaria: true,
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
        secundaria: true,
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
      { chave: "valor", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
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
        secundaria: true,
        moeda: true,
        valorNum: (linha) => totalPago(linha),
        formato: (_, linha) => {
          const t = totalPago(linha);
          return t > 0 ? moeda(t) : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      {
        chave: "pagamentos",
        titulo: "Distribuição",
        secundaria: true,
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
        secundaria: true,
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
      {
        chave: "preco_id",
        titulo: "Oferta",
        secundaria: true,
        formato: (v) =>
          v
            ? `<code title="${v}" style="font-size:var(--fs-xs)">…${String(v).slice(-6)}</code>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "remover", rotulo: "Excluir", variant: "perigo" },
    ];
    // OBS.: os eventos internos (ui-data-table / ui-lista-gestos) são `composed`,
    // então sem `stopPropagation` eles atravessariam o shadow e chegariam ao
    // ouvinte da obra-detail JUNTO com o evento re-emitido aqui — abrindo DOIS
    // banners quando o nome coincide (ex.: `editar`→`editar`). Consumимos o evento
    // interno e repassamos só o traduzido.
    tabela.addEventListener("acao", (e) => {
      e.stopPropagation();
      this.emitir(e.detail.acao, { despesa: e.detail.linha });
    });
    tabela.addEventListener("linha", (e) => {
      e.stopPropagation();
      this.emitir("abrir", { despesa: e.detail.linha });
    });
    // Exclusão em massa: a tabela confirma e emite as linhas; repassa à obra-detail.
    tabela.setAttribute("excluir-massa", "");
    tabela.addEventListener("excluir-massa", (e) => {
      e.stopPropagation();
      this.emitir("excluir-massa", { despesas: e.detail.linhas });
    });
    // Ações em massa nas selecionadas: lançar pagamento + definir responsabilidade.
    tabela.acoesMassa = [
      { nome: "pagar", rotulo: "Registrar pagamento" },
      { nome: "responsavel", rotulo: "Definir responsabilidade" },
    ];
    tabela.addEventListener("acao-massa", (e) => {
      e.stopPropagation();
      this.emitir("acao-massa", { acao: e.detail.acao, despesas: e.detail.linhas });
    });
    // Busca no cabeçalho do card (a tabela interna não alcança o card por estar no shadow).
    injetarBuscaNoCard(this, tabela);

    // ----- Versão MOBILE: lista de gestos (emite os MESMOS eventos → obra-detail intacto) -----
    const lista = this.$("#lista");
    lista.render = (d) => this._cardDespesa(d);
    lista.acoesMassa = [
      { nome: "pagar", rotulo: "Registrar pagamento" },
      { nome: "responsavel", rotulo: "Definir responsabilidade" },
    ];
    lista.addEventListener("abrir", (e) => { e.stopPropagation(); this.emitir("abrir", { despesa: e.detail.item }); });
    lista.addEventListener("editar", (e) => { e.stopPropagation(); this.emitir("editar", { despesa: e.detail.item }); });
    lista.addEventListener("excluir", (e) => { e.stopPropagation(); this.emitir("remover", { despesa: e.detail.item }); });
    lista.addEventListener("acao-massa", (e) => {
      e.stopPropagation();
      if (e.detail.acao === "excluir") this.emitir("excluir-massa", { despesas: e.detail.itens });
      else this.emitir("acao-massa", { acao: e.detail.acao, despesas: e.detail.itens });
    });

    this.atualizarTabela();
  }

  atualizarTabela() {
    const tabela = this.$ ? this.$("#tabela") : null;
    if (tabela) tabela.rows = this.despesas;
    const lista = this.$ ? this.$("#lista") : null;
    if (lista) lista.itens = this.despesas;
  }
}

customElements.define("despesa-table", DespesaTable);
