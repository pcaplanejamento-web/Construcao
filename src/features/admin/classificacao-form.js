/**
 * <classificacao-form> — Modal do ADMIN para criar/editar uma CLASSIFICAÇÃO de item
 * EXTRA (nome + cor). As 5 base (Material/Serviço/Documentação/Inicial/Comissão) são
 * fixas e não passam por aqui. GLOBAL: vale p/ todos os usuários. Auto-contido: chama
 * o data-store e emite "salvo"/"fechar". Espelha tipo-transf-form + o picker de cor
 * do categoria-form.
 *
 * Propriedade: .classificacao (objeto p/ edição; ausente = nova)
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class ClassificacaoForm extends BaseElement {
  set classificacao(v) {
    this._c = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get classificacao() {
    return this._c || null;
  }
  get ehEdicao() {
    return !!(this.classificacao && this.classificacao.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); align-items: end; }
      .linha ui-input[type] { flex: 1; }
      .cor { width: 90px; }
      .dica { font-size: var(--fs-xs); color: var(--cor-texto-fraco); }
    `;
  }

  template() {
    const c = this.classificacao || {};
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar classificação" : "Nova classificação"}">
        <div class="campos">
          <div class="linha">
            <ui-input id="nome" label="Nome da classificação"
              value="${(c.nome || "").replace(/"/g, "&quot;")}"
              placeholder="Ex.: Locação"></ui-input>
            <ui-input id="cor" class="cor" label="Cor" type="color"
              value="${c.cor || "#64748b"}"></ui-input>
          </div>
          <div class="dica">Vale para <b>todos os usuários</b>. Aceita empresa ou ofertante (como Documentação/Inicial); não entra em estoque — só Material entra.</div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar"}</ui-button>
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
    const nome = this.$("#nome").value.trim();
    const erro = obrigatorio(nome, "O nome");
    if (erro) {
      this.$("#nome").setAttribute("error", erro);
      return;
    }
    this.$("#nome").removeAttribute("error");
    const cor = this.$("#cor").value || "#64748b";
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarClassificacao(this.classificacao.id, { nome, cor });
        toastSucesso("Classificação atualizada.");
      } else {
        await dataStore.criarClassificacao({ nome, cor });
        toastSucesso("Classificação criada.");
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

customElements.define("classificacao-form", ClassificacaoForm);
