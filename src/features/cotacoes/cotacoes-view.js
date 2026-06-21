/**
 * <cotacoes-view> — Rota /cotacoes, com abas [Cotações | Orçamento].
 *  - Cotações: tabela das necessidades (clique → detalhe comparativo).
 *  - Orçamento: grade de cards (estilo Obras) dos orçamentos (containers de ofertas).
 * CRUD próprio do usuário; lê do data-store (cache-first) e assina mudanças.
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, numero } from "../../core/formatters.js";
import { colunasLog } from "../../core/audit-columns.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { melhorTotal } from "./cotacao-util.js";
import "../../components/ui-card.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./cotacao-form.js";
import "../orcamentos/orcamento-card.js";
import "../orcamentos/orcamento-form.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#2563eb", "Serviço": "#7c3aed" };

class CotacoesView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
      .grid { display: grid; gap: var(--esp-4);
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Cotações</h1>
            <p class="sub">Compare preços de contatos e agrupe ofertas em orçamentos.</p>
          </div>
        </div>
        <ui-tabs id="abas">
          <div slot="cotacoes">
            <ui-card title="Minhas cotações">
              <ui-button slot="acoes" id="nova">+ Nova cotação</ui-button>
              <div id="lista"></div>
            </ui-card>
          </div>
          <div slot="orcamento">
            <ui-card title="Meus orçamentos">
              <ui-button slot="acoes" id="novoOrc">+ Novo orçamento</ui-button>
              <div id="listaOrc"></div>
            </ui-card>
          </div>
        </ui-tabs>
      </div>
    `;
  }

  aoConectar() {
    this.$("#abas").abas = [
      { id: "cotacoes", rotulo: "Cotações", icone: "cotacao" },
      { id: "orcamento", rotulo: "Orçamento", icone: "carteira" },
    ];
    this.$("#nova").addEventListener("click", () => this.abrirForm(null));
    this.$("#novoOrc").addEventListener("click", () => this.abrirOrcamentoForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    this.pintarCotacoes();
    this.pintarOrcamentos();
  }

  pintarCotacoes() {
    const el = this.$("#lista");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }

    const cotacoes = dataStore.cotacoes();
    if (!cotacoes.length) {
      el.innerHTML = `
        <ui-empty-state icone="cotacao" titulo="Nenhuma cotação"
          texto="Crie uma cotação e adicione ofertas de contatos para comparar.">
          <ui-button slot="acao" id="vaziaNova">+ Criar cotação</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vaziaNova").addEventListener("click", () => this.abrirForm(null));
      return;
    }

    const mapaCat = {};
    dataStore.categorias().forEach((c) => (mapaCat[c.id] = c));
    const mapaObra = {};
    dataStore.obras().forEach((o) => (mapaObra[o.id] = o.nome));

    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.setAttribute("clicavel", "");
    tabela.columns = [
      {
        chave: "descricao",
        titulo: "Item",
        // Nome ao vivo do catálogo; `descricao` denormalizado é fallback.
        formato: (v, l) => (l.item_id && (dataStore.item(l.item_id) || {}).nome) || v || "—",
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
        chave: "quantidade",
        titulo: "Qtd.",
        formato: (q, l) => (Number(q) > 0 ? `${numero(q)} ${l.unidade || ""}`.trim() : "—"),
      },
      {
        chave: "categoria_id",
        titulo: "Subclassificação",
        formato: (id) => {
          const c = mapaCat[id];
          return c
            ? `<category-badge nome="${c.nome}" cor="${c.cor}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      {
        chave: "obra_id",
        titulo: "Obra",
        formato: (id) => mapaObra[id] || `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "id",
        titulo: "Ofertas",
        alinhar: "dir",
        formato: (id) => String(dataStore.precosDaCotacao(id).length),
      },
      {
        chave: "id",
        titulo: "Melhor preço",
        alinhar: "dir",
        formato: (id, linha) => {
          const min = melhorTotal(dataStore.precosDaCotacao(id), linha);
          return min == null ? "—" : moeda(min);
        },
      },
      {
        chave: "status",
        titulo: "Situação",
        formato: (s) =>
          s === "fechada"
            ? `<span style="color:var(--cor-texto-fraco)">Fechada</span>`
            : `<span style="color:var(--cor-sucesso)">Aberta</span>`,
      },
      ...colunasLog(),
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = cotacoes;
    tabela.addEventListener("linha", (e) => {
      irPara("/cotacoes/" + e.detail.linha.id);
    });
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirForm(e.detail.linha);
      else this.remover(e.detail.linha);
    });
    el.replaceChildren(tabela);
  }

  /* ----------------------------- Orçamento ---------------------------- */

  pintarOrcamentos() {
    const el = this.$("#listaOrc");
    if (!el || !dataStore.carregado()) return;
    const orcamentos = dataStore.orcamentos();
    if (!orcamentos.length) {
      el.innerHTML = `
        <ui-empty-state icone="carteira" titulo="Nenhum orçamento"
          texto="Crie um orçamento (Material ou Serviço) e agrupe ofertas de várias cotações.">
          <ui-button slot="acao" id="vazioOrc">+ Criar orçamento</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vazioOrc").addEventListener("click", () => this.abrirOrcamentoForm(null));
      return;
    }
    const grid = document.createElement("div");
    grid.className = "grid";
    orcamentos.forEach((o) => {
      const card = document.createElement("orcamento-card");
      card.orcamento = o;
      card.addEventListener("abrir", (e) => {
        irPara("/orcamentos/" + e.detail.orcamento.id);
      });
      card.addEventListener("editar", (e) => this.abrirOrcamentoForm(e.detail.orcamento));
      card.addEventListener("remover", (e) => this.removerOrcamento(e.detail.orcamento));
      grid.appendChild(card);
    });
    el.replaceChildren(grid);
  }

  abrirForm(cotacao) {
    const form = document.createElement("cotacao-form");
    form.cotacao = cotacao;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  abrirOrcamentoForm(orcamento) {
    const form = document.createElement("orcamento-form");
    form.orcamento = orcamento;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  async removerOrcamento(orcamento) {
    if (!confirm("Excluir o orçamento e suas ofertas?")) return;
    try {
      await dataStore.removerOrcamento(orcamento.id);
      toastSucesso("Orçamento removido.");
    } catch (e) {
      notificarErro(e);
    }
  }

  async remover(cotacao) {
    if (!confirm(`Excluir a cotação "${cotacao.descricao}" e suas ofertas?`)) return;
    try {
      await dataStore.removerCotacao(cotacao.id);
      toastSucesso("Cotação removida.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("cotacoes-view", CotacoesView);
