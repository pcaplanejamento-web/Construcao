/**
 * <agenda-lista> — Vista "Agenda" (schedule) imitando o Google Calendar: linha do
 * tempo CRONOLÓGICA ASCENDENTE, com faixa de mês, cabeçalho de intervalo de
 * semana e uma linha por dia (dia da semana + número à esquerda; barras coloridas
 * do evento à direita). Componente PURO de UI: recebe `.eventos` e emite:
 *   - "novo"                    → criar evento (botão do cabeçalho)
 *   - "evento-abrir" {evento}   → abrir um item
 * Não toca em rede. Reusa as cores (agenda-cores.js) e os tokens. Responsivo.
 */
import { BaseElement } from "../../components/base-element.js";
import { corEvento } from "./agenda-cores.js";
import "../../components/ui-button.js";

function pad(n) { return (n < 10 ? "0" : "") + n; }
function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function horaDe(ev) { return ev.diaInteiro ? "" : String(ev.inicio || "").slice(11, 16); }

const DIAS_ABREV = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
  "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// Faixas sazonais (variedade visual como as ilustrações do Google), por mês.
const GRADS = ["var(--grad-azul)", "var(--grad-roxo)", "var(--grad-verde)",
  "var(--grad-primaria)", "var(--grad-laranja)", "var(--grad-vermelho)"];

class AgendaLista extends BaseElement {
  set eventos(v) { this._eventos = v || []; if (this.shadowRoot.childElementCount) this.renderizar(); }
  get eventos() { return this._eventos || []; }

  /** Eventos por dia (YYYY-MM-DD), ordenados por hora dentro do dia. */
  _porDia() {
    const map = {};
    (this.eventos || []).forEach((ev) => {
      const k = String(ev.inicio || "").slice(0, 10);
      if (k) (map[k] = map[k] || []).push(ev);
    });
    Object.keys(map).forEach((k) =>
      map[k].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)))
    );
    return map;
  }

  estilos() {
    return `
      :host { display: block; }
      .cab { display: flex; align-items: center; justify-content: flex-end; margin-bottom: var(--esp-4); }
      .lista { display: flex; flex-direction: column; }
      .vazio { color: var(--cor-texto-fraco); text-align: center; padding: var(--esp-6) var(--esp-2); }

      .faixa-mes { position: relative; height: 84px; border-radius: var(--raio-md); overflow: hidden;
        background: var(--g); display: flex; align-items: flex-end; padding: var(--esp-3) var(--esp-4);
        margin: var(--esp-4) 0 var(--esp-3); box-shadow: var(--sombra-sm); }
      .faixa-mes:first-child { margin-top: 0; }
      .faixa-mes span { color: #fff; font-family: var(--fonte-titulo); font-weight: var(--peso-forte);
        font-size: var(--fs-xl); text-shadow: 0 1px 3px rgba(0,0,0,.35); text-transform: capitalize; }

      .semana { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .06em;
        color: var(--cor-texto-fraco); font-weight: var(--peso-semi); padding: var(--esp-3) 0 var(--esp-1); }

      .dia-linha { display: grid; grid-template-columns: 56px 1fr; gap: var(--esp-3);
        padding: var(--esp-2) 0; border-top: 1px solid var(--cor-divisor); align-items: start; }
      .dia-col { text-align: center; padding-top: 2px; }
      .dia-col .wd { font-size: 10px; font-weight: var(--peso-semi); letter-spacing: .06em;
        color: var(--cor-texto-fraco); }
      .dia-col .dnum { font-size: var(--fs-xl); font-weight: var(--peso-forte); line-height: 1.1;
        width: 38px; height: 38px; margin: 2px auto 0; display: flex; align-items: center; justify-content: center;
        border-radius: 50%; }
      .dia-col.hoje .dnum { background: var(--cor-primaria); color: #fff; }
      .dia-col.hoje .wd { color: var(--cor-primaria); }

      .eventos { display: flex; flex-direction: column; gap: var(--esp-2); min-width: 0; }
      .barra { display: flex; align-items: center; gap: var(--esp-2); width: 100%; text-align: left;
        background: var(--c); color: #fff; border: none; border-radius: var(--raio-sm); cursor: pointer;
        padding: 0 var(--esp-3); min-height: 44px; font-size: var(--fs-md); }
      .barra:hover { filter: brightness(1.05); }
      .barra .hora { font-weight: var(--peso-forte); font-variant-numeric: tabular-nums; flex: none; opacity: .95; }
      .barra .tit { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      @media (max-width: 560px) {
        .dia-linha { grid-template-columns: 44px 1fr; gap: var(--esp-2); }
        .dia-col .dnum { width: 32px; height: 32px; font-size: var(--fs-lg); }
        .faixa-mes { height: 68px; }
        .faixa-mes span { font-size: var(--fs-lg); }
      }
    `;
  }

  _domingoDe(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  }

  _rotuloSemana(d) {
    const ini = this._domingoDe(d);
    const fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6);
    if (ini.getMonth() === fim.getMonth()) {
      return ini.getDate() + " – " + fim.getDate() + " de " + MESES_ABREV[fim.getMonth()];
    }
    return ini.getDate() + " de " + MESES_ABREV[ini.getMonth()] + " – " + fim.getDate() + " de " + MESES_ABREV[fim.getMonth()];
  }

  _diaLinha(d, evs) {
    const hoje = ymd(d) === ymd(new Date());
    const barras = evs.map((ev) => {
      const h = horaDe(ev);
      return `<button class="barra" data-id="${esc(ev.id)}" style="--c:${corEvento(ev.cor)}" title="${esc(ev.titulo)}">
        ${h ? `<span class="hora">${h}</span>` : ""}<span class="tit">${esc(ev.titulo)}</span>
      </button>`;
    }).join("");
    return `<div class="dia-linha">
      <div class="dia-col ${hoje ? "hoje" : ""}">
        <div class="wd">${DIAS_ABREV[d.getDay()]}</div>
        <div class="dnum">${d.getDate()}</div>
      </div>
      <div class="eventos">${barras}</div>
    </div>`;
  }

  template() {
    const cabecalho = `<div class="cab"><ui-button id="novo" tamanho="sm">+ Novo evento</ui-button></div>`;
    const porDia = this._porDia();
    const dias = Object.keys(porDia).sort((a, b) => a.localeCompare(b)); // ascendente
    if (!dias.length) {
      return cabecalho + `<p class="vazio">Nada registrado nesta obra ainda.</p>`;
    }
    let corpo = "";
    let mesAtual = null, semanaAtual = null;
    dias.forEach((k) => {
      const d = new Date(k + "T00:00:00");
      const chMes = d.getFullYear() + "-" + d.getMonth();
      if (chMes !== mesAtual) {
        corpo += `<div class="faixa-mes" style="--g:${GRADS[d.getMonth() % GRADS.length]}"><span>${MESES[d.getMonth()]} ${d.getFullYear()}</span></div>`;
        mesAtual = chMes;
        semanaAtual = ymd(this._domingoDe(d)); // 1ª semana do mês não repete cabeçalho
      } else {
        const chSem = ymd(this._domingoDe(d));
        if (chSem !== semanaAtual) {
          corpo += `<div class="semana">${this._rotuloSemana(d)}</div>`;
          semanaAtual = chSem;
        }
      }
      corpo += this._diaLinha(d, porDia[k]);
    });
    return cabecalho + `<div class="lista">${corpo}</div>`;
  }

  aposRender() {
    const novo = this.$("#novo");
    if (novo) novo.addEventListener("click", () => this.emitir("novo"));
    this.$$(".barra").forEach((b) =>
      b.addEventListener("click", () => this._abrir(b.dataset.id))
    );
  }

  _abrir(id) {
    const ev = (this.eventos || []).find((e) => String(e.id) === String(id));
    if (ev) this.emitir("evento-abrir", { evento: ev });
  }
}

customElements.define("agenda-lista", AgendaLista);
