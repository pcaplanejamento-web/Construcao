/**
 * <nota-form> — Modal para criar/editar uma nota da obra. Auto-contido: chama
 * dataStore.adicionarNota/atualizarNota e emite "salvo"/"fechar". Espelha o
 * padrão de tipo-transf-form.
 *
 * Propriedades: .obraId (string), .nota ({...} para editar)
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

class NotaForm extends BaseElement {
  set obraId(v) { this._obraId = v; }
  get obraId() { return this._obraId; }
  set nota(v) { this._nota = v || null; if (this.shadowRoot.childElementCount) this.renderizar(); }
  get nota() { return this._nota || null; }
  get ehEdicao() { return !!(this.nota && this.nota.id); }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .campo { display: flex; flex-direction: column; gap: 6px; }
      .campo > span { font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto-suave); }
      textarea { width: 100%; min-height: 160px; box-sizing: border-box; font-family: inherit;
        font-size: var(--fs-md); color: var(--cor-texto); background: var(--cor-superficie);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-md); padding: var(--esp-3);
        resize: vertical; line-height: 1.5; }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm); background: var(--cor-erro-suave);
        padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); }
    `;
  }

  template() {
    const n = this.nota || {};
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar nota" : "Nova nota"}">
        <div class="campos">
          <div class="erro" id="erro" hidden></div>
          <ui-input id="titulo" label="Título" placeholder="Ex.: Pendências da semana" value="${(n.titulo || "").replace(/"/g, "&quot;")}"></ui-input>
          <label class="campo"><span>Nota</span><textarea id="texto" placeholder="Escreva a anotação...">${esc(n.texto)}</textarea></label>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar nota"}</ui-button>
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
    const texto = this.$("#texto").value.trim();
    if (!titulo && !texto) return this.mostrarErro("Escreva um título ou um texto.");
    this.mostrarErro("");
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarNota(this.obraId, this.nota.id, { titulo, texto });
        toastSucesso("Nota atualizada.");
      } else {
        await dataStore.adicionarNota(this.obraId, { titulo, texto });
        toastSucesso("Nota criada.");
      }
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      this.mostrarErro(e.message || "Não foi possível salvar a nota.");
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

customElements.define("nota-form", NotaForm);
