/**
 * <grafico-evolucao-precos> — Evolução do preço das ofertas no tempo, com UMA
 * LINHA POR CONTATO (gráfico de linhas em SVG). Lê o histórico de preços.
 *
 * Propriedades:
 *   .historico = [{ contato_id, valor_unit, registrado_em }]  (asc por tempo)
 *   .cotacao   = { quantidade, ... }  (para o total = valor_unit × quantidade)
 *   .contatos  = { id: { nome, ... } }  (mapa para nomes)
 *   .cores     = { contato_id: cor }    (mapa estável de cores — coresPorContato)
 *
 * Mira o estilo de grafico-rosca/grafico-mensal (SVG + legenda; tokens; sem libs).
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { totalOferta } from "./cotacao-util.js";

const VB_W = 600;
const VB_H = 260;
const PAD = { l: 66, r: 16, t: 16, b: 32 };

class GraficoEvolucaoPrecos extends BaseElement {
  set historico(v) {
    this._historico = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get historico() {
    return this._historico || [];
  }
  set cotacao(v) {
    this._cotacao = v || {};
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get cotacao() {
    return this._cotacao || {};
  }
  set contatos(v) {
    this._contatos = v || {};
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get contatos() {
    return this._contatos || {};
  }
  set cores(v) {
    this._cores = v || {};
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get cores() {
    return this._cores || {};
  }

  estilos() {
    return `
      :host { display: flex; flex-direction: column; height: 100%; }
      .titulo { font-size: var(--fs-md); font-weight: var(--peso-semi);
        margin-bottom: var(--esp-3); flex: none; }
      .area { flex: 1; min-height: 0; }
      svg { width: 100%; height: 100%; display: block; }
      text.eixo { fill: var(--cor-texto-suave); font-size: 11px; }
      line.grid { stroke: var(--cor-borda); stroke-width: 1; }
      .legenda { flex: none; margin-top: var(--esp-3); display: flex; flex-wrap: wrap;
        gap: var(--esp-2) var(--esp-4); max-height: 64px; overflow-y: auto; }
      .li { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-sm); }
      .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
      .vazio { flex: 1; display: flex; align-items: center; justify-content: center;
        color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    const pts = this.historico
      .map((h) => ({
        contato_id: h.contato_id,
        t: Date.parse(h.registrado_em) || 0,
        v: totalOferta(h, this.cotacao),
        registrado_em: h.registrado_em,
      }))
      .sort((a, b) => a.t - b.t);

    if (!pts.length) {
      return `<div class="titulo">Evolução de preços</div>
        <div class="vazio">Sem histórico ainda. Adicione/edite ofertas para acompanhar a evolução.</div>`;
    }

    const tMin = Math.min(...pts.map((p) => p.t));
    const tMax = Math.max(...pts.map((p) => p.t));
    const vMin = Math.min(...pts.map((p) => p.v));
    const vMax = Math.max(...pts.map((p) => p.v));
    const plotW = VB_W - PAD.l - PAD.r;
    const plotH = VB_H - PAD.t - PAD.b;
    const xOf = (t) => (tMax > tMin ? PAD.l + ((t - tMin) / (tMax - tMin)) * plotW : PAD.l + plotW / 2);
    const yOf = (v) => (vMax > vMin ? PAD.t + (1 - (v - vMin) / (vMax - vMin)) * plotH : PAD.t + plotH / 2);

    // Agrupa por contato (mantém ordem temporal dentro da série).
    const series = {};
    pts.forEach((p) => {
      (series[p.contato_id] = series[p.contato_id] || []).push(p);
    });

    const corDe = (id) => this.cores[id] || "var(--cor-primaria)";
    const nomeDe = (id) => (this.contatos[id] || {}).nome || "Contato removido";

    const linhas = Object.keys(series)
      .map((id) => {
        const serie = series[id];
        const cor = corDe(id);
        const poly =
          serie.length > 1
            ? `<polyline fill="none" stroke="${cor}" stroke-width="2.5"
                 stroke-linejoin="round" stroke-linecap="round"
                 points="${serie.map((p) => `${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(" ")}"></polyline>`
            : "";
        const dots = serie
          .map(
            (p) =>
              `<circle cx="${xOf(p.t).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="3.5" fill="${cor}">
                 <title>${nomeDe(id)} · ${moeda(p.v)} · ${fmtData(p.registrado_em)}</title>
               </circle>`
          )
          .join("");
        return poly + dots;
      })
      .join("");

    // Eixos: linhas de grade (topo/base) + rótulos de Y (máx/mín) e X (início/fim).
    const yTop = PAD.t;
    const yBot = PAD.t + plotH;
    const eixos = `
      <line class="grid" x1="${PAD.l}" y1="${yTop}" x2="${VB_W - PAD.r}" y2="${yTop}"></line>
      <line class="grid" x1="${PAD.l}" y1="${yBot}" x2="${VB_W - PAD.r}" y2="${yBot}"></line>
      <text class="eixo" x="${PAD.l - 8}" y="${yTop + 4}" text-anchor="end">${moeda(vMax)}</text>
      <text class="eixo" x="${PAD.l - 8}" y="${yBot + 4}" text-anchor="end">${moeda(vMin)}</text>
      <text class="eixo" x="${PAD.l}" y="${VB_H - 8}" text-anchor="start">${fmtData(pts[0].registrado_em)}</text>
      <text class="eixo" x="${VB_W - PAD.r}" y="${VB_H - 8}" text-anchor="end">${fmtData(pts[pts.length - 1].registrado_em)}</text>
    `;

    const legenda = Object.keys(series)
      .map(
        (id) =>
          `<div class="li"><span class="dot" style="background:${corDe(id)}"></span>${nomeDe(id)}</div>`
      )
      .join("");

    return `
      <div class="titulo">Evolução de preços (por contato)</div>
      <div class="area">
        <svg viewBox="0 0 ${VB_W} ${VB_H}" role="img" aria-label="Evolução de preços por contato">
          ${eixos}
          ${linhas}
        </svg>
      </div>
      <div class="legenda">${legenda}</div>
    `;
  }
}

customElements.define("grafico-evolucao-precos", GraficoEvolucaoPrecos);
