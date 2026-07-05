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
import { avisarDuplicado } from "../shared/duplicado.js";
import { editarEntidade, excluirEntidade, ehPrimario } from "../shared/drop-crud.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../categorias/categoria-form.js";

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
            <ui-input id="telefone" label="Telefone" formato="telefone" value="${esc(f.telefone)}"
              placeholder="(00) 00000-0000"></ui-input>
            <ui-input id="email" label="E-mail" type="email" value="${esc(f.email)}"
              placeholder="contato@empresa.com"></ui-input>
          </div>
          <div class="linha">
            <ui-input id="cnpj" label="CNPJ" formato="cnpj" value="${esc(f.cnpj)}"
              placeholder="00.000.000/0000-00"></ui-input>
            <ui-select id="categoria" label="Classificação" criar="Cadastrar classificação"></ui-select>
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
    const selCat = this.$("#categoria");
    if (selCat && !selCat._ligado) {
      selCat.addEventListener("criar", () => this.abrirNovaClassificacao());
      selCat.addEventListener("editar", (e) => editarEntidade("classificacaoFornecedor", e.detail.value, () => this.preencherCategorias()));
      selCat.addEventListener("excluir", (e) => excluirEntidade("classificacaoFornecedor", e.detail.value, () => this.preencherCategorias()));
      selCat._ligado = true;
    }
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  /** (Re)popula a Classificação (ícones editar/excluir; GLOBAL sem ações), preservando a seleção. */
  preencherCategorias() {
    const sel = this.$("#categoria");
    if (!sel) return;
    const ops = [{ value: "", label: "— Sem classificação —" }].concat(
      dataStore.categoriasFornecedor().map((c) => {
        const prim = ehPrimario("classificacaoFornecedor", c);
        return { value: c.id, label: c.nome, editavel: !prim, removivel: !prim };
      })
    );
    const atual = sel.value || (this.fornecedor || {}).categoria_id || "";
    sel.options = ops;
    sel.value = ops.some((o) => String(o.value) === String(atual)) ? atual : "";
  }

  /** Abre o <categoria-form> (tipo fornecedor) e seleciona a nova classificação ao voltar. */
  abrirNovaClassificacao() {
    const antes = new Set(dataStore.categoriasFornecedor().map((c) => String(c.id)));
    const form = document.createElement("categoria-form");
    form.tipo = "fornecedor";
    form.addEventListener("fechar", () => form.remove());
    form.addEventListener("salvo", () => {
      const nova = dataStore.categoriasFornecedor().find((c) => !antes.has(String(c.id)));
      this.preencherCategorias();
      if (nova && this.$("#categoria")) this.$("#categoria").value = nova.id;
    });
    document.body.appendChild(form);
  }

  async salvar() {
    const nome = this.$("#nome").value.trim();
    const erro = obrigatorio(nome, "O nome");
    if (erro) {
      this.$("#nome").setAttribute("error", erro);
      return;
    }
    this.$("#nome").removeAttribute("error");

    // Aviso de duplicado (só ao criar): o usuário decide se cadastra mesmo assim.
    if (!this.ehEdicao && !(await avisarDuplicado("empresa", nome, dataStore.fornecedoresAtivos()))) return;

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
