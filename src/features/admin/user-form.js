/**
 * <user-form> — Modal para o admin criar/editar usuário.
 *
 * Propriedade: .usuario (objeto p/ edição; ausente = novo)
 * Eventos: "salvo", "fechar". Auto-contido (chama a API admin.usuarios.*).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { primeiroErro, obrigatorio, email as validarEmail, senhaMinima } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class UserForm extends BaseElement {
  set usuario(v) {
    this._usuario = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get usuario() {
    return this._usuario || null;
  }
  get ehEdicao() {
    return !!(this.usuario && this.usuario.id);
  }

  estilos() {
    return `.campos { display: flex; flex-direction: column; gap: var(--esp-4); }`;
  }

  template() {
    const u = this.usuario || {};
    const ed = this.ehEdicao;
    return `
      <ui-modal open title="${ed ? "Editar usuário" : "Novo usuário"}">
        <div class="campos">
          <ui-input id="nome" label="Nome" value="${(u.nome || "").replace(/"/g, "&quot;")}"></ui-input>
          <ui-input id="email" label="E-mail" type="email" value="${(u.email || "").replace(
            /"/g,
            "&quot;"
          )}" ${ed ? "disabled" : ""}></ui-input>
          <ui-input id="senha" label="${
            ed ? "Nova senha (opcional)" : "Senha"
          }" type="password" placeholder="${ed ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}"></ui-input>
          <ui-select id="role" label="Papel" value="${u.role || "usuario"}"></ui-select>
          ${
            ed
              ? `<ui-select id="ativo" label="Status" value="${
                  u.ativo ? "1" : "0"
                }"></ui-select>`
              : ""
          }
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${ed ? "Salvar" : "Criar usuário"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.$("#role").options = [
      { value: "usuario", label: "Usuário" },
      { value: "admin", label: "Administrador" },
    ];
    const ativo = this.$("#ativo");
    if (ativo)
      ativo.options = [
        { value: "1", label: "Ativo" },
        { value: "0", label: "Inativo" },
      ];
    // E-mail desabilitado na edição (backend não altera e-mail).
    if (this.ehEdicao) {
      const inp = this.$("#email").shadowRoot.querySelector("input");
      if (inp) inp.disabled = true;
    }
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const nome = this.$("#nome").value.trim();
    const senha = this.$("#senha").value;
    const btn = this.$("#salvar");

    let erro;
    if (this.ehEdicao) {
      erro = primeiroErro(
        obrigatorio(nome, "O nome"),
        senha ? senhaMinima(senha) : ""
      );
    } else {
      const email = this.$("#email").value.trim();
      erro = primeiroErro(
        obrigatorio(nome, "O nome"),
        validarEmail(email),
        senhaMinima(senha)
      );
    }
    if (erro) {
      notificarErro({ message: erro });
      return;
    }

    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        const dados = { id: this.usuario.id, nome, role: this.$("#role").value };
        const ativo = this.$("#ativo");
        if (ativo) dados.ativo = ativo.value === "1";
        if (senha) dados.novaSenha = senha;
        await dataStore.adminAtualizarUsuario(dados);
        toastSucesso("Usuário atualizado.");
      } else {
        await dataStore.adminCriarUsuario({
          nome,
          email: this.$("#email").value.trim(),
          senha,
          role: this.$("#role").value,
        });
        toastSucesso("Usuário criado.");
      }
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("user-form", UserForm);
