/**
 * <responsaveis-form> — Modal para escolher, entre os PARTICIPANTES da obra,
 * quem são os responsáveis. Alterna o flag por participante (em tempo real),
 * espelhando o padrão de obra-share-form. Reusa ui-modal/ui-button.
 *
 * Propriedade: .obraId   Evento: "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { rotuloOrigem } from "../despesas/despesa-split.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";

class ResponsaveisForm extends BaseElement {
  set obraId(v) {
    this._obraId = v || "";
  }
  get obraId() {
    return this._obraId || "";
  }

  estilos() {
    return `
      .dica { color: var(--cor-texto-suave); font-size: var(--fs-sm); margin-bottom: var(--esp-3); }
      .lista { display: flex; flex-direction: column; gap: var(--esp-2); }
      .item { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); padding: var(--esp-3); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-sm); }
      .item.ativo { border-color: var(--cor-primaria); background: var(--cor-primaria-suave); }
      .info { display: flex; flex-direction: column; }
      .nome { font-weight: var(--peso-medio); }
      .origem { font-size: var(--fs-xs); color: var(--cor-texto-suave); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); padding: var(--esp-4); text-align: center; }
    `;
  }

  template() {
    return `
      <ui-modal open title="Definir responsáveis">
        <p class="dica">Marque, entre os participantes, quem são os responsáveis da obra.</p>
        <div class="lista" id="lista"></div>
        <div slot="rodape"><ui-button id="fechar" variant="secundario">Concluir</ui-button></div>
      </ui-modal>
    `;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    this.pintar();
  }

  pintar() {
    const lista = this.$("#lista");
    const participantes = dataStore.participantesDaObra(this.obraId);
    if (!participantes.length) {
      lista.innerHTML = `<div class="vazio">Nenhum participante. Adicione participantes na aba "Participantes da obra".</div>`;
      return;
    }
    lista.innerHTML = "";
    participantes.forEach((p) => {
      const ativo = !!p.eh_responsavel;
      const item = document.createElement("div");
      item.className = "item" + (ativo ? " ativo" : "");
      item.innerHTML = `
        <div class="info">
          <span class="nome">${p.nome}</span>
          <span class="origem">${rotuloOrigem(p.origem)}</span>
        </div>
        <ui-button tamanho="sm" variant="${ativo ? "perigo" : "primario"}">
          ${ativo ? "Tirar" : "Tornar responsável"}
        </ui-button>`;
      item.querySelector("ui-button").addEventListener("click", () => this.alternar(p, item));
      lista.appendChild(item);
    });
  }

  async alternar(p, item) {
    const btn = item.querySelector("ui-button");
    btn.setAttribute("loading", "");
    try {
      await dataStore.definirResponsavel(this.obraId, p.chave, !p.eh_responsavel);
      toastSucesso(!p.eh_responsavel ? "Marcado como responsável." : "Removido dos responsáveis.");
      this.pintar(); // relê do store (já atualizado)
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("responsaveis-form", ResponsaveisForm);
