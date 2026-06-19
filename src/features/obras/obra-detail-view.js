/**
 * <obra-detail-view> — Detalhe da obra (rota #/obras/:id).
 *
 * Layout: cabeçalho → dashboard → GRÁFICOS (categoria/rosca/mês) → formulário de
 * adição → TABELA full-width. Lê do data-store (cache-first) e sincroniza os
 * filhos por propriedade. A edição de um item é feita no BANNER <despesa-detail>
 * (clique na linha ou em Editar), não mais no formulário de adição.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-tabs.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../dashboard/grafico-rosca.js";
import "../dashboard/grafico-mensal.js";
import "../despesas/despesa-form.js";
import "../despesas/despesa-table.js";
import "../despesas/despesa-detail.js";
import "../despesas/despesa-filtros.js";
import "./obra-form.js";
import "./obra-share-form.js";

class ObraDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
    this._catSig = null;
  }

  get obraId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { max-width: 1100px; margin: 0 auto; padding: var(--esp-5);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .topo { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .acoes-topo { display: flex; gap: var(--esp-2); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      /* Gráficos em grade 1 x 3, todos do MESMO tamanho (largura e altura). */
      .graficos { display: grid; gap: var(--esp-5); grid-template-columns: repeat(3, 1fr); }
      .graficos > * { min-width: 0; height: 340px; }
      @media (max-width: 900px) {
        .graficos { grid-template-columns: 1fr; }
        .graficos > * { height: auto; min-height: 300px; }
      }
      .despesas-aba { display: flex; flex-direction: column; gap: var(--esp-5); }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando obra..."></ui-spinner></div></div>`;
  }

  aoConectar() {
    if (!dataStore.obra(this.obraId)) {
      this.$("#conteudo").innerHTML = `<p>Obra não encontrada. <a href="#/obras">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  /* --------------------------- Montagem ------------------------------ */

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="#/obras">← Minhas obras</a>
      <div class="topo" id="topo"></div>
      <dashboard-summary id="dash"></dashboard-summary>
      <ui-tabs id="abas">
        <div slot="graficos" class="graficos">
          <ui-card><category-breakdown id="break"></category-breakdown></ui-card>
          <ui-card><grafico-rosca id="rosca"></grafico-rosca></ui-card>
          <ui-card><grafico-mensal id="mensal"></grafico-mensal></ui-card>
        </div>
        <div slot="despesas" class="despesas-aba">
          <ui-card title="Registrar despesa"><despesa-form id="form"></despesa-form></ui-card>
          <ui-card title="Despesas">
            <despesa-filtros id="filtros"></despesa-filtros>
            <despesa-table id="tabela"></despesa-table>
          </ui-card>
        </div>
      </ui-tabs>
    `;
    alvo.querySelector("#abas").abas = [
      { id: "graficos", rotulo: "Gráficos", icone: "grafico" },
      { id: "despesas", rotulo: "Despesas", icone: "recibo" },
    ];
    this._dash = alvo.querySelector("#dash");
    this._break = alvo.querySelector("#break");
    this._rosca = alvo.querySelector("#rosca");
    this._mensal = alvo.querySelector("#mensal");
    this._tabela = alvo.querySelector("#tabela");
    this._form = alvo.querySelector("#form");
    this._filtros = alvo.querySelector("#filtros");
    this._filtro = { texto: "", categoria: "" };

    this._form.addEventListener("adicionar", (e) => this.adicionar(e.detail));
    this._filtros.addEventListener("filtrar", (e) => {
      this._filtro = e.detail;
      this.aplicarFiltro();
    });
    this._tabela.addEventListener("abrir", (e) => this.abrirBanner(e.detail.despesa));
    this._tabela.addEventListener("editar", (e) => this.abrirBanner(e.detail.despesa));
    this._tabela.addEventListener("remover", (e) => this.remover(e.detail.despesa));

    this._montado = true;
  }

  sincronizar() {
    if (!this._montado) return;
    const o = dataStore.obra(this.obraId);
    if (!o) {
      location.hash = "#/obras";
      return;
    }
    this._obra = o;
    const categorias = dataStore.categoriasDaObra(this.obraId);
    const resumo = dataStore.resumo(this.obraId);
    const despesas = dataStore.despesas(this.obraId);

    this._despesas = despesas; // todas (KPIs/gráficos usam o total; tabela é filtrada)
    this._dash.resumo = resumo;
    this._break.porCategoria = resumo.por_categoria || [];
    this._rosca.porCategoria = resumo.por_categoria || [];
    this._mensal.despesas = despesas;
    this._tabela.categorias = categorias;
    this.aplicarFiltro();

    const sig = categorias.map((c) => c.id).join(",");
    if (sig !== this._catSig) {
      this._catSig = sig;
      this._form.categorias = categorias;
      this._filtros.categorias = categorias;
    }
    this.pintarTopo();
  }

  /** Aplica pesquisa (item) + filtro (classificação) à tabela; KPIs ficam no total. */
  aplicarFiltro() {
    const f = this._filtro || { texto: "", categoria: "" };
    const texto = (f.texto || "").toLowerCase();
    const filtradas = (this._despesas || []).filter((d) => {
      const okTexto = !texto || String(d.item || "").toLowerCase().includes(texto);
      const okCat = !f.categoria || String(d.categoria_id) === String(f.categoria);
      return okTexto && okCat;
    });
    this._tabela.despesas = filtradas;
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo || !this._obra) return;
    const o = this._obra;
    const ehDono = o.ehDono !== false;
    topo.innerHTML = `
      <div>
        <h1>${o.nome || ""}</h1>
        <div class="meta">${
          o.endereco
            ? `<ui-icon name="local" size="14"></ui-icon> ${o.endereco} · `
            : ""
        }${o.descricao || ""}${
      !ehDono && o.dono_email
        ? ` · <ui-icon name="usuario" size="14"></ui-icon> compartilhada por ${o.dono_email}`
        : ""
    }</div>
      </div>
      <div class="acoes-topo">
        ${
          ehDono
            ? `<ui-button id="compartilharObra" variant="secundario">Compartilhar</ui-button>
               <ui-button id="editarObra" variant="secundario">Editar obra</ui-button>`
            : ""
        }
      </div>
    `;
    if (ehDono) {
      topo.querySelector("#editarObra").addEventListener("click", () => this.editarObra());
      topo.querySelector("#compartilharObra").addEventListener("click", () => this.compartilharObra());
    }
  }

  /* --------------------------- Ações --------------------------------- */

  async adicionar(dados) {
    try {
      await dataStore.adicionarDespesa(this.obraId, dados);
    } catch (e) {
      notificarErro(e);
    }
  }

  /** Abre o banner com a despesa (ver/editar/excluir). O banner é autossuficiente. */
  abrirBanner(despesa) {
    const banner = document.createElement("despesa-detail");
    banner.despesa = despesa;
    banner.categorias = dataStore.categoriasDaObra(this.obraId);
    banner.addEventListener("fechar", () => banner.remove());
    document.body.appendChild(banner);
  }

  async remover(despesa) {
    if (!confirm(`Excluir a despesa "${despesa.item}"?`)) return;
    try {
      await dataStore.removerDespesa(this.obraId, despesa.id);
    } catch (e) {
      notificarErro(e);
    }
  }

  editarObra() {
    const form = document.createElement("obra-form");
    form.obra = this._obra;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  compartilharObra() {
    const form = document.createElement("obra-share-form");
    form.obra = this._obra;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }
}

customElements.define("obra-detail-view", ObraDetailView);
