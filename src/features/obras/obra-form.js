/**
 * <obra-form> — Formulário (em modal) para criar/editar obra.
 *
 * Propriedade: .obra (objeto para edição; ausente/null = nova obra)
 * Eventos: "salvo" ({ obra }), "fechar".
 * Auto-contido: faz a chamada à API e emite EVENTOS.OBRAS para a lista atualizar.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class ObraForm extends BaseElement {
  set obra(v) {
    this._obra = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get obra() {
    return this._obra || null;
  }

  get ehEdicao() {
    return !!(this.obra && this.obra.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
      label.tx { font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); display: block; }
      textarea { width: 100%; min-height: 70px; padding: var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        font-family: inherit; resize: vertical; }
      textarea:focus { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
    `;
  }

  template() {
    const o = this.obra || {};
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar obra" : "Nova obra"}">
        <div class="campos">
          <ui-input id="nome" label="Nome da obra" value="${(o.nome || "").replace(
            /"/g,
            "&quot;"
          )}" placeholder="Ex.: Casa Vila Mariana"></ui-input>
          <ui-input id="endereco" label="Endereço" value="${(o.endereco || "").replace(
            /"/g,
            "&quot;"
          )}" placeholder="Rua, número, cidade"></ui-input>
          <div>
            <label class="tx">Descrição</label>
            <textarea id="descricao" placeholder="Detalhes da obra (opcional)">${
              o.descricao || ""
            }</textarea>
          </div>
          <div class="linha">
            <ui-input id="orcamento" label="Orçamento (R$)" type="number" step="0.01" min="0"
                      value="${o.orcamento || ""}" placeholder="0,00"></ui-input>
            <ui-select id="status" label="Status" value="${o.status || "ativa"}"></ui-select>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar obra"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.$("#status").options = [
      { value: "ativa", label: "Ativa" },
      { value: "pausada", label: "Pausada" },
      { value: "concluida", label: "Concluída" },
    ];
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const nome = this.$("#nome").value.trim();
    const erro = obrigatorio(nome, "O nome");
    if (erro) {
      this.$("#nome").setAttribute("error", erro);
      return;
    }
    this.$("#nome").removeAttribute("error");

    const dados = {
      nome,
      endereco: this.$("#endereco").value.trim(),
      descricao: this.$("#descricao").value.trim(),
      orcamento: Number(this.$("#orcamento").value) || 0,
      status: this.$("#status").value || "ativa",
    };

    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarObra(this.obra.id, dados);
        toastSucesso("Obra atualizada.");
      } else {
        await dataStore.criarObra(dados);
        toastSucesso("Obra criada.");
      }
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("obra-form", ObraForm);
