/**
 * <tipo-transf-form> — Modal para criar/editar um TIPO de transferência (extra).
 * Os tipos base (dinheiro/crédito/débito/boleto) são fixos e não passam por aqui.
 * Auto-contido: chama o data-store e emite "salvo"/"fechar". Espelha cargo-form.
 *
 * Propriedade: .tipo (objeto p/ edição; ausente = novo)
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class TipoTransfForm extends BaseElement {
  set tipo(v) {
    this._tipo = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get tipo() {
    return this._tipo || null;
  }
  get ehEdicao() {
    return !!(this.tipo && this.tipo.id);
  }

  estilos() {
    return `.campos { display: flex; flex-direction: column; gap: var(--esp-4); }`;
  }

  template() {
    const t = this.tipo || {};
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar tipo" : "Novo tipo de transferência"}">
        <div class="campos">
          <ui-input id="nome" label="Nome do tipo"
            value="${(t.nome || "").replace(/"/g, "&quot;")}"
            placeholder="Ex.: Pix"></ui-input>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const nome = this.$("#nome").value.trim();
    const erro = obrigatorio(nome, "O nome");
    if (erro) {
      this.$("#nome").setAttribute("error", erro);
      return;
    }
    this.$("#nome").removeAttribute("error");
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarTipoTransferencia(this.tipo.id, { nome });
        toastSucesso("Tipo atualizado.");
      } else {
        await dataStore.criarTipoTransferencia({ nome });
        toastSucesso("Tipo criado.");
      }
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("tipo-transf-form", TipoTransfForm);
