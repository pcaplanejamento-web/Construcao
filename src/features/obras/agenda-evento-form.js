/**
 * <agenda-evento-form> — Modal para criar um evento na agenda (Google Calendar)
 * vinculado a uma obra. Auto-contido: chama `google.agenda.criar` e emite
 * "salvo"/"fechar". Espelha o padrão de tipo-transf-form.
 *
 * Propriedade: .obra ({ id, nome })
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class AgendaEventoForm extends BaseElement {
  set obra(v) {
    this._obra = v || {};
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get obra() {
    return this._obra || {};
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .campo { display: flex; flex-direction: column; gap: 6px; }
      .campo > span { font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto-suave); }
      .campo input[type="datetime-local"] {
        width: 100%; height: 46px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-md);
        color: var(--cor-texto); background: var(--cor-superficie);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-md); padding: 0 var(--esp-3); }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm); background: var(--cor-erro-suave);
        padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); }
    `;
  }

  template() {
    return `
      <ui-modal open title="Novo evento na agenda">
        <div class="campos">
          <div class="erro" id="erro" hidden></div>
          <ui-input id="titulo" label="Título" placeholder="Ex.: Visita técnica"></ui-input>
          <label class="campo"><span>Início</span><input id="inicio" type="datetime-local" /></label>
          <label class="campo"><span>Fim (opcional — padrão: +1h)</span><input id="fim" type="datetime-local" /></label>
          <ui-input id="descricao" label="Descrição (opcional)"></ui-input>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">Criar evento</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const titulo = this.$("#titulo").value.trim();
    const inicio = this.$("#inicio").value;
    const fim = this.$("#fim").value;
    const descricao = this.$("#descricao").value.trim();
    if (!titulo || !inicio) {
      return this.mostrarErro("Informe ao menos o título e o início.");
    }
    this.mostrarErro("");
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      await api.call("google.agenda.criar", {
        obraId: this.obra.id,
        obraNome: this.obra.nome || "",
        titulo, inicio, fim, descricao,
      });
      toastSucesso("Evento criado no Google Agenda.");
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      this.mostrarErro(e.message || "Não foi possível criar o evento.");
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
