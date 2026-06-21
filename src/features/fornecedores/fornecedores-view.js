/**
 * <fornecedores-view> — Agenda de fornecedores (rota #/fornecedores).
 *
 * Lê do data-store (cache-first) e assina mudanças. CRUD próprio do usuário.
 * Reusa ui-card, ui-data-table, category-badge, ui-button, ui-empty-state.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { data as fmtData } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./fornecedor-form.js";

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
        <ui-card title="Meus fornecedores">
          <ui-button slot="acoes" id="novo">+ Novo fornecedor</ui-button>
          <div id="lista"></div>
        </ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#novo").addEventListener("click", () => this.abrirForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
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
      { chave: "criado_em", titulo: "Criado em", formato: (v) => (v ? fmtData(v) : "—") },
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = fornecedores;
    tabela.addEventListener("linha", (e) => {
      location.hash = "#/fornecedores/" + e.detail.linha.id;
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

  async remover(fornecedor) {
    if (!confirm(`Excluir o fornecedor "${fornecedor.nome}"?`)) return;
    try {
      await dataStore.removerFornecedor(fornecedor.id);
      toastSucesso("Fornecedor removido.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("fornecedores-view", FornecedoresView);
