/**
 * <fornecedores-view> — Agenda de fornecedores (rota /fornecedores), com abas:
 *  - Fornecedores: CRUD próprio (nome/telefone/e-mail/classificação);
 *  - Classificação: lista a entidade `categoria` (a mesma "subclassificação" dos
 *    itens — o fornecedor usa `categoria_id` como Classificação), reaproveitando
 *    `categoria-form` e o padrão da aba Subclassificações de itens.
 * Lê do data-store (cache-first) e assina mudanças. Reusa ui-tabs, ui-card,
 * ui-data-table, category-badge, ui-button, ui-empty-state, categoria-form.
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { colunasLog } from "../../core/audit-columns.js";
import {
  abrirBannerVinculos,
  vinculosDoFornecedor,
  vinculosDaSubclassificacao,
} from "../shared/vinculos.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./fornecedor-form.js";
import "../categorias/categoria-form.js";

class FornecedoresView extends BaseElement {
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
            <h1>Fornecedores</h1>
            <p class="sub">Cadastre as empresas/lojas de onde você compra.</p>
          </div>
        </div>
        <ui-tabs id="abas">
          <div slot="fornecedores">
            <ui-card title="Meus fornecedores">
              <ui-button slot="acoes" id="novo">+ Novo fornecedor</ui-button>
              <div id="lista"></div>
            </ui-card>
          </div>
          <div slot="classificacao">
            <ui-card title="Classificações">
              <ui-button slot="acoes" id="novaClass">+ Nova classificação</ui-button>
              <div id="listaClass"></div>
            </ui-card>
          </div>
        </ui-tabs>
      </div>
    `;
  }

  aoConectar() {
    this.$("#abas").abas = [
      { id: "fornecedores", rotulo: "Fornecedores", icone: "fornecedor" },
      { id: "classificacao", rotulo: "Classificação", icone: "tag" },
    ];
    this.$("#novo").addEventListener("click", () => this.abrirForm(null));
    this.$("#novaClass").addEventListener("click", () => this.abrirClassForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    this.pintarFornecedores();
    this.pintarClassificacoes();
  }

  /* ---------------------------- Fornecedores --------------------------- */

  pintarFornecedores() {
    const el = this.$("#lista");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }

    const fornecedores = dataStore.fornecedoresAtivos();
    if (!fornecedores.length) {
      el.innerHTML = `
        <ui-empty-state icone="fornecedor" titulo="Nenhum fornecedor"
          texto="Cadastre fornecedores para usá-los nas cotações.">
          <ui-button slot="acao" id="vazioNovo">+ Cadastrar fornecedor</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vazioNovo").addEventListener("click", () => this.abrirForm(null));
      return;
    }

    const mapaCat = {};
    dataStore.categorias().forEach((c) => (mapaCat[c.id] = c));

    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.setAttribute("clicavel", "");
    tabela.columns = [
      { chave: "nome", titulo: "Fornecedor" },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
      {
        chave: "categoria_id",
        titulo: "Classificação",
        formato: (id) => {
          const c = mapaCat[id];
          return c
            ? `<category-badge nome="${c.nome}" cor="${c.cor}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      ...colunasLog(),
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = fornecedores;
    tabela.addEventListener("linha", (e) => {
      irPara("/fornecedores/" + e.detail.linha.id);
    });
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirForm(e.detail.linha);
      else this.remover(e.detail.linha);
    });
    el.replaceChildren(tabela);
  }

  abrirForm(fornecedor) {
    const form = document.createElement("fornecedor-form");
    form.fornecedor = fornecedor;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  remover(fornecedor) {
    abrirBannerVinculos({
      titulo: `O fornecedor "${fornecedor.nome}"`,
      grupos: vinculosDoFornecedor(fornecedor.id),
      aoExcluir: async () => {
        if (!confirm(`Excluir o fornecedor "${fornecedor.nome}"?`)) return;
        try {
          await dataStore.removerFornecedor(fornecedor.id);
          toastSucesso("Fornecedor removido.");
        } catch (e) {
          notificarErro(e);
        }
      },
    });
  }

  /* --------------------------- Classificação --------------------------- */
  /* Mesma entidade `categoria` da subclassificação de itens (reuso total). */

  pintarClassificacoes() {
    const el = this.$("#listaClass");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }

    const todas = dataStore.categoriasFornecedor();
    if (!todas.length) {
      el.innerHTML = `
        <ui-empty-state icone="tag" titulo="Nenhuma classificação"
          texto="Crie classificações para organizar seus fornecedores.">
          <ui-button slot="acao" id="vaziaClass">+ Criar classificação</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vaziaClass").addEventListener("click", () => this.abrirClassForm(null));
      return;
    }
    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.columns = [
      {
        chave: "nome",
        titulo: "Classificação",
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
      if (e.detail.acao === "editar") this.abrirClassForm(e.detail.linha);
      else this.removerClass(e.detail.linha);
    });
    el.replaceChildren(tabela);
  }

  abrirClassForm(categoria) {
    const form = document.createElement("categoria-form");
    form.tipo = "fornecedor";
    form.categoria = categoria;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  removerClass(categoria) {
    abrirBannerVinculos({
      titulo: `A classificação "${categoria.nome}"`,
      grupos: vinculosDaSubclassificacao(categoria.id),
      aoExcluir: async () => {
        if (!confirm(`Excluir a classificação "${categoria.nome}"?`)) return;
        try {
          await dataStore.removerCategoria(categoria.id);
          toastSucesso("Classificação removida.");
        } catch (e) {
          notificarErro(e);
        }
      },
    });
  }
}

customElements.define("fornecedores-view", FornecedoresView);
