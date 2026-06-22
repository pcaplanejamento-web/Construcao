/**
 * <orcamento-detail-view> — Página de um orçamento (rota /orcamentos/:id).
 *
 * Cabeçalho (tipo, fornecedor/contato, obra) + resumo (nº ofertas · total) +
 * tabela das ofertas (cada uma de uma cotação). "+ Adicionar oferta" abre o
 * preco-form em modo orçamento (cotação filtrada pelo tipo, contato travado).
 * Lê do data-store (cache-first) e assina mudanças. Espelha cotacao-detail-view.
 */
import { rotuloVoltar } from "../../core/router.js";
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, numero } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { colunasLog } from "../../core/audit-columns.js";
import { totalOferta, totalOfertaCheio, qtdOferta } from "../cotacoes/cotacao-util.js";
import { rotuloOrcamento, totalOrcamento, ofertanteNome, COR_CLASSIFICACAO } from "./orcamento-util.js";
import { abrirBannerVinculos, vinculosDaOferta } from "../shared/vinculos.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "../cotacoes/preco-form.js";
import "./orcamento-form.js";

class OrcamentoDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
  }

  get orcamentoId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--esp-2); color: var(--cor-primaria); font-size: var(--fs-md); font-weight: var(--peso-forte); text-decoration: none; }
      .voltar:hover { text-decoration: none; color: var(--cor-primaria-escura); }
      #conteudo { display: flex; flex-direction: column; gap: var(--esp-5); }
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; margin-top: var(--esp-1); }
      .resumo { font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .resumo strong { color: var(--cor-texto); }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando orçamento..."></ui-spinner></div></div>`;
  }

  _buscar() {
    return dataStore.orcamento(this.orcamentoId);
  }

  /** Nome do item (ao vivo) de uma cotação. */
  _nomeCotacao(c) {
    if (!c) return "—";
    return (c.item_id && (dataStore.item(c.item_id) || {}).nome) || c.descricao || "—";
  }

  _bool(v) {
    return v === true || v === "TRUE" || v === "true";
  }

  aoConectar() {
    if (!this._buscar()) {
      this.$("#conteudo").innerHTML = `<p>Orçamento não encontrado. <a href="/cotacoes">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="/cotacoes"><ui-icon name="seta-esquerda" size="18"></ui-icon><span>${rotuloVoltar("/cotacoes")}</span></a>
      <div class="topo" id="topo"></div>
      <ui-card title="Ofertas do orçamento">
        <ui-button slot="acoes" id="addOferta">+ Adicionar oferta</ui-button>
        <ui-data-table id="tabela" fluido
          empty-text="Nenhuma oferta neste orçamento ainda."></ui-data-table>
      </ui-card>
    `;
    this._tabela = alvo.querySelector("#tabela");
    this._tabela.columns = [
      {
        chave: "cotacao_id",
        titulo: "Cotação",
        formato: (id) => this._nomeCotacao(dataStore.cotacao(id)),
      },
      {
        chave: "quantidade",
        titulo: "Qtd",
        alinhar: "dir",
        formato: (v, linha) => String(qtdOferta(linha, dataStore.cotacao(linha.cotacao_id))),
      },
      { chave: "valor_unit", titulo: "Valor unit.", alinhar: "dir", formato: (v) => moeda(v) },
      {
        chave: "valor_unit_desconto",
        titulo: "Unit. c/ desc.",
        alinhar: "dir",
        secundaria: true,
        formato: (v) =>
          Number(v) > 0 ? moeda(v) : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "valor_unit",
        titulo: "Total",
        alinhar: "dir",
        secundaria: true,
        formato: (v, linha) => moeda(totalOfertaCheio(linha, dataStore.cotacao(linha.cotacao_id))),
      },
      {
        chave: "valor_unit",
        titulo: "Total c/ desc.",
        alinhar: "dir",
        formato: (v, linha) => moeda(totalOferta(linha, dataStore.cotacao(linha.cotacao_id))),
      },
      { chave: "prazo_entrega", titulo: "Prazo", formato: (v) => v || "—" },
      { chave: "observacao", titulo: "Obs.", formato: (v) => v || "—" },
      ...colunasLog(),
      {
        chave: "despesa_id",
        titulo: "Status",
        formato: (v, linha) =>
          linha.despesa_id
            ? `<category-badge nome="Registrada" cor="var(--cor-info)"></category-badge>`
            : this._bool(linha.escolhido)
            ? `<category-badge nome="Escolhida" cor="var(--cor-sucesso)"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    this._tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "remover", rotulo: "Excluir", variant: "perigo" },
    ];
    this._tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirPrecoForm(e.detail.linha);
      else this.removerPreco(e.detail.linha);
    });
    alvo.querySelector("#addOferta").addEventListener("click", () => this.abrirPrecoForm(null));
    this._montado = true;
  }

  sincronizar() {
    if (!this._montado) return;
    const o = this._buscar();
    if (!o) {
      irPara("/cotacoes");
      return;
    }
    this._orcamento = o;
    const ofertas = dataStore
      .ofertasDoOrcamento(o.id)
      .slice()
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    this._tabela.rows = ofertas;
    this.pintarTopo();
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo) return;
    const o = this._orcamento;
    const cor = COR_CLASSIFICACAO[o.tipo] || "var(--cor-neutro)";
    const forn = o.fornecedor_id ? dataStore.fornecedores().find((f) => String(f.id) === String(o.fornecedor_id)) : null;
    const ofertante = ofertanteNome(o.contato_id, o.equipe_id);
    const obra = o.obra_id ? dataStore.obra(o.obra_id) : null;
    const n = dataStore.ofertasDoOrcamento(o.id).length;
    topo.innerHTML = `
      <div>
        <h1>${rotuloOrcamento(o)}</h1>
        <div class="meta">
          <category-badge nome="${o.tipo || "—"}" cor="${cor}"></category-badge>
          ${forn ? `<span>· ${forn.nome}</span>` : ""}
          ${ofertante && ofertante !== "—" ? `<span>· <ui-icon name="${o.equipe_id ? "usuario" : "contato"}" size="13"></ui-icon> ${ofertante}</span>` : ""}
          ${obra ? `· <a href="/obras/${obra.id}"><ui-icon name="obra" size="14"></ui-icon> ${obra.nome}</a>` : ""}
        </div>
        <div class="resumo">${numero(n)} oferta(s) · Total <strong>${moeda(totalOrcamento(o.id))}</strong></div>
      </div>
      <div><ui-button id="editarOrc" variant="secundario">Editar orçamento</ui-button></div>
    `;
    topo.querySelector("#editarOrc").addEventListener("click", () => this.editarOrcamento());
  }

  abrirPrecoForm(preco) {
    const form = document.createElement("preco-form");
    form.orcamento = this._orcamento;
    form.preco = preco;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  removerPreco(preco) {
    abrirBannerVinculos({
      titulo: "Esta oferta",
      grupos: vinculosDaOferta(preco),
      aoExcluir: async () => {
        if (!confirm("Excluir esta oferta?")) return;
        try {
          await dataStore.removerPreco(preco.cotacao_id, preco.id);
          toastSucesso("Oferta removida.");
        } catch (e) {
          notificarErro(e);
        }
      },
    });
  }

  editarOrcamento() {
    const form = document.createElement("orcamento-form");
    form.orcamento = this._orcamento;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }
}

customElements.define("orcamento-detail-view", OrcamentoDetailView);
