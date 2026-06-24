/**
 * <pagamentos-view> — Página "Transferências" (rota /pagamentos, item do menu lateral).
 * Componente de abas: [Transferências | Pagamentos]. As transferências são cards CINZA
 * ESCURO (clicar → banner da transferência, com os pagamentos agrupados); os pagamentos
 * são cards esverdeados (clicar → banner do pagamento + repasses). Lê do data-store
 * (cache-first) e assina mudanças.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import {
  previaPagamentoHtml,
  abrirPagamento,
  previaTransferenciaHtml,
  abrirTransferencia,
  montarGradeResumos,
} from "./pagamento-util.js";
import "../../components/ui-card.js";
import "../../components/ui-tabs.js";
import "../../components/ui-spinner.js";

class PagamentosView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div>
          <h1>Transferências</h1>
          <p class="sub">Cada transferência agrupa um ou mais pagamentos do mesmo recebedor — clique para ver os detalhes.</p>
        </div>
        <ui-tabs id="abas">
          <div slot="transferencias">
            <ui-card mesa title="Mesa com transferências"><div id="listaT"></div></ui-card>
          </div>
          <div slot="pagamentos">
            <ui-card mesa title="Mesa com pagamentos"><div id="listaP"></div></ui-card>
          </div>
        </ui-tabs>
      </div>
    `;
  }

  aoConectar() {
    const abas = this.$("#abas");
    if (abas)
      abas.abas = [
        { id: "transferencias", rotulo: "Transferências", icone: "cifrao" },
        { id: "pagamentos", rotulo: "Pagamentos", icone: "recibo" },
      ];
    this.pintar();
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const elT = this.$("#listaT");
    const elP = this.$("#listaP");
    if (!elT || !elP) return;
    if (!dataStore.carregado()) {
      elT.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      elP.innerHTML = "";
      return;
    }
    montarGradeResumos(elT, dataStore.transferencias(), "transf", previaTransferenciaHtml, abrirTransferencia, "Nenhuma transferência registrada.");
    montarGradeResumos(elP, dataStore.pagamentos(), "pag", previaPagamentoHtml, abrirPagamento, "Nenhum pagamento registrado.");
  }
}

customElements.define("pagamentos-view", PagamentosView);
