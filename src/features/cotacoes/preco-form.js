/**
 * <preco-form> — Modal para adicionar/editar uma OFERTA de um contato numa
 * cotação (valor unitário, prazo, observação).
 *
 * Propriedades: .cotacaoId (obrigatório), .preco (objeto p/ edição; ausente = nova)
 * Eventos: "salvo", "fechar". Auto-contido (chama o data-store).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { primeiroErro, obrigatorio, valorPositivo } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class PrecoForm extends BaseElement {
  set cotacaoId(v) {
    this._cotacaoId = v || "";
  }
  get cotacaoId() {
    return this._cotacaoId || "";
  }
  set preco(v) {
    this._preco = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get preco() {
    return this._preco || null;
  }
  get ehEdicao() {
    return !!(this.preco && this.preco.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
      label.tx { font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); display: block; }
      textarea { width: 100%; min-height: 56px; padding: var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        font-family: inherit; resize: vertical; background: var(--cor-superficie);
        color: var(--cor-texto); }
      textarea:focus { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    const p = this.preco || {};
    const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar oferta" : "Adicionar oferta"}">
        <div class="campos">
          <ui-select id="contato" label="Contato (quem ofertou)"></ui-select>
          <div class="linha">
            <ui-input id="valor" label="Valor unitário (R$)" type="number" step="0.01" min="0"
              value="${esc(p.valor_unit)}" placeholder="0,00"></ui-input>
            <ui-input id="prazo" label="Prazo de entrega" value="${esc(p.prazo_entrega)}"
              placeholder="Ex.: 5 dias"></ui-input>
          </div>
          <div>
            <label class="tx">Observação</label>
            <textarea id="observacao" placeholder="Condições, frete, etc. (opcional)">${p.observacao || ""}</textarea>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Adicionar"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.preencherContatos();
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  preencherContatos() {
    const sel = this.$("#contato");
    if (!sel) return;
    const mapaForn = {};
    dataStore.fornecedores().forEach((f) => (mapaForn[f.id] = f.nome));
    const contatos = dataStore.contatosAtivos();
    sel.options = contatos.map((c) => ({
      value: c.id,
      label: c.fornecedor_id && mapaForn[c.fornecedor_id]
        ? `${c.nome} — ${mapaForn[c.fornecedor_id]}`
        : c.nome,
    }));
    sel.value = (this.preco || {}).contato_id || (contatos[0] || {}).id || "";
  }

  async salvar() {
    const contatoId = this.$("#contato").value;
    const valor = Number(this.$("#valor").value);
    const erro = primeiroErro(obrigatorio(contatoId, "O contato"), valorPositivo(valor));
    if (erro) {
      if (!contatoId) this.$("#contato").setAttribute("error", "Selecione um contato.");
      this.$("#valor").setAttribute("error", valorPositivo(valor));
      return;
    }
    const dados = {
      contato_id: contatoId,
      valor_unit: valor,
      prazo_entrega: this.$("#prazo").value.trim(),
      observacao: this.$("#observacao").value.trim(),
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarPreco(this.cotacaoId, this.preco.id, dados);
        toastSucesso("Oferta atualizada.");
      } else {
        await dataStore.adicionarPreco(this.cotacaoId, dados);
        toastSucesso("Oferta adicionada.");
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

customElements.define("preco-form", PrecoForm);
