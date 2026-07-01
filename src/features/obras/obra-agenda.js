/**
 * <obra-agenda obra-id="…"> — Agenda da obra (Google Calendar).
 *
 * Mostra os eventos do Google Agenda do usuário vinculados a ESTA obra e permite
 * criar/remover eventos (escopo calendar.events, por usuário). Se a conta Google
 * não estiver conectada, convida a conectar no perfil. Busca ao vivo (não usa o
 * cache do data-store); espelha o padrão de <obra-participantes>.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { api } from "../../core/api-client.js";
import { irPara } from "../../core/router.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-button.js";
import "../../components/ui-icon.js";
import "../../components/ui-input.js";
import "../../components/ui-modal.js";
import "../../components/ui-spinner.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

class ObraAgenda extends BaseElement {
  get obraId() {
    return this.getAttribute("obra-id");
  }

  estilos() {
    return `
      :host { display: block; }
      .barra { display: flex; justify-content: flex-end; margin-bottom: var(--esp-4); }
      .vazio { color: var(--cor-texto-suave); font-size: var(--fs-sm); padding: var(--esp-4) 0; }
      .conectar { display: flex; flex-direction: column; gap: var(--esp-3);
        align-items: flex-start; color: var(--cor-texto-suave); }
      .lista { display: flex; flex-direction: column; gap: var(--esp-3); }
      .evento { display: flex; gap: var(--esp-4); align-items: flex-start;
        background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-md); padding: var(--esp-3) var(--esp-4); }
      .evento .quando { min-width: 132px; color: var(--cor-info); font-weight: var(--peso-semi);
        font-size: var(--fs-sm); display: flex; gap: 6px; align-items: center; }
      .evento .corpo { flex: 1; min-width: 0; }
      .evento .titulo { font-weight: var(--peso-semi); }
      .evento .desc { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        margin-top: 2px; white-space: pre-wrap; }
      .evento .acoes { display: flex; align-items: center; gap: var(--esp-3); }
      .evento .abrir { color: var(--cor-primaria); font-size: var(--fs-sm); font-weight: var(--peso-semi); }
      .evento .rm { background: none; border: 0; cursor: pointer; color: var(--cor-texto-fraco);
        font-size: 1.3rem; line-height: 1; padding: 4px 8px; border-radius: var(--raio-sm); }
      .evento .rm:hover { color: var(--cor-erro); background: var(--cor-erro-suave); }
      @media (max-width: 560px) {
        .evento { flex-direction: column; gap: var(--esp-2); }
        .evento .acoes { align-self: flex-end; }
      }
      /* Formulário no modal */
      .form { display: flex; flex-direction: column; gap: var(--esp-4); }
      .campo { display: flex; flex-direction: column; gap: 6px; }
      .campo > span { font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto-suave); }
      .campo input[type="datetime-local"] {
        width: 100%; height: 44px; box-sizing: border-box; font-family: inherit;
        font-size: var(--fs-md); color: var(--cor-texto); background: var(--cor-superficie);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-md);
        padding: 0 var(--esp-3); }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm);
        background: var(--cor-erro-suave); padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); }
    `;
  }

  template() {
    if (this._estado === undefined) {
      return `<ui-spinner centro text="Carregando agenda..."></ui-spinner>`;
    }
    if (this._estado === "desconectado") {
      return `
        <div class="conectar">
          <p>Conecte sua conta Google para ver e criar eventos da agenda desta obra
             (prazos, visitas técnicas, marcos).</p>
          <ui-button id="irPerfil">Conectar no meu perfil</ui-button>
        </div>`;
    }
    const eventos = this._eventos || [];
    const linhas = eventos.map((ev) => this.linhaEvento(ev)).join("");
    return `
      <div class="barra"><ui-button id="novo">+ Novo evento</ui-button></div>
      ${
        eventos.length
          ? `<div class="lista">${linhas}</div>`
          : `<p class="vazio">Nenhum evento para esta obra ainda. Crie o primeiro em "Novo evento".</p>`
      }
      <ui-modal id="modal" title="Novo evento na agenda">
        <div class="form">
          <div class="erro" id="fErro" hidden></div>
          <ui-input id="fTitulo" label="Título" placeholder="Ex.: Visita técnica"></ui-input>
          <label class="campo"><span>Início</span><input id="fInicio" type="datetime-local" /></label>
          <label class="campo"><span>Fim (opcional — padrão: +1h)</span><input id="fFim" type="datetime-local" /></label>
          <ui-input id="fDesc" label="Descrição (opcional)"></ui-input>
        </div>
        <div slot="rodape">
          <ui-button id="fCancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="fSalvar">Criar evento</ui-button>
        </div>
      </ui-modal>`;
  }

  linhaEvento(ev) {
    return `
      <div class="evento">
        <div class="quando"><ui-icon name="relogio" size="15"></ui-icon>${esc(this.formatarQuando(ev.inicio))}</div>
        <div class="corpo">
          <div class="titulo">${esc(ev.titulo)}</div>
          ${ev.descricao ? `<div class="desc">${esc(ev.descricao)}</div>` : ""}
        </div>
        <div class="acoes">
          ${ev.link ? `<a class="abrir" href="${esc(ev.link)}" target="_blank" rel="noopener">Abrir</a>` : ""}
          <button class="rm" data-id="${esc(ev.id)}" aria-label="Remover evento">&times;</button>
        </div>
      </div>`;
  }

  formatarQuando(inicio) {
    if (!inicio) return "";
    // Data só (evento de dia inteiro) vem "YYYY-MM-DD".
    if (/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
      const d = new Date(inicio + "T00:00:00");
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    }
    const d = new Date(inicio);
    if (isNaN(d.getTime())) return inicio;
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  aoConectar() {
    this.carregar();
  }

  async carregar() {
    try {
      const st = await api.call("google.status");
      if (st && st.conectado) {
        const r = await api.call("google.agenda.listar", { obraId: this.obraId });
        this._eventos = r.eventos || [];
        this._estado = "conectado";
      } else {
        this._estado = "desconectado";
      }
    } catch (e) {
      this._estado = "desconectado";
    }
    this.renderizar();
  }

  aposRender() {
    const perfil = this.$("#irPerfil");
    if (perfil) perfil.addEventListener("click", () => irPara("/perfil"));
    const novo = this.$("#novo");
    if (novo) novo.addEventListener("click", () => this.abrirForm());
    const modal = this.$("#modal");
    if (modal) {
      modal.addEventListener("fechar", () => modal.removeAttribute("open"));
      this.$("#fCancelar").addEventListener("click", () => modal.removeAttribute("open"));
      this.$("#fSalvar").addEventListener("click", () => this.salvar());
    }
    this.$$(".evento .rm").forEach((b) =>
      b.addEventListener("click", () => this.remover(b.dataset.id))
    );
  }

  abrirForm() {
    this.$("#fErro").hidden = true;
    this.$("#fTitulo").value = "";
    this.$("#fInicio").value = "";
    this.$("#fFim").value = "";
    this.$("#fDesc").value = "";
    this.$("#modal").setAttribute("open", "");
  }

  async salvar() {
    const titulo = this.$("#fTitulo").value.trim();
    const inicio = this.$("#fInicio").value;
    const fim = this.$("#fFim").value;
    const descricao = this.$("#fDesc").value.trim();
    if (!titulo || !inicio) {
      const el = this.$("#fErro");
      el.textContent = "Informe ao menos o título e o início.";
      el.hidden = false;
      return;
    }
    const obra = dataStore.obra(this.obraId) || {};
    const btn = this.$("#fSalvar");
    btn.setAttribute("loading", "");
    try {
      await api.call("google.agenda.criar", {
        obraId: this.obraId,
        obraNome: obra.nome || "",
        titulo, inicio, fim, descricao,
      });
      toastSucesso("Evento criado no Google Agenda.");
      this.$("#modal").removeAttribute("open");
      await this.carregar();
    } catch (e) {
      const el = this.$("#fErro");
      el.textContent = e.message || "Não foi possível criar o evento.";
      el.hidden = false;
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }

  async remover(eventoId) {
    const ok = await confirmar({
      titulo: "Remover evento",
      mensagem: "Remover este evento do seu Google Agenda?",
      perigo: true,
      rotuloOk: "Remover",
    });
    if (!ok) return;
    try {
      await api.call("google.agenda.remover", { eventoId });
      toastSucesso("Evento removido.");
      await this.carregar();
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("obra-agenda", ObraAgenda);
