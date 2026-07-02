/**
 * <email-picker-contatos> — Banner flutuante (modal) para escolher VÁRIOS
 * destinatários de uma vez. Recebe a lista completa em `.contatos`
 * ([{nome,email,tipo}]) e os já escolhidos em `.jaEscolhidos` (emails).
 * Busca + checkboxes; emite "escolher" ({ itens:[{nome,email,tipo}] }) e "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/).filter(Boolean);
  return (((p[0] || "?")[0] || "?") + (p.length > 1 ? (p[p.length - 1][0] || "") : "")).toUpperCase();
}
function cor(s) { let h = 0; const t = String(s || ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return `hsl(${h}, 45%, 55%)`; }

class EmailPickerContatos extends BaseElement {
  set contatos(v) { this._contatos = Array.isArray(v) ? v : []; }
  set jaEscolhidos(v) { this._ja = new Set((v || []).map((e) => String(e).toLowerCase())); }

  constructor() { super(); this._contatos = []; this._ja = new Set(); this._sel = new Set(); this._q = ""; }

  estilos() {
    return `
      .busca { width: 100%; height: 40px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-md); color: var(--cor-texto);
        background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 0 var(--esp-4); margin-bottom: var(--esp-3); }
      .lista { max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; }
      .row { display: flex; align-items: center; gap: var(--esp-3); padding: var(--esp-2) var(--esp-1); min-height: 48px; cursor: pointer; border-radius: var(--raio-sm); }
      .row:hover { background: var(--cor-superficie-2); }
      .row input { width: 18px; height: 18px; flex: none; }
      .av { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: var(--peso-semi); font-size: var(--fs-sm); flex: none; }
      .info { min-width: 0; flex: 1; }
      .nome { font-size: var(--fs-md); color: var(--cor-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mail { font-size: var(--fs-sm); color: var(--cor-texto-fraco); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tag { font-size: var(--fs-xs); color: var(--cor-texto-fraco); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 1px 8px; flex: none; }
      .vazio { color: var(--cor-texto-fraco); padding: var(--esp-4); text-align: center; }
    `;
  }

  template() {
    return `
      <ui-modal open largo title="Escolher destinatários">
        <input id="busca" class="busca" type="search" placeholder="Buscar por nome ou e-mail..." autocomplete="off">
        <div class="lista" id="lista"></div>
        <div slot="rodape">
          <ui-button id="add">Adicionar</ui-button>
          <ui-button id="fechar" variant="secundario">Cancelar</ui-button>
        </div>
      </ui-modal>`;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#add").addEventListener("click", () => this._adicionar());
    this.$("#busca").addEventListener("input", (e) => { this._q = e.target.value.trim().toLowerCase(); this._pintar(); });
    this._pintar();
  }

  get _disponiveis() {
    return this._contatos.filter((c) => c && c.email && !this._ja.has(String(c.email).toLowerCase()));
  }

  _pintar() {
    const box = this.$("#lista");
    if (!box) return;
    const q = this._q;
    const cs = this._disponiveis.filter((c) => !q || (c.nome || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
    if (!cs.length) { box.innerHTML = `<p class="vazio">${this._disponiveis.length ? "Nada encontrado." : "Nenhum contato com e-mail cadastrado."}</p>`; this._sincronizarBotao(); return; }
    box.innerHTML = cs.map((c) => `<label class="row">
        <input type="checkbox" data-email="${esc(c.email)}" ${this._sel.has(c.email) ? "checked" : ""}>
        <span class="av" style="background:${cor(c.nome || c.email)}">${esc(iniciais(c.nome || c.email))}</span>
        <span class="info"><span class="nome">${esc(c.nome || c.email)}</span><span class="mail">${esc(c.email)}</span></span>
        ${c.tipo ? `<span class="tag">${esc(c.tipo)}</span>` : ""}
      </label>`).join("");
    box.querySelectorAll("input[type=checkbox]").forEach((ch) =>
      ch.addEventListener("change", () => { if (ch.checked) this._sel.add(ch.dataset.email); else this._sel.delete(ch.dataset.email); this._sincronizarBotao(); })
    );
    this._sincronizarBotao();
  }

  _sincronizarBotao() {
    const b = this.$("#add");
    if (b) b.textContent = this._sel.size ? `Adicionar (${this._sel.size})` : "Adicionar";
  }

  _adicionar() {
    const itens = this._contatos.filter((c) => this._sel.has(c.email));
    this.emitir("escolher", { itens });
    this.emitir("fechar");
  }
}

customElements.define("email-picker-contatos", EmailPickerContatos);
