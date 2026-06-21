/**
 * <despesa-form> — Banner (modal) para ADICIONAR despesa. Auto-contido: chama
 * dataStore.adicionarDespesa e emite "salvo"/"fechar". Reusa ui-modal/ui-tabs/
 * ui-input/ui-select/ui-button. (pago/pagamento/responsabilidade são definidos
 * depois, no banner de edição <despesa-detail>.)
 *
 * Fluxo: abas Material/Serviço (classificação) → seleciona um ITEM cadastrado
 * daquela classificação (obrigatório) → subclassificação (opcional).
 *
 * Propriedades: .obraId, .categorias = [{ id, nome, cor }] (subclassificações)
 * Eventos: "salvo", "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { hojeIso } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { valorPositivo } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-tabs.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

const CLASSIFICACOES = ["Material", "Serviço"];

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
          <ui-tabs id="abas"></ui-tabs>
          <ui-select id="item" label="Item"></ui-select>
          <div class="linha">
            <ui-input id="valor" label="Valor (R$)" type="number" step="0.01" min="0"
                      placeholder="0,00"></ui-input>
            <ui-input id="data" label="Data" type="date" value="${hojeIso()}"></ui-input>
          </div>
          <ui-select id="categoria" label="Subclassificação"></ui-select>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">Adicionar</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.$("#abas").abas = CLASSIFICACOES.map((c) => ({ id: c, rotulo: c, icone: "tag" }));
    this.$("#abas").addEventListener("mudar", () => this.preencherItens());
    this.preencherItens();
    this.preencherCategorias();
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
    this.$$("ui-input").forEach((i) => i.addEventListener("enter", () => this.salvar()));
  }

  get classificacao() {
    return this.$("#abas").ativo || CLASSIFICACOES[0];
  }

  preencherItens() {
    const sel = this.$("#item");
    if (!sel) return;
    const itens = dataStore.itensAtivos().filter((i) => i.classificacao === this.classificacao);
    sel.setAttribute("placeholder", itens.length ? "Selecione um item" : "Nenhum item desta classificação");
    sel.options = itens.map((i) => ({ value: i.id, label: i.nome }));
    sel.value = "";
    sel.removeAttribute("error");
  }

  preencherCategorias() {
    const sel = this.$("#categoria");
    if (!sel) return;
    // Subclassificação é opcional → 1ª opção vazia.
    sel.options = [{ value: "", label: "Sem subclassificação" }].concat(
      this.categorias.map((c) => ({ value: c.id, label: c.nome }))
    );
    sel.value = "";
  }

  async salvar() {
    const itemId = this.$("#item").value;
    const valor = Number(this.$("#valor").value);
    const erroValor = valorPositivo(valor);
    if (!itemId) this.$("#item").setAttribute("error", "Selecione um item.");
    if (erroValor) this.$("#valor").setAttribute("error", erroValor);
    if (!itemId || erroValor) return;
    this.$("#item").removeAttribute("error");

    const item = dataStore.itensAtivos().find((i) => String(i.id) === String(itemId)) || {};
    const dados = {
      item_id: itemId,
      classificacao: this.classificacao,
      item: item.nome || "", // nome denormalizado p/ exibição otimista
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
