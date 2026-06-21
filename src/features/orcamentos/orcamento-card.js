/**
 * <orcamento-card> — Cartão de um orçamento (espelha obra-card: quadrado, grade).
 *
 * Propriedade: .orcamento = { id, tipo, fornecedor_id, contato_id, obra_id, titulo, ... }
 * Eventos: "abrir", "editar", "remover" ({ orcamento }).
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, numero, data as fmtData } from "../../core/formatters.js";
import { dataStore } from "../../core/data-store.js";
import { rotuloOrcamento, totalOrcamento, ofertanteNome, COR_CLASSIFICACAO } from "./orcamento-util.js";
import "../../components/ui-badge.js";
import "../../components/ui-icon.js";

class OrcamentoCard extends BaseElement {
  set orcamento(v) {
    this._orcamento = v || {};
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get orcamento() {
    return this._orcamento || {};
  }

  estilos() {
    return `
      :host { display: block; }
      .card {
        background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-lg); box-shadow: var(--sombra-sm);
        padding: var(--esp-5); cursor: pointer; transition: var(--transicao);
        display: flex; flex-direction: column; gap: var(--esp-3); height: 100%;
      }
      .card:hover { box-shadow: var(--sombra-md); transform: translateY(-2px); }
      .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--esp-2); }
      h3 { font-size: var(--fs-lg); font-weight: var(--peso-semi); overflow-wrap: anywhere; }
      .sub { color: var(--cor-texto-fraco); font-size: var(--fs-sm);
        display: flex; align-items: center; gap: var(--esp-1); flex-wrap: wrap; }
      .valores { display: flex; justify-content: space-between; font-size: var(--fs-sm); }
      .valores .rotulo { color: var(--cor-texto-suave); }
      .total { font-weight: var(--peso-semi); }
      .log { font-size: var(--fs-xs); color: var(--cor-texto-fraco);
        border-top: 1px solid var(--cor-borda); padding-top: var(--esp-2); }
      .log span { display: block; }
      .acoes { display: flex; gap: var(--esp-2); margin-top: auto; }
      .acoes button {
        flex: 1; border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        border-radius: var(--raio-sm); padding: 6px; font-size: var(--fs-xs);
        color: var(--cor-texto-suave);
      }
      .acoes button:hover { background: var(--cor-superficie-2); }
      .acoes button.perigo { color: var(--cor-erro); }
    `;
  }

  template() {
    const o = this.orcamento;
    const cor = COR_CLASSIFICACAO[o.tipo] || "var(--cor-neutro)";
    const ofertas = dataStore.ofertasDoOrcamento(o.id);
    const obra = o.obra_id ? dataStore.obra(o.obra_id) : null;
    const fornecedor =
      o.tipo === "Material"
        ? dataStore.fornecedores().find((f) => String(f.id) === String(o.fornecedor_id))
        : null;
    const ofertante = ofertanteNome(o.contato_id, o.equipe_id);
    const partes = [];
    if (fornecedor) partes.push(fornecedor.nome);
    if (ofertante && ofertante !== "—") partes.push(o.equipe_id ? ofertante + " (equipe)" : ofertante);
    const editado = o.editor_nome && o.atualizado_em && String(o.atualizado_em) !== String(o.criado_em);
    const log = o.criado_em
      ? `<div class="log">
           <span>Criado em ${fmtData(o.criado_em)}${o.autor_nome ? ` por ${o.autor_nome}` : ""}</span>
           ${editado ? `<span>Editado em ${fmtData(o.atualizado_em)} por ${o.editor_nome}</span>` : ""}
         </div>`
      : "";
    return `
      <div class="card" id="card">
        <div class="topo">
          <h3>${rotuloOrcamento(o)}</h3>
          <ui-badge color="${cor}" text="${o.tipo || "—"}"></ui-badge>
        </div>
        ${partes.length ? `<div class="sub">${partes.join(" · ")}</div>` : ""}
        ${obra ? `<div class="sub"><ui-icon name="obra" size="13"></ui-icon> ${obra.nome}</div>` : ""}
        <div class="valores">
          <span class="rotulo">Total</span>
          <span class="total">${moeda(totalOrcamento(o.id))}</span>
        </div>
        <div class="valores">
          <span class="rotulo">Ofertas</span>
          <span>${numero(ofertas.length)}</span>
        </div>
        ${log}
        <div class="acoes">
          <button id="editar">Editar</button>
          <button id="remover" class="perigo">Excluir</button>
        </div>
      </div>
    `;
  }

  aposRender() {
    this.$("#card").addEventListener("click", (e) => {
      if (e.target.closest(".acoes")) return;
      this.emitir("abrir", { orcamento: this.orcamento });
    });
    this.$("#editar").addEventListener("click", () => this.emitir("editar", { orcamento: this.orcamento }));
    this.$("#remover").addEventListener("click", () => this.emitir("remover", { orcamento: this.orcamento }));
  }
}

customElements.define("orcamento-card", OrcamentoCard);
