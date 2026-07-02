/**
 * <email-enderecos> — Modal (admin): endereços/aliases disponíveis para enviar,
 * editor de ASSINATURA padrão e o guia para CRIAR um endereço @dattaobra.com.br
 * (não é 1-clique em conta Gmail comum). Emite "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

class EmailEnderecos extends BaseElement {
  estilos() {
    return `
      #corpo { display: flex; flex-direction: column; gap: var(--esp-4); }
      h4 { font-size: var(--fs-md); font-weight: var(--peso-semi); margin-bottom: var(--esp-2); }
      .lista { display: flex; flex-direction: column; gap: 4px; }
      .end { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-md); }
      .end .tag { font-size: var(--fs-xs); color: var(--cor-texto-fraco); background: var(--cor-superficie-2);
        border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 1px 8px; }
      .end .rem { margin-left: auto; border: none; background: none; cursor: pointer; color: var(--cor-texto-fraco); font-size: 1.1rem; line-height: 1; padding: 0 6px; }
      .end .rem:hover { color: var(--cor-erro); }
      .criar { display: flex; align-items: center; gap: var(--esp-2); flex-wrap: wrap; margin-bottom: var(--esp-3); }
      .criar .local { height: 38px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-md);
        color: var(--cor-texto); background: var(--cor-superficie); border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-sm); padding: 0 var(--esp-3); flex: 1; min-width: 120px; }
      .criar .dominio { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      textarea { width: 100%; min-height: 100px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-md);
        color: var(--cor-texto); background: var(--cor-superficie); border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-md); padding: var(--esp-3); resize: vertical; line-height: 1.5; }
      .guia { font-size: var(--fs-sm); color: var(--cor-texto-suave); background: var(--cor-superficie-2);
        border: 1px solid var(--cor-borda); border-radius: var(--raio-md); padding: var(--esp-3); line-height: 1.6; }
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
    try { r = await api.call("email.caixa.remetentes"); }
    catch (e) { notificarErro(e); this.$("#corpo").innerHTML = `<p style="color:var(--cor-erro)">Não foi possível carregar.</p>`; return; }
    const fixos = [];
    if (r.principal) fixos.push({ e: r.principal, tag: "principal" });
    (r.aliases || []).forEach((a) => fixos.push({ e: a, tag: "alias" }));
    const criados = r.enderecos || [];
    const assinaturaTexto = String(r.assinatura || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    this.$("#corpo").innerHTML = `
      <div>
        <h4>Criar endereço @dattaobra.com.br</h4>
        <div class="criar">
          <input id="local" class="local" type="text" placeholder="ex.: contato" autocomplete="off">
          <span class="dominio">@dattaobra.com.br</span>
          <ui-button id="btnCriar" tamanho="sm">Criar</ui-button>
        </div>
        <div class="lista" id="criados">
          ${criados.length
            ? criados.map((e) => `<div class="end">${esc(e)} <span class="tag">criado</span><button class="rem" data-e="${esc(e)}" title="Remover" type="button">&times;</button></div>`).join("")
            : `<div class="end" style="color:var(--cor-texto-fraco)">(nenhum endereço criado ainda)</div>`}
        </div>
      </div>
      <div>
        <h4>Endereços da conta</h4>
        <div class="lista">
          ${fixos.map((x) => `<div class="end">${esc(x.e)} <span class="tag">${x.tag}</span></div>`).join("")}
        </div>
      </div>
      <div>
        <h4>Assinatura padrão</h4>
        <textarea id="assinatura" placeholder="Ex.: Equipe Dattaobra — (00) 0000-0000">${esc(assinaturaTexto)}</textarea>
      </div>
      <div class="guia">
        Para o endereço <b>enviar e receber</b> de fato, a infra do domínio precisa estar ativa (uma vez):
        <ol>
          <li><b>Receber:</b> Cloudflare → <i>Email Routing</i> com <b>catch-all</b> → encaminha tudo p/ <b>dattaobra@gmail.com</b>.</li>
          <li><b>Enviar:</b> domínio verificado no <b>Resend</b> (SPF/DKIM) + <code>RESEND_API_KEY</code> nas Script Properties.</li>
        </ol>
      </div>`;
    const btn = this.$("#btnCriar");
    if (btn) btn.addEventListener("click", () => this._criar());
    const inp = this.$("#local");
    if (inp) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") this._criar(); });
    this.$$(".rem").forEach((b) => b.addEventListener("click", () => this._remover(b.dataset.e)));
  }

  async _criar() {
    const inp = this.$("#local");
    const local = (inp.value || "").trim().toLowerCase();
    if (!local) return;
    const btn = this.$("#btnCriar"); btn.setAttribute("loading", "");
    try {
      await api.call("email.caixa.criarEndereco", { local });
      toastSucesso("Endereço criado.");
      this.carregar();
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }

  async _remover(endereco) {
    try {
      await api.call("email.caixa.removerEndereco", { endereco });
      toastSucesso("Endereço removido.");
      this.carregar();
    } catch (e) { notificarErro(e); }
  }

  async salvar() {
    const ta = this.$("#assinatura");
    if (!ta) return;
    const html = esc(ta.value.trim()).replace(/\n/g, "<br>");
    const btn = this.$("#salvar"); btn.setAttribute("loading", "");
    try {
      await api.call("email.caixa.assinatura", { html });
      toastSucesso("Assinatura salva.");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("email-enderecos", EmailEnderecos);
