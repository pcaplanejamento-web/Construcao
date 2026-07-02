/**
 * <obra-agenda obra-id="…"> — Agenda da obra: um CENTRO DE TUDO. Agrega as
 * marcações datadas do app (despesas, transferências/pagamentos, notas, prazo —
 * de `marcacoes.js`) e FUNCIONA SEM Google. Se a conta Google estiver conectada,
 * também mostra os eventos avulsos do Google e permite criá-los/editá-los.
 * Duas vistas: **Calendário** (grade, `agenda-calendario`) e **Histórico**
 * (linha do tempo cronológica). Reage a `dataStore.subscribe`.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { api } from "../../core/api-client.js";
import { irPara } from "../../core/router.js";
import { toastSucesso, toastAviso, notificarErro } from "../../core/event-bus.js";
import { avisar } from "../../components/confirmar.js";
import { marcacoesDaObra, ROTULO_TIPO } from "./marcacoes.js";
import { sincronizarObraGoogle, syncAgendaLigada, googleConectado } from "./sync-agenda.js";
import { corEvento } from "./agenda-cores.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "./agenda-evento-form.js";
import "./agenda-calendario.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function diaLongo(dia) {
  const d = new Date(dia + "T00:00:00");
  return isNaN(d.getTime()) ? dia
    : d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

// Obras cujos eventos avulsos do Google já buscamos NESTA sessão (por carga de
// página). Enquanto a página viver, reentrar na aba Agenda usa só o cache — zero
// rede. Uma nova sessão (login/refresh) busca de novo; o botão "Sincronizar
// agora" e salvar um evento forçam atualização a qualquer momento.
const _googleBuscadoNaSessao = new Set();

class ObraAgenda extends BaseElement {
  constructor() {
    super();
    this._vista = "calendario";
    this._googleEventos = [];
  }

  get obraId() { return this.getAttribute("obra-id"); }
  get conectado() { return !!(this._google && this._google.conectado); }

  estilos() {
    return `
      :host { display: block; }
      .agenda-acoes { display: flex; align-items: center; gap: var(--esp-3); }
      .vistas { display: inline-flex; border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-sm); overflow: hidden; }
      .vista { height: 38px; padding: 0 var(--esp-4); background: var(--cor-superficie);
        border: none; color: var(--cor-texto-suave); cursor: pointer; font-weight: var(--peso-semi); }
      .vista.ativo { background: var(--cor-primaria); color: #fff; }
      .hint { font-size: var(--fs-sm); color: var(--cor-texto-suave); background: var(--cor-superficie-2);
        border: 1px solid var(--cor-borda); border-radius: var(--raio-md); padding: var(--esp-3);
        margin-bottom: var(--esp-4); }
      .hint a { color: var(--cor-primaria); font-weight: var(--peso-semi); cursor: pointer; }
      .historico { display: flex; flex-direction: column; gap: var(--esp-4); }
      .historico .vazio { color: var(--cor-texto-fraco); padding: var(--esp-4) 0; }
      .dia-cab { font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto-suave);
        text-transform: capitalize; padding-bottom: var(--esp-2); border-bottom: 1px solid var(--cor-divisor);
        margin-bottom: var(--esp-1); }
      .item { display: flex; align-items: center; gap: var(--esp-3); width: 100%; text-align: left;
        background: none; border: none; cursor: pointer; padding: var(--esp-2) var(--esp-2);
        min-height: 44px; color: var(--cor-texto); font-size: var(--fs-md); border-radius: var(--raio-sm); }
      .item:hover { background: var(--cor-superficie-2); }
      .item .pt { width: 11px; height: 11px; border-radius: 50%; flex: none; }
      .item .tipo { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .04em;
        color: var(--cor-texto-fraco); min-width: 104px; }
      .item .tit { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      @media (max-width: 560px) { .item { flex-wrap: wrap; } .item .tipo { min-width: 0; } }
    `;
  }

  template() {
    if (this._estado === undefined) {
      return `<ui-spinner centro text="Carregando agenda..."></ui-spinner>`;
    }
    return `
      <ui-card mesa title="Agenda da obra">
        <div slot="acoes" class="agenda-acoes">
          <div class="vistas">
            <button class="vista ${this._vista === "calendario" ? "ativo" : ""}" data-vista="calendario" type="button">Calendário</button>
            <button class="vista ${this._vista === "historico" ? "ativo" : ""}" data-vista="historico" type="button">Histórico</button>
          </div>
          ${this.conectado && syncAgendaLigada() ? `<ui-button id="sincronizar" variant="secundario" tamanho="sm">Sincronizar agora</ui-button>` : ""}
        </div>
        ${
          this.conectado
            ? ""
            : `<div class="hint">Conecte sua conta Google no <a id="irPerfil">perfil</a> para criar eventos e sincronizar com o Google Calendar. Este calendário já mostra despesas, transferências, notas e o prazo da obra — sem precisar de conexão.</div>`
        }
        <div id="corpo"></div>
      </ui-card>`;
  }

  aoConectar() {
    // CACHE-FIRST: estado da conexão vem do config (cache), eventos avulsos do
    // Google vêm do localStorage — a agenda aparece na hora, sem esperar rede.
    this._google = { conectado: googleConectado() };
    this._googleEventos = this._google.conectado ? this._lerCacheGoogle() : [];
    this._estado = "pronto";
    this.renderizar();
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
    // Em SEGUNDO PLANO, e só UMA vez por sessão por obra: atualiza os eventos
    // avulsos do Google. Reentrar na aba depois usa apenas o cache (sem rede).
    if (this._google.conectado && !_googleBuscadoNaSessao.has(this.obraId)) {
      _googleBuscadoNaSessao.add(this.obraId);
      this._atualizarGoogleEmBackground();
    }
  }

  /** Sincroniza (1×) e re-lista os eventos avulsos do Google, sem bloquear a UI. */
  async _atualizarGoogleEmBackground() {
    try {
      if (!this._jaSincronizou && syncAgendaLigada()) {
        this._jaSincronizou = true;
        try { await sincronizarObraGoogle(this.obraId); } catch (e) { /* best-effort */ }
      }
      await this._recarregarGoogle();
    } catch (e) {
      /* offline / sem conexão: mantém o que está no cache */
    }
  }

  /** Lista os eventos avulsos do Google, atualiza o cache local e repinta. */
  async _recarregarGoogle() {
    const r = await api.call("google.agenda.listar", { obraId: this.obraId });
    this._googleEventos = (r.eventos || [])
      .filter((ev) => !ev.sincronizado) // sincronizados já aparecem como marcação derivada
      .map((ev) => ({ ...ev, tipo: "evento", origem: "google" }));
    this._gravarCacheGoogle(this._googleEventos);
    this.pintar();
  }

  _chaveCache() { return "dattaobra.agenda.google." + this.obraId; }
  _lerCacheGoogle() {
    try { return JSON.parse(localStorage.getItem(this._chaveCache()) || "[]") || []; }
    catch (e) { return []; }
  }
  _gravarCacheGoogle(evs) {
    try { localStorage.setItem(this._chaveCache(), JSON.stringify(evs || [])); }
    catch (e) { /* storage indisponível */ }
  }

  /** Marcações internas (do app) + eventos avulsos do Google. */
  _todas() {
    return [...marcacoesDaObra(this.obraId), ...(this._googleEventos || [])];
  }

  aposRender() {
    const perfil = this.$("#irPerfil");
    if (perfil) perfil.addEventListener("click", () => irPara("/perfil"));
    const sinc = this.$("#sincronizar");
    if (sinc) sinc.addEventListener("click", () => this._sincronizarAgora());
    this.$$(".vista").forEach((b) =>
      b.addEventListener("click", () => {
        if (this._vista === b.dataset.vista) return;
        this._vista = b.dataset.vista;
        this.pintar(true);
        this.$$(".vista").forEach((x) => x.classList.toggle("ativo", x.dataset.vista === this._vista));
      })
    );
    this.pintar(true);
  }

  /** Preenche #corpo. `recriar` força reconstruir (troca de vista); senão reaproveita a grade. */
  pintar(recriar) {
    const corpo = this.$("#corpo");
    if (!corpo) return;
    if (this._vista === "calendario") {
      let cal = corpo.querySelector("agenda-calendario");
      if (!cal || recriar) {
        cal = document.createElement("agenda-calendario");
        cal.addEventListener("novo", () => this.abrirForm());
        cal.addEventListener("dia-novo", (e) => this.abrirForm({ inicio: e.detail.data + "T09:00" }));
        cal.addEventListener("evento-abrir", (e) => this._abrirMarcacao(e.detail.evento));
        corpo.replaceChildren(cal);
      }
      cal.eventos = this._todas();
    } else {
      corpo.replaceChildren(this._historicoEl());
    }
  }

  _historicoEl() {
    const div = document.createElement("div");
    div.className = "historico";
    const marc = this._todas().slice().sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
    if (!marc.length) {
      div.innerHTML = `<p class="vazio">Nada registrado nesta obra ainda.</p>`;
      return div;
    }
    const grupos = {};
    marc.forEach((m) => {
      const k = String(m.inicio).slice(0, 10);
      (grupos[k] = grupos[k] || []).push(m);
    });
    const dias = Object.keys(grupos).sort((a, b) => b.localeCompare(a));
    div.innerHTML = dias
      .map(
        (dia) => `<div class="dia">
          <div class="dia-cab">${esc(diaLongo(dia))}</div>
          ${grupos[dia]
            .map(
              (m) => `<button class="item" data-id="${esc(m.id)}">
                <span class="pt" style="background:${corEvento(m.cor)}"></span>
                <span class="tipo">${esc(ROTULO_TIPO[m.tipo] || "Evento")}</span>
                <span class="tit">${esc(m.titulo)}</span>
              </button>`
            )
            .join("")}
        </div>`
      )
      .join("");
    const byId = {};
    marc.forEach((m) => (byId[m.id] = m));
    div.querySelectorAll(".item").forEach((b) =>
      b.addEventListener("click", () => this._abrirMarcacao(byId[b.dataset.id]))
    );
    return div;
  }

  /** Google → editar; marcação derivada → info somente-leitura (gerida na aba de origem). */
  _abrirMarcacao(m) {
    if (!m) return;
    if (m.origem === "google") {
      this.abrirForm(m);
      return;
    }
    const quando = new Date(String(m.inicio).slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR");
    avisar({
      titulo: ROTULO_TIPO[m.tipo] || "Marcação",
      mensagem: m.titulo + "\n\n" + quando + "\n\nGerida na aba de origem desta obra.",
    });
  }

  async _sincronizarAgora() {
    const btn = this.$("#sincronizar");
    if (btn) btn.setAttribute("loading", "");
    try {
      const r = await sincronizarObraGoogle(this.obraId);
      toastSucesso(`Sincronizado com o Google (${r.criados} novos, ${r.atualizados} atualizados, ${r.removidos} removidos).`);
      await this._recarregarGoogle();
    } catch (e) {
      notificarErro(e);
    } finally {
      if (btn) btn.removeAttribute("loading");
    }
  }

  /** Cria/edita evento avulso no Google (exige conexão). */
  abrirForm(evento) {
    if (!this.conectado) {
      toastAviso("Conecte sua conta Google no perfil para criar eventos.");
      return;
    }
    const form = document.createElement("agenda-evento-form");
    form.obra = dataStore.obra(this.obraId) || { id: this.obraId };
    if (evento) form.evento = evento;
    form.addEventListener("fechar", () => form.remove());
    form.addEventListener("salvo", () => this._recarregarGoogle());
    document.body.appendChild(form);
  }
}

customElements.define("obra-agenda", ObraAgenda);
