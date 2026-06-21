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
import { moeda } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { balancos } from "../despesas/despesa-split.js";
import { montarGradeOrcamentos } from "../orcamentos/orcamento-grade.js";
import { montarGradeEquipes } from "../equipes/equipe-grade.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../dashboard/grafico-rosca.js";
import "../dashboard/grafico-mensal.js";
import "../cotacoes/cotacao-despesa-form.js";
import "../despesas/despesa-table.js";
import "../despesas/despesa-detail.js";
import "../despesas/despesa-filtros.js";
import "./obra-form.js";
import "./obra-share-form.js";
import "./obra-participantes.js";

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
      .area { padding: var(--esp-tela);
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
      <dashboard-summary id="dash"></dashboard-summary>
      <a class="voltar" href="#/obras">← Minhas obras</a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="graficos" class="graficos">
          <ui-card><category-breakdown id="break" titulo="Gastos por subclassificação"></category-breakdown></ui-card>
          <ui-card><grafico-rosca id="rosca" titulo="Distribuição por classificação"></grafico-rosca></ui-card>
          <ui-card><grafico-mensal id="mensal"></grafico-mensal></ui-card>
        </div>
        <div slot="despesas" class="despesas-aba">
          <ui-card title="Despesas">
            <ui-button slot="acoes" id="addDespesa">+ Registrar oferta</ui-button>
            <despesa-filtros id="filtros"></despesa-filtros>
            <despesa-table id="tabela"></despesa-table>
          </ui-card>
        </div>
        <div slot="participantes">
          <obra-participantes obra-id="${this.obraId}"></obra-participantes>
        </div>
        <div slot="responsaveis">
          <obra-participantes obra-id="${this.obraId}" modo="responsaveis"></obra-participantes>
        </div>
        <div slot="orcamentos">
          <ui-card title="Orçamentos da obra">
            <div id="gradeOrc"></div>
          </ui-card>
        </div>
        <div slot="equipes">
          <ui-card title="Equipes da obra">
            <div id="gradeEquipes"></div>
          </ui-card>
        </div>
        <div slot="fornecedores">
          <ui-card title="Fornecedores da obra">
            <ui-data-table id="tabForn" fluido clicavel
              empty-text="Nenhum fornecedor usado nesta obra ainda."></ui-data-table>
          </ui-card>
        </div>
      </ui-tabs>
    `;
    alvo.querySelector("#abas").abas = [
      { id: "graficos", rotulo: "Gráficos", icone: "grafico" },
      { id: "despesas", rotulo: "Despesas", icone: "recibo" },
      { id: "participantes", rotulo: "Participantes da obra", icone: "usuario" },
      { id: "responsaveis", rotulo: "Responsáveis", icone: "seguranca" },
      { id: "orcamentos", rotulo: "Orçamentos", icone: "carteira" },
      { id: "equipes", rotulo: "Equipes", icone: "usuario" },
      { id: "fornecedores", rotulo: "Fornecedores", icone: "fornecedor" },
    ];
    this._gradeOrc = alvo.querySelector("#gradeOrc");
    this._gradeEquipes = alvo.querySelector("#gradeEquipes");
    this._tabForn = alvo.querySelector("#tabForn");
    this._tabForn.addEventListener("linha", (e) => {
      location.hash = "#/fornecedores/" + e.detail.linha.id;
    });
    this._dash = alvo.querySelector("#dash");
    this._break = alvo.querySelector("#break");
    this._rosca = alvo.querySelector("#rosca");
    this._mensal = alvo.querySelector("#mensal");
    this._tabela = alvo.querySelector("#tabela");
    this._filtros = alvo.querySelector("#filtros");
    this._filtro = { texto: "", categoria: "" };

    alvo.querySelector("#addDespesa").addEventListener("click", () => this.abrirDespesaForm());
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
    // Barras = Subclassificação; Rosca = Classificação (Material/Serviço).
    this._break.porCategoria = resumo.por_subclassificacao || resumo.por_categoria || [];
    this._rosca.porCategoria = resumo.por_classificacao || [];
    this._mensal.despesas = despesas;
    this._tabela.categorias = categorias;
    this._tabela.participantes = dataStore.participantesDaObra(this.obraId);
    montarGradeOrcamentos(
      this._gradeOrc,
      dataStore.orcamentos().filter((o) => String(o.obra_id) === String(this.obraId))
    );
    montarGradeEquipes(this._gradeEquipes, dataStore.equipesDaObra(this.obraId));
    this.montarFornecedores(despesas);
    this.aplicarFiltro();

    const sig = categorias.map((c) => c.id).join(",");
    if (sig !== this._catSig) {
      this._catSig = sig;
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

  /**
   * Abre o modal para REGISTRAR uma oferta como despesa nesta obra (obra-fixa;
   * escolhe a oferta). Não há mais cadastro manual — a despesa nasce da oferta.
   */
  abrirDespesaForm() {
    const form = document.createElement("cotacao-despesa-form");
    form.obraFixaId = this.obraId;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("registrado", fechar);
    document.body.appendChild(form);
  }

  /** Aba Fornecedores: empresas usadas na obra + Total/Pago/Saldo a receber. */
  montarFornecedores(despesas) {
    const tab = this._tabForn;
    if (!tab) return;
    const { porFornecedor } = balancos(despesas);
    const qtd = {};
    despesas.forEach((d) => {
      if (d.fornecedor_id) qtd[d.fornecedor_id] = (qtd[d.fornecedor_id] || 0) + 1;
    });
    tab.columns = [
      { chave: "_nome", titulo: "Fornecedor" },
      { chave: "_qtd", titulo: "Despesas", alinhar: "dir" },
      { chave: "_total", titulo: "Total", alinhar: "dir", formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", formato: (v) => moeda(v) },
      {
        chave: "_resto",
        titulo: "Saldo a receber",
        alinhar: "dir",
        formato: (v) =>
          v > 0.01
            ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    tab.rows = Object.keys(porFornecedor)
      .map((fid) => {
        const f = dataStore.fornecedores().find((x) => String(x.id) === String(fid)) || {};
        const v = porFornecedor[fid];
        return { id: fid, _nome: f.nome || "—", _qtd: qtd[fid] || 0, _total: v.total, _recebido: v.recebido, _resto: v.saldoReceber };
      })
      .sort((a, b) => b._resto - a._resto);
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
