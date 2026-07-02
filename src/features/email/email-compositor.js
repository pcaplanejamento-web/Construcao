/**
 * <email-compositor> — Modal para compor um e-mail novo OU responder uma conversa.
 * Envia pela caixa da empresa (GmailApp no backend). Emite "enviado" e "fechar".
 *
 * Propriedades:
 *   .threadId  — se definido, é RESPOSTA (usa email.caixa.responder; oculta Para/Assunto).
 *   .para, .assunto — pré-preenchimento (compor novo).
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

class EmailCompositor extends BaseElement {
  set threadId(v) { this._threadId = v || null; }
  get threadId() { return this._threadId || null; }
  set para(v) { this._para = v || ""; }
  set assunto(v) { this._assunto = v || ""; }
  get ehResposta() { return !!this.threadId; }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .campo { display: flex; flex-direction: column; gap: 6px; }
      .campo > span { font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto-suave); }
      .resp-info { font-size: var(--fs-sm); color: var(--cor-texto-suave); background: var(--cor-superficie-2);
        border: 1px solid var(--cor-borda); border-radius: var(--raio-md); padding: var(--esp-3); }
      textarea { width: 100%; min-height: 180px; box-sizing: border-box; font-family: inherit;
        font-size: var(--fs-md); color: var(--cor-texto); background: var(--cor-superficie);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-md); padding: var(--esp-3);
        resize: vertical; line-height: 1.5; }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm); background: var(--cor-erro-suave);
        padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); }
    `;
  }

  template() {
    const resp = this.ehResposta;
    return `
      <ui-modal open title="${resp ? "Responder" : "Escrever e-mail"}">
        <div class="campos">
          <div class="erro" id="erro" hidden></div>
          ${
            resp
              ? `<div class="resp-info">Respondendo à conversa${this._assunto ? `: <b>${esc(this._assunto)}</b>` : ""}.</div>`
              : `<ui-input id="para" label="Para" type="email" placeholder="destinatario@email.com" value="${(this._para || "").replace(/"/g, "&quot;")}"></ui-input>
                 <ui-input id="assunto" label="Assunto" placeholder="Assunto do e-mail" value="${(this._assunto || "").replace(/"/g, "&quot;")}"></ui-input>`
          }
          <label class="campo"><span>Mensagem</span><textarea id="corpo" placeholder="Escreva sua mensagem..."></textarea></label>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="enviar">Enviar</ui-button>
        </div>
      </ui-modal>`;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#enviar").addEventListener("click", () => this.enviar());
  }

  async enviar() {
    const texto = this.$("#corpo").value.trim();
    if (!texto) return this._erro("Escreva a mensagem.");
    const html = esc(texto).replace(/\n/g, "<br>");
    let para = "", assunto = "";
    if (!this.ehResposta) {
      para = this.$("#para").value.trim();
      assunto = this.$("#assunto").value.trim();
      if (!para) return this._erro("Informe o destinatário.");
      if (!assunto) return this._erro("Informe o assunto.");
    }
    this._erro("");
    const btn = this.$("#enviar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehResposta) {
        await api.call("email.caixa.responder", { threadId: this.threadId, html });
      } else {
        await api.call("email.caixa.enviar", { para, assunto, html });
      }
      toastSucesso("E-mail enviado.");
      this.emitir("enviado");
      this.emitir("fechar");
    } catch (e) {
      this._erro(e.message || "Não foi possível enviar.");
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }

  _erro(msg) {
    const el = this.$("#erro");
    el.textContent = msg;
    el.hidden = !msg;
  }
}

customElements.define("email-compositor", EmailCompositor);
