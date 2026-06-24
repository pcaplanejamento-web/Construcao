/**
 * <cotacao-form> — Modal para criar/editar uma cotação (necessidade a cotar).
 *
 * Modo ÚNICO: a cotação é SEMPRE por SUBCLASSIFICAÇÃO — cada oferta define o
 * próprio item dentro da subclassificação; o detalhe agrupa as ofertas por item.
 *
 * Propriedade: .cotacao (objeto p/ edição; ausente = nova)
 * Eventos: "salvo" ({ cotacao }), "fechar". Auto-contido (chama o data-store).
 * obra é OPCIONAL (cotação geral). As ofertas/preços são geridos no detalhe.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class CotacaoForm extends BaseElement {
  set cotacao(v) {
    this._cotacao = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get cotacao() {
    return this._cotacao || null;
  }
  get ehEdicao() {
    return !!(this.cotacao && this.cotacao.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
    `;
  }

  template() {
    const c = this.cotacao || {};
    const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar cotação" : "Nova cotação"}">
        <div class="campos">
          <ui-select id="categoria" label="Subclassificação"></ui-select>
          <div class="linha">
            <ui-input id="quantidade" label="Quantidade" type="number" step="0.01" min="0"
              value="${esc(c.quantidade)}" placeholder="0"></ui-input>
            <ui-input id="unidade" label="Unidade" value="${esc(c.unidade)}"
              placeholder="un, m², kg, saco…"></ui-input>
          </div>
          <ui-select id="obra" label="Obra (opcional)"></ui-select>
          <ui-select id="status" label="Situação"></ui-select>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    const c = this.cotacao || {};

    const selCat = this.$("#categoria");
    selCat.options = [{ value: "", label: "— Selecione —" }].concat(
      dataStore.categoriasItem().map((x) => ({ value: x.id, label: x.nome }))
    );
    selCat.value = c.categoria_id || "";

    const selObra = this.$("#obra");
    selObra.options = [{ value: "", label: "— Nenhuma (geral) —" }].concat(
      dataStore.obras().map((o) => ({ value: o.id, label: o.nome }))
    );
    selObra.value = c.obra_id || "";

    const selStatus = this.$("#status");
    selStatus.options = [
      { value: "aberta", label: "Aberta" },
      { value: "fechada", label: "Fechada" },
    ];
    selStatus.value = c.status || "aberta";

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const categoriaId = this.$("#categoria").value;
    if (!categoriaId) {
      this.$("#categoria").setAttribute("error", "Selecione a subclassificação.");
      return;
    }
    this.$("#categoria").removeAttribute("error");
    const dados = {
      modo: "subclasse",
      categoria_id: categoriaId,
      quantidade: Number(this.$("#quantidade").value) || 0,
      unidade: this.$("#unidade").value.trim(),
      obra_id: this.$("#obra").value,
      status: this.$("#status").value,
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      let cot;
      if (this.ehEdicao) {
        cot = await dataStore.atualizarCotacao(this.cotacao.id, dados);
        toastSucesso("Cotação atualizada.");
      } else {
        cot = await dataStore.criarCotacao(dados);
        toastSucesso("Cotação criada.");
      }
      this.emitir("salvo", { cotacao: cot });
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("cotacao-form", CotacaoForm);
