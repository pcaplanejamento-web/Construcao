/**
 * <item-form> — Modal para criar/editar um item do catálogo.
 *
 * Propriedade: .item (objeto p/ edição; ausente = novo)
 * Eventos: "salvo", "fechar". Auto-contido: chama itens.criar/atualizar e
 * emite EVENTOS.ITENS para os demais componentes reagirem.
 * Espelha categoria-form, trocando a cor por um ui-select de Classificação.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

/** Classificações fixas (espelha CLASSIFICACOES_ITEM do backend). */
const CLASSIFICACOES = ["Material", "Serviço"];

class ItemForm extends BaseElement {
  set item(v) {
    this._item = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get item() {
    return this._item || null;
  }
  get ehEdicao() {
    return !!(this.item && this.item.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
    `;
  }

  template() {
    const i = this.item || {};
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar item" : "Novo item"}">
        <div class="campos">
          <ui-input id="nome" label="Nome do item"
            value="${(i.nome || "").replace(/"/g, "&quot;")}"
            placeholder="Ex.: Cimento CP-II"></ui-input>
          <ui-select id="classificacao" label="Classificação"></ui-select>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    const i = this.item || {};
    const sel = this.$("#classificacao");
    sel.options = CLASSIFICACOES.map((c) => ({ value: c, label: c }));
    sel.value = i.classificacao || CLASSIFICACOES[0];

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
    const classificacao = this.$("#classificacao").value || CLASSIFICACOES[0];

    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarItem(this.item.id, { nome, classificacao });
        toastSucesso("Item atualizado.");
      } else {
        await dataStore.criarItem({ nome, classificacao });
        toastSucesso("Item criado.");
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

customElements.define("item-form", ItemForm);
