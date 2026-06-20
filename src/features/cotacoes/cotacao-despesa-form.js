/**
 * <cotacao-despesa-form> — Mini-modal para lançar a oferta ESCOLHIDA de uma
 * cotação como DESPESA numa obra (fecha o ciclo cotar → comprar → gasto).
 *
 * Propriedades: .cotacao, .preco (oferta escolhida), .contatoNome
 * Eventos: "registrado" ({ obra_id }), "fechar". Reusa o já existente
 * dataStore.adicionarDespesa — nenhuma action nova no backend.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { totalOferta } from "./cotacao-util.js";
import "../../components/ui-modal.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class CotacaoDespesaForm extends BaseElement {
  set cotacao(v) {
    this._cotacao = v || null;
  }
  get cotacao() {
    return this._cotacao || {};
  }
  set preco(v) {
    this._preco = v || null;
  }
  get preco() {
    return this._preco || {};
  }
  set contatoNome(v) {
    this._contatoNome = v || "";
  }
  get contatoNome() {
    return this._contatoNome || "";
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .resumo { background: var(--cor-superficie-2); border-radius: var(--raio-sm);
        padding: var(--esp-3) var(--esp-4); display: flex; flex-direction: column; gap: 4px; }
      .resumo .item { font-weight: var(--peso-semi); }
      .resumo .val { font-size: var(--fs-lg); font-weight: var(--peso-forte);
        color: var(--cor-primaria); }
      .resumo small { color: var(--cor-texto-suave); }
    `;
  }

  template() {
    const total = totalOferta(this.preco, this.cotacao);
    return `
      <ui-modal open title="Registrar como despesa">
        <div class="campos">
          <div class="resumo">
            <span class="item">${this.cotacao.descricao || ""}</span>
            <span class="val">${moeda(total)}</span>
            <small>Oferta de ${this.contatoNome || "—"}</small>
          </div>
          <ui-select id="obra" label="Obra"></ui-select>
          <ui-select id="categoria" label="Classificação"></ui-select>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="confirmar">Lançar despesa</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    const selObra = this.$("#obra");
    selObra.options = dataStore.obras().map((o) => ({ value: o.id, label: o.nome }));
    selObra.value = this.cotacao.obra_id || (dataStore.obras()[0] || {}).id || "";

    const selCat = this.$("#categoria");
    selCat.options = [{ value: "", label: "— Sem classificação —" }].concat(
      dataStore.categorias().map((c) => ({ value: c.id, label: c.nome }))
    );
    selCat.value = this.cotacao.categoria_id || "";

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#confirmar").addEventListener("click", () => this.confirmar());
  }

  async confirmar() {
    const obraId = this.$("#obra").value;
    if (!obraId) {
      this.$("#obra").setAttribute("error", "Selecione uma obra.");
      return;
    }
    const btn = this.$("#confirmar");
    btn.setAttribute("loading", "");
    try {
      // Cria a despesa E marca a oferta como registrada + fecha a cotação (servidor).
      await dataStore.registrarDespesaOferta(
        this.cotacao.id,
        this.preco.id,
        obraId,
        this.$("#categoria").value
      );
      const obra = dataStore.obra(obraId) || {};
      toastSucesso(`Despesa lançada em "${obra.nome || "obra"}".`);
      this.emitir("registrado", { obra_id: obraId });
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("cotacao-despesa-form", CotacaoDespesaForm);
