/**
 * <despesa-form> — Banner (modal) para ADICIONAR despesa. Auto-contido: chama
 * dataStore.adicionarDespesa e emite "salvo"/"fechar". Reusa ui-modal/ui-input/
 * ui-select/ui-button. (pago/pagamento/responsabilidade são definidos depois, no
 * banner de edição <despesa-detail>.)
 *
 * Propriedades: .obraId, .categorias = [{ id, nome, cor }]
 * Eventos: "salvo", "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { hojeIso } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { primeiroErro, obrigatorio, valorPositivo } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class DespesaForm extends BaseElement {
  set obraId(v) {
    this._obraId = v || "";
  }
  get obraId() {
    return this._obraId || "";
  }
  set categorias(v) {
    this._categorias = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.preencherCategorias();
  }
  get categorias() {
    return this._categorias || [];
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
    `;
  }

  template() {
    return `
      <ui-modal open title="Registrar despesa">
        <div class="campos">
          <ui-input id="item" label="Item" placeholder="Ex.: Cimento CP-II"></ui-input>
          <div class="linha">
            <ui-input id="valor" label="Valor (R$)" type="number" step="0.01" min="0"
                      placeholder="0,00"></ui-input>
            <ui-input id="data" label="Data" type="date" value="${hojeIso()}"></ui-input>
          </div>
          <ui-select id="categoria" label="Classificação"></ui-select>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">Adicionar</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.preencherCategorias();
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
    this.$$("ui-input").forEach((i) => i.addEventListener("enter", () => this.salvar()));
  }

  preencherCategorias() {
    const sel = this.$("#categoria");
    if (!sel) return;
    sel.options = this.categorias.map((c) => ({ value: c.id, label: c.nome }));
    if (this.categorias[0]) sel.value = this.categorias[0].id;
  }

  async salvar() {
    const item = this.$("#item").value.trim();
    const valor = Number(this.$("#valor").value);
    const erro = primeiroErro(obrigatorio(item, "O item"), valorPositivo(valor));
    if (erro) {
      this.$("#item").setAttribute("error", obrigatorio(item, "O item"));
      this.$("#valor").setAttribute("error", valorPositivo(valor));
      return;
    }
    const dados = {
      item,
      valor,
      categoria_id: this.$("#categoria").value,
      data: this.$("#data").value || hojeIso(),
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      await dataStore.adicionarDespesa(this.obraId, dados);
      toastSucesso("Despesa adicionada.");
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("despesa-form", DespesaForm);
