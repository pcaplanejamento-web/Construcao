/**
 * <categoria-form> — Modal para criar/editar a classificação do usuário.
 *
 * Propriedade: .categoria (objeto p/ edição; ausente = nova)
 * Eventos: "salvo", "fechar". Auto-contido: chama categorias.criar/atualizar e
 * emite EVENTOS.CATEGORIAS para os demais componentes reagirem.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { bus, EVENTOS, toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class CategoriaForm extends BaseElement {
  set categoria(v) {
    this._categoria = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get categoria() {
    return this._categoria || null;
  }
  get ehEdicao() {
    return !!(this.categoria && this.categoria.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); align-items: end; }
      .linha ui-input[type] { flex: 1; }
      .cor { width: 90px; }
    `;
  }

  template() {
    const c = this.categoria || {};
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar classificação" : "Nova classificação"}">
        <div class="campos">
          <div class="linha">
            <ui-input id="nome" label="Nome da classificação"
              value="${(c.nome || "").replace(/"/g, "&quot;")}"
              placeholder="Ex.: Acabamento"></ui-input>
            <ui-input id="cor" class="cor" label="Cor" type="color"
              value="${c.cor || "#2563eb"}"></ui-input>
          </div>
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
    const cor = this.$("#cor").value || "#2563eb";

    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await api.call("categorias.atualizar", { id: this.categoria.id, nome, cor });
        toastSucesso("Classificação atualizada.");
      } else {
        await api.call("categorias.criar", { nome, cor });
        toastSucesso("Classificação criada.");
      }
      bus.emit(EVENTOS.CATEGORIAS, { tipo: this.ehEdicao ? "atualizada" : "criada" });
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("categoria-form", CategoriaForm);
