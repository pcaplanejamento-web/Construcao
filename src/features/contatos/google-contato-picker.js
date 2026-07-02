/**
 * <google-contato-picker> — Banner/modal para ESCOLHER um contato do Google
 * (People API) — usado em "Importar do Google" e "Vincular". Carrega a lista via
 * dataStore.listarContatosGoogle(q) com BUSCA no servidor (debounce). Clicar numa
 * linha escolhe (seleção única). Emite "escolher" ({ contato:{resourceName,nome,
 * email,telefone,grupos} }) e "fechar". Requer Google conectado (com permissão
 * de contatos) — mostra estado de erro amigável caso contrário.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/).filter(Boolean);
  return (((p[0] || "?")[0] || "?") + (p.length > 1 ? (p[p.length - 1][0] || "") : "")).toUpperCase();
}
function cor(s) { let h = 0; const t = String(s || ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return `hsl(${h}, 45%, 55%)`; }

class GoogleContatoPicker extends BaseElement {
  set titulo(v) { this._titulo = v || ""; }
  get titulo() { return this._titulo || "Escolher contato do Google"; }

  constructor() { super(); this._q = ""; this._itens = []; this._estado = "carregando"; }

  estilos() {
    return `
      .busca { width: 100%; height: 40px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-md); color: var(--cor-texto);
        background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 0 var(--esp-4); margin-bottom: var(--esp-3); }
      .lista { min-height: 200px; max-height: 52vh; overflow-y: auto; display: flex; flex-direction: column; }
      .row { display: flex; align-items: center; gap: var(--esp-3); padding: var(--esp-2) var(--esp-2); min-height: 52px; cursor: pointer;
        border: none; background: none; width: 100%; text-align: left; border-radius: var(--raio-sm); }
      .row:hover { background: var(--cor-superficie-2); }
      .av { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: var(--peso-semi); font-size: var(--fs-sm); flex: none; }
      .info { min-width: 0; flex: 1; display: flex; flex-direction: column; }
      .nome { font-size: var(--fs-md); color: var(--cor-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mail { font-size: var(--fs-sm); color: var(--cor-texto-fraco); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .vazio { color: var(--cor-texto-fraco); padding: var(--esp-5) var(--esp-4); text-align: center; }
      .vazio.erro { color: var(--cor-erro); display: flex; flex-direction: column; gap: var(--esp-3); }
      .vazio.erro .dica { color: var(--cor-texto-suave); font-size: var(--fs-sm); line-height: 1.5; }
      .vazio.erro .det { display: block; color: var(--cor-texto-fraco); font-size: var(--fs-xs); line-height: 1.5;
        background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-sm);
        padding: var(--esp-2) var(--esp-3); text-align: left; word-break: break-word; }
    `;
  }

  template() {
    return `
      <ui-modal open largo title="${esc(this.titulo)}">
        <input id="busca" class="busca" type="search" placeholder="Buscar por nome, e-mail ou telefone..." autocomplete="off">
        <div class="lista" id="lista"></div>
        <div slot="rodape">
          <ui-button id="fechar" variant="secundario">Cancelar</ui-button>
        </div>
      </ui-modal>`;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#busca").addEventListener("input", (e) => { this._q = e.target.value.trim(); this._buscarDebounced(); });
    this._carregar();
  }

  aoLimpar() { clearTimeout(this._t); }

  _buscarDebounced() { clearTimeout(this._t); this._t = setTimeout(() => this._carregar(), 300); }

  async _carregar() {
    this._estado = "carregando";
    this._pintar();
    const q = this._q;
    try {
      const itens = await dataStore.listarContatosGoogle(q);
      if (q !== this._q) return; // busca mais nova em andamento
      this._itens = itens;
      this._estado = "pronto";
    } catch (e) {
      this._estado = "erro";
      this._erroMsg = (e && e.message) || "";
    }
    this._pintar();
  }

  _pintar() {
    const box = this.$("#lista");
    if (!box) return;
    if (this._estado === "carregando") { box.innerHTML = `<ui-spinner centro text="Carregando contatos do Google..."></ui-spinner>`; return; }
    if (this._estado === "erro") {
      const detalhe = this._erroMsg ? `<span class="det">${esc(this._erroMsg)}</span>` : "";
      box.innerHTML = `<div class="vazio erro">
        <p>Não foi possível carregar os contatos do Google.</p>
        <p class="dica">Confira, no seu <strong>Perfil</strong>: (1) a <strong>People API</strong> ativa no Google Cloud e (2) a conta <strong>reconectada</strong> (permissão de contatos).</p>
        ${detalhe}
      </div>`;
      return;
    }
    const cs = this._itens || [];
    if (!cs.length) { box.innerHTML = `<p class="vazio">Nenhum contato encontrado.</p>`; return; }
    box.innerHTML = cs.map((c, i) => `<button class="row" type="button" data-i="${i}">
        <span class="av" style="background:${cor(c.nome || c.email)}">${esc(iniciais(c.nome || c.email))}</span>
        <span class="info"><span class="nome">${esc(c.nome || "(sem nome)")}</span><span class="mail">${esc(c.email || c.telefone || "")}</span></span>
      </button>`).join("");
    box.querySelectorAll(".row").forEach((el) => el.addEventListener("click", () => this._escolher(cs[Number(el.dataset.i)])));
  }

  _escolher(c) {
    if (!c) return;
    this.emitir("escolher", { contato: c });
    this.emitir("fechar");
  }
}

customElements.define("google-contato-picker", GoogleContatoPicker);
