/**
 * <perfil-view> — Página do usuário (rota #/perfil).
 * Mostra os dados do usuário (do data-store) e permite trocar a senha.
 * Reusa ui-card + <senha-form>.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import "../../components/ui-card.js";
import "../../components/ui-badge.js";
import "./senha-form.js";

class PerfilView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { max-width: 760px; margin: 0 auto; padding: var(--esp-6) var(--esp-4);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-bottom: var(--esp-2); }
      .dados { display: grid; grid-template-columns: 1fr 1fr; gap: var(--esp-4); }
      @media (max-width: 560px) { .dados { grid-template-columns: 1fr; } }
      .campo .rotulo { font-size: var(--fs-xs); text-transform: uppercase;
        letter-spacing: .04em; color: var(--cor-texto-fraco); font-weight: var(--peso-semi); }
      .campo .valor { font-size: var(--fs-md); margin-top: 2px; }
    `;
  }

  template() {
    const u = dataStore.usuario() || {};
    const papel = u.role === "admin" ? "Administrador" : "Usuário";
    return `
      <div class="area">
        <div>
          <h1>Meu perfil</h1>
          <p class="sub">Seus dados e segurança da conta.</p>
        </div>
        <ui-card title="Meus dados">
          <div class="dados">
            <div class="campo"><div class="rotulo">Nome</div><div class="valor">${u.nome || "—"}</div></div>
            <div class="campo"><div class="rotulo">E-mail</div><div class="valor">${u.email || "—"}</div></div>
            <div class="campo"><div class="rotulo">Papel</div><div class="valor">
              <ui-badge color="${u.role === "admin" ? "var(--cor-roxo)" : "var(--cor-info)"}" text="${papel}"></ui-badge>
            </div></div>
            <div class="campo"><div class="rotulo">Status</div><div class="valor">
              <ui-badge color="${u.ativo ? "var(--cor-sucesso)" : "var(--cor-neutro)"}" text="${u.ativo ? "Ativo" : "Inativo"}"></ui-badge>
            </div></div>
          </div>
        </ui-card>
        <ui-card title="Segurança">
          <senha-form></senha-form>
        </ui-card>
      </div>
    `;
  }

}

customElements.define("perfil-view", PerfilView);
