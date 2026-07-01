/**
 * <agenda-calendario> — Grade visual do calendário (Mês/Semana), imitando o
 * Google Calendar. Componente PURO de UI: recebe `.eventos` (mapeados do backend)
 * e emite:
 *   - "novo"          → criar evento em branco (botão do cabeçalho)
 *   - "dia-novo" {data:"YYYY-MM-DD"} → criar evento naquele dia
 *   - "evento-abrir" {evento}        → abrir/editar um evento
 * Não toca em rede. Reusa as cores do Google (agenda-cores.js) e os tokens.
 * Responsivo: no mobile o Mês compacta (pontos + painel do dia) e a Semana empilha.
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

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho",
  "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

class AgendaCalendario extends BaseElement {
  constructor() {
    super();
    this._view = "mes";
    this._ref = new Date();
    this._diaSel = null;
  }

  set eventos(v) { this._eventos = v || []; if (this.shadowRoot.childElementCount) this.renderizar(); }
  get eventos() { return this._eventos || []; }

  /** Eventos agrupados por dia de início (YYYY-MM-DD), ordenados por hora. */
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
      .cab { display: flex; align-items: center; gap: var(--esp-3); flex-wrap: wrap;
        margin-bottom: var(--esp-4); }
      .titulo { font-size: var(--fs-lg); font-weight: var(--peso-forte); text-transform: capitalize;
        min-width: 160px; }
      .nav { display: flex; align-items: center; gap: var(--esp-1); }
      .ic { width: 36px; height: 36px; border: 1px solid var(--cor-borda-forte);
        background: var(--cor-superficie); border-radius: var(--raio-sm); font-size: 1.2rem;
        color: var(--cor-texto); cursor: pointer; }
      .ic:hover { background: var(--cor-superficie-2); }
      .hoje { height: 36px; padding: 0 var(--esp-3); border: 1px solid var(--cor-borda-forte);
        background: var(--cor-superficie); border-radius: var(--raio-sm); color: var(--cor-texto);
        font-weight: var(--peso-semi); cursor: pointer; }
      .modos { display: inline-flex; border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-sm); overflow: hidden; }
      .modo { height: 36px; padding: 0 var(--esp-4); background: var(--cor-superficie);
        border: none; color: var(--cor-texto-suave); cursor: pointer; font-weight: var(--peso-semi); }
      .modo.ativo { background: var(--cor-primaria); color: #fff; }
      .cab ui-button { margin-left: auto; }

      /* ---- Mês ---- */
      .grade-cab { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
      .wd { text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
        color: var(--cor-texto-fraco); font-weight: var(--peso-semi); padding: 4px 0; }
      .grade { display: grid; grid-template-columns: repeat(7, 1fr);
        grid-auto-rows: minmax(96px, 1fr); gap: 4px; }
      .cel { border: 1px solid var(--cor-borda); border-radius: var(--raio-sm);
        background: var(--cor-superficie); padding: 4px; overflow: hidden; cursor: pointer;
        display: flex; flex-direction: column; gap: 3px; min-height: 96px; }
      .cel:hover { border-color: var(--cor-borda-forte); }
      .cel.fora { background: var(--cor-mesa); }
      .cel.fora .num { color: var(--cor-texto-fraco); }
      .cel.sel { border-color: var(--cor-primaria); box-shadow: 0 0 0 1px var(--cor-primaria) inset; }
      .num { font-size: var(--fs-sm); font-weight: var(--peso-semi); align-self: flex-start;
        width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
        border-radius: 50%; }
      .cel.hoje .num { background: var(--cor-primaria); color: #fff; }
      .chips { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .chip { display: block; width: 100%; text-align: left; border: none; cursor: pointer;
        background: var(--c); color: #fff; border-radius: 4px; padding: 1px 5px; font-size: 11px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .chip b { font-weight: var(--peso-forte); }
      .mais { font-size: 10px; color: var(--cor-texto-suave); font-weight: var(--peso-semi); padding-left: 2px; }

      /* Painel do dia selecionado (mês) */
      .painel { margin-top: var(--esp-4); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-md); background: var(--cor-superficie); padding: var(--esp-3) var(--esp-4); }
      .painel-cab { display: flex; align-items: center; justify-content: space-between; gap: var(--esp-3);
        margin-bottom: var(--esp-2); }
      .painel-cab span { font-weight: var(--peso-semi); text-transform: capitalize; }
      .linha-ev { display: flex; align-items: center; gap: var(--esp-2); width: 100%; text-align: left;
        background: none; border: none; cursor: pointer; padding: var(--esp-2) 0; min-height: 44px;
        border-top: 1px solid var(--cor-divisor); color: var(--cor-texto); font-size: var(--fs-md); }
      .linha-ev .pt { width: 10px; height: 10px; border-radius: 50%; flex: none; }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); padding: var(--esp-2) 0; }

      /* ---- Semana ---- */
      .semana { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .col { border: 1px solid var(--cor-borda); border-radius: var(--raio-sm);
        background: var(--cor-superficie); min-height: 260px; cursor: pointer;
        display: flex; flex-direction: column; }
      .col.hoje { border-color: var(--cor-primaria); }
      .col-cab { text-align: center; padding: 6px 0; border-bottom: 1px solid var(--cor-divisor); }
      .col-cab .wd { display: block; }
      .col-cab .dnum { font-size: var(--fs-lg); font-weight: var(--peso-forte); }
      .col.hoje .col-cab .dnum { color: var(--cor-primaria); }
      .col-ev { display: flex; flex-direction: column; gap: 3px; padding: 4px; }
      .vazio-col { color: var(--cor-texto-fraco); text-align: center; font-size: var(--fs-sm); padding: var(--esp-2); }

      /* ---- Mobile ---- */
      @media (max-width: 700px) {
        .semana { grid-template-columns: 1fr; }
        .col { min-height: auto; }
        .col-cab { text-align: left; padding: var(--esp-2) var(--esp-3); }
        .col-cab .wd { display: inline; }
        .col-cab .dnum { margin-left: 6px; }
      }
      @media (max-width: 600px) {
        .cab ui-button { margin-left: 0; width: 100%; }
        .grade { grid-auto-rows: minmax(56px, 1fr); }
        .cel { min-height: 56px; padding: 2px; }
        .num { width: 22px; height: 22px; font-size: var(--fs-xs); }
        /* eventos viram PONTOS coloridos (o painel do dia mostra os detalhes ao tocar). */
        .chips { flex-direction: row; flex-wrap: wrap; gap: 3px; }
        .chip { width: 8px; height: 8px; padding: 0; border-radius: 50%; font-size: 0; overflow: visible; }
        .mais { font-size: 9px; }
      }
    `;
  }

  _tituloPeriodo() {
    const r = this._ref;
    if (this._view === "mes") return MESES[r.getMonth()] + " " + r.getFullYear();
    const ini = new Date(r.getFullYear(), r.getMonth(), r.getDate() - r.getDay());
    const fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6);
    const mesIni = MESES[ini.getMonth()].slice(0, 3).toLowerCase();
    const mesFim = MESES[fim.getMonth()].slice(0, 3).toLowerCase();
    return ini.getDate() + " " + mesIni + " – " + fim.getDate() + " " + mesFim + " " + fim.getFullYear();
  }

  _chip(ev) {
    const h = horaDe(ev);
    return `<button class="chip" data-id="${esc(ev.id)}" style="--c:${corEvento(ev.cor)}" title="${esc(ev.titulo)}">${h ? "<b>" + h + "</b> " : ""}${esc(ev.titulo)}</button>`;
  }

  _mesHtml() {
    const ref = this._ref, ano = ref.getFullYear(), mes = ref.getMonth();
    const primeiro = new Date(ano, mes, 1);
    const inicio = new Date(ano, mes, 1 - primeiro.getDay());
    const porDia = this._porDia(), hoje = ymd(new Date());
    let celulas = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const k = ymd(d), doMes = d.getMonth() === mes, evs = porDia[k] || [];
      const chips = evs.slice(0, 3).map((ev) => this._chip(ev)).join("");
      const mais = evs.length > 3 ? `<span class="mais">+${evs.length - 3}</span>` : "";
      celulas += `<div class="cel ${doMes ? "" : "fora"} ${k === hoje ? "hoje" : ""} ${k === this._diaSel ? "sel" : ""}" data-ymd="${k}">
        <div class="num">${d.getDate()}</div>
        <div class="chips">${chips}${mais}</div>
      </div>`;
    }
    const cabDias = DIAS.map((d) => `<div class="wd">${d}</div>`).join("");
    return `<div class="grade-cab">${cabDias}</div><div class="grade">${celulas}</div>${this._painelDia()}`;
  }

  _painelDia() {
    if (!this._diaSel) return "";
    const evs = this._porDia()[this._diaSel] || [];
    const d = new Date(this._diaSel + "T00:00:00");
    const rotulo = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const linhas = evs.length
      ? evs.map((ev) =>
          `<button class="linha-ev" data-id="${esc(ev.id)}"><span class="pt" style="background:${corEvento(ev.cor)}"></span>${horaDe(ev) ? "<b>" + horaDe(ev) + "</b>&nbsp;" : ""}${esc(ev.titulo)}</button>`
        ).join("")
      : `<p class="vazio">Nenhum evento neste dia.</p>`;
    return `<div class="painel"><div class="painel-cab"><span>${rotulo}</span><ui-button id="novoDia" tamanho="sm">+ Novo evento</ui-button></div>${linhas}</div>`;
  }

  _semanaHtml() {
    const ref = this._ref;
    const inicio = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ref.getDay());
    const porDia = this._porDia(), hoje = ymd(new Date());
    let cols = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const k = ymd(d), evs = porDia[k] || [];
      const chips = evs.length ? evs.map((ev) => this._chip(ev)).join("") : `<p class="vazio-col">—</p>`;
      cols += `<div class="col ${k === hoje ? "hoje" : ""}" data-ymd="${k}">
        <div class="col-cab"><span class="wd">${DIAS[d.getDay()]}</span><span class="dnum">${d.getDate()}</span></div>
        <div class="col-ev">${chips}</div>
      </div>`;
    }
    return `<div class="semana">${cols}</div>`;
  }

  template() {
    return `
      <div class="cab">
        <div class="titulo">${this._tituloPeriodo()}</div>
        <div class="nav">
          <button class="ic" id="prev" aria-label="Anterior">‹</button>
          <button class="hoje" id="hoje">Hoje</button>
          <button class="ic" id="next" aria-label="Próximo">›</button>
        </div>
        <div class="modos">
          <button class="modo ${this._view === "mes" ? "ativo" : ""}" data-modo="mes">Mês</button>
          <button class="modo ${this._view === "semana" ? "ativo" : ""}" data-modo="semana">Semana</button>
        </div>
        <ui-button id="novo">+ Novo evento</ui-button>
      </div>
      ${this._view === "mes" ? this._mesHtml() : this._semanaHtml()}
    `;
  }

  aposRender() {
    this.$("#prev").addEventListener("click", () => this._navegar(-1));
    this.$("#next").addEventListener("click", () => this._navegar(1));
    this.$("#hoje").addEventListener("click", () => { this._ref = new Date(); this.renderizar(); });
    this.$$(".modo").forEach((b) =>
      b.addEventListener("click", () => { this._view = b.dataset.modo; this._diaSel = null; this.renderizar(); })
    );
    this.$("#novo").addEventListener("click", () => this.emitir("novo"));

    // Chips (mês + semana) → abrir/editar evento.
    this.$$(".chip").forEach((c) =>
      c.addEventListener("click", (e) => { e.stopPropagation(); this._abrirEvento(c.dataset.id); })
    );

    if (this._view === "mes") {
      // Clique numa célula (fora do chip) → seleciona o dia (mostra o painel).
      this.$$(".cel").forEach((cel) =>
        cel.addEventListener("click", () => { this._diaSel = cel.dataset.ymd; this.renderizar(); })
      );
      const novoDia = this.$("#novoDia");
      if (novoDia) novoDia.addEventListener("click", () => this.emitir("dia-novo", { data: this._diaSel }));
      this.$$(".linha-ev").forEach((l) =>
        l.addEventListener("click", () => this._abrirEvento(l.dataset.id))
      );
    } else {
      // Semana: clique na coluna (fora do chip) → novo evento naquele dia.
      this.$$(".col").forEach((col) =>
        col.addEventListener("click", () => this.emitir("dia-novo", { data: col.dataset.ymd }))
      );
    }
  }

  _navegar(sinal) {
    const r = this._ref;
    if (this._view === "mes") this._ref = new Date(r.getFullYear(), r.getMonth() + sinal, 1);
    else this._ref = new Date(r.getFullYear(), r.getMonth(), r.getDate() + 7 * sinal);
    this.renderizar();
  }

  _abrirEvento(id) {
    const ev = (this.eventos || []).find((e) => String(e.id) === String(id));
    if (ev) this.emitir("evento-abrir", { evento: ev });
  }
}

customElements.define("agenda-calendario", AgendaCalendario);
