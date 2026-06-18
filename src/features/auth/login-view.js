/**
 * <login-view> — Tela de login: centraliza o <login-form> num cartão.
 * É a rota pública #/login.
 */
import { BaseElement } from "../../components/base-element.js";
import { API_NAO_CONFIGURADA } from "../../core/config.js";
import "./login-form.js";
import "../../components/ui-icon.js";

class LoginView extends BaseElement {
  estilos() {
    return `
      :host { display: flex; align-items: center; justify-content: center;
        min-height: 100vh; padding: var(--esp-4); }
      .cartao {
        width: 100%; max-width: 400px; background: var(--cor-superficie);
        border: 1px solid var(--cor-borda); border-radius: var(--raio-lg);
        box-shadow: var(--sombra-md); padding: var(--esp-6);
      }
      .marca { text-align: center; margin-bottom: var(--esp-5); }
      .logo { color: var(--cor-primaria); }
      h1 { font-size: var(--fs-xl); font-weight: var(--peso-forte); margin-top: var(--esp-2); }
      p.sub { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .aviso { margin-top: var(--esp-4); font-size: var(--fs-xs);
        background: var(--cor-aviso-suave); color: var(--cor-aviso);
        padding: var(--esp-3); border-radius: var(--raio-sm); }
    `;
  }

  template() {
    return `
      <div class="cartao">
        <div class="marca">
          <div class="logo"><ui-icon name="obra" size="44"></ui-icon></div>
          <h1>Gestão de Obras</h1>
          <p class="sub">Acesse para gerenciar suas obras e despesas.</p>
        </div>
        <login-form></login-form>
        ${
          API_NAO_CONFIGURADA
            ? `<div class="aviso">API não configurada. Defina a URL do Web App em
               <code>src/core/config.js</code> (veja docs/SETUP-E-DEPLOY.md).</div>`
            : ""
        }
      </div>
    `;
  }
}

customElements.define("login-view", LoginView);
