/**
 * <obra-detail-view> — Detalhe da obra: dashboard + despesas (rota #/obras/:id).
 *
 * Lê do data-store (cache-first): assina o store e sincroniza os componentes
 * filhos (dashboard, tabela, breakdown) sem reconstruir o formulário. As
 * mutações (add/editar/remover despesa) vão pelas mutações do store, que fazem
 * UI otimista + reconciliação com o servidor. A frescura entre usuários vem do
 * refresh em 2º plano (app.js) — sem polling local.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../despesas/despesa-form.js";
import "../despesas/despesa-table.js";
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
      .colunas { display: grid; gap: var(--esp-5); grid-template-columns: 2fr 1fr; }
      @media (max-width: 860px) { .colunas { grid-template-columns: 1fr; } }
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
      <ui-card title="Registrar despesa">
        <despesa-form id="form"></despesa-form>
      </ui-card>
      <div class="colunas">
        <ui-card title="Despesas"><despesa-table id="tabela"></despesa-table></ui-card>
        <ui-card><category-breakdown id="break"></category-breakdown></ui-card>
      </div>
    `;
    this._dash = alvo.querySelector("#dash");
    this._break = alvo.querySelector("#break");
    this._tabela = alvo.querySelector("#tabela");
    this._form = alvo.querySelector("#form");

    this._form.addEventListener("adicionar", (e) => this.adicionar(e.detail));
    this._form.addEventListener("salvar", (e) => this.salvarEdicao(e.detail.id, e.detail.dados));
    this._form.addEventListener("cancelar", () => (this._form.emEdicao = null));
    this._tabela.addEventListener("editar", (e) => this.editar(e.detail.despesa));
    this._tabela.addEventListener("remover", (e) => this.remover(e.detail.despesa));

    this._montado = true;
  }

  /** Sincroniza os filhos a partir do store (sem reconstruir o formulário). */
  sincronizar() {
    if (!this._montado) return;
    const o = dataStore.obra(this.obraId);
    if (!o) {
      location.hash = "#/obras"; // obra removida
      return;
    }
    this._obra = o;
    const categorias = dataStore.categoriasDaObra(this.obraId);
    const resumo = dataStore.resumo(this.obraId);

    this._dash.resumo = resumo;
    this._break.porCategoria = resumo.por_categoria || [];
    this._tabela.categorias = categorias;
    this._tabela.despesas = dataStore.despesas(this.obraId);

    const sig = categorias.map((c) => c.id).join(",");
    if (sig !== this._catSig) {
      this._catSig = sig;
      this._form.categorias = categorias; // só atualiza o select quando muda
    }
    this.pintarTopo();
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
      await dataStore.adicionarDespesa(this.obraId, dados); // otimista + reconcilia
    } catch (e) {
      notificarErro(e);
    }
  }

  editar(despesa) {
    this._form.emEdicao = despesa;
    this._form.categorias = dataStore.categoriasDaObra(this.obraId);
    this._form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async salvarEdicao(id, dados) {
    try {
      await dataStore.atualizarDespesa(this.obraId, id, dados);
      this._form.emEdicao = null;
      toastSucesso("Despesa atualizada.");
    } catch (e) {
      notificarErro(e);
    }
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
