/**
 * <obra-card> — Cartão de uma obra com resumo financeiro.
 *
 * Propriedade: .obra = { id, nome, endereco, status, orcamento, total_gasto }
 * Eventos: "abrir", "editar", "remover" ({ obra }).
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, percentual } from "../../core/formatters.js";
import "../../components/ui-badge.js";

const STATUS_INFO = {
  ativa: { rotulo: "Ativa", cor: "#16a34a" },
  pausada: { rotulo: "Pausada", cor: "#d97706" },
  concluida: { rotulo: "Concluída", cor: "#2563eb" },
};

class ObraCard extends BaseElement {
  set obra(v) {
    this._obra = v || {};
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get obra() {
    return this._obra || {};
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
      h3 { font-size: var(--fs-lg); font-weight: var(--peso-semi); }
      .end { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      .valores { display: flex; justify-content: space-between; font-size: var(--fs-sm); }
      .valores .rotulo { color: var(--cor-texto-suave); }
      .gasto { font-weight: var(--peso-semi); }
      .barra { height: 8px; background: var(--cor-borda); border-radius: var(--raio-completo); overflow: hidden; }
      .barra > div { height: 100%; background: var(--cor-primaria); transition: width .3s; }
      .barra > div.estouro { background: var(--cor-erro); }
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
    const o = this.obra;
    const st = STATUS_INFO[o.status] || STATUS_INFO.ativa;
    const orcamento = Number(o.orcamento) || 0;
    const gasto = Number(o.total_gasto) || 0;
    const pct = orcamento ? percentual(gasto, orcamento) : 0;
    const estouro = orcamento && gasto > orcamento;
    return `
      <div class="card" id="card">
        <div class="topo">
          <h3>${o.nome || ""}</h3>
          <ui-badge color="${st.cor}" text="${st.rotulo}"></ui-badge>
        </div>
        ${o.endereco ? `<div class="end">📍 ${o.endereco}</div>` : ""}
        <div class="valores">
          <span class="rotulo">Gasto</span>
          <span class="gasto" style="${estouro ? "color:var(--cor-erro)" : ""}">${moeda(gasto)}</span>
        </div>
        ${
          orcamento
            ? `<div class="barra"><div class="${estouro ? "estouro" : ""}" style="width:${Math.min(
                pct,
                100
              )}%"></div></div>
               <div class="valores"><span class="rotulo">Orçamento</span><span>${moeda(
                 orcamento
               )} · ${pct}%</span></div>`
            : `<div class="valores"><span class="rotulo">Orçamento</span><span>não definido</span></div>`
        }
        <div class="acoes">
          <button id="editar">Editar</button>
          <button id="remover" class="perigo">Excluir</button>
        </div>
      </div>
    `;
  }

  aposRender() {
    this.$("#card").addEventListener("click", (e) => {
      if (e.target.closest(".acoes")) return; // cliques nos botões não abrem
      this.emitir("abrir", { obra: this.obra });
    });
    this.$("#editar").addEventListener("click", () =>
      this.emitir("editar", { obra: this.obra })
    );
    this.$("#remover").addEventListener("click", () =>
      this.emitir("remover", { obra: this.obra })
    );
  }
}

customElements.define("obra-card", ObraCard);
