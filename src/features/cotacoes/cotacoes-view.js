/**
 * <cotacoes-view> — Lista de cotações (rota #/cotacoes).
 *
 * Cada linha resume a necessidade + nº de ofertas + melhor preço. Clique na
 * linha abre o detalhe comparativo (#/cotacoes/:id). CRUD próprio do usuário.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, numero } from "../../core/formatters.js";
import { colunasLog } from "../../core/audit-columns.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { melhorTotal } from "./cotacao-util.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./cotacao-form.js";

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
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Cotações</h1>
            <p class="sub">Compare preços de contatos para cada necessidade.</p>
          </div>
        </div>
        <ui-card title="Minhas cotações">
          <ui-button slot="acoes" id="nova">+ Nova cotação</ui-button>
          <div id="lista"></div>
        </ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#nova").addEventListener("click", () => this.abrirForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
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
      location.hash = "#/cotacoes/" + e.detail.linha.id;
    });
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirForm(e.detail.linha);
      else this.remover(e.detail.linha);
    });
    el.replaceChildren(tabela);
  }

  abrirForm(cotacao) {
    const form = document.createElement("cotacao-form");
    form.cotacao = cotacao;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
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
