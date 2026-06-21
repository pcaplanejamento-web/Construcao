/**
 * <cargo-form> — Modal para criar/editar um CARGO extra de contato.
 * Os cargos obrigatórios são fixos (não passam por aqui). Auto-contido: chama o
 * data-store e emite "salvo"/"fechar". Espelha categoria-form.
 *
 * Propriedade: .cargo (objeto p/ edição; ausente = novo)
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class CargoForm extends BaseElement {
  set cargo(v) {
    this._cargo = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get cargo() {
    return this._cargo || null;
  }
  get ehEdicao() {
    return !!(this.cargo && this.cargo.id);
  }

  estilos() {
    return `.campos { display: flex; flex-direction: column; gap: var(--esp-4); }`;
  }

  template() {
    const c = this.cargo || {};
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar cargo" : "Novo cargo"}">
        <div class="campos">
          <ui-input id="nome" label="Nome do cargo"
            value="${(c.nome || "").replace(/"/g, "&quot;")}"
            placeholder="Ex.: Eletricista"></ui-input>
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
        await dataStore.atualizarCargo(this.cargo.id, { nome });
        toastSucesso("Cargo atualizado.");
      } else {
        await dataStore.criarCargo({ nome });
        toastSucesso("Cargo criado.");
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

customElements.define("cargo-form", CargoForm);
