/**
 * <email-compositor> — Compor/responder/encaminhar (editor profissional) pela
 * caixa da empresa. De (alias c/ nome) · Para/Cc (autocomplete de contatos) ·
 * Cco · Assunto · **toolbar rica** (negrito/itálico/sublinhado/tachado/limpar,
 * dropdown de parágrafo, cor e realce em paleta, listas, alinhamento, link) ·
 * anexos (clique + arraste) · auto-salvar rascunho. Emite "enviado"/"fechar".
 *
 * A toolbar aciona `execCommand` no **mousedown com preventDefault** → o
 * contenteditable NÃO perde a seleção (funciona no Shadow DOM).
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { emailCache } from "./email-cache.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";
import "../../components/ui-icon.js";
import "./email-campo-destinatarios.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function kb(n) {
  n = Number(n) || 0;
  return n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB";
}
// Paleta de cores (estilo Google/Quill) para texto e realce.
const PALETA = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#efefef", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff",
  "#9900ff", "#ff00ff", "#e6b8af", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#cfe2f3",
  "#cc4125", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3d85c6", "#674ea7", "#a64d79",
];
// Ícones SVG da toolbar (sem emoji).
const SVG_AL = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4h11M2.5 8h7M2.5 12h9.5"/></svg>';
const SVG_AC = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4h11M4.5 8h7M3.5 12h9"/></svg>';
const SVG_AR = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4h11M6.5 8h7M4 12h9.5"/></svg>';

class EmailCompositor extends BaseElement {
  constructor() {
    super();
    this._modo = "novo";
    this._anexos = [];
    this._remetentes = null;
    this._salvarTimer = null;
    this._contatos = [];
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
      .topo { display: flex; align-items: center; gap: var(--esp-2); flex-wrap: wrap; padding-bottom: var(--esp-3); border-bottom: 1px solid var(--cor-divisor); margin-bottom: var(--esp-3); }
      .anexar { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: var(--cor-primaria); font-size: var(--fs-sm); font-weight: var(--peso-semi); border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-md); padding: 0 var(--esp-3); height: 34px; }
      .anexar input { display: none; }
      .drop-hint { font-size: var(--fs-sm); color: var(--cor-texto-fraco); }
      .campos { display: flex; flex-direction: column; }
      .linha { display: grid; grid-template-columns: 54px 1fr auto; gap: var(--esp-2); align-items: center; border-bottom: 1px solid var(--cor-divisor); }
      .linha > label { font-size: var(--fs-sm); color: var(--cor-texto-suave); font-weight: var(--peso-semi); }
      .campo-in, select { width: 100%; box-sizing: border-box; height: 40px; font-family: inherit; font-size: var(--fs-md); color: var(--cor-texto); background: transparent; border: none; padding: 0 var(--esp-1); }
      .campo-in:focus, select:focus { outline: none; }
      .toggles { display: flex; gap: var(--esp-2); }
      .toggles button { background: none; border: none; color: var(--cor-primaria); cursor: pointer; font-size: var(--fs-sm); font-weight: var(--peso-semi); padding: 4px; }
      /* Autocomplete de contatos */
      .ac { position: relative; min-width: 0; }
      .sug { position: absolute; top: 100%; left: 0; right: 0; z-index: 6; background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-md); box-shadow: var(--sombra-lg); overflow: hidden; margin-top: 2px; }
      .sug button { display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left; border: none; background: none; cursor: pointer; padding: 8px var(--esp-3); min-height: 40px; }
      .sug button:hover, .sug button.hi { background: var(--cor-superficie-2); }
      .sug b { font-size: var(--fs-md); color: var(--cor-texto); } .sug small { color: var(--cor-texto-fraco); }

      /* Toolbar */
      .toolbar { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; padding: var(--esp-2) 0; border-bottom: 1px solid var(--cor-divisor); margin-top: var(--esp-2); position: relative; }
      .toolbar .tb { min-width: 32px; height: 32px; border: none; background: none; cursor: pointer; border-radius: var(--raio-sm); color: var(--cor-texto); font-size: var(--fs-md); display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 0 6px; }
      .toolbar .tb:hover { background: var(--cor-divisor); }
      .toolbar .sep { width: 1px; height: 22px; background: var(--cor-borda); margin: 0 4px; }
      .toolbar .b { font-weight: 800; } .toolbar .i { font-style: italic; } .toolbar .u { text-decoration: underline; } .toolbar .s { text-decoration: line-through; }
      .caret { font-size: 9px; color: var(--cor-texto-fraco); }
      .ab { font-weight: 800; border-bottom: 3px solid #111; line-height: .9; } .ab.hl { background: #ffff00; border-bottom: none; padding: 0 2px; }
      .dd { position: relative; display: inline-flex; }
      .pop { position: absolute; top: calc(100% + 4px); left: 0; z-index: 8; background: var(--cor-superficie); border: 1px solid var(--cor-borda); border-radius: var(--raio-md); box-shadow: var(--sombra-lg); padding: 6px; max-width: 92vw; }
      .tb svg { display: block; } .tb ui-icon { display: inline-flex; }
      .pop[hidden] { display: none; }
      .pop-item { display: block; width: 100%; text-align: left; border: none; background: none; cursor: pointer; padding: 6px 12px; border-radius: var(--raio-sm); color: var(--cor-texto); white-space: nowrap; font-size: var(--fs-sm); }
      .pop-item:hover { background: var(--cor-superficie-2); }
      .pop-item.h1 { font-size: 1.3em; font-weight: 700; } .pop-item.h2 { font-size: 1.15em; font-weight: 700; } .pop-item.h3 { font-weight: 700; }
      .paleta { display: grid; grid-template-columns: repeat(8, 22px); gap: 4px; }
      .paleta .sw { width: 22px; height: 22px; border-radius: 4px; border: 1px solid rgba(0,0,0,.15); cursor: pointer; padding: 0; }
      .pop .sem { grid-column: 1 / -1; margin-top: 4px; border: 1px solid var(--cor-borda); border-radius: var(--raio-sm); background: var(--cor-superficie-2); cursor: pointer; padding: 6px; font-size: var(--fs-sm); }

      .corpo { min-height: 220px; max-height: 44vh; overflow-y: auto; padding: var(--esp-3) var(--esp-1); font-size: var(--fs-md); color: var(--cor-texto); line-height: 1.5; }
      .corpo:focus { outline: none; }
      .corpo h1 { font-size: 1.5em; } .corpo h2 { font-size: 1.25em; } .corpo h3 { font-size: 1.1em; } .corpo a { color: var(--cor-primaria); }
      :host(.arrastando) .corpo { outline: 2px dashed var(--cor-primaria); outline-offset: -6px; }

      .anexos { display: flex; flex-wrap: wrap; gap: var(--esp-2); padding-top: var(--esp-2); }
      .chip { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 4px 6px 4px 12px; color: var(--cor-texto-suave); }
      .chip button { border: none; background: none; cursor: pointer; color: var(--cor-texto-fraco); font-size: 1rem; line-height: 1; padding: 2px 6px; }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm); background: var(--cor-erro-suave); padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); margin-bottom: var(--esp-2); }
      #rodape { display: flex; align-items: center; gap: var(--esp-2); }
      #rodape .espaco { flex: 1; }
    `;
  }

  template() {
    const mostrarPara = !this.ehResposta;
    const sw = (c, cmd) => `<button class="sw" data-cmd="${cmd}" data-val="${c}" title="${c}" type="button" style="background:${c}"></button>`;
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
          ${mostrarPara ? `<div class="linha"><label>Para</label><email-campo-destinatarios id="paraCampo"></email-campo-destinatarios><div class="toggles"><button type="button" id="tgCc">Cc</button><button type="button" id="tgCco">Cco</button></div></div>` : ""}
          <div class="linha" id="lnCc" hidden><label>Cc</label><email-campo-destinatarios id="ccCampo"></email-campo-destinatarios><span></span></div>
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
          <div class="dd">
            <button class="tb ddbtn" data-dd="par" type="button" title="Estilo">Normal <span class="caret">▾</span></button>
            <div class="pop" data-pop="par" hidden>
              <button class="pop-item" data-cmd="formatBlock" data-val="P" type="button">Normal</button>
              <button class="pop-item h1" data-cmd="formatBlock" data-val="H1" type="button">Título 1</button>
              <button class="pop-item h2" data-cmd="formatBlock" data-val="H2" type="button">Título 2</button>
              <button class="pop-item h3" data-cmd="formatBlock" data-val="H3" type="button">Título 3</button>
            </div>
          </div>
          <span class="sep"></span>
          <div class="dd">
            <button class="tb ddbtn" data-dd="cor" type="button" title="Cor do texto"><span class="ab">A</span> <span class="caret">▾</span></button>
            <div class="pop" data-pop="cor" hidden><div class="paleta">${PALETA.map((c) => sw(c, "foreColor")).join("")}</div></div>
          </div>
          <div class="dd">
            <button class="tb ddbtn" data-dd="realce" type="button" title="Realce"><span class="ab hl">A</span> <span class="caret">▾</span></button>
            <div class="pop" data-pop="realce" hidden><div class="paleta">${PALETA.slice(8).map((c) => sw(c, "hiliteColor")).join("")}</div><button class="sem" data-cmd="hiliteColor" data-val="transparent" type="button">Sem realce</button></div>
          </div>
          <span class="sep"></span>
          <button class="tb" data-cmd="insertUnorderedList" title="Lista" type="button">•</button>
          <button class="tb" data-cmd="insertOrderedList" title="Lista numerada" type="button">1.</button>
          <span class="sep"></span>
          <button class="tb" data-cmd="justifyLeft" title="Alinhar à esquerda" type="button">${SVG_AL}</button>
          <button class="tb" data-cmd="justifyCenter" title="Centralizar" type="button">${SVG_AC}</button>
          <button class="tb" data-cmd="justifyRight" title="Alinhar à direita" type="button">${SVG_AR}</button>
          <span class="sep"></span>
          <button class="tb" data-cmd="createLink" title="Inserir link" type="button"><ui-icon name="link" size="15"></ui-icon></button>
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
    this._contatos = this._montarDestinatarios();
    this.$("ui-modal").addEventListener("fechar", () => this._fechar());
    this.$("#cancelar").addEventListener("click", () => this._fechar());
    this.$("#enviar").addEventListener("click", () => this.enviar());
    this.$("#enviar2").addEventListener("click", () => this.enviar());
    this.$("#rascunho").addEventListener("click", () => this.salvarRascunho(false));
    const desc = this.$("#descartar"); if (desc) desc.addEventListener("click", () => this._descartar());
    const tgCc = this.$("#tgCc"); if (tgCc) tgCc.addEventListener("click", () => this._toggle("#lnCc"));
    const tgCco = this.$("#tgCco"); if (tgCco) tgCco.addEventListener("click", () => this._toggle("#lnCco"));

    // Toolbar: mousedown+preventDefault preserva a seleção do editor (Shadow DOM).
    this.$("#toolbar").addEventListener("mousedown", (e) => {
      const dd = e.target.closest(".ddbtn");
      if (dd) { e.preventDefault(); this._togglePop(dd.dataset.dd); return; }
      const b = e.target.closest("[data-cmd]");
      if (!b) return;
      e.preventDefault();
      this.$("#corpo").focus();
      const cmd = b.dataset.cmd;
      this._fecharPops();
      if (cmd === "createLink") { const u = prompt("URL do link (com https://):"); if (u) document.execCommand("createLink", false, u); return; }
      if (cmd === "hiliteColor") {
        const v = b.dataset.val;
        if (!document.execCommand("hiliteColor", false, v)) document.execCommand("backColor", false, v);
        return;
      }
      document.execCommand(cmd, false, b.dataset.val || null);
    });
    // Fecha popovers ao clicar fora da toolbar.
    this.$("#corpo").addEventListener("mousedown", () => this._fecharPops());

    // Campos de destinatários (chips + autocomplete + banner picker).
    const pc = this.$("#paraCampo"); if (pc) { pc.contatos = this._contatos; if (this._para) pc.valor = this._para; }
    const ccc = this.$("#ccCampo"); if (ccc) { ccc.contatos = this._contatos; if (this._cc) ccc.valor = this._cc; }

    // Anexos: clique + arraste.
    this.$("#arquivo").addEventListener("change", (e) => this._addArquivos(e.target.files));
    const modal = this.$("ui-modal");
    modal.addEventListener("dragover", (e) => { e.preventDefault(); this.classList.add("arrastando"); });
    modal.addEventListener("dragleave", (e) => { if (e.target === modal) this.classList.remove("arrastando"); });
    modal.addEventListener("drop", (e) => { e.preventDefault(); this.classList.remove("arrastando"); this._addArquivos(e.dataTransfer.files); });

    this.$("#corpo").addEventListener("input", () => this._agendarSalvar());

    if (this._corpoHtml) this.$("#corpo").innerHTML = this._corpoHtml;
    if ((this._cc || "").trim()) this._toggle("#lnCc", true);
    if ((this._bcc || "").trim()) this._toggle("#lnCco", true);
    this._carregarRemetentes();
    this._pintarAnexos();
  }

  /* ---------------------------- Popovers ------------------------------ */
  _togglePop(nome) {
    const alvo = this.$(`.pop[data-pop="${nome}"]`);
    const abrir = alvo && alvo.hidden;
    this._fecharPops();
    if (alvo && abrir) alvo.hidden = false;
  }
  _fecharPops() { this.$$(".pop").forEach((p) => (p.hidden = true)); }

  /* -------------------------- Autocomplete ---------------------------- */
  /** Destinatários sugeridos: você + usuários (compartilhados) + contatos + empresas, com e-mail. */
  _montarDestinatarios() {
    const seen = new Set();
    const out = [];
    const add = (nome, email, tipo) => {
      email = String(email || "").trim();
      if (!email || seen.has(email.toLowerCase())) return;
      seen.add(email.toLowerCase());
      out.push({ nome: nome || email, email, tipo });
    };
    try {
      const u = dataStore.usuario && dataStore.usuario();
      if (u && u.email) add((u.nome || "Você") + " (você)", u.email, "você");
      (dataStore.usuarios ? dataStore.usuarios() : []).forEach((x) => x && add(x.nome, x.email, "usuário"));
      (dataStore.contatosAtivos ? dataStore.contatosAtivos() : []).forEach((x) => x && add(x.nome, x.email, "contato"));
      (dataStore.fornecedoresAtivos ? dataStore.fornecedoresAtivos() : []).forEach((x) => x && add(x.nome, x.email, "empresa"));
    } catch (e) { /* data-store indisponível */ }
    return out;
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
      reader.onload = () => { this._anexos.push({ nome: f.name, mimeType: f.type || "application/octet-stream", base64: String(reader.result || "").split(",")[1] || "", tamanho: f.size }); this._pintarAnexos(); };
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
    const val = (s) => { const el = this.$(s); return el ? el.value.trim().replace(/[,;\s]+$/, "") : ""; };
    return { from: val("#de"), para: this.$("#paraCampo") ? this.$("#paraCampo").emails : "", cc: this.$("#ccCampo") ? this.$("#ccCampo").emails : "", bcc: this.$("#bcc") ? val("#bcc") : "", assunto: this.$("#assunto") ? val("#assunto") : "", html: this.$("#corpo").innerHTML, anexos: this._anexos };
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
    this.$("#enviar").setAttribute("loading", ""); this.$("#enviar2").setAttribute("loading", "");
    try {
      if (this.ehEncaminhar) await api.call("email.caixa.encaminhar", { threadId: this._threadId, para: d.para, cc: d.cc, bcc: d.bcc, from: d.from, html: d.html });
      else if (this.ehResposta) await api.call("email.caixa.responder", { threadId: this._threadId, todos: this._modo === "responderTodos", html: d.html, cc: d.cc, bcc: d.bcc, from: d.from, anexos: d.anexos });
      else {
        await api.call("email.caixa.enviar", { para: d.para, cc: d.cc, bcc: d.bcc, from: d.from, assunto: d.assunto, html: d.html, anexos: d.anexos });
        if (this._draftId) { try { await api.call("email.caixa.excluirRascunho", { draftId: this._draftId }); } catch (e) {} }
      }
      toastSucesso("E-mail enviado.");
      this._enviado = true; this.emitir("enviado"); this.emitir("fechar");
    } catch (e) { this._erro(e.message || "Não foi possível enviar."); notificarErro(e); this.$("#enviar").removeAttribute("loading"); this.$("#enviar2").removeAttribute("loading"); }
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

  _agendarSalvar() { clearTimeout(this._salvarTimer); this._salvarTimer = setTimeout(() => this.salvarRascunho(true), 5000); }

  async _descartar() {
    if (!this._draftId) return this.emitir("fechar");
    try { await api.call("email.caixa.excluirRascunho", { draftId: this._draftId }); toastSucesso("Rascunho descartado."); emailCache.invalidar("rascunhos"); }
    catch (e) { notificarErro(e); }
    this._enviado = true; this.emitir("enviado"); this.emitir("fechar");
  }

  _fechar() {
    clearTimeout(this._salvarTimer);
    if (!this._enviado && this._temConteudo()) this.salvarRascunho(true);
    this.emitir("fechar");
  }

  _erro(msg) { const el = this.$("#erro"); el.textContent = msg; el.hidden = !msg; }
}

customElements.define("email-compositor", EmailCompositor);
