/**
 * <senha-form> — Formulário de troca de senha (na página de perfil).
 * Reusa ui-input/ui-button e validators.senhaMinima. Chama auth.alterarSenha.
 */
import { BaseElement } from "../../components/base-element.js";
import { auth } from "../../core/auth-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { primeiroErro, obrigatorio, senhaMinima } from "../../core/validators.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class SenhaForm extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      form { display: flex; flex-direction: column; gap: var(--esp-4); max-width: 420px; }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm);
        background: var(--cor-erro-suave); padding: var(--esp-2) var(--esp-3);
        border-radius: var(--raio-sm); }
    `;
  }

  template() {
    return `
      <form>
        <div class="erro" id="erro" hidden></div>
        <ui-input id="atual" label="Senha atual" type="password" autocomplete="current-password"></ui-input>
        <ui-input id="nova" label="Nova senha" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></ui-input>
        <ui-input id="conf" label="Confirmar nova senha" type="password" autocomplete="new-password"></ui-input>
        <ui-button id="salvar">Alterar senha</ui-button>
      </form>
    `;
  }

  aposRender() {
    this.$("#salvar").addEventListener("click", () => this.salvar());
    this.$$("ui-input").forEach((i) => i.addEventListener("enter", () => this.salvar()));
  }

  async salvar() {
    const atual = this.$("#atual").value;
    const nova = this.$("#nova").value;
    const conf = this.$("#conf").value;
    const erro = primeiroErro(
      obrigatorio(atual, "A senha atual"),
      senhaMinima(nova),
      nova === conf ? "" : "A confirmação não confere."
    );
    if (erro) return this.mostrarErro(erro);
    this.mostrarErro("");

    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      await auth.alterarSenha(atual, nova);
      toastSucesso("Senha alterada com sucesso.");
      this.$("#atual").value = "";
      this.$("#nova").value = "";
      this.$("#conf").value = "";
    } catch (e) {
      this.mostrarErro(e.message || "Não foi possível alterar a senha.");
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }

  mostrarErro(msg) {
    const el = this.$("#erro");
    el.textContent = msg;
    el.hidden = !msg;
  }
}

customElements.define("senha-form", SenhaForm);
