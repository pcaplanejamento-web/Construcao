/**
 * <publico-grupo-view> — Link PÚBLICO de um GRUPO de obras (rota /publico-grupo/:token,
 * sem login). Mostra a lista das obras do grupo; o visitante ESCOLHE uma e vê todos
 * os dados reusando <publico-view> em modo grupo (grupo-token + obra-id → publico.grupoObra).
 * Componente ISOLADO (não usa o data-store autenticado) → zero risco à tela interna.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { moeda, percentual } from "../../core/formatters.js";
import "../../components/ui-card.js";
import "../../components/ui-icon.js";
import "../../components/ui-spinner.js";
import "../../components/ui-button.js";
import "./publico-view.js";

const STATUS = {
  ativa: { r: "Ativa", c: "var(--cor-sucesso)" },
  pausada: { r: "Pausada", c: "var(--cor-aviso)" },
  concluida: { r: "Concluída", c: "var(--cor-info)" },
};
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

class PublicoGrupoView extends BaseElement {
  get token() {
    return this.getAttribute("token");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .sub { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .selo { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
        font-size: var(--fs-sm); color: var(--cor-texto-suave);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-completo); padding: 4px 12px; }
      .grid { display: grid; gap: var(--esp-4); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
      .card { background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-lg); box-shadow: var(--sombra-md); padding: var(--esp-5); cursor: pointer;
        transition: box-shadow var(--transicao), transform var(--transicao);
        display: flex; flex-direction: column; gap: var(--esp-3); text-align: left; width: 100%; font: inherit; color: inherit; }
      .card:hover { box-shadow: var(--sombra-lg); transform: translateY(-4px); }
      .topo { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--esp-2); }
      h3 { font-size: var(--fs-lg); font-weight: var(--peso-semi); min-height: calc(2 * 1.2em);
        display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
      .badge { font-size: var(--fs-xs); border-radius: var(--raio-completo); padding: 2px 10px; color: #fff; flex: none; white-space: nowrap; }
      .end { color: var(--cor-texto-fraco); font-size: var(--fs-sm); display: flex; align-items: center; gap: var(--esp-1); }
      .valores { display: flex; justify-content: space-between; font-size: var(--fs-sm); }
      .valores .rotulo { color: var(--cor-texto-suave); }
      .gasto { font-weight: var(--peso-semi); }
      .barra { height: 8px; background: var(--cor-borda); border-radius: var(--raio-completo); overflow: hidden; }
      .barra > div { height: 100%; background: var(--grad-primaria); }
      .barra > div.estouro { background: var(--cor-erro); }
      .vazio { color: var(--cor-texto-fraco); }
      .voltar { align-self: flex-start; }
    `;
  }

  template() {
    return `<div class="area" id="conteudo"><ui-spinner centro text="Carregando..."></ui-spinner></div>`;
  }

  aoConectar() {
    this.carregar();
  }

  async carregar() {
    try {
      this._d = await api.call("publico.grupo", { token: this.token });
      this.pintarLista();
    } catch (e) {
      this.$("#conteudo").innerHTML = `<ui-card title="Link indisponível"><p>${
        e.message || "Este link não está mais válido."
      }</p></ui-card>`;
    }
  }

  pintarLista() {
    const d = this._d || {};
    const grupo = d.grupo || {};
    const obras = d.obras || [];
    const cards = obras
      .map((o, i) => {
        const st = STATUS[o.status] || STATUS.ativa;
        const orc = Number(o.orcamento) || 0;
        const gasto = Number(o.total_gasto) || 0;
        const pct = orc ? percentual(gasto, orc) : 0;
        const estouro = orc && gasto > orc;
        return `
          <button class="card" type="button" data-i="${i}">
            <div class="topo">
              <h3>${esc(o.nome || "Obra")}</h3>
              <span class="badge" style="background:${st.c}">${st.r}</span>
            </div>
            ${o.endereco ? `<div class="end"><ui-icon name="local" size="14"></ui-icon> ${esc(o.endereco)}</div>` : ""}
            <div class="valores"><span class="rotulo">Gasto</span><span class="gasto" style="${estouro ? "color:var(--cor-erro)" : ""}">${moeda(gasto)}</span></div>
            ${
              orc
                ? `<div class="barra"><div class="${estouro ? "estouro" : ""}" style="width:${Math.min(pct, 100)}%"></div></div>
                   <div class="valores"><span class="rotulo">Orçamento</span><span>${moeda(orc)} · ${pct}%</span></div>`
                : `<div class="valores"><span class="rotulo">Orçamento</span><span>não definido</span></div>`
            }
          </button>`;
      })
      .join("");
    this.$("#conteudo").innerHTML = `
      <div>
        <h1>${esc(grupo.nome || "Grupo de obras")}</h1>
        <p class="sub">Escolha uma obra para ver todos os dados.</p>
      </div>
      <span class="selo"><ui-icon name="olho" size="14"></ui-icon> Somente leitura — link do grupo</span>
      ${obras.length ? `<div class="grid">${cards}</div>` : `<p class="vazio">Este grupo ainda não tem obras.</p>`}`;
    this.$$(".card").forEach((el) =>
      el.addEventListener("click", () => this.abrirObra(obras[Number(el.dataset.i)]))
    );
  }

  abrirObra(o) {
    if (!o) return;
    this.$("#conteudo").innerHTML = `
      <ui-button class="voltar" id="voltar" variant="secundario"><ui-icon name="seta-esquerda" size="16"></ui-icon> Voltar aos empreendimentos</ui-button>
      <div id="pub"></div>`;
    this.$("#voltar").addEventListener("click", () => this.pintarLista());
    const pv = document.createElement("publico-view");
    pv.setAttribute("grupo-token", this.token);
    pv.setAttribute("obra-id", o.id);
    this.$("#pub").appendChild(pv);
  }
}

customElements.define("publico-grupo-view", PublicoGrupoView);
