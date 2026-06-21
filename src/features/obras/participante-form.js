/**
 * <participante-form> — Modal para adicionar um CONTATO como participante da obra.
 * Reusa ui-modal/ui-select/ui-button. Dono/compartilhados já são participantes
 * automaticamente (derivados); aqui só se adicionam contatos cadastrados.
 *
 * Propriedade: .obraId   Eventos: "salvo", "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class ParticipanteForm extends BaseElement {
  set obraId(v) {
    this._obraId = v || "";
  }
  get obraId() {
    return this._obraId || "";
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-3); }
      .dica { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  _disponiveis() {
    const jaPart = new Set(
      dataStore.participantesDaObra(this.obraId).map((p) => String(p.ref_id))
    );
    return dataStore.contatosAtivos().filter((c) => !jaPart.has(String(c.id)));
  }

  template() {
    const disp = this._disponiveis();
    return `
      <ui-modal open title="Adicionar contato como participante">
        <div class="campos">
          ${
            disp.length
              ? `<p class="dica">Escolha um contato cadastrado para participar da obra.</p>
                 <ui-select id="contato" label="Contato"></ui-select>`
              : `<p class="vazio">Nenhum contato disponível. Cadastre contatos em "Contatos"
                 (ou todos já são participantes).</p>`
          }
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          ${disp.length ? `<ui-button id="salvar">Adicionar</ui-button>` : ""}
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    const sel = this.$("#contato");
    if (sel) {
      const disp = this._disponiveis();
      sel.options = disp.map((c) => ({ value: c.id, label: c.nome }));
      sel.value = (disp[0] || {}).id || "";
    }
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    const salvar = this.$("#salvar");
    if (salvar) salvar.addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const contatoId = this.$("#contato").value;
    if (!contatoId) {
      this.$("#contato").setAttribute("error", "Selecione um contato.");
      return;
    }
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      await dataStore.adicionarParticipante(this.obraId, contatoId);
      toastSucesso("Participante adicionado.");
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("participante-form", ParticipanteForm);
