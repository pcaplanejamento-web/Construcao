/**
 * <categorias-view> — Gestão das classificações de itens (rota #/categorias).
 *
 * Cada usuário cria/edita/remove as SUAS classificações. As classificações
 * padrão (globais) são exibidas como referência (somente leitura).
 * Reusa ui-card, ui-data-table, category-badge, ui-button, ui-empty-state.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { auth } from "../../core/auth-store.js";
import { bus, EVENTOS, toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./categoria-form.js";

class CategoriasView extends BaseElement {
  constructor() {
    super();
    this._categorias = [];
    this._carregando = true;
  }

  estilos() {
    return `
      :host { display: block; }
      .area { max-width: 1100px; margin: 0 auto; padding: var(--esp-6) var(--esp-4);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); }
      .globais { display: flex; flex-wrap: wrap; gap: var(--esp-2); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Classificações</h1>
            <p class="sub">Crie e gerencie suas próprias classificações de itens.</p>
          </div>
          <ui-button id="nova">+ Nova classificação</ui-button>
        </div>
        <ui-card title="Minhas classificações"><div id="minhas"></div></ui-card>
        <ui-card title="Classificações padrão (todos)"><div id="globais"></div></ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#nova").addEventListener("click", () => this.abrirForm(null));
    this.aoLimpar(bus.on(EVENTOS.CATEGORIAS, () => this.carregar()));
    this.carregar();
  }

  async carregar() {
    this._carregando = true;
    this.pintar();
    try {
      const r = await api.call("categorias.listar");
      this._categorias = r.categorias || [];
    } catch (e) {
      notificarErro(e);
      this._categorias = [];
    } finally {
      this._carregando = false;
      this.pintar();
    }
  }

  pintar() {
    const minhasEl = this.$("#minhas");
    const globaisEl = this.$("#globais");
    if (!minhasEl) return;

    if (this._carregando) {
      minhasEl.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      globaisEl.innerHTML = "";
      return;
    }

    const meuId = (auth.usuario() || {}).id;
    const minhas = this._categorias.filter((c) => String(c.usuario_id) === String(meuId));
    const globais = this._categorias.filter((c) => String(c.usuario_id) !== String(meuId));

    // Minhas classificações: tabela com ações (reusa ui-data-table + category-badge).
    if (!minhas.length) {
      minhasEl.innerHTML = `
        <ui-empty-state icone="🏷️" titulo="Nenhuma classificação sua"
          texto="Crie classificações personalizadas para organizar suas despesas.">
          <ui-button slot="acao" id="vaziaNova">+ Criar classificação</ui-button>
        </ui-empty-state>`;
      minhasEl.querySelector("#vaziaNova").addEventListener("click", () => this.abrirForm(null));
    } else {
      const tabela = document.createElement("ui-data-table");
      tabela.columns = [
        {
          chave: "nome",
          titulo: "Classificação",
          formato: (nome, linha) =>
            `<category-badge nome="${nome}" cor="${linha.cor}"></category-badge>`,
        },
      ];
      tabela.acoes = [
        { nome: "editar", rotulo: "Editar" },
        { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
      ];
      tabela.rows = minhas;
      tabela.addEventListener("acao", (e) => {
        if (e.detail.acao === "editar") this.abrirForm(e.detail.linha);
        else this.remover(e.detail.linha);
      });
      minhasEl.replaceChildren(tabela);
    }

    // Globais: badges somente leitura (reusa category-badge).
    globaisEl.innerHTML = `<div class="globais">${globais
      .map((c) => `<category-badge nome="${c.nome}" cor="${c.cor}"></category-badge>`)
      .join("")}</div>`;
  }

  abrirForm(categoria) {
    const form = document.createElement("categoria-form");
    form.categoria = categoria;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  async remover(categoria) {
    if (!confirm(`Excluir a classificação "${categoria.nome}"?`)) return;
    try {
      await api.call("categorias.remover", { id: categoria.id });
      toastSucesso("Classificação removida.");
      bus.emit(EVENTOS.CATEGORIAS, { tipo: "removida" });
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("categorias-view", CategoriasView);
