/**
 * <repasse-form> — Modal para registrar um REPASSE de um pagamento: o recebedor
 * repassa parte do valor a outros contatos. Auto-contido (chama o data-store).
 *
 * Propriedades: .pagamento (objeto), .obra (opcional). Eventos: "salvo", "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-select.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class RepasseForm extends BaseElement {
  set pagamento(v) {
    this._pagamento = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get pagamento() {
    return this._pagamento || null;
  }
  set obra(v) {
    this._obra = v || null;
  }
  get obra() {
    return this._obra || null;
  }

  _contatoNome(id) {
    return (dataStore.contatos().find((c) => String(c.id) === String(id)) || {}).nome || "—";
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
      .tx { font-size: var(--fs-sm); color: var(--cor-texto-suave); display:block; margin-bottom: var(--esp-1); }
      .lista { display:flex; flex-direction:column; gap: var(--esp-1); max-height: 200px; overflow:auto;
        border: 1px solid var(--cor-divisor); border-radius: var(--raio-sm); padding: var(--esp-2); }
      .c { display:flex; align-items:center; gap: var(--esp-2); font-size: var(--fs-sm); }
      input[type="checkbox"] { width:16px; height:16px; accent-color: var(--cor-primaria); }
      .info { font-size: var(--fs-sm); color: var(--cor-texto-suave); }
    `;
  }

  template() {
    const p = this.pagamento || {};
    const receb = this._contatoNome(p.recebedor_contato_id);
    const outros = dataStore
      .contatosAtivos()
      .filter((c) => String(c.id) !== String(p.recebedor_contato_id));
    const linhas = outros.length
      ? outros.map((c) => `<label class="c"><input type="checkbox" class="chk" data-id="${c.id}"/> ${c.nome}</label>`).join("")
      : `<div class="info">Nenhum outro contato disponível.</div>`;
    return `
      <ui-modal open title="Repassar pagamento">
        <div class="campos">
          <div class="info">Pagamento de <strong>${moeda(Number(p.valor) || 0)}</strong> recebido por <strong>${receb}</strong>.</div>
          <div>
            <label class="tx">Repassar para</label>
            <div class="lista" id="lista">${linhas}</div>
          </div>
          <div class="linha">
            <ui-input id="valor" label="Valor repassado (R$)" type="number" step="0.01" min="0" placeholder="0,00"></ui-input>
            <ui-input id="data" label="Data" type="date"></ui-input>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">Registrar repasse</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.$("#data").value = new Date().toISOString().substring(0, 10);
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const p = this.pagamento || {};
    const repassados = this.$$(".chk").filter((c) => c.checked).map((c) => c.dataset.id);
    if (!repassados.length) {
      notificarErro(new Error("Selecione ao menos um contato para repassar."));
      return;
    }
    const valor = Number(this.$("#valor").value) || 0;
    if (!(valor > 0)) {
      this.$("#valor").setAttribute("error", "Informe um valor maior que zero.");
      return;
    }
    this.$("#valor").removeAttribute("error");
    const dados = {
      pagamento_id: p.id,
      recebedor_contato_id: p.recebedor_contato_id || "",
      obra_id: p.obra_id || (this.obra || {}).id || "",
      contatos_repassados: repassados,
      valor,
      data: this.$("#data").value || new Date().toISOString().substring(0, 10),
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      await dataStore.lancarRepasse(dados);
      toastSucesso("Repasse registrado.");
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("repasse-form", RepasseForm);
