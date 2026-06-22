/**
 * <obra-card> — Cartão de uma obra com resumo financeiro.
 *
 * Propriedade: .obra = { id, nome, endereco, status, orcamento, total_gasto }
 * Eventos: "abrir", "editar", "remover" ({ obra }).
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, percentual, data as fmtData } from "../../core/formatters.js";
import "../../components/ui-badge.js";
import "../../components/ui-icon.js";

const STATUS_INFO = {
  ativa: { rotulo: "Ativa", cor: "var(--cor-sucesso)" },
  pausada: { rotulo: "Pausada", cor: "var(--cor-aviso)" },
  concluida: { rotulo: "Concluída", cor: "var(--cor-info)" },
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
        border-radius: var(--raio-lg); box-shadow: var(--sombra-md);
        padding: var(--esp-5); cursor: pointer;
        transition: box-shadow var(--transicao), transform var(--transicao);
        display: flex; flex-direction: column; gap: var(--esp-3); height: 100%;
      }
      .card:hover { box-shadow: var(--sombra-lg); transform: translateY(-2px); }
      .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--esp-2); }
      h3 { font-size: var(--fs-lg); font-weight: var(--peso-semi); }
      .end { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      .valores { display: flex; justify-content: space-between; font-size: var(--fs-sm); }
      .valores .rotulo { color: var(--cor-texto-suave); }
      .valores span:last-child { font-family: var(--fonte-titulo); font-weight: var(--peso-semi); }
      .gasto { font-weight: var(--peso-semi); }
      .barra { height: 8px; background: var(--cor-borda); border-radius: var(--raio-completo); overflow: hidden; }
      .barra > div { height: 100%; background: var(--grad-primaria); transition: width .3s; }
      .barra > div.estouro { background: var(--cor-erro); }
      .acoes { display: flex; gap: var(--esp-2); margin-top: auto; }
      .acoes button {
        flex: 1; border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        border-radius: var(--raio-sm); padding: 6px; font-size: var(--fs-xs);
        color: var(--cor-texto-suave);
      }
      .acoes button:hover { background: var(--cor-superficie-2); }
      .acoes button.perigo { color: var(--cor-erro); border-color: var(--cor-erro-suave); }
      .dono { font-size: var(--fs-xs); color: var(--cor-texto-fraco);
        display: flex; align-items: center; gap: var(--esp-1); }
      .log { font-size: var(--fs-xs); color: var(--cor-texto-fraco);
        border-top: 1px solid var(--cor-borda); padding-top: var(--esp-2); }
      .log span { display: block; }
      .end { display: flex; align-items: center; gap: var(--esp-1); }
      .badges { display: flex; gap: var(--esp-2); flex-wrap: wrap; }
    `;
  }

  template() {
    const o = this.obra;
    const st = STATUS_INFO[o.status] || STATUS_INFO.ativa;
    const orcamento = Number(o.orcamento) || 0;
    const gasto = Number(o.total_gasto) || 0;
    const pct = orcamento ? percentual(gasto, orcamento) : 0;
    const estouro = orcamento && gasto > orcamento;
    const ehDono = o.ehDono !== false; // default dono se não informado
    const editada = o.editor_nome && o.atualizado_em && String(o.atualizado_em) !== String(o.criado_em);
    const log = o.criado_em
      ? `<div class="log">
           <span>Criada em ${fmtData(o.criado_em)}${o.autor_nome ? ` por ${o.autor_nome}` : ""}</span>
           ${editada ? `<span>Editada em ${fmtData(o.atualizado_em)} por ${o.editor_nome}</span>` : ""}
         </div>`
      : "";
    return `
      <div class="card" id="card">
        <div class="topo">
          <h3>${o.nome || ""}</h3>
          <div class="badges">
            ${!ehDono ? `<ui-badge color="var(--cor-roxo)" text="Compartilhada"></ui-badge>` : ""}
            <ui-badge color="${st.cor}" text="${st.rotulo}"></ui-badge>
          </div>
        </div>
        ${!ehDono && o.dono_email ? `<div class="dono"><ui-icon name="usuario" size="13"></ui-icon> de ${o.dono_email}</div>` : ""}
        ${o.endereco ? `<div class="end"><ui-icon name="local" size="14"></ui-icon> ${o.endereco}</div>` : ""}
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
        ${log}
        ${
          ehDono
            ? `<div class="acoes">
                 <button id="editar">Editar</button>
                 <button id="compartilhar">Compartilhar</button>
                 <button id="remover" class="perigo">Excluir</button>
               </div>`
            : ""
        }
      </div>
    `;
  }

  aposRender() {
    this.$("#card").addEventListener("click", (e) => {
      if (e.target.closest(".acoes")) return; // cliques nos botões não abrem
      this.emitir("abrir", { obra: this.obra });
    });
    const editar = this.$("#editar");
    if (editar)
      editar.addEventListener("click", () =>
        this.emitir("editar", { obra: this.obra })
      );
    const compartilhar = this.$("#compartilhar");
    if (compartilhar)
      compartilhar.addEventListener("click", () =>
        this.emitir("compartilhar", { obra: this.obra })
      );
    const remover = this.$("#remover");
    if (remover)
      remover.addEventListener("click", () =>
        this.emitir("remover", { obra: this.obra })
      );
  }
}

customElements.define("obra-card", ObraCard);
