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
    const enderecos = [];
    if (r.principal) enderecos.push({ e: r.principal, tag: "principal" });
    (r.aliases || []).forEach((a) => enderecos.push({ e: a, tag: "alias" }));
    const assinaturaTexto = String(r.assinatura || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    this.$("#corpo").innerHTML = `
      <div>
        <h4>Endereços disponíveis para envio</h4>
        <div class="lista">
          ${enderecos.length
            ? enderecos.map((x) => `<div class="end">${esc(x.e)} <span class="tag">${x.tag}</span></div>`).join("")
            : `<div class="end">(nenhum alias — só a conta principal)</div>`}
        </div>
      </div>
      <div>
        <h4>Assinatura padrão</h4>
        <textarea id="assinatura" placeholder="Ex.: Equipe Dattaobra — (00) 0000-0000">${esc(assinaturaTexto)}</textarea>
      </div>
      <div class="guia">
        <b>Criar um endereço @dattaobra.com.br</b> (ex.: contato@) — em conta Gmail comum são 2 passos, feitos uma vez:
        <ol>
          <li><b>Receber:</b> Cloudflare → e-mail do domínio → <i>Email Routing</i> → criar <code>contato@dattaobra.com.br</code> encaminhando para <b>dattaobra@gmail.com</b>.</li>
          <li><b>Enviar como:</b> Gmail → Ver todas as configurações → <i>Contas e importação</i> → "Enviar e-mail como" → Adicionar <code>contato@dattaobra.com.br</code> (o código de verificação chega aqui na caixa).</li>
        </ol>
        Depois o endereço aparece automaticamente na lista acima e no seletor "De" ao escrever.
      </div>`;
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
