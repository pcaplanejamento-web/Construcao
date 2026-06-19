/**
 * <despesa-form> — Formulário inline para ADICIONAR despesa.
 *
 * Propriedade: .categorias = [{ id, nome, cor }]   (popula o select)
 * Evento: "adicionar" ({ item, valor, categoria_id, data })
 *
 * A edição NÃO é feita aqui — é feita no banner <despesa-detail> (ao clicar na
 * linha ou em Editar). Não chama a API: a orquestração fica em obra-detail-view.
 */
import { BaseElement } from "../../components/base-element.js";
import { hojeIso } from "../../core/formatters.js";
import { primeiroErro, obrigatorio, valorPositivo } from "../../core/validators.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class DespesaForm extends BaseElement {
  set categorias(v) {
    this._categorias = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.preencherCategorias();
  }
  get categorias() {
    return this._categorias || [];
  }

  estilos() {
    return `
      :host { display: block; }
      .form { display: grid; gap: var(--esp-3);
        grid-template-columns: 2fr 1fr 1.2fr 1fr auto; align-items: end; }
      @media (max-width: 760px) { .form { grid-template-columns: 1fr 1fr; } }
    `;
  }

  template() {
    return `
      <div class="form">
        <ui-input id="item" label="Item" placeholder="Ex.: Cimento CP-II"></ui-input>
        <ui-input id="valor" label="Valor (R$)" type="number" step="0.01" min="0"
                  placeholder="0,00"></ui-input>
        <ui-select id="categoria" label="Classificação"></ui-select>
        <ui-input id="data" label="Data" type="date" value="${hojeIso()}"></ui-input>
        <ui-button id="salvar">+ Adicionar</ui-button>
      </div>
    `;
  }

  aposRender() {
    this.preencherCategorias();
    this.$("#salvar").addEventListener("click", () => this.enviar());
    this.$$("ui-input").forEach((i) =>
      i.addEventListener("enter", () => this.enviar())
    );
  }

  preencherCategorias() {
    const sel = this.$("#categoria");
    if (!sel) return;
    sel.options = this.categorias.map((c) => ({ value: c.id, label: c.nome }));
    if (this.categorias[0]) sel.value = this.categorias[0].id;
  }

  enviar() {
    const item = this.$("#item").value.trim();
    const valor = Number(this.$("#valor").value);
    const erro = primeiroErro(obrigatorio(item, "O item"), valorPositivo(valor));
    if (erro) {
      this.$("#item").setAttribute("error", obrigatorio(item, "O item"));
      this.$("#valor").setAttribute("error", valorPositivo(valor));
      return;
    }
    this.$("#item").removeAttribute("error");
    this.$("#valor").removeAttribute("error");

    this.emitir("adicionar", {
      item,
      valor,
      categoria_id: this.$("#categoria").value,
      data: this.$("#data").value || hojeIso(),
    });
    this.limpar();
  }

  /** Limpa item/valor mantendo categoria e data (inclusão rápida). */
  limpar() {
    this.$("#item").value = "";
    this.$("#valor").value = "";
    this.$("#item").focus && this.$("#item").focus();
  }
}

customElements.define("despesa-form", DespesaForm);
