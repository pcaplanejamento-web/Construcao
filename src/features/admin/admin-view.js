/**
 * <admin-view> — Painel de administração (rota #/admin, somente admin).
 *
 * Lê os usuários do data-store (vêm no snapshot quando admin) e assina mudanças.
 * Criar/editar usuário vão pelas mutações do store; configurações por usuário
 * continuam via <user-config-form> (chamada direta à API admin).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import "../../components/ui-button.js";
import "../../components/ui-card.js";
import "../../components/ui-spinner.js";
import "./users-table.js";
import "./user-form.js";
import "./user-config-form.js";

class AdminView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { max-width: 1100px; margin: 0 auto; padding: var(--esp-6) var(--esp-4); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); margin-bottom: var(--esp-5); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Administração</h1>
            <p class="sub">Cadastre usuários e defina as configurações de cada um.</p>
          </div>
          <ui-button id="novo">+ Novo usuário</ui-button>
        </div>
        <ui-card title="Usuários">
          <div id="conteudo"></div>
        </ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#novo").addEventListener("click", () => this.abrirUserForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const alvo = this.$("#conteudo");
    if (!alvo) return;
    if (!dataStore.carregado()) {
      alvo.innerHTML = `<ui-spinner centro text="Carregando usuários..."></ui-spinner>`;
      return;
    }
    const tabela = document.createElement("users-table");
    tabela.usuarios = dataStore.usuarios();
    tabela.addEventListener("editar", (e) => this.abrirUserForm(e.detail.usuario));
    tabela.addEventListener("config", (e) => this.abrirConfig(e.detail.usuario));
    alvo.replaceChildren(tabela);
  }

  abrirUserForm(usuario) {
    const form = document.createElement("user-form");
    form.usuario = usuario;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar); // o store atualiza a tabela
    document.body.appendChild(form);
  }

  abrirConfig(usuario) {
    const form = document.createElement("user-config-form");
    form.usuario = usuario;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }
}

customElements.define("admin-view", AdminView);
