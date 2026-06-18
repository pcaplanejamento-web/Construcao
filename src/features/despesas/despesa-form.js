/**
 * <despesa-form> — Formulário inline para adicionar/editar despesa.
 *
 * Propriedades:
 *   .categorias = [{ id, nome, cor }]   (popula o select)
 *   .emEdicao   = despesa | null         (modo edição quando definido)
 * Eventos:
 *   "adicionar" ({ item, valor, categoria_id, data, observacao })  — modo add
 *   "salvar"    ({ id, dados })                                     — modo edição
 *   "cancelar"  — sai do modo edição
 *
 * Não chama a API: a orquestração (otimista/confirmação) fica em
 * <obra-detail-view>, mantendo este componente reutilizável e simples.
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

  set emEdicao(d) {
    this._emEdicao = d || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get emEdicao() {
    return this._emEdicao || null;
  }

  estilos() {
    return `
      :host { display: block; }
      .form { display: grid; gap: var(--esp-3);
        grid-template-columns: 2fr 1fr 1.2fr 1fr auto; align-items: end; }
      .acoes { display: flex; gap: var(--esp-2); }
      @media (max-width: 760px) { .form { grid-template-columns: 1fr 1fr; } }
    `;
  }

  template() {
    const d = this.emEdicao || {};
    const editando = !!this.emEdicao;
    return `
      <div class="form">
        <ui-input id="item" label="Item" placeholder="Ex.: Cimento CP-II"
                  value="${(d.item || "").replace(/"/g, "&quot;")}"></ui-input>
        <ui-input id="valor" label="Valor (R$)" type="number" step="0.01" min="0"
                  placeholder="0,00" value="${d.valor || ""}"></ui-input>
        <ui-select id="categoria" label="Classificação"></ui-select>
        <ui-input id="data" label="Data" type="date" value="${d.data ? String(d.data).substring(0, 10) : hojeIso()}"></ui-input>
        <div class="acoes">
          <ui-button id="salvar">${editando ? "Salvar" : "+ Adicionar"}</ui-button>
          ${editando ? `<ui-button id="cancelar" variant="secundario">Cancelar</ui-button>` : ""}
        </div>
      </div>
    `;
  }

  aposRender() {
    this.preencherCategorias();
    this.$("#salvar").addEventListener("click", () => this.enviar());
    this.$$("ui-input").forEach((i) =>
      i.addEventListener("enter", () => this.enviar())
    );
    const cancelar = this.$("#cancelar");
    if (cancelar) cancelar.addEventListener("click", () => this.emitir("cancelar"));
  }

  preencherCategorias() {
    const sel = this.$("#categoria");
    if (!sel) return;
    sel.options = this.categorias.map((c) => ({ value: c.id, label: c.nome }));
    const d = this.emEdicao;
    if (d && d.categoria_id) sel.value = d.categoria_id;
    else if (this.categorias[0]) sel.value = this.categorias[0].id;
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

    const dados = {
      item,
      valor,
      categoria_id: this.$("#categoria").value,
      data: this.$("#data").value || hojeIso(),
    };

    if (this.emEdicao) {
      this.emitir("salvar", { id: this.emEdicao.id, dados });
    } else {
      this.emitir("adicionar", dados);
      this.limpar();
    }
  }

  /** Limpa item/valor mantendo categoria e data (fluxo de inclusão rápida). */
  limpar() {
    this.$("#item").value = "";
    this.$("#valor").value = "";
    this.$("#item").focus && this.$("#item").focus();
  }
}

customElements.define("despesa-form", DespesaForm);
