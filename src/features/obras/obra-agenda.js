/**
 * <obra-agenda obra-id="…"> — Agenda da obra (Google Calendar) em formato de MESA.
 *
 * Mostra os eventos do Google Agenda do usuário vinculados a ESTA obra numa
 * planilha (`ui-data-table` dentro de um `ui-card mesa`, igual às demais abas) e
 * permite criar (via <agenda-evento-form>) e remover eventos (escopo
 * calendar.events, por usuário). Se a conta Google não estiver conectada, convida
 * a conectar no perfil. Busca ao vivo (não usa o cache do data-store).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { api } from "../../core/api-client.js";
import { irPara } from "../../core/router.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-data-table.js";
import "../../components/ui-spinner.js";
import "./agenda-evento-form.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Data/hora do evento em texto pt-BR (aceita "YYYY-MM-DD" de dia inteiro). */
function formatarQuando(inicio) {
  if (!inicio) return "";
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

/** Descrição sem o sufixo "Obra: … · via Dattaobra" (escapada; "—" se vazia). */
function descLimpa(v) {
  const s = String(v || "")
    .replace(/\n*\s*Obra:[^\n]*· via Dattaobra\s*$/, "")
    .trim();
  return s ? esc(s) : "—";
}

class ObraAgenda extends BaseElement {
  get obraId() {
    return this.getAttribute("obra-id");
  }

  estilos() {
    return `
      :host { display: block; }
      .conectar { display: flex; flex-direction: column; gap: var(--esp-3);
        align-items: flex-start; color: var(--cor-texto-suave); }
    `;
  }

  template() {
    if (this._estado === undefined) {
      return `<ui-spinner centro text="Carregando agenda..."></ui-spinner>`;
    }
    if (this._estado === "desconectado") {
      return `
        <ui-card title="Agenda da obra (Google Calendar)">
          <div class="conectar">
            <p>Conecte sua conta Google para ver e criar eventos da agenda desta obra
               (prazos, visitas técnicas, marcos).</p>
            <ui-button id="irPerfil">Conectar no meu perfil</ui-button>
          </div>
        </ui-card>`;
    }
    return `
      <ui-card mesa title="Mesa com a agenda da obra">
        <ui-button slot="acoes" id="novo">+ Novo evento</ui-button>
        <ui-data-table id="tab" fluido
          empty-text="Nenhum evento para esta obra ainda. Crie o primeiro em '+ Novo evento'."></ui-data-table>
      </ui-card>`;
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

    const tab = this.$("#tab");
    if (tab) {
      tab.columns = [
        { chave: "quando", titulo: "Quando", largura: "150px" },
        { chave: "titulo", titulo: "Evento", formato: (v) => esc(v) },
        { chave: "descricao", titulo: "Descrição", formato: (v) => descLimpa(v) },
      ];
      tab.acoes = [
        { nome: "editar", rotulo: "Editar" },
        { nome: "abrir", rotulo: "Abrir" },
        { nome: "remover", rotulo: "Remover", variant: "perigo" },
      ];
      tab.rows = (this._eventos || []).map((ev) => ({
        ...ev,
        quando: formatarQuando(ev.inicio),
      }));
      tab.addEventListener("acao", (e) => {
        const { acao, linha } = e.detail;
        if (acao === "editar") {
          this.abrirForm(linha);
        } else if (acao === "abrir") {
          if (linha.link) window.open(linha.link, "_blank", "noopener");
        } else if (acao === "remover") {
          this.remover(linha.id);
        }
      });
    }
  }

  /** Abre o form. Sem argumento = novo; com `evento` = editar (ou pré-preencher). */
  abrirForm(evento) {
    const form = document.createElement("agenda-evento-form");
    form.obra = dataStore.obra(this.obraId) || { id: this.obraId };
    if (evento) form.evento = evento;
    form.addEventListener("fechar", () => form.remove());
    form.addEventListener("salvo", () => this.carregar());
    document.body.appendChild(form);
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
