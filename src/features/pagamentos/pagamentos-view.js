/**
 * <pagamentos-view> — Página "Transferências" (rota /pagamentos, item do menu lateral).
 * Organizada POR OBRA: um seletor de obras (chips) no topo; ao escolher uma obra,
 * as abas [Transferências | Pagamentos] mostram só os lançamentos daquela obra.
 * Transferências/pagamentos são VINCULADOS À OBRA — obras compartilhadas aparecem
 * no seletor; ao descompartilhar, a obra some e os dados junto. Cache-first.
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

const _esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

class PagamentosView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-4); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
      /* Seletor de obras (chips) — rola na horizontal no mobile, sem barra visível. */
      .obras-chips { display: flex; gap: var(--esp-2); overflow-x: auto; padding-bottom: 2px;
        -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .obras-chips::-webkit-scrollbar { display: none; }
      .chip { flex: none; border: 1px solid var(--cor-borda); background: var(--cor-superficie);
        color: var(--cor-texto); cursor: pointer; border-radius: var(--raio-completo); font: inherit;
        font-size: var(--fs-sm); font-weight: var(--peso-medio); min-height: 40px; padding: 0 var(--esp-4);
        white-space: nowrap; transition: background .15s ease, color .15s ease, border-color .15s ease; }
      .chip.ativo { background: var(--cor-primaria); color: #fff; border-color: var(--cor-primaria); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div>
          <h1>Transferências</h1>
          <p class="sub">Escolha uma obra para ver suas transferências e pagamentos. Cada transferência agrupa um ou mais pagamentos do mesmo recebedor — clique para ver os detalhes.</p>
        </div>
        <div class="obras-chips" id="chips"></div>
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
    this._obraSel = ""; // "" = todas as obras
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
    this.pintarChips();
    this.pintarGrades();
  }

  /** Chips de obra (Todas + cada obra acessível — inclui compartilhadas). */
  pintarChips() {
    const el = this.$("#chips");
    if (!el || !dataStore.carregado()) return;
    const obras = dataStore.obras();
    // Se a obra selecionada sumiu (ex.: descompartilhada), volta p/ "Todas".
    if (this._obraSel && !obras.some((o) => String(o.id) === String(this._obraSel))) this._obraSel = "";
    const chip = (id, rot) =>
      `<button type="button" class="chip ${String(this._obraSel) === String(id) ? "ativo" : ""}" data-id="${id}">${_esc(rot)}</button>`;
    el.innerHTML = chip("", "Todas as obras") + obras.map((o) => chip(o.id, o.nome)).join("");
    el.querySelectorAll(".chip").forEach((b) =>
      b.addEventListener("click", () => {
        this._obraSel = b.dataset.id;
        this.pintar();
      })
    );
  }

  pintarGrades() {
    const elT = this.$("#listaT");
    const elP = this.$("#listaP");
    if (!elT || !elP) return;
    if (!dataStore.carregado()) {
      elT.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      elP.innerHTML = "";
      return;
    }
    const sel = String(this._obraSel || "");
    const fil = (arr) => (sel ? arr.filter((x) => String(x.obra_id) === sel) : arr);
    montarGradeResumos(elT, fil(dataStore.transferencias()), "transf", previaTransferenciaHtml, abrirTransferencia, "Nenhuma transferência registrada.");
    montarGradeResumos(elP, fil(dataStore.pagamentos()), "pag", previaPagamentoHtml, abrirPagamento, "Nenhum pagamento registrado.");
  }
}

customElements.define("pagamentos-view", PagamentosView);
