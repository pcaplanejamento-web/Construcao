/**
 * <users-table> — Tabela de usuários (admin). Reutiliza <ui-data-table>.
 *
 * Propriedade: .usuarios = [{ id, nome, email, role, ativo }]
 * Eventos: "editar" ({ usuario }), "config" ({ usuario }).
 */
import { BaseElement } from "../../components/base-element.js";
import "../../components/ui-data-table.js";
import "../../components/ui-badge.js";

class UsersTable extends BaseElement {
  set usuarios(v) {
    this._usuarios = Array.isArray(v) ? v : [];
    this.atualizar();
  }
  get usuarios() {
    return this._usuarios || [];
  }

  estilos() {
    return `:host { display: block; }`;
  }
  template() {
    return `<ui-data-table id="t" empty-text="Nenhum usuário cadastrado."></ui-data-table>`;
  }

  aposRender() {
    const t = this.$("#t");
    t.columns = [
      { chave: "nome", titulo: "Nome" },
      { chave: "email", titulo: "E-mail" },
      {
        chave: "role",
        titulo: "Papel",
        formato: (r) =>
          `<ui-badge color="${r === "admin" ? "#7c3aed" : "#2563eb"}" text="${
            r === "admin" ? "Administrador" : "Usuário"
          }"></ui-badge>`,
      },
      {
        chave: "ativo",
        titulo: "Status",
        formato: (a) =>
          `<ui-badge color="${a ? "#16a34a" : "#94a3b8"}" text="${
            a ? "Ativo" : "Inativo"
          }"></ui-badge>`,
      },
    ];
    t.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "config", rotulo: "Configurações" },
    ];
    t.addEventListener("acao", (e) =>
      this.emitir(e.detail.acao, { usuario: e.detail.linha })
    );
    this.atualizar();
  }

  atualizar() {
    const t = this.$ ? this.$("#t") : null;
    if (t) t.rows = this.usuarios;
  }
}

customElements.define("users-table", UsersTable);
