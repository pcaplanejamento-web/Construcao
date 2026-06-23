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
      .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--esp-3); }
      .resumo { position: relative; border-radius: var(--raio-md);
        padding: var(--esp-3) var(--esp-4); display: flex; flex-direction: column; gap: 4px;
        cursor: pointer; transition: border-color var(--transicao), background var(--transicao); }
      .resumo .item { font-weight: var(--peso-semi); }
      .resumo .val { font-size: var(--fs-lg); font-weight: var(--peso-forte); }
      .resumo small { color: var(--cor-texto-suave); }
      .resumo.pag { background: var(--cor-sucesso-suave, rgba(22,163,74,.10)); border: 1px solid var(--cor-sucesso); }
      .resumo.pag:hover { background: rgba(22,163,74,.16); }
      .resumo.pag .val { color: var(--cor-sucesso); }
      .resumo.transf { background: color-mix(in srgb, var(--cor-neutro) 30%, var(--cor-superficie)); border: 1px solid var(--cor-neutro); }
      .resumo.transf:hover { background: color-mix(in srgb, var(--cor-neutro) 40%, var(--cor-superficie)); }
      .resumo.transf .val { color: var(--cor-texto); }
      .vazio { color: var(--cor-texto-fraco); padding: var(--esp-6); text-align: center; }
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
            <ui-card title="Minhas transferências"><div id="listaT"></div></ui-card>
          </div>
          <div slot="pagamentos">
            <ui-card title="Meus pagamentos"><div id="listaP"></div></ui-card>
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
    this._pintarGrade(elT, dataStore.transferencias(), "transf", previaTransferenciaHtml, abrirTransferencia, "Nenhuma transferência registrada.");
    this._pintarGrade(elP, dataStore.pagamentos(), "pag", previaPagamentoHtml, abrirPagamento, "Nenhum pagamento registrado.");
  }

  _pintarGrade(el, itens, classe, previaHtml, abrir, vazio) {
    if (!itens.length) {
      el.innerHTML = `<div class="vazio">${vazio}</div>`;
      return;
    }
    el.innerHTML = `<div class="grade"></div>`;
    const grade = el.querySelector(".grade");
    itens.forEach((it) => {
      const card = document.createElement("div");
      card.className = "resumo " + classe;
      card.title = "Ver detalhes";
      card.innerHTML = previaHtml(it);
      card.addEventListener("click", () => abrir(it));
      grade.appendChild(card);
    });
  }
}

customElements.define("pagamentos-view", PagamentosView);
