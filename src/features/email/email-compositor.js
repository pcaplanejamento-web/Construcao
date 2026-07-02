/**
 * <email-compositor> — Compor/responder/encaminhar e-mail (estilo Gmail) pela
 * caixa da empresa. De (alias) · Para · Cc · Cco · Assunto · texto rico · anexos
 * · salvar rascunho. Emite "enviado" e "fechar".
 *
 * Propriedades:
 *   .modo      — "novo" (padrão) | "responder" | "responderTodos" | "encaminhar"
 *   .threadId  — conversa (responder/encaminhar)
 *   .draftId   — rascunho em edição (continuar)
 *   .para/.cc/.bcc/.assunto/.corpoHtml — pré-preenchimento
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";
import "../../components/ui-icon.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function kb(n) {
  n = Number(n) || 0;
  return n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB";
}

class EmailCompositor extends BaseElement {
  constructor() {
    super();
    this._modo = "novo";
    this._anexos = []; // { nome, mimeType, base64, tamanho }
    this._remetentes = null;
  }
  set modo(v) { this._modo = v || "novo"; }
  set threadId(v) { this._threadId = v || null; }
  set draftId(v) { this._draftId = v || null; }
  set para(v) { this._para = v || ""; }
  set cc(v) { this._cc = v || ""; }
  set bcc(v) { this._bcc = v || ""; }
  set assunto(v) { this._assunto = v || ""; }
  set corpoHtml(v) { this._corpoHtml = v || ""; }

  get ehResposta() { return !!this._threadId && (this._modo === "responder" || this._modo === "responderTodos"); }
  get ehEncaminhar() { return this._modo === "encaminhar"; }
  get titulo() {
    if (this._modo === "responderTodos") return "Responder a todos";
    if (this._modo === "responder") return "Responder";
    if (this.ehEncaminhar) return "Encaminhar";
    return this._draftId ? "Editar rascunho" : "Escrever e-mail";
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-3); }
      .linha { display: grid; grid-template-columns: 54px 1fr auto; gap: var(--esp-2); align-items: center; }
      .linha > label { font-size: var(--fs-sm); color: var(--cor-texto-suave); font-weight: var(--peso-semi); }
      .campo-in, select { width: 100%; box-sizing: border-box; height: 38px; font-family: inherit; font-size: var(--fs-md);
        color: var(--cor-texto); background: var(--cor-superficie); border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-sm); padding: 0 var(--esp-3); }
      .toggles { display: flex; gap: var(--esp-2); }
      .toggles button { background: none; border: none; color: var(--cor-primaria); cursor: pointer;
        font-size: var(--fs-sm); font-weight: var(--peso-semi); padding: 4px; }
      .barra { display: flex; gap: 2px; border: 1px solid var(--cor-borda); border-bottom: none;
        border-radius: var(--raio-sm) var(--raio-sm) 0 0; padding: 4px; flex-wrap: wrap; background: var(--cor-superficie-2); }
      .barra button { width: 32px; height: 32px; border: none; background: none; cursor: pointer; border-radius: var(--raio-sm);
        color: var(--cor-texto); font-size: var(--fs-md); }
      .barra button:hover { background: var(--cor-divisor); }
      .barra b, .barra i, .barra u { pointer-events: none; }
      .corpo { min-height: 200px; max-height: 40vh; overflow-y: auto; border: 1px solid var(--cor-borda-forte);
        border-radius: 0 0 var(--raio-sm) var(--raio-sm); padding: var(--esp-3); font-size: var(--fs-md);
        color: var(--cor-texto); background: var(--cor-superficie); line-height: 1.5; }
      .corpo:focus { outline: none; border-color: var(--cor-primaria); }
      .anexos { display: flex; flex-wrap: wrap; gap: var(--esp-2); }
      .chip { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm);
        background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-completo);
        padding: 4px 6px 4px 12px; color: var(--cor-texto-suave); }
      .chip button { border: none; background: none; cursor: pointer; color: var(--cor-texto-fraco); font-size: 1rem; line-height: 1; padding: 2px 6px; }
      .anexar { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: var(--cor-primaria);
        font-size: var(--fs-sm); font-weight: var(--peso-semi); }
      .anexar input { display: none; }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm); background: var(--cor-erro-suave); padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); }
      #rodape { display: flex; align-items: center; gap: var(--esp-2); }
      #rodape .espaco { flex: 1; }
      @media (max-width: 560px) { .linha { grid-template-columns: 44px 1fr; } .linha .toggles { grid-column: 2; } }
    `;
  }

  template() {
    const mostrarPara = !this.ehResposta;
    return `
      <ui-modal open largo title="${esc(this.titulo)}">
        <div class="campos">
          <div class="erro" id="erro" hidden></div>
          <div class="linha"><label>De</label><select id="de" class="campo-in"><option value="">Carregando…</option></select><span></span></div>
          ${
            mostrarPara
              ? `<div class="linha"><label>Para</label><input id="para" class="campo-in" type="text" placeholder="email@exemplo.com, outro@..." value="${esc(this._para || "")}">
                   <div class="toggles"><button type="button" id="tgCc">Cc</button><button type="button" id="tgCco">Cco</button></div></div>`
              : ""
          }
          <div class="linha" id="lnCc" hidden><label>Cc</label><input id="cc" class="campo-in" type="text" placeholder="cópia@..." value="${esc(this._cc || "")}"><span></span></div>
          <div class="linha" id="lnCco" hidden><label>Cco</label><input id="bcc" class="campo-in" type="text" placeholder="cópia oculta@..." value="${esc(this._bcc || "")}"><span></span></div>
          ${
            mostrarPara
              ? `<div class="linha"><label>Assunto</label><input id="assunto" class="campo-in" type="text" placeholder="Assunto" value="${esc(this._assunto || "")}"><span></span></div>`
              : ""
          }
          <div>
            <div class="barra">
              <button type="button" data-cmd="bold" title="Negrito"><b>B</b></button>
              <button type="button" data-cmd="italic" title="Itálico"><i>I</i></button>
              <button type="button" data-cmd="underline" title="Sublinhado"><u>U</u></button>
              <button type="button" data-cmd="insertUnorderedList" title="Lista">•</button>
              <button type="button" data-cmd="createLink" title="Link">🔗</button>
            </div>
            <div class="corpo" id="corpo" contenteditable="true"></div>
          </div>
          <div class="anexos" id="anexos"></div>
          <label class="anexar"><ui-icon name="recibo" size="16"></ui-icon> Anexar arquivo<input type="file" id="arquivo" multiple></label>
        </div>
        <div slot="rodape" id="rodape">
          <ui-button id="enviar">Enviar</ui-button>
          <ui-button id="rascunho" variant="secundario">Salvar rascunho</ui-button>
          <span class="espaco"></span>
          <ui-button id="cancelar" variant="secundario">Fechar</ui-button>
        </div>
      </ui-modal>`;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#enviar").addEventListener("click", () => this.enviar());
    this.$("#rascunho").addEventListener("click", () => this.salvarRascunho());
    const tgCc = this.$("#tgCc"); if (tgCc) tgCc.addEventListener("click", () => this._toggle("#lnCc"));
    const tgCco = this.$("#tgCco"); if (tgCco) tgCco.addEventListener("click", () => this._toggle("#lnCco"));
    this.$$(".barra button").forEach((b) =>
      b.addEventListener("click", () => this._cmd(b.dataset.cmd))
    );
    this.$("#arquivo").addEventListener("change", (e) => this._addArquivos(e.target.files));
    // Corpo inicial (prefill) + assinatura carregada com os remetentes.
    if (this._corpoHtml) this.$("#corpo").innerHTML = this._corpoHtml;
    if ((this._cc || "").trim()) this._toggle("#lnCc", true);
    if ((this._bcc || "").trim()) this._toggle("#lnCco", true);
    this._carregarRemetentes();
    this._pintarAnexos();
  }

  async _carregarRemetentes() {
    try {
      this._remetentes = await api.call("email.caixa.remetentes");
    } catch (e) {
      this._remetentes = { principal: "", aliases: [], assinatura: "" };
    }
    const sel = this.$("#de");
    if (sel) {
      const r = this._remetentes;
      const ops = [];
      if (r.principal) ops.push(r.principal);
      (r.aliases || []).forEach((a) => { if (ops.indexOf(a) < 0) ops.push(a); });
      (r.enderecos || []).forEach((a) => { if (ops.indexOf(a) < 0) ops.push(a); });
      sel.innerHTML = ops.length
        ? ops.map((e) => `<option value="${esc(e)}">${esc(e)}</option>`).join("")
        : `<option value="">(conta padrão)</option>`;
    }
    // Assinatura: acrescenta ao corpo se estiver vazio (compor novo).
    const corpo = this.$("#corpo");
    if (corpo && !corpo.innerHTML.trim() && this._remetentes.assinatura) {
      corpo.innerHTML = "<br><br>" + this._remetentes.assinatura;
    }
  }

  _toggle(sel, forcar) {
    const el = this.$(sel);
    if (el) el.hidden = forcar === true ? false : !el.hidden;
  }

  _cmd(cmd) {
    if (!cmd) return;
    this.$("#corpo").focus();
    if (cmd === "createLink") {
      const url = prompt("URL do link:");
      if (url) document.execCommand("createLink", false, url);
      return;
    }
    document.execCommand(cmd, false, null);
  }

  _addArquivos(files) {
    Array.from(files || []).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = String(reader.result || "").split(",")[1] || "";
        this._anexos.push({ nome: f.name, mimeType: f.type || "application/octet-stream", base64: b64, tamanho: f.size });
        this._pintarAnexos();
      };
      reader.readAsDataURL(f);
    });
    const inp = this.$("#arquivo"); if (inp) inp.value = "";
  }

  _pintarAnexos() {
    const box = this.$("#anexos");
    if (!box) return;
    box.innerHTML = this._anexos
      .map((a, i) => `<span class="chip"><ui-icon name="recibo" size="13"></ui-icon>${esc(a.nome)} <small>(${kb(a.tamanho)})</small><button type="button" data-i="${i}" title="Remover">&times;</button></span>`)
      .join("");
    box.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => { this._anexos.splice(Number(b.dataset.i), 1); this._pintarAnexos(); })
    );
  }

  _coleta() {
    const val = (s) => { const el = this.$(s); return el ? el.value.trim() : ""; };
    return {
      from: val("#de"),
      para: this.$("#para") ? val("#para") : "",
      cc: this.$("#cc") ? val("#cc") : "",
      bcc: this.$("#bcc") ? val("#bcc") : "",
      assunto: this.$("#assunto") ? val("#assunto") : "",
      html: this.$("#corpo").innerHTML,
      anexos: this._anexos,
    };
  }

  async enviar() {
    const d = this._coleta();
    if (!this.ehResposta && !d.para) return this._erro("Informe o destinatário (Para).");
    if (!this.ehResposta && !d.assunto && !this.ehEncaminhar) return this._erro("Informe o assunto.");
    if (!d.html.replace(/<[^>]+>/g, "").trim() && !d.anexos.length) return this._erro("Escreva a mensagem.");
    this._erro("");
    const btn = this.$("#enviar"); btn.setAttribute("loading", "");
    try {
      if (this.ehEncaminhar) {
        await api.call("email.caixa.encaminhar", { threadId: this._threadId, para: d.para, cc: d.cc, bcc: d.bcc, from: d.from, html: d.html });
      } else if (this.ehResposta) {
        await api.call("email.caixa.responder", { threadId: this._threadId, todos: this._modo === "responderTodos", html: d.html, cc: d.cc, bcc: d.bcc, from: d.from, anexos: d.anexos });
      } else {
        await api.call("email.caixa.enviar", { para: d.para, cc: d.cc, bcc: d.bcc, from: d.from, assunto: d.assunto, html: d.html, anexos: d.anexos });
        if (this._draftId) { try { await api.call("email.caixa.excluirRascunho", { draftId: this._draftId }); } catch (e) { /* ok */ } }
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

  async salvarRascunho() {
    const d = this._coleta();
    const btn = this.$("#rascunho"); btn.setAttribute("loading", "");
    try {
      const r = await api.call("email.caixa.salvarRascunho", {
        draftId: this._draftId || "", para: d.para, cc: d.cc, bcc: d.bcc, from: d.from,
        assunto: d.assunto, html: d.html, anexos: d.anexos,
      });
      this._draftId = r.draftId || this._draftId;
      toastSucesso("Rascunho salvo.");
      this.emitir("enviado"); // recarrega a lista (se estiver em Rascunhos)
      this.emitir("fechar");
    } catch (e) {
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
