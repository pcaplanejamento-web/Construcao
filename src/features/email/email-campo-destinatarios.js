/**
 * <email-campo-destinatarios> — Campo de destinatários com CHIPS (avatar + nome +
 * ×, estilo do chip de usuário do header), **autocomplete** ao digitar e um
 * **botão que abre o banner** (email-picker-contatos) para escolher VÁRIOS.
 *
 * Propriedades: `.contatos` ([{nome,email,tipo}] p/ sugestões/picker), `.valor`
 * (string inicial "a@x, b@y"). Leia os e-mails via o getter `.emails`.
 */
import { BaseElement } from "../../components/base-element.js";
import "../../components/ui-icon.js";
import "./email-picker-contatos.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/).filter(Boolean);
  return (((p[0] || "?")[0] || "?") + (p.length > 1 ? (p[p.length - 1][0] || "") : "")).toUpperCase();
}
function cor(s) { let h = 0; const t = String(s || ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return `hsl(${h}, 45%, 55%)`; }

class EmailCampoDestinatarios extends BaseElement {
  constructor() { super(); this._itens = []; this._contatos = []; }
  set contatos(v) { this._contatos = Array.isArray(v) ? v : []; }
  set valor(v) {
    this._itens = String(v || "").split(/[,;]+/).map((s) => s.trim()).filter(Boolean).map((email) => this._nomear(email));
    if (this.shadowRoot && this.shadowRoot.childElementCount) this._pintarChips();
  }

  /** E-mails atuais (chips + o que estiver digitado). */
  get emails() {
    const extra = ((this.$("#entrada") || {}).value || "").trim().replace(/[,;\s]+$/, "");
    const all = this._itens.map((i) => i.email);
    if (extra) all.push(extra);
    return all.join(", ");
  }

  _nomear(email) {
    const c = this._contatos.find((x) => String(x.email).toLowerCase() === String(email).toLowerCase());
    return { email, nome: c ? c.nome : email, tipo: c ? c.tipo : "" };
  }

  estilos() {
    return `
      :host { display: block; min-width: 0; }
      .campo { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-height: 40px; padding: 4px 0; min-width: 0; }
      .chip { display: inline-flex; align-items: center; gap: 6px; background: var(--cor-superficie-2); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-completo); padding: 2px 4px 2px 2px; max-width: 100%; }
      .chip .av { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: var(--peso-semi); font-size: 10px; flex: none; }
      .chip .nome { font-size: var(--fs-sm); color: var(--cor-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
      .chip .x { border: none; background: none; cursor: pointer; color: var(--cor-texto-fraco); font-size: 1rem; line-height: 1; padding: 0 4px; flex: none; }
      .chip .x:hover { color: var(--cor-erro); }
      #entrada { flex: 1; min-width: 80px; height: 32px; border: none; background: transparent; font-family: inherit; font-size: var(--fs-md); color: var(--cor-texto); }
      #entrada:focus { outline: none; }
      .picker { border: none; background: none; cursor: pointer; color: var(--cor-texto-suave); width: 32px; height: 32px; border-radius: 50%; flex: none; display: inline-flex; align-items: center; justify-content: center; }
      .picker:hover { background: var(--cor-superficie-2); color: var(--cor-primaria); }
      .ac { position: relative; }
      .sug { position: absolute; top: 100%; left: 0; right: 0; z-index: 9; background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-md); box-shadow: var(--sombra-lg); overflow: hidden; margin-top: 2px; }
      .sug button { display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left; border: none; background: none; cursor: pointer; padding: 8px var(--esp-3); min-height: 40px; }
      .sug button:hover, .sug button.hi { background: var(--cor-superficie-2); }
      .sug b { font-size: var(--fs-md); color: var(--cor-texto); } .sug small { color: var(--cor-texto-fraco); }
    `;
  }

  template() {
    return `
      <div class="ac">
        <div class="campo" id="campo">
          <input id="entrada" type="text" placeholder="Nome ou e-mail…" autocomplete="off">
          <button class="picker" id="picker" title="Escolher contatos" type="button"><ui-icon name="usuarios" size="18"></ui-icon></button>
        </div>
        <div class="sug" id="sug" hidden></div>
      </div>`;
  }

  aoConectar() {
    const inp = this.$("#entrada");
    inp.addEventListener("input", () => this._sugerir());
    inp.addEventListener("blur", () => setTimeout(() => { this.$("#sug").hidden = true; this._flush(); }, 160));
    inp.addEventListener("keydown", (e) => this._teclado(e));
    this.$("#picker").addEventListener("click", () => this._abrirPicker());
    this._pintarChips();
  }

  _pintarChips() {
    const campo = this.$("#campo");
    if (!campo) return;
    campo.querySelectorAll(".chip").forEach((c) => c.remove());
    const inp = this.$("#entrada");
    this._itens.forEach((it) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<span class="av" style="background:${cor(it.nome || it.email)}">${esc(iniciais(it.nome || it.email))}</span><span class="nome" title="${esc(it.email)}">${esc(it.nome || it.email)}</span><button class="x" type="button" title="Remover">&times;</button>`;
      chip.querySelector(".x").addEventListener("click", () => this._remover(it.email));
      campo.insertBefore(chip, inp);
    });
  }

  _add(email, nome, tipo) {
    email = String(email || "").trim().replace(/[,;\s]+$/, "");
    if (!email) return;
    if (this._itens.some((i) => i.email.toLowerCase() === email.toLowerCase())) return;
    this._itens.push({ email, nome: nome || email, tipo: tipo || "" });
    this._pintarChips();
  }
  _remover(email) { this._itens = this._itens.filter((i) => i.email.toLowerCase() !== String(email).toLowerCase()); this._pintarChips(); }

  /** Converte o texto digitado em chip (ao sair/Enter/vírgula). */
  _flush() {
    const inp = this.$("#entrada");
    const v = (inp.value || "").trim().replace(/[,;]+$/, "");
    if (v) { const c = this._nomear(v); this._add(c.email, c.nome, c.tipo); }
    inp.value = "";
  }

  _teclado(e) {
    const sug = this.$("#sug");
    if (e.key === "Enter" || e.key === ",") {
      const hi = sug && !sug.hidden ? sug.querySelector("button.hi") : null;
      e.preventDefault();
      if (hi) hi.dispatchEvent(new MouseEvent("mousedown"));
      else this._flush();
      sug.hidden = true;
      return;
    }
    if (e.key === "Backspace" && !this.$("#entrada").value && this._itens.length) { this._remover(this._itens[this._itens.length - 1].email); return; }
    if (sug.hidden) return;
    const items = [...sug.querySelectorAll("button")];
    let idx = items.findIndex((b) => b.classList.contains("hi"));
    if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(0, idx - 1); }
    else return;
    items.forEach((b, i) => b.classList.toggle("hi", i === idx));
  }

  _sugerir() {
    const inp = this.$("#entrada"), sug = this.$("#sug");
    const token = (inp.value || "").trim().toLowerCase();
    const usados = new Set(this._itens.map((i) => i.email.toLowerCase()));
    if (token.length < 1) { sug.hidden = true; return; }
    const cs = this._contatos.filter((c) => c.email && !usados.has(c.email.toLowerCase()) && ((c.nome || "").toLowerCase().includes(token) || c.email.toLowerCase().includes(token))).slice(0, 6);
    if (!cs.length) { sug.hidden = true; return; }
    sug.innerHTML = cs.map((c) => `<button type="button" data-email="${esc(c.email)}"><b>${esc(c.nome || c.email)}</b><small>${esc(c.email)}${c.tipo ? " · " + esc(c.tipo) : ""}</small></button>`).join("");
    sug.hidden = false;
    sug.querySelectorAll("button").forEach((b) =>
      b.addEventListener("mousedown", (e) => { e.preventDefault(); const c = this._nomear(b.dataset.email); this._add(c.email, c.nome, c.tipo); inp.value = ""; sug.hidden = true; inp.focus(); })
    );
  }

  _abrirPicker() {
    const p = document.createElement("email-picker-contatos");
    p.contatos = this._contatos;
    p.jaEscolhidos = this._itens.map((i) => i.email);
    p.addEventListener("fechar", () => p.remove());
    p.addEventListener("escolher", (e) => { (e.detail.itens || []).forEach((c) => this._add(c.email, c.nome, c.tipo)); });
    document.body.appendChild(p);
  }
}

customElements.define("email-campo-destinatarios", EmailCampoDestinatarios);
