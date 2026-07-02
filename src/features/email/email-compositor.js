/**
 * <email-compositor> — Compor/responder/encaminhar (editor profissional) pela
 * caixa da empresa. De (alias c/ nome) · Para · Cc · Cco · Assunto · **toolbar
 * rica** (negrito/itálico/sublinhado/tachado/limpar, parágrafo, cor, realce,
 * listas, alinhamento, link) · anexos (clique + arraste) · auto-salvar rascunho.
 * Emite "enviado" e "fechar".
 *
 * A toolbar usa `execCommand` acionado no **mousedown com preventDefault** —
 * assim o `contenteditable` NÃO perde a seleção (funciona no Shadow DOM).
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { emailCache } from "./email-cache.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";
import "../../components/ui-icon.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function kb(n) {
  n = Number(n) || 0;
  return n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB";
}
const CORES_TEXTO = ["#111827", "#6b7280", "#e11d48", "#2563eb", "#16a34a", "#d97706"];
const CORES_REALCE = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "transparent"];

class EmailCompositor extends BaseElement {
  constructor() {
    super();
    this._modo = "novo";
    this._anexos = [];
    this._remetentes = null;
    this._salvarTimer = null;
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
      .topo { display: flex; align-items: center; gap: var(--esp-2); flex-wrap: wrap; padding-bottom: var(--esp-3);
        border-bottom: 1px solid var(--cor-divisor); margin-bottom: var(--esp-3); }
      .anexar { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: var(--cor-primaria);
        font-size: var(--fs-sm); font-weight: var(--peso-semi); border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-md); padding: 0 var(--esp-3); height: 34px; }
      .anexar input { display: none; }
      .drop-hint { font-size: var(--fs-sm); color: var(--cor-texto-fraco); }
      .campos { display: flex; flex-direction: column; }
      .linha { display: grid; grid-template-columns: 54px 1fr auto; gap: var(--esp-2); align-items: center;
        border-bottom: 1px solid var(--cor-divisor); }
      .linha > label { font-size: var(--fs-sm); color: var(--cor-texto-suave); font-weight: var(--peso-semi); }
      .campo-in, select { width: 100%; box-sizing: border-box; height: 40px; font-family: inherit; font-size: var(--fs-md);
        color: var(--cor-texto); background: transparent; border: none; padding: 0 var(--esp-1); }
      .campo-in:focus, select:focus { outline: none; }
      .toggles { display: flex; gap: var(--esp-2); }
      .toggles button { background: none; border: none; color: var(--cor-primaria); cursor: pointer; font-size: var(--fs-sm); font-weight: var(--peso-semi); padding: 4px; }

      .toolbar { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; padding: var(--esp-2) 0;
        border-bottom: 1px solid var(--cor-divisor); margin-top: var(--esp-2); }
      .toolbar .tb { min-width: 32px; height: 32px; border: none; background: none; cursor: pointer; border-radius: var(--raio-sm);
        color: var(--cor-texto); font-size: var(--fs-md); display: inline-flex; align-items: center; justify-content: center; padding: 0 6px; }
      .toolbar .tb:hover { background: var(--cor-divisor); }
      .toolbar .sep { width: 1px; height: 22px; background: var(--cor-borda); margin: 0 4px; }
      .toolbar .b { font-weight: 800; } .toolbar .i { font-style: italic; } .toolbar .u { text-decoration: underline; } .toolbar .s { text-decoration: line-through; }
      .sw { width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--cor-borda); cursor: pointer; padding: 0; }
      .sw.none { background: repeating-linear-gradient(45deg, #fff, #fff 3px, #f3a 3px, #f3a 4px); }

      .corpo { min-height: 220px; max-height: 46vh; overflow-y: auto; padding: var(--esp-3) var(--esp-1); font-size: var(--fs-md);
        color: var(--cor-texto); line-height: 1.5; }
      .corpo:focus { outline: none; }
      .corpo h1 { font-size: 1.5em; } .corpo h2 { font-size: 1.25em; } .corpo a { color: var(--cor-primaria); }
      :host(.arrastando) .corpo { outline: 2px dashed var(--cor-primaria); outline-offset: -6px; }

      .anexos { display: flex; flex-wrap: wrap; gap: var(--esp-2); padding-top: var(--esp-2); }
      .chip { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); background: var(--cor-superficie-2);
        border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 4px 6px 4px 12px; color: var(--cor-texto-suave); }
      .chip button { border: none; background: none; cursor: pointer; color: var(--cor-texto-fraco); font-size: 1rem; line-height: 1; padding: 2px 6px; }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm); background: var(--cor-erro-suave); padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); margin-bottom: var(--esp-2); }
      #rodape { display: flex; align-items: center; gap: var(--esp-2); }
      #rodape .espaco { flex: 1; }
    `;
  }

  template() {
    const mostrarPara = !this.ehResposta;
    return `
      <ui-modal open largo title="${esc(this.titulo)}">
        <div class="topo">
          <ui-button id="enviar">Enviar</ui-button>
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <label class="anexar"><ui-icon name="recibo" size="16"></ui-icon> Anexar<input type="file" id="arquivo" multiple></label>
          <span class="drop-hint">ou arraste arquivos aqui</span>
        </div>
        <div class="erro" id="erro" hidden></div>
        <div class="campos">
          <div class="linha"><label>De</label><select id="de" class="campo-in"><option value="">Carregando…</option></select><span></span></div>
          ${mostrarPara ? `<div class="linha"><label>Para</label><input id="para" class="campo-in" type="text" placeholder="destinatario@exemplo.com" value="${esc(this._para || "")}"><div class="toggles"><button type="button" id="tgCc">Cc</button><button type="button" id="tgCco">Cco</button></div></div>` : ""}
          <div class="linha" id="lnCc" hidden><label>Cc</label><input id="cc" class="campo-in" type="text" placeholder="opcional, separados por vírgula" value="${esc(this._cc || "")}"><span></span></div>
          <div class="linha" id="lnCco" hidden><label>Cco</label><input id="bcc" class="campo-in" type="text" placeholder="opcional, separados por vírgula" value="${esc(this._bcc || "")}"><span></span></div>
          ${mostrarPara ? `<div class="linha"><label>Assunto</label><input id="assunto" class="campo-in" type="text" placeholder="Assunto" value="${esc(this._assunto || "")}"><span></span></div>` : ""}
        </div>
        <div class="toolbar" id="toolbar">
          <button class="tb b" data-cmd="bold" title="Negrito" type="button">B</button>
          <button class="tb i" data-cmd="italic" title="Itálico" type="button">I</button>
          <button class="tb u" data-cmd="underline" title="Sublinhado" type="button">U</button>
          <button class="tb s" data-cmd="strikeThrough" title="Tachado" type="button">S</button>
          <button class="tb" data-cmd="removeFormat" title="Limpar formatação" type="button">T×</button>
          <span class="sep"></span>
          <button class="tb" data-cmd="formatBlock" data-val="P" title="Normal" type="button">¶</button>
          <button class="tb" data-cmd="formatBlock" data-val="H1" title="Título 1" type="button">H1</button>
          <button class="tb" data-cmd="formatBlock" data-val="H2" title="Título 2" type="button">H2</button>
          <span class="sep"></span>
          ${CORES_TEXTO.map((c) => `<button class="sw" data-cmd="foreColor" data-val="${c}" title="Cor do texto" type="button" style="background:${c}"></button>`).join("")}
          <span class="sep"></span>
          ${CORES_REALCE.map((c) => `<button class="sw ${c === "transparent" ? "none" : ""}" data-cmd="hiliteColor" data-val="${c}" title="Realce" type="button" style="${c === "transparent" ? "" : "background:" + c}"></button>`).join("")}
          <span class="sep"></span>
          <button class="tb" data-cmd="insertUnorderedList" title="Lista" type="button">•</button>
          <button class="tb" data-cmd="insertOrderedList" title="Lista numerada" type="button">1.</button>
          <span class="sep"></span>
          <button class="tb" data-cmd="justifyLeft" title="Alinhar à esquerda" type="button">⯇</button>
          <button class="tb" data-cmd="justifyCenter" title="Centralizar" type="button">≡</button>
          <button class="tb" data-cmd="justifyRight" title="Alinhar à direita" type="button">⯈</button>
          <span class="sep"></span>
          <button class="tb" data-cmd="createLink" title="Inserir link" type="button">🔗</button>
        </div>
        <div class="corpo" id="corpo" contenteditable="true"></div>
        <div class="anexos" id="anexos"></div>
        <div slot="rodape" id="rodape">
          <ui-button id="rascunho" variant="secundario">Salvar rascunho</ui-button>
          ${this._draftId ? `<ui-button id="descartar" variant="perigo-contorno">Descartar</ui-button>` : ""}
          <span class="espaco"></span>
          <ui-button id="enviar2">Enviar</ui-button>
        </div>
      </ui-modal>`;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this._fechar());
    this.$("#cancelar").addEventListener("click", () => this._fechar());
    this.$("#enviar").addEventListener("click", () => this.enviar());
    this.$("#enviar2").addEventListener("click", () => this.enviar());
    this.$("#rascunho").addEventListener("click", () => this.salvarRascunho(false));
    const desc = this.$("#descartar"); if (desc) desc.addEventListener("click", () => this._descartar());
    const tgCc = this.$("#tgCc"); if (tgCc) tgCc.addEventListener("click", () => this._toggle("#lnCc"));
    const tgCco = this.$("#tgCco"); if (tgCco) tgCco.addEventListener("click", () => this._toggle("#lnCco"));

    // Toolbar: mousedown+preventDefault mantém a seleção no editor (Shadow DOM ok).
    this.$("#toolbar").addEventListener("mousedown", (e) => {
      const b = e.target.closest("[data-cmd]");
      if (!b) return;
      e.preventDefault();
      this.$("#corpo").focus();
      const cmd = b.dataset.cmd;
      if (cmd === "createLink") { const u = prompt("URL do link (com https://):"); if (u) document.execCommand("createLink", false, u); return; }
      if (cmd === "hiliteColor") {
        const v = b.dataset.val === "transparent" ? "transparent" : b.dataset.val;
        if (!document.execCommand("hiliteColor", false, v)) document.execCommand("backColor", false, v);
        return;
      }
      document.execCommand(cmd, false, b.dataset.val || null);
    });

    // Anexos: clique + arraste.
    this.$("#arquivo").addEventListener("change", (e) => this._addArquivos(e.target.files));
    const modal = this.$("ui-modal");
    modal.addEventListener("dragover", (e) => { e.preventDefault(); this.classList.add("arrastando"); });
    modal.addEventListener("dragleave", (e) => { if (e.target === modal) this.classList.remove("arrastando"); });
    modal.addEventListener("drop", (e) => { e.preventDefault(); this.classList.remove("arrastando"); this._addArquivos(e.dataTransfer.files); });

    // Auto-salvar rascunho ao digitar (debounce).
    this.$("#corpo").addEventListener("input", () => this._agendarSalvar());

    if (this._corpoHtml) this.$("#corpo").innerHTML = this._corpoHtml;
    if ((this._cc || "").trim()) this._toggle("#lnCc", true);
    if ((this._bcc || "").trim()) this._toggle("#lnCco", true);
    this._carregarRemetentes();
    this._pintarAnexos();
  }

  async _carregarRemetentes() {
    let r = emailCache.getRemetentes();
    if (!r) {
      try { r = await api.call("email.caixa.remetentes"); emailCache.setRemetentes(r); }
      catch (e) { r = { principal: "", aliases: [], enderecos: [], assinatura: "" }; }
    }
    this._remetentes = r;
    const sel = this.$("#de");
    if (sel) {
      const ops = [];
      if (r.principal) ops.push({ v: r.principal, t: r.principal });
      (r.aliases || []).forEach((a) => { if (!ops.find((o) => o.v === a)) ops.push({ v: a, t: a }); });
      (r.enderecos || []).forEach((x) => {
        const end = x.endereco || x; const nome = x.nome || "";
        const v = nome ? `${nome} <${end}>` : end;
        if (!ops.find((o) => o.v === v)) ops.push({ v, t: v });
      });
      sel.innerHTML = ops.length ? ops.map((o) => `<option value="${esc(o.v)}">${esc(o.t)}</option>`).join("") : `<option value="">(conta padrão)</option>`;
    }
    const corpo = this.$("#corpo");
    if (corpo && !corpo.innerHTML.trim() && r.assinatura) corpo.innerHTML = "<br><br>" + r.assinatura;
  }

  _toggle(sel, forcar) { const el = this.$(sel); if (el) el.hidden = forcar === true ? false : !el.hidden; }

  _addArquivos(files) {
    Array.from(files || []).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        this._anexos.push({ nome: f.name, mimeType: f.type || "application/octet-stream", base64: String(reader.result || "").split(",")[1] || "", tamanho: f.size });
        this._pintarAnexos();
      };
      reader.readAsDataURL(f);
    });
    const inp = this.$("#arquivo"); if (inp) inp.value = "";
  }

  _pintarAnexos() {
    const box = this.$("#anexos");
    if (!box) return;
    box.innerHTML = this._anexos.map((a, i) => `<span class="chip"><ui-icon name="recibo" size="13"></ui-icon>${esc(a.nome)} <small>(${kb(a.tamanho)})</small><button type="button" data-i="${i}" title="Remover">&times;</button></span>`).join("");
    box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { this._anexos.splice(Number(b.dataset.i), 1); this._pintarAnexos(); }));
  }

  _coleta() {
    const val = (s) => { const el = this.$(s); return el ? el.value.trim() : ""; };
    return { from: val("#de"), para: this.$("#para") ? val("#para") : "", cc: this.$("#cc") ? val("#cc") : "", bcc: this.$("#bcc") ? val("#bcc") : "", assunto: this.$("#assunto") ? val("#assunto") : "", html: this.$("#corpo").innerHTML, anexos: this._anexos };
  }

  _temConteudo() {
    const d = this._coleta();
    return !!(d.para || d.assunto || d.html.replace(/<[^>]+>/g, "").trim() || d.anexos.length);
  }

  async enviar() {
    const d = this._coleta();
    if (!this.ehResposta && !d.para) return this._erro("Informe o destinatário (Para).");
    if (!this.ehResposta && !d.assunto && !this.ehEncaminhar) return this._erro("Informe o assunto.");
    if (!d.html.replace(/<[^>]+>/g, "").trim() && !d.anexos.length) return this._erro("Escreva a mensagem.");
    this._erro("");
    clearTimeout(this._salvarTimer);
    const btn = this.$("#enviar"); btn.setAttribute("loading", "");
    try {
      if (this.ehEncaminhar) {
        await api.call("email.caixa.encaminhar", { threadId: this._threadId, para: d.para, cc: d.cc, bcc: d.bcc, from: d.from, html: d.html });
      } else if (this.ehResposta) {
        await api.call("email.caixa.responder", { threadId: this._threadId, todos: this._modo === "responderTodos", html: d.html, cc: d.cc, bcc: d.bcc, from: d.from, anexos: d.anexos });
      } else {
        await api.call("email.caixa.enviar", { para: d.para, cc: d.cc, bcc: d.bcc, from: d.from, assunto: d.assunto, html: d.html, anexos: d.anexos });
        if (this._draftId) { try { await api.call("email.caixa.excluirRascunho", { draftId: this._draftId }); } catch (e) {} }
      }
      toastSucesso("E-mail enviado.");
      this._enviado = true;
      this.emitir("enviado"); this.emitir("fechar");
    } catch (e) { this._erro(e.message || "Não foi possível enviar."); notificarErro(e); btn.removeAttribute("loading"); }
  }

  async salvarRascunho(silencioso) {
    const d = this._coleta();
    if (!this._temConteudo()) return;
    const btn = silencioso ? null : this.$("#rascunho");
    if (btn) btn.setAttribute("loading", "");
    try {
      const r = await api.call("email.caixa.salvarRascunho", { draftId: this._draftId || "", para: d.para, cc: d.cc, bcc: d.bcc, from: d.from, assunto: d.assunto, html: d.html, anexos: d.anexos });
      this._draftId = r.draftId || this._draftId;
      if (!silencioso) { toastSucesso("Rascunho salvo."); emailCache.invalidar("rascunhos"); this.emitir("enviado"); this.emitir("fechar"); }
    } catch (e) { if (!silencioso) { notificarErro(e); if (btn) btn.removeAttribute("loading"); } }
  }

  _agendarSalvar() {
    clearTimeout(this._salvarTimer);
    this._salvarTimer = setTimeout(() => this.salvarRascunho(true), 5000);
  }

  async _descartar() {
    if (!this._draftId) return this.emitir("fechar");
    try { await api.call("email.caixa.excluirRascunho", { draftId: this._draftId }); toastSucesso("Rascunho descartado."); emailCache.invalidar("rascunhos"); }
    catch (e) { notificarErro(e); }
    this._enviado = true; this.emitir("enviado"); this.emitir("fechar");
  }

  _fechar() {
    clearTimeout(this._salvarTimer);
    // Fechar com conteúdo (e sem ter enviado) → salva rascunho silenciosamente.
    if (!this._enviado && this._temConteudo()) this.salvarRascunho(true);
    this.emitir("fechar");
  }

  _erro(msg) { const el = this.$("#erro"); el.textContent = msg; el.hidden = !msg; }
}

customElements.define("email-compositor", EmailCompositor);
