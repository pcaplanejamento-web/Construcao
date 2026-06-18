/**
 * <login-form> — Formulário de autenticação.
 * Chama auth.login; em sucesso o EVENTOS.AUTH dispara a navegação central
 * (app.js). Em erro, mostra mensagem inline e um toast.
 */
import { BaseElement } from "../../components/base-element.js";
import { auth } from "../../core/auth-store.js";
import { notificarErro } from "../../core/event-bus.js";
import { email as validarEmail, obrigatorio, primeiroErro } from "../../core/validators.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class LoginForm extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      form { display: flex; flex-direction: column; gap: var(--esp-4); }
      .erro-geral { color: var(--cor-erro); font-size: var(--fs-sm);
        background: var(--cor-erro-suave); padding: var(--esp-2) var(--esp-3);
        border-radius: var(--raio-sm); }
    `;
  }

  template() {
    return `
      <form>
        <div class="erro-geral" id="erroGeral" hidden></div>
        <ui-input id="email" label="E-mail" type="email" name="email"
                  placeholder="voce@exemplo.com" autocomplete="username"></ui-input>
        <ui-input id="senha" label="Senha" type="password" name="senha"
                  placeholder="••••••••" autocomplete="current-password"></ui-input>
        <ui-button id="btn" full>Entrar</ui-button>
      </form>
    `;
  }

  aoConectar() {
    const submeter = () => this.submeter();
    this.$("#btn").addEventListener("click", submeter);
    // Enter em qualquer campo submete (os inputs emitem "enter").
    this.$$("ui-input").forEach((i) => i.addEventListener("enter", submeter));
  }

  async submeter() {
    const email = this.$("#email").value.trim();
    const senha = this.$("#senha").value;

    const erro = primeiroErro(validarEmail(email), obrigatorio(senha, "A senha"));
    if (erro) {
      this.mostrarErro(erro);
      return;
    }

    const btn = this.$("#btn");
    btn.setAttribute("loading", "");
    this.mostrarErro("");
    try {
      await auth.login(email, senha);
      // Navegação tratada centralmente via EVENTOS.AUTH (app.js).
    } catch (e) {
      this.mostrarErro(e.message || "Não foi possível entrar.");
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }

  mostrarErro(msg) {
    const el = this.$("#erroGeral");
    el.textContent = msg;
    el.hidden = !msg;
  }
}

customElements.define("login-form", LoginForm);
