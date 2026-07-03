/**
 * <senha-form> — Segurança (perfil): botão que abre o fluxo de troca de senha
 * por PIN (<redefinir-senha>), o MESMO do primeiro acesso / esqueci a senha.
 * O código é enviado ao e-mail do próprio usuário, que já vem travado.
 */
import { BaseElement } from "../../components/base-element.js";
import { auth } from "../../core/auth-store.js";
import "../../components/ui-button.js";
import "../auth/redefinir-senha.js";

class SenhaForm extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      p { margin: 0 0 var(--esp-4); font-size: var(--fs-sm); color: var(--cor-texto-suave); max-width: 460px; }
    `;
  }

  template() {
    return `
      <p>Para trocar a senha, enviaremos um <b>código de confirmação</b> para o seu e-mail. Depois de confirmar, você define a nova senha.</p>
      <ui-button id="trocar">Alterar senha</ui-button>
    `;
  }

  aposRender() {
    this.$("#trocar").addEventListener("click", () => this.abrir());
  }

  abrir() {
    const u = auth.usuario() || {};
    const el = document.createElement("redefinir-senha");
    el.contexto = "perfil";
    el.email = u.email || "";
    document.body.appendChild(el);
  }
}

customElements.define("senha-form", SenhaForm);
