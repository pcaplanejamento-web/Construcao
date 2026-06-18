/**
 * <obras-list-view> — Lista as obras do usuário (rota #/obras).
 *
 * Busca via obras.listar, renderiza um grid de <obra-card>, permite criar,
 * editar e excluir. Reage a EVENTOS.OBRAS para recarregar.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { bus, EVENTOS, toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "./obra-card.js";
import "./obra-form.js";
import "./obra-share-form.js";

class ObrasListView extends BaseElement {
  constructor() {
    super();
    this._obras = [];
    this._carregando = true;
  }

  estilos() {
    return `
      :host { display: block; }
      .area { max-width: 1100px; margin: 0 auto; padding: var(--esp-6) var(--esp-4); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); margin-bottom: var(--esp-5); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); }
      .grid { display: grid; gap: var(--esp-4);
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Minhas obras</h1>
            <p class="sub">Cadastre obras e acompanhe os gastos em tempo real.</p>
          </div>
          <ui-button id="nova">+ Nova obra</ui-button>
        </div>
        <div id="conteudo"></div>
      </div>
    `;
  }

  aoConectar() {
    this.$("#nova").addEventListener("click", () => this.abrirForm(null));
    this.aoLimpar(bus.on(EVENTOS.OBRAS, () => this.carregar()));
    this.carregar();
  }

  async carregar() {
    this._carregando = true;
    this.pintar();
    try {
      const data = await api.call("obras.listar");
      this._obras = data.obras || [];
    } catch (e) {
      notificarErro(e);
      this._obras = [];
    } finally {
      this._carregando = false;
      this.pintar();
    }
  }

  pintar() {
    const alvo = this.$("#conteudo");
    if (!alvo) return;

    if (this._carregando) {
      alvo.innerHTML = `<ui-spinner centro text="Carregando obras..."></ui-spinner>`;
      return;
    }
    if (!this._obras.length) {
      alvo.innerHTML = `
        <ui-empty-state icone="🏗️" titulo="Nenhuma obra ainda"
          texto="Crie sua primeira obra para começar a registrar despesas.">
          <ui-button slot="acao" id="vazioNova">+ Criar obra</ui-button>
        </ui-empty-state>`;
      alvo.querySelector("#vazioNova").addEventListener("click", () => this.abrirForm(null));
      return;
    }

    const grid = document.createElement("div");
    grid.className = "grid";
    this._obras.forEach((o) => {
      const card = document.createElement("obra-card");
      card.obra = o;
      card.addEventListener("abrir", (e) => {
        location.hash = "#/obras/" + e.detail.obra.id;
      });
      card.addEventListener("editar", (e) => this.abrirForm(e.detail.obra));
      card.addEventListener("compartilhar", (e) => this.abrirShare(e.detail.obra));
      card.addEventListener("remover", (e) => this.remover(e.detail.obra));
      grid.appendChild(card);
    });
    alvo.replaceChildren(grid);
  }

  abrirForm(obra) {
    const form = document.createElement("obra-form");
    form.obra = obra;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  abrirShare(obra) {
    const form = document.createElement("obra-share-form");
    form.obra = obra;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }

  async remover(obra) {
    if (!confirm(`Excluir a obra "${obra.nome}" e todas as suas despesas?`)) return;
    try {
      await api.call("obras.remover", { id: obra.id });
      toastSucesso("Obra excluída.");
      bus.emit(EVENTOS.OBRAS, { tipo: "removida" });
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("obras-list-view", ObrasListView);
