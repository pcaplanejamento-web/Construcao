/**
 * <email-enderecos> — Modal (admin): criar/remover endereços @dattaobra.com.br
 * (com **nome de exibição**), ver os endereços da conta e editar a **assinatura
 * padrão** (editor rico). Emite "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { emailCache } from "./email-cache.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";
import "../../components/ui-icon.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

class EmailEnderecos extends BaseElement {
  estilos() {
    return `
      #corpo { display: flex; flex-direction: column; gap: var(--esp-4); }
      h4 { font-size: var(--fs-md); font-weight: var(--peso-semi); margin-bottom: var(--esp-2); }
      .lista { display: flex; flex-direction: column; gap: 4px; }
      .end { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-md); }
      .end .tag { font-size: var(--fs-xs); color: var(--cor-texto-fraco); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 1px 8px; }
      .end .rem { margin-left: auto; border: none; background: none; cursor: pointer; color: var(--cor-texto-fraco); font-size: 1.1rem; line-height: 1; padding: 0 6px; }
      .end .rem:hover { color: var(--cor-erro); }
      .criar { display: flex; align-items: center; gap: var(--esp-2); flex-wrap: wrap; margin-bottom: var(--esp-2); }
      .criar input { height: 38px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-md); color: var(--cor-texto);
        background: var(--cor-superficie); border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm); padding: 0 var(--esp-3); }
      .criar .local { flex: 1; min-width: 110px; } .criar .nome { flex: 1; min-width: 110px; }
      .criar .dominio { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .sig-barra { display: flex; gap: 2px; border: 1px solid var(--cor-borda); border-bottom: none; border-radius: var(--raio-sm) var(--raio-sm) 0 0; padding: 4px; background: var(--cor-superficie-2); }
      .sig-barra button { width: 30px; height: 30px; border: none; background: none; cursor: pointer; border-radius: var(--raio-sm); color: var(--cor-texto); }
      .sig-barra button:hover { background: var(--cor-divisor); }
      .sig { min-height: 90px; border: 1px solid var(--cor-borda-forte); border-radius: 0 0 var(--raio-sm) var(--raio-sm); padding: var(--esp-3); font-size: var(--fs-md); color: var(--cor-texto); background: var(--cor-superficie); line-height: 1.5; }
      .sig:focus { outline: none; }
      .guia { font-size: var(--fs-sm); color: var(--cor-texto-suave); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-md); padding: var(--esp-3); line-height: 1.6; }
      .guia ol { margin: var(--esp-2) 0 0 var(--esp-4); display: flex; flex-direction: column; gap: 4px; }
    `;
  }

  template() {
    return `
      <ui-modal open largo title="Endereços e assinatura">
        <div id="corpo"><ui-spinner centro text="Carregando..."></ui-spinner></div>
        <div slot="rodape">
          <ui-button id="salvar">Salvar assinatura</ui-button>
          <ui-button id="fechar" variant="secundario">Fechar</ui-button>
        </div>
      </ui-modal>`;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
    this.carregar();
  }

  async carregar() {
    let r;
    try { r = await api.call("email.caixa.remetentes"); emailCache.setRemetentes(r); }
    catch (e) { notificarErro(e); this.$("#corpo").innerHTML = `<p style="color:var(--cor-erro)">Não foi possível carregar.</p>`; return; }
    const fixos = [];
    if (r.principal) fixos.push({ e: r.principal, tag: "principal" });
    (r.aliases || []).forEach((a) => fixos.push({ e: a, tag: "alias" }));
    const criados = r.enderecos || [];
    this.$("#corpo").innerHTML = `
      <div>
        <h4>Criar endereço @dattaobra.com.br</h4>
        <div class="criar">
          <input id="local" class="local" type="text" placeholder="ex.: contato" autocomplete="off">
          <span class="dominio">@dattaobra.com.br</span>
          <input id="nome" class="nome" type="text" placeholder="Nome de exibição (opcional)" autocomplete="off">
          <ui-button id="btnCriar" tamanho="sm">Criar</ui-button>
        </div>
        <div class="lista" id="criados">
          ${criados.length
            ? criados.map((x) => `<div class="end">${x.nome ? esc(x.nome) + " · " : ""}${esc(x.endereco)} <span class="tag">criado</span><button class="rem" data-e="${esc(x.endereco)}" title="Remover" type="button">&times;</button></div>`).join("")
            : `<div class="end" style="color:var(--cor-texto-fraco)">(nenhum endereço criado ainda)</div>`}
        </div>
      </div>
      <div>
        <h4>Endereços da conta</h4>
        <div class="lista">${fixos.map((x) => `<div class="end">${esc(x.e)} <span class="tag">${x.tag}</span></div>`).join("")}</div>
      </div>
      <div>
        <h4>Assinatura padrão</h4>
        <div class="sig-barra" id="sigBarra">
          <button data-cmd="bold" title="Negrito" type="button" style="font-weight:800">B</button>
          <button data-cmd="italic" title="Itálico" type="button" style="font-style:italic">I</button>
          <button data-cmd="underline" title="Sublinhado" type="button" style="text-decoration:underline">U</button>
          <button data-cmd="createLink" title="Link" type="button"><ui-icon name="link" size="15"></ui-icon></button>
        </div>
        <div class="sig" id="sig" contenteditable="true"></div>
      </div>
      <div class="guia">
        Para o endereço <b>enviar e receber</b> de fato, a infra do domínio precisa estar ativa (uma vez):
        <ol>
          <li><b>Receber:</b> Cloudflare → <i>Email Routing</i> com <b>catch-all</b> → encaminha p/ <b>dattaobra@gmail.com</b>.</li>
          <li><b>Enviar:</b> domínio verificado no <b>Resend</b> (SPF/DKIM) + <code>RESEND_API_KEY</code> nas Script Properties.</li>
        </ol>
      </div>`;
    this.$("#sig").innerHTML = r.assinatura || "";
    this.$("#btnCriar").addEventListener("click", () => this._criar());
    this.$("#local").addEventListener("keydown", (e) => { if (e.key === "Enter") this._criar(); });
    this.$$(".rem").forEach((b) => b.addEventListener("click", () => this._remover(b.dataset.e)));
    this.$("#sigBarra").addEventListener("mousedown", (e) => {
      const b = e.target.closest("[data-cmd]");
      if (!b) return;
      e.preventDefault(); this.$("#sig").focus();
      if (b.dataset.cmd === "createLink") { const u = prompt("URL do link (com https://):"); if (u) document.execCommand("createLink", false, u); return; }
      document.execCommand(b.dataset.cmd, false, null);
    });
  }

  async _criar() {
    const local = (this.$("#local").value || "").trim().toLowerCase();
    const nome = (this.$("#nome").value || "").trim();
    if (!local) return;
    const btn = this.$("#btnCriar"); btn.setAttribute("loading", "");
    try { await api.call("email.caixa.criarEndereco", { local, nome }); emailCache.setRemetentes(null); toastSucesso("Endereço criado."); this.carregar(); }
    catch (e) { notificarErro(e); btn.removeAttribute("loading"); }
  }

  async _remover(endereco) {
    try { await api.call("email.caixa.removerEndereco", { endereco }); emailCache.setRemetentes(null); toastSucesso("Endereço removido."); this.carregar(); }
    catch (e) { notificarErro(e); }
  }

  async salvar() {
    const html = this.$("#sig").innerHTML.trim();
    const btn = this.$("#salvar"); btn.setAttribute("loading", "");
    try { await api.call("email.caixa.assinatura", { html }); emailCache.setRemetentes(null); toastSucesso("Assinatura salva."); this.emitir("fechar"); }
    catch (e) { notificarErro(e); btn.removeAttribute("loading"); }
  }
}

customElements.define("email-enderecos", EmailEnderecos);
