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
import { editarEmMassa } from "../shared/edicao-massa.js";
import { melhorTotal } from "./cotacao-util.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./cotacao-form.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };

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
            <p class="sub">Compare preços de ofertas para cada item. Orçamentos e ofertas têm abas próprias no menu.</p>
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
    this.pintarCotacoes();
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
        moeda: true,
        valorNum: (linha) => melhorTotal(dataStore.precosDaCotacao(linha.id), linha) || 0,
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
    tabela.setAttribute("editar-massa", "");
    tabela.setAttribute("excluir-massa", "");
    tabela.addEventListener("editar-massa", (e) =>
      editarEmMassa(e.detail.linhas, {
        criarForm: (ref) => {
          const f = document.createElement("cotacao-form");
          f.cotacao = ref;
          return f;
        },
        reler: (ref) => dataStore.cotacao(ref.id),
        aplicar: (l, diff) => dataStore.atualizarCotacao(l.id, diff),
      })
    );
    tabela.addEventListener("excluir-massa", async (e) => {
      let ok = 0;
      for (const l of e.detail.linhas || []) {
        try {
          await dataStore.removerCotacao(l.id);
          ok++;
        } catch (err) {
          notificarErro(err);
        }
      }
      if (ok) toastSucesso(`${ok} cotação(ões) excluída(s).`);
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
