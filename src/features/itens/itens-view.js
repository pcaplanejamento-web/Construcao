/**
 * <itens-view> — Catálogo de itens (rota #/itens), com abas:
 *  - Itens: cada item classificado como Material ou Serviço (CRUD via item-form);
 *  - Subclassificações: lista livre (entidade categoria), TODAS editáveis
 *    (as próprias e as padrão compartilhadas), reaproveitando categoria-form.
 * Lê do data-store (cache-first) e assina mudanças. Reusa ui-tabs, ui-card,
 * ui-data-table, category-badge, ui-button, ui-empty-state.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { colunasLog } from "../../core/audit-columns.js";
import { abrirBannerVinculos, vinculosDoItem, vinculosDaSubclassificacao } from "../shared/vinculos.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./item-form.js";
import "../categorias/categoria-form.js";

/** Cor do badge por classificação (espelha as cores padrão do sistema). */
const COR_CLASSIFICACAO = { Material: "#2563eb", "Serviço": "#7c3aed" };

class ItensView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
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
            <h1>Itens</h1>
            <p class="sub">Cadastre itens (Material ou Serviço) e suas subclassificações.</p>
          </div>
        </div>
        <ui-tabs id="abas">
          <div slot="itens">
            <ui-card title="Meus itens">
              <ui-button slot="acoes" id="novoItem">+ Novo item</ui-button>
              <div id="listaItens"></div>
            </ui-card>
          </div>
          <div slot="sub">
            <ui-card title="Subclassificações">
              <ui-button slot="acoes" id="novaSub">+ Nova subclassificação</ui-button>
              <div id="listaSub"></div>
            </ui-card>
          </div>
        </ui-tabs>
      </div>
    `;
  }

  aoConectar() {
    this.$("#abas").abas = [
      { id: "itens", rotulo: "Itens", icone: "recibo" },
      { id: "sub", rotulo: "Subclassificações", icone: "tag" },
    ];
    this.$("#novoItem").addEventListener("click", () => this.abrirItemForm(null));
    this.$("#novaSub").addEventListener("click", () => this.abrirSubForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    this.pintarItens();
    this.pintarSub();
  }

  /* ------------------------------ Itens ------------------------------- */

  pintarItens() {
    const el = this.$("#listaItens");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }
    const itens = dataStore.itensAtivos();
    if (!itens.length) {
      el.innerHTML = `
        <ui-empty-state icone="recibo" titulo="Nenhum item"
          texto="Cadastre itens e classifique cada um como Material ou Serviço.">
          <ui-button slot="acao" id="vazioItem">+ Cadastrar item</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vazioItem").addEventListener("click", () => this.abrirItemForm(null));
      return;
    }
    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.setAttribute("clicavel", "");
    tabela.columns = [
      { chave: "nome", titulo: "Item" },
      {
        chave: "classificacao",
        titulo: "Classificação",
        formato: (v) =>
          `<category-badge nome="${v || "—"}" cor="${COR_CLASSIFICACAO[v] || "var(--cor-neutro)"}"></category-badge>`,
      },
      ...colunasLog(),
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = itens;
    tabela.addEventListener("linha", (e) => {
      location.hash = "#/itens/" + e.detail.linha.id;
    });
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirItemForm(e.detail.linha);
      else this.removerItem(e.detail.linha);
    });
    el.replaceChildren(tabela);
  }

  abrirItemForm(item) {
    const form = document.createElement("item-form");
    form.item = item;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  removerItem(item) {
    abrirBannerVinculos({
      titulo: `O item "${item.nome}"`,
      grupos: vinculosDoItem(item.id),
      aoExcluir: async () => {
        if (!confirm(`Excluir o item "${item.nome}"?`)) return;
        try {
          await dataStore.removerItem(item.id);
          toastSucesso("Item removido.");
        } catch (e) {
          notificarErro(e);
        }
      },
    });
  }

  /* ------------------------ Subclassificações ------------------------- */

  pintarSub() {
    const el = this.$("#listaSub");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }

    // Subclassificações de ITEM (exclui as classificações de fornecedor).
    const todas = dataStore.categoriasItem();
    if (!todas.length) {
      el.innerHTML = `
        <ui-empty-state icone="tag" titulo="Nenhuma subclassificação"
          texto="Crie subclassificações para detalhar despesas e itens.">
          <ui-button slot="acao" id="vaziaSub">+ Criar subclassificação</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vaziaSub").addEventListener("click", () => this.abrirSubForm(null));
      return;
    }
    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.columns = [
      {
        chave: "nome",
        titulo: "Subclassificação",
        formato: (nome, linha) =>
          `<category-badge nome="${nome}" cor="${linha.cor}"></category-badge>`,
      },
      ...colunasLog(),
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = todas;
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirSubForm(e.detail.linha);
      else this.removerSub(e.detail.linha);
    });
    el.replaceChildren(tabela);
  }

  abrirSubForm(categoria) {
    const form = document.createElement("categoria-form");
    form.categoria = categoria;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  removerSub(categoria) {
    abrirBannerVinculos({
      titulo: `A subclassificação "${categoria.nome}"`,
      grupos: vinculosDaSubclassificacao(categoria.id),
      aoExcluir: async () => {
        if (!confirm(`Excluir a subclassificação "${categoria.nome}"?`)) return;
        try {
          await dataStore.removerCategoria(categoria.id);
          toastSucesso("Subclassificação removida.");
        } catch (e) {
          notificarErro(e);
        }
      },
    });
  }
}

customElements.define("itens-view", ItensView);
