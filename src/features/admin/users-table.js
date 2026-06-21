/**
 * <users-table> — Tabela de usuários (admin). Reutiliza <ui-data-table>.
 *
 * Propriedade: .usuarios = [{ id, nome, email, role, ativo }]
 * Eventos: "editar" ({ usuario }), "config" ({ usuario }).
 */
import { BaseElement } from "../../components/base-element.js";
import { data as fmtData } from "../../core/formatters.js";
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
          `<ui-badge color="${r === "admin" ? "var(--cor-roxo)" : "var(--cor-info)"}" text="${
            r === "admin" ? "Administrador" : "Usuário"
          }"></ui-badge>`,
      },
      {
        chave: "ativo",
        titulo: "Status",
        formato: (a) =>
          `<ui-badge color="${a ? "var(--cor-sucesso)" : "var(--cor-neutro)"}" text="${
            a ? "Ativo" : "Inativo"
          }"></ui-badge>`,
      },
      {
        chave: "criado_em",
        titulo: "Criado em",
        formato: (v, linha) => {
          if (!v) return `<span style="color:var(--cor-texto-fraco)">—</span>`;
          const por = this._nomePor(linha.criado_por);
          return `<div>${fmtData(v)}</div><small style="color:var(--cor-texto-fraco)">por ${por}</small>`;
        },
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

  /** Resolve o nome de quem criou (UUID → nome; "BOOTSTRAP" → Sistema). */
  _nomePor(id) {
    if (!id) return "—";
    if (String(id) === "BOOTSTRAP") return "Sistema";
    const u = this.usuarios.find((x) => String(x.id) === String(id));
    return u ? u.nome : "—";
  }

  atualizar() {
    const t = this.$ ? this.$("#t") : null;
    if (t) t.rows = this.usuarios;
  }
}

customElements.define("users-table", UsersTable);
