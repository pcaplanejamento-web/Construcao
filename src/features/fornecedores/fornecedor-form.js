/**
 * <fornecedor-form> — Modal para criar/editar um fornecedor (empresa/loja).
 *
 * Propriedade: .fornecedor (objeto p/ edição; ausente = novo)
 * Eventos: "salvo", "fechar". Auto-contido: chama o data-store e emite EVENTOS.
 * Reusa ui-modal/ui-input/ui-select/ui-button.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class FornecedorForm extends BaseElement {
  set fornecedor(v) {
    this._fornecedor = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get fornecedor() {
    return this._fornecedor || null;
  }
  get ehEdicao() {
    return !!(this.fornecedor && this.fornecedor.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
      label.tx { font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); display: block; }
      textarea { width: 100%; min-height: 64px; padding: var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        font-family: inherit; resize: vertical; background: var(--cor-superficie);
        color: var(--cor-texto); }
      textarea:focus { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
    `;
  }

  template() {
    const f = this.fornecedor || {};
    const esc = (v) => String(v || "").replace(/"/g, "&quot;");
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar empresa" : "Nova empresa"}">
        <div class="campos">
          <ui-input id="nome" label="Nome da empresa" value="${esc(f.nome)}"
            placeholder="Ex.: Casa do Construtor"></ui-input>
          <div class="linha">
            <ui-input id="telefone" label="Telefone" value="${esc(f.telefone)}"
              placeholder="(00) 00000-0000"></ui-input>
            <ui-input id="email" label="E-mail" type="email" value="${esc(f.email)}"
              placeholder="contato@empresa.com"></ui-input>
          </div>
          <div class="linha">
            <ui-input id="cnpj" label="CNPJ" value="${esc(f.cnpj)}"
              placeholder="00.000.000/0000-00"></ui-input>
            <ui-select id="categoria" label="Classificação"></ui-select>
          </div>
          <div>
            <label class="tx">Observação</label>
            <textarea id="observacao" placeholder="Detalhes (opcional)">${f.observacao || ""}</textarea>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.preencherCategorias();
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  preencherCategorias() {
    const sel = this.$("#categoria");
    if (!sel) return;
    sel.options = [{ value: "", label: "— Sem classificação —" }].concat(
      dataStore.categoriasFornecedor().map((c) => ({ value: c.id, label: c.nome }))
    );
    sel.value = (this.fornecedor || {}).categoria_id || "";
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
      telefone: this.$("#telefone").value.trim(),
      email: this.$("#email").value.trim(),
      cnpj: this.$("#cnpj").value.trim(),
      categoria_id: this.$("#categoria").value,
      observacao: this.$("#observacao").value.trim(),
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarFornecedor(this.fornecedor.id, dados);
        toastSucesso("Empresa atualizada.");
      } else {
        await dataStore.criarFornecedor(dados);
        toastSucesso("Empresa criada.");
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

customElements.define("fornecedor-form", FornecedorForm);
