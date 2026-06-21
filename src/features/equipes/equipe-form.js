/**
 * <equipe-form> — Modal para criar/editar uma equipe (nome + líder).
 *
 * Líder é obrigatoriamente Mestre de Obra/Engenheiro/Gestor. Membros e obras são
 * geridos na página da equipe (equipe-detail-view). Espelha cotacao/orcamento-form.
 *
 * Propriedade: .equipe (objeto p/ edição; ausente = nova)
 * Eventos: "salvo" ({ equipe }), "fechar". Auto-contido (chama o data-store).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { CARGOS_LIDER } from "./equipe-util.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class EquipeForm extends BaseElement {
  set equipe(v) {
    this._equipe = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get equipe() {
    return this._equipe || null;
  }
  get ehEdicao() {
    return !!(this.equipe && this.equipe.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    const e = this.equipe || {};
    const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar equipe" : "Nova equipe"}">
        <div class="campos">
          <ui-input id="nome" label="Nome da equipe" value="${esc(e.nome)}"
            placeholder="Ex.: Equipe Fundação"></ui-input>
          <ui-select id="lider" label="Líder (Mestre de Obra, Engenheiro ou Gestor)"></ui-select>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    const e = this.equipe || {};
    const sel = this.$("#lider");
    const elegiveis = dataStore.contatosAtivos().filter((c) => CARGOS_LIDER.indexOf(c.cargo) >= 0);
    sel.setAttribute("placeholder", elegiveis.length ? "Selecione o líder" : "Nenhum contato elegível");
    sel.options = elegiveis.map((c) => ({ value: c.id, label: `${c.nome} — ${c.cargo}` }));
    sel.value = e.lider_id || "";

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const nome = this.$("#nome").value.trim();
    const liderId = this.$("#lider").value;
    if (!nome) {
      this.$("#nome").setAttribute("error", "Informe o nome.");
      return;
    }
    if (!liderId) {
      this.$("#lider").setAttribute("error", "Selecione o líder.");
      return;
    }
    const dados = { nome, lider_id: liderId };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      let eq;
      if (this.ehEdicao) {
        eq = await dataStore.atualizarEquipe(this.equipe.id, dados);
        toastSucesso("Equipe atualizada.");
      } else {
        eq = await dataStore.criarEquipe(dados);
        toastSucesso("Equipe criada.");
      }
      this.emitir("salvo", { equipe: eq });
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("equipe-form", EquipeForm);
