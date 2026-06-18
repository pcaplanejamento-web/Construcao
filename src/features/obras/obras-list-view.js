/**
 * <obras-list-view> — Lista as obras do usuário (rota #/obras).
 *
 * Lê do data-store (cache-first, sem recarregar): assina o store e repinta.
 * Criar/editar/excluir vão pelas mutações do store (write-through).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "./obra-card.js";
import "./obra-form.js";
import "./obra-share-form.js";

class ObrasListView extends BaseElement {
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
    // Assina o store: repinta quando as obras (ou totais) mudam.
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const alvo = this.$("#conteudo");
    if (!alvo) return;

    if (!dataStore.carregado()) {
      alvo.innerHTML = `<ui-spinner centro text="Carregando obras..."></ui-spinner>`;
      return;
    }
    const obras = dataStore.obras();
    if (!obras.length) {
      alvo.innerHTML = `
        <ui-empty-state icone="obra" titulo="Nenhuma obra ainda"
          texto="Crie sua primeira obra para começar a registrar despesas.">
          <ui-button slot="acao" id="vazioNova">+ Criar obra</ui-button>
        </ui-empty-state>`;
      alvo.querySelector("#vazioNova").addEventListener("click", () => this.abrirForm(null));
      return;
    }

    const grid = document.createElement("div");
    grid.className = "grid";
    obras.forEach((o) => {
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
      await dataStore.removerObra(obra.id);
      toastSucesso("Obra excluída.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("obras-list-view", ObrasListView);
