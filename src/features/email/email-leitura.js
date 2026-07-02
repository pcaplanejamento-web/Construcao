/**
 * <email-leitura> — Modal que lê uma conversa da caixa da empresa (GmailApp).
 * Busca `email.caixa.ler` e renderiza cada mensagem; o corpo HTML (arbitrário)
 * vai num <iframe sandbox srcdoc> SEM allow-scripts → neutraliza XSS.
 *
 * Propriedades: .threadId (string), .assunto (string, opcional p/ o título).
 * Emite "responder" ({ threadId, assunto }) e "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function quando(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

class EmailLeitura extends BaseElement {
  set threadId(v) { this._threadId = v; }
  get threadId() { return this._threadId; }
  set assunto(v) { this._assunto = v; }
  get assunto() { return this._assunto || "E-mail"; }

  estilos() {
    return `
      #corpo { display: flex; flex-direction: column; gap: var(--esp-4); }
      .msg { border: 1px solid var(--cor-borda); border-radius: var(--raio-md); overflow: hidden; }
      .msg-cab { padding: var(--esp-3) var(--esp-4); background: var(--cor-superficie-2);
        border-bottom: 1px solid var(--cor-borda); }
      .de { font-weight: var(--peso-semi); }
      .de small { color: var(--cor-texto-fraco); font-weight: var(--peso-normal); }
      .meta { display: flex; justify-content: space-between; gap: var(--esp-3); flex-wrap: wrap;
        font-size: var(--fs-sm); color: var(--cor-texto-suave); margin-top: 2px; }
      .para { font-size: var(--fs-xs); color: var(--cor-texto-fraco); }
      iframe { width: 100%; height: 52vh; border: none; background: #fff; display: block; }
      .anexos { display: flex; flex-wrap: wrap; gap: var(--esp-2); padding: var(--esp-3) var(--esp-4);
        border-top: 1px solid var(--cor-divisor); }
      .anexo { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); font-family: inherit;
        color: var(--cor-texto-suave); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-completo); padding: 6px 12px; min-height: 34px; cursor: pointer; }
      .anexo:hover { background: var(--cor-superficie); color: var(--cor-primaria); border-color: var(--cor-primaria); }
      .erro { color: var(--cor-erro); }
      .labels { display: flex; flex-wrap: wrap; gap: var(--esp-2); margin-bottom: var(--esp-3); }
      .labels:empty { display: none; }
      .label { font-size: var(--fs-xs); background: var(--cor-primaria-suave); color: var(--cor-primaria-escura);
        border-radius: var(--raio-completo); padding: 2px 10px; font-weight: var(--peso-semi); }
      #estrela { font-size: 1.1rem; line-height: 1; }
    `;
  }

  template() {
    return `
      <ui-modal open title="${esc(this.assunto)}" largo>
        <div id="labels" class="labels"></div>
        <div id="corpo"><ui-spinner centro text="Abrindo e-mail..."></ui-spinner></div>
        <div slot="rodape">
          <ui-button id="estrela" variant="secundario" tamanho="sm" title="Favoritar">☆</ui-button>
          <ui-button id="arquivar" variant="secundario" tamanho="sm">Arquivar</ui-button>
          <ui-button id="lixeira" variant="perigo-contorno" tamanho="sm">Excluir</ui-button>
          <ui-button id="encaminhar" variant="secundario" tamanho="sm">Encaminhar</ui-button>
          <ui-button id="responder" variant="secundario" tamanho="sm">Responder</ui-button>
          <ui-button id="respTodos" tamanho="sm">Resp. todos</ui-button>
          <ui-button id="fechar" variant="secundario" tamanho="sm">Fechar</ui-button>
        </div>
      </ui-modal>`;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    const compor = (modo) => this.emitir("compor", { modo, threadId: this.threadId, assunto: this.assunto });
    this.$("#responder").addEventListener("click", () => compor("responder"));
    this.$("#respTodos").addEventListener("click", () => compor("responderTodos"));
    this.$("#encaminhar").addEventListener("click", () => compor("encaminhar"));
    this.$("#arquivar").addEventListener("click", () => this._marcar("arquivar", true));
    this.$("#lixeira").addEventListener("click", () => this._marcar("lixeira", true));
    this.$("#estrela").addEventListener("click", () => this._marcar(this._estrela ? "tirarEstrela" : "estrela", false));
    this.carregar();
  }

  async carregar() {
    try {
      const r = await api.call("email.caixa.ler", { threadId: this.threadId });
      this._assunto = r.assunto || this._assunto;
      this._estrela = !!r.estrela;
      this._atualizarEstrela();
      const modal = this.$("ui-modal");
      if (modal) modal.setAttribute("title", this.assunto);
      const lab = this.$("#labels");
      if (lab) lab.innerHTML = (r.labels || []).map((n) => `<span class="label">${esc(n)}</span>`).join("");
      const corpo = this.$("#corpo");
      corpo.innerHTML = (r.mensagens || []).map((m, i) => this._msg(m, i)).join("");
      corpo.querySelectorAll(".anexo").forEach((b) =>
        b.addEventListener("click", () => this._baixarAnexo(b.dataset.msg, b.dataset.anexo, b.dataset.nome))
      );
    } catch (e) {
      notificarErro(e);
      const c = this.$("#corpo");
      if (c) c.innerHTML = `<p class="erro">Não foi possível abrir o e-mail.</p>`;
    }
  }

  async _marcar(acao, fechar) {
    try {
      await api.call("email.caixa.marcar", { threadId: this.threadId, acao });
      const msgs = { arquivar: "Conversa arquivada.", lixeira: "Movido para a lixeira.", naoLida: "Marcada como não lida.", estrela: "Marcada com estrela.", tirarEstrela: "Estrela removida." };
      toastSucesso(msgs[acao] || "Feito.");
      if (acao === "estrela" || acao === "tirarEstrela") { this._estrela = acao === "estrela"; this._atualizarEstrela(); }
      this.emitir("mudou");
      if (fechar) this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    }
  }

  _atualizarEstrela() {
    const b = this.$("#estrela");
    if (b) b.textContent = this._estrela ? "★" : "☆";
  }

  async _baixarAnexo(msgIdx, anexoIdx, nome) {
    try {
      const r = await api.call("email.caixa.anexo", { threadId: this.threadId, msgIdx: Number(msgIdx), anexoIdx: Number(anexoIdx) });
      const bin = atob(r.base64 || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: r.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = r.nome || nome || "anexo";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notificarErro(e);
    }
  }

  _msg(m, idx) {
    const anexos = (m.anexos || []).length
      ? `<div class="anexos">${m.anexos
          .map((a) => `<button class="anexo" type="button" data-msg="${idx}" data-anexo="${a.idx}" data-nome="${esc(a.nome)}" title="Baixar ${esc(a.nome)}"><ui-icon name="recibo" size="14"></ui-icon>${esc(a.nome)}</button>`)
          .join("")}</div>`
      : "";
    return `
      <div class="msg">
        <div class="msg-cab">
          <div class="de">${esc(m.de || "")} ${m.deEmail && m.deEmail !== m.de ? `<small>&lt;${esc(m.deEmail)}&gt;</small>` : ""}</div>
          <div class="meta"><span class="para">para ${esc(m.para || "")}</span><span>${esc(quando(m.data))}</span></div>
        </div>
        <iframe sandbox="" srcdoc="${esc(m.html || "")}" referrerpolicy="no-referrer"></iframe>
        ${anexos}
      </div>`;
  }
}

customElements.define("email-leitura", EmailLeitura);
