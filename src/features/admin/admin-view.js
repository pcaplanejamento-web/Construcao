/**
 * <admin-view> — Painel de administração (rota /admin, somente admin).
 *
 * Lê os usuários do data-store (vêm no snapshot quando admin) e assina mudanças.
 * Criar/editar usuário vão pelas mutações do store; configurações por usuário
 * continuam via <user-config-form> (chamada direta à API admin).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { editarEmMassa } from "../shared/edicao-massa.js";
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
      .area { padding: var(--esp-tela); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); margin-bottom: var(--esp-5); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
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
        </div>
        <ui-card title="Usuários">
          <ui-button slot="acoes" id="novo">+ Novo usuário</ui-button>
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
    tabela.addEventListener("editar-massa", (e) =>
      editarEmMassa(e.detail.usuarios, {
        criarForm: (ref) => {
          const f = document.createElement("user-form");
          f.usuario = ref;
          return f;
        },
        reler: (ref) => dataStore.usuarios().find((u) => String(u.id) === String(ref.id)),
        // adminAtualizarUsuario recebe o objeto inteiro; preserva nome/role/ativo + diff.
        aplicar: (l, diff) =>
          dataStore.adminAtualizarUsuario({ id: l.id, nome: l.nome, role: l.role, ativo: l.ativo, ...diff }),
        ignorar: ["email", "criado_por", "novaSenha"],
      })
    );
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
