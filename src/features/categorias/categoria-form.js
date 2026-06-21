/**
 * <categoria-form> — Modal para criar/editar uma `categoria`. A MESMA entidade
 * serve a dois pools, via `.tipo`: **"item"** (subclassificação de itens, padrão)
 * ou **"fornecedor"** (classificação de fornecedor) — rótulos se ajustam.
 *
 * Propriedades: .categoria (objeto p/ edição; ausente = nova), .tipo ("item"|"fornecedor")
 * Eventos: "salvo", "fechar". Auto-contido: chama categorias.criar/atualizar e
 * emite EVENTOS.CATEGORIAS para os demais componentes reagirem.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
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
  set tipo(v) {
    this._tipo = v === "fornecedor" ? "fornecedor" : "item";
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get tipo() {
    return this._tipo || (this.categoria && this.categoria.tipo === "fornecedor" ? "fornecedor" : "item");
  }
  /** Termo exibido conforme o pool. */
  get _termo() {
    return this.tipo === "fornecedor" ? "classificação" : "subclassificação";
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
    const termo = this._termo;
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar" : "Nova"} ${termo}">
        <div class="campos">
          <div class="linha">
            <ui-input id="nome" label="Nome da ${termo}"
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
    const Termo = this._termo.charAt(0).toUpperCase() + this._termo.slice(1);
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarCategoria(this.categoria.id, { nome, cor });
        toastSucesso(`${Termo} atualizada.`);
      } else {
        await dataStore.criarCategoria({ nome, cor, tipo: this.tipo });
        toastSucesso(`${Termo} criada.`);
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

customElements.define("categoria-form", CategoriaForm);
