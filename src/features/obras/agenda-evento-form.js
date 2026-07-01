/**
 * <agenda-evento-form> — Modal para CRIAR ou EDITAR um evento da agenda (Google
 * Calendar) vinculado a uma obra, com todos os campos do Google Calendar:
 * dia inteiro, recorrência, lembrete, convidados, local, cor e descrição.
 * Auto-contido: chama `google.agenda.criar`/`google.agenda.atualizar` e emite
 * "salvo"/"fechar". Espelha o padrão de tipo-transf-form.
 *
 * Propriedades:
 *   .obra   ({ id, nome })
 *   .evento ({...}) — para EDITAR (tem id) ou pré-preencher a criação (ex.: só inicio)
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import { CORES_EVENTO, CORES_NOMES, IDS_COR } from "./agenda-cores.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Valor do evento para o input (date "YYYY-MM-DD" ou datetime-local "…THH:MM"). */
function fmtParaInput(v, diaInteiro) {
  const s = String(v || "");
  if (!s) return "";
  return diaInteiro ? s.slice(0, 10) : s.slice(0, 16);
}

/** Descrição sem o sufixo "Obra: … · via Dattaobra" (o backend o re-adiciona). */
function descSemSufixo(v) {
  return String(v || "").replace(/\n*\s*Obra:[^\n]*· via Dattaobra\s*$/, "").trim();
}

class AgendaEventoForm extends BaseElement {
  set obra(v) { this._obra = v || {}; }
  get obra() { return this._obra || {}; }
  set evento(v) { this._evento = v || null; if (this.shadowRoot.childElementCount) this.renderizar(); }
  get evento() { return this._evento || null; }
  get ehEdicao() { return !!(this.evento && this.evento.id); }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .campo { display: flex; flex-direction: column; gap: 6px; }
      .campo > span { font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto-suave); }
      .linha { display: grid; grid-template-columns: 1fr 1fr; gap: var(--esp-3); }
      @media (max-width: 480px) { .linha { grid-template-columns: 1fr; } }
      .campo input[type="date"], .campo input[type="datetime-local"] {
        width: 100%; height: 46px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-md);
        color: var(--cor-texto); background: var(--cor-superficie);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-md); padding: 0 var(--esp-3); }
      .check { display: flex; align-items: center; gap: 10px; font-size: var(--fs-md);
        color: var(--cor-texto); cursor: pointer; user-select: none; }
      .check input { width: 20px; height: 20px; accent-color: var(--cor-primaria); }
      .cores { display: flex; flex-wrap: wrap; gap: 10px; }
      .cor { width: 30px; height: 30px; border-radius: 50%; border: 2px solid transparent;
        cursor: pointer; padding: 0; }
      .cor.sel { border-color: var(--cor-texto); box-shadow: 0 0 0 2px var(--cor-superficie) inset; }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm); background: var(--cor-erro-suave);
        padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); }
      #excluir { margin-right: auto; }
    `;
  }

  template() {
    const e = this.evento || {};
    const di = !!e.diaInteiro;
    const tipo = di ? "date" : "datetime-local";
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar evento" : "Novo evento na agenda"}">
        <div class="campos">
          <div class="erro" id="erro" hidden></div>
          <ui-input id="titulo" label="Título" placeholder="Ex.: Visita técnica" value="${esc(e.titulo)}"></ui-input>
          <label class="check"><input type="checkbox" id="diaInteiro" ${di ? "checked" : ""}/> Dia inteiro</label>
          <div class="linha">
            <label class="campo"><span>Início</span><input id="inicio" type="${tipo}" value="${fmtParaInput(e.inicio, di)}"/></label>
            <label class="campo"><span>Fim</span><input id="fim" type="${tipo}" value="${fmtParaInput(e.fim, di)}"/></label>
          </div>
          <ui-select id="repetir" label="Repetir"></ui-select>
          <ui-select id="lembrete" label="Lembrete"></ui-select>
          <ui-input id="local" label="Local (opcional)" value="${esc(e.local)}"></ui-input>
          <ui-input id="convidados" label="Convidados (e-mails separados por vírgula)" value="${esc((e.convidados || []).join(", "))}"></ui-input>
          <div class="campo"><span>Cor</span><div class="cores" id="cores"></div></div>
          <ui-input id="descricao" label="Descrição (opcional)" value="${esc(descSemSufixo(e.descricao))}"></ui-input>
        </div>
        <div slot="rodape">
          ${this.ehEdicao ? `<ui-button id="excluir" variant="perigo-contorno">Excluir</ui-button>` : ""}
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar evento"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    const e = this.evento || {};
    this._cor = e.cor || "";

    const repetir = this.$("#repetir");
    repetir.options = [
      { value: "", label: "Não repete" },
      { value: "DAILY", label: "Diariamente" },
      { value: "WEEKLY", label: "Semanalmente" },
      { value: "MONTHLY", label: "Mensalmente" },
      { value: "YEARLY", label: "Anualmente" },
    ];
    repetir.value = e.recorrencia || "";

    const lembrete = this.$("#lembrete");
    lembrete.options = [
      { value: "", label: "Nenhum" },
      { value: "10", label: "10 minutos antes" },
      { value: "30", label: "30 minutos antes" },
      { value: "60", label: "1 hora antes" },
      { value: "1440", label: "1 dia antes" },
    ];
    lembrete.value = e.lembreteMin ? String(e.lembreteMin) : "";

    this.pintarCores();
    this.$("#diaInteiro").addEventListener("change", () => this.alternarDiaInteiro());
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
    const excluir = this.$("#excluir");
    if (excluir) excluir.addEventListener("click", () => this.excluir());
  }

  async excluir() {
    const ok = await confirmar({
      titulo: "Remover evento",
      mensagem: "Remover este evento do seu Google Agenda?",
      perigo: true,
      rotuloOk: "Remover",
    });
    if (!ok) return;
    try {
      await api.call("google.agenda.remover", { eventoId: this.evento.id });
      toastSucesso("Evento removido.");
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    }
  }

  pintarCores() {
    const box = this.$("#cores");
    const chip = (id, hex, nome) =>
      `<button type="button" class="cor ${String(this._cor) === String(id) ? "sel" : ""}" data-cor="${id}" title="${nome}" style="background:${hex}"></button>`;
    box.innerHTML =
      chip("", CORES_EVENTO[""], "Padrão") +
      IDS_COR.map((id) => chip(id, CORES_EVENTO[id], CORES_NOMES[id])).join("");
    box.querySelectorAll(".cor").forEach((b) =>
      b.addEventListener("click", () => {
        this._cor = b.dataset.cor;
        this.pintarCores();
      })
    );
  }

  /** Alterna os inputs início/fim entre date (dia inteiro) e datetime-local. */
  alternarDiaInteiro() {
    const di = this.$("#diaInteiro").checked;
    ["inicio", "fim"].forEach((id) => {
      const inp = this.$("#" + id);
      const val = inp.value;
      if (di) {
        inp.type = "date";
        inp.value = (val || "").slice(0, 10);
      } else {
        inp.type = "datetime-local";
        inp.value = val ? val.slice(0, 10) + "T09:00" : "";
      }
    });
  }

  async salvar() {
    const titulo = this.$("#titulo").value.trim();
    const diaInteiro = this.$("#diaInteiro").checked;
    const inicio = this.$("#inicio").value;
    const fim = this.$("#fim").value;
    if (!titulo || !inicio) {
      return this.mostrarErro("Informe ao menos o título e o início.");
    }
    this.mostrarErro("");
    const dados = {
      obraId: this.obra.id,
      obraNome: this.obra.nome || "",
      titulo, diaInteiro, inicio, fim,
      local: this.$("#local").value.trim(),
      descricao: this.$("#descricao").value.trim(),
      recorrencia: this.$("#repetir").value,
      lembreteMin: Number(this.$("#lembrete").value) || 0,
      cor: this._cor || "",
      convidados: this.$("#convidados").value.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await api.call("google.agenda.atualizar", { eventoId: this.evento.id, ...dados });
        toastSucesso("Evento atualizado.");
      } else {
        await api.call("google.agenda.criar", dados);
        toastSucesso("Evento criado no Google Agenda.");
      }
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      this.mostrarErro(e.message || "Não foi possível salvar o evento.");
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }

  mostrarErro(msg) {
    const el = this.$("#erro");
    el.textContent = msg;
    el.hidden = !msg;
  }
}

customElements.define("agenda-evento-form", AgendaEventoForm);
