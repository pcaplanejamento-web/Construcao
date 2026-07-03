/**
 * <sistema-email-config> — Configuração do E-mail do SISTEMA (admin): define o
 * **remetente** das notificações automáticas (recuperação de senha, etc.),
 * gravado na Script Property `EMAIL_REMETENTE`. Mostra também para onde vai a
 * **cópia (BCC)** dos envios de recuperação (a caixa dattaobra@gmail.com), que
 * ficam visíveis no Gmail e na aba E-mail do app.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";

class SistemaEmailConfig extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .form { display: flex; flex-direction: column; gap: var(--esp-4); max-width: 520px; }
      p.ajuda { margin: 0; font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .info { font-size: var(--fs-sm); color: var(--cor-texto-suave); background: var(--cor-superficie-2);
        border: 1px solid var(--cor-divisor); border-radius: var(--raio-sm); padding: var(--esp-3); }
      .info b { color: var(--cor-texto); }
      .acoes { display: flex; gap: var(--esp-2); }
    `;
  }

  template() {
    return `<div id="area"><ui-spinner centro text="Carregando..."></ui-spinner></div>`;
  }

  aoConectar() { this._carregar(); }

  async _carregar() {
    try {
      this._cfg = await api.call("admin.email.obter");
      this._pintar();
    } catch (e) {
      notificarErro(e);
      this.$("#area").innerHTML = `<p class="ajuda">Não foi possível carregar a configuração.</p>`;
    }
  }

  _pintar() {
    const c = this._cfg || {};
    const copia = c.copia
      ? `<div class="info">Uma <b>cópia</b> de cada e-mail de recuperação é enviada para <b>${c.copia}</b> — visível no Gmail e na aba <b>E-mail</b> do app.</div>`
      : "";
    this.$("#area").innerHTML = `
      <div class="form">
        <p class="ajuda">E-mail <b>remetente</b> das mensagens automáticas do sistema (código de recuperação de senha, avisos). Use um endereço <b>@dattaobra.com.br</b> verificado no Resend. Aceita "Nome &lt;email&gt;" ou só o e-mail. Em branco = padrão (<i>${(c.padrao || "").replace(/</g, "&lt;")}</i>).</p>
        <ui-input id="remetente" label="Remetente" type="email" value="${(c.remetente || "").replace(/"/g, "&quot;")}" placeholder="notificacoes@dattaobra.com.br"></ui-input>
        ${copia}
        <div class="acoes"><ui-button id="salvar">Salvar</ui-button></div>
      </div>`;
    this.$("#salvar").addEventListener("click", () => this._salvar());
    this.$("#remetente").addEventListener("enter", () => this._salvar());
  }

  async _salvar() {
    const remetente = (this.$("#remetente").value || "").trim();
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      this._cfg = await api.call("admin.email.definir", { remetente });
      toastSucesso("Remetente do sistema salvo.");
      this._pintar();
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("sistema-email-config", SistemaEmailConfig);
