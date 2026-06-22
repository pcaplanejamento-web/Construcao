/**
 * <orcamentos-view> — Lista de orçamentos (rota /orcamentos, aba própria do menu).
 * Um orçamento agrupa ofertas de itens (de um fornecedor ou grupo). Reusa a grade
 * de `orcamento-card` (montarGradeOrcamentos) e o `orcamento-form`. Antes essa
 * lista ficava numa aba dentro de Cotações.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { montarGradeOrcamentos } from "./orcamento-grade.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "./orcamento-form.js";

class OrcamentosView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Orçamentos</h1>
            <p class="sub">Agrupe ofertas de vários itens num orçamento (de um fornecedor ou grupo).</p>
          </div>
        </div>
        <ui-card title="Meus orçamentos">
          <ui-button slot="acoes" id="novo">+ Novo orçamento</ui-button>
          <div id="lista"></div>
        </ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#novo").addEventListener("click", () => this.abrirForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const el = this.$("#lista");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }
    montarGradeOrcamentos(el, dataStore.orcamentos());
  }

  abrirForm(orcamento) {
    const form = document.createElement("orcamento-form");
    form.orcamento = orcamento;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }
}

customElements.define("orcamentos-view", OrcamentosView);
