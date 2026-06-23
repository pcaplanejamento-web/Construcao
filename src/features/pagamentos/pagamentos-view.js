/**
 * <pagamentos-view> — Página "Pagamentos" (rota /pagamentos, item do menu lateral).
 * Lista TODOS os pagamentos do usuário como cards padronizados (esverdeados); clicar
 * abre o MESMO banner de detalhe (`abrirPagamento`) usado nas despesas — com os dados
 * completos + repasses. Lê do data-store (cache-first) e assina mudanças.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { previaPagamentoHtml, abrirPagamento } from "./pagamento-util.js";
import "../../components/ui-card.js";
import "../../components/ui-spinner.js";

class PagamentosView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
      .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--esp-3); }
      .resumo { position: relative; background: var(--cor-sucesso-suave, rgba(22,163,74,.10));
        border: 1px solid var(--cor-sucesso); border-radius: var(--raio-md);
        padding: var(--esp-3) var(--esp-4); display: flex; flex-direction: column; gap: 4px;
        cursor: pointer; transition: border-color var(--transicao), background var(--transicao); }
      .resumo:hover { background: rgba(22,163,74,.16); }
      .resumo .item { font-weight: var(--peso-semi); }
      .resumo .val { font-size: var(--fs-lg); font-weight: var(--peso-forte); color: var(--cor-sucesso); }
      .resumo small { color: var(--cor-texto-suave); }
      .vazio { color: var(--cor-texto-fraco); padding: var(--esp-6); text-align: center; }
    `;
  }

  template() {
    return `
      <div class="area">
        <div>
          <h1>Pagamentos</h1>
          <p class="sub">Todos os pagamentos registrados — clique para ver os dados completos e os repasses.</p>
        </div>
        <ui-card title="Meus pagamentos">
          <div id="lista"></div>
        </ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.pintar();
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const el = this.$("#lista");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }
    const pags = dataStore.pagamentos();
    if (!pags.length) {
      el.innerHTML = `<div class="vazio">Nenhum pagamento registrado.</div>`;
      return;
    }
    el.innerHTML = `<div class="grade"></div>`;
    const grade = el.querySelector(".grade");
    pags.forEach((p) => {
      const card = document.createElement("div");
      card.className = "resumo";
      card.title = "Ver detalhes do pagamento";
      card.innerHTML = previaPagamentoHtml(p);
      card.addEventListener("click", () => abrirPagamento(p));
      grade.appendChild(card);
    });
  }
}

customElements.define("pagamentos-view", PagamentosView);
