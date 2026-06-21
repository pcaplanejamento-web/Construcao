/**
 * <equipe-card> — Cartão de uma equipe (espelha orcamento-card/obra-card).
 *
 * Propriedade: .equipe = { id, nome, lider_id, membros:[], obras:[], ... }
 * Eventos: "abrir", "editar", "remover" ({ equipe }).
 */
import { BaseElement } from "../../components/base-element.js";
import { numero, data as fmtData } from "../../core/formatters.js";
import { liderNome } from "./equipe-util.js";
import "../../components/ui-badge.js";
import "../../components/ui-icon.js";

class EquipeCard extends BaseElement {
  set equipe(v) {
    this._equipe = v || {};
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get equipe() {
    return this._equipe || {};
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
    const e = this.equipe;
    const editado = e.editor_nome && e.atualizado_em && String(e.atualizado_em) !== String(e.criado_em);
    const log = e.criado_em
      ? `<div class="log">
           <span>Criada em ${fmtData(e.criado_em)}${e.autor_nome ? ` por ${e.autor_nome}` : ""}</span>
           ${editado ? `<span>Editada em ${fmtData(e.atualizado_em)} por ${e.editor_nome}</span>` : ""}
         </div>`
      : "";
    return `
      <div class="card" id="card">
        <div class="topo">
          <h3>${e.nome || ""}</h3>
          <ui-badge color="var(--cor-primaria)" text="Equipe"></ui-badge>
        </div>
        <div class="sub"><ui-icon name="usuario" size="13"></ui-icon> Líder: ${liderNome(e)}</div>
        <div class="valores">
          <span class="rotulo">Membros</span>
          <span>${numero((e.membros || []).length)}</span>
        </div>
        <div class="valores">
          <span class="rotulo">Obras</span>
          <span>${numero((e.obras || []).length)}</span>
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
      this.emitir("abrir", { equipe: this.equipe });
    });
    this.$("#editar").addEventListener("click", () => this.emitir("editar", { equipe: this.equipe }));
    this.$("#remover").addEventListener("click", () => this.emitir("remover", { equipe: this.equipe }));
  }
}

customElements.define("equipe-card", EquipeCard);
