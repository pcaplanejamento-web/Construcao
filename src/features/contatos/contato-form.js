/**
 * <contato-form> — Modal para criar/editar um contato (pessoa).
 *
 * O Cargo é escolhido numa lista (cargos fixos + extras). Campo condicional:
 *  - Vendedor → vínculo OBRIGATÓRIO a um Fornecedor (só aparece p/ Vendedor).
 * (Pedreiro agora é organizado por Equipes — sem campo de superior aqui.)
 * Auto-contido: chama o data-store e emite "salvo"/"fechar".
 *
 * Propriedade: .contato (objeto p/ edição; ausente = novo)
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";

class ContatoForm extends BaseElement {
  set contato(v) {
    this._contato = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get contato() {
    return this._contato || null;
  }
  get ehEdicao() {
    return !!(this.contato && this.contato.id);
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
    const c = this.contato || {};
    const esc = (v) => String(v || "").replace(/"/g, "&quot;");
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar contato" : "Novo contato"}">
        <div class="campos">
          <ui-alert id="erro" tipo="erro"></ui-alert>
          <ui-input id="nome" label="Nome" value="${esc(c.nome)}"
            placeholder="Ex.: João da Silva"></ui-input>
          <div class="linha">
            <ui-input id="telefone" label="Telefone" value="${esc(c.telefone)}"
              placeholder="(00) 00000-0000"></ui-input>
            <ui-input id="email" label="E-mail" type="email" value="${esc(c.email)}"
              placeholder="joao@empresa.com"></ui-input>
          </div>
          <ui-select id="cargo" label="Cargo"></ui-select>
          <div id="campoFornecedor" hidden>
            <ui-select id="fornecedor" label="Empresa (fornecedor)"></ui-select>
          </div>
          <div>
            <label class="tx">Observação</label>
            <textarea id="observacao" placeholder="Detalhes (opcional)">${c.observacao || ""}</textarea>
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
    const c = this.contato || {};

    const selCargo = this.$("#cargo");
    selCargo.options = [{ value: "", label: "— Sem cargo —" }].concat(
      dataStore.cargos().map((x) => ({ value: x.nome, label: x.nome }))
    );
    selCargo.value = c.cargo || "";

    const selForn = this.$("#fornecedor");
    selForn.options = [{ value: "", label: "— Selecione —" }].concat(
      dataStore.fornecedoresAtivos().map((f) => ({ value: f.id, label: f.nome }))
    );
    selForn.value = c.fornecedor_id || "";

    this.atualizarCondicionais();
    selCargo.addEventListener("change", () => this.atualizarCondicionais());
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  /** Mostra Fornecedor só p/ Vendedor. */
  atualizarCondicionais() {
    const cargo = this.$("#cargo").value;
    this.$("#campoFornecedor").hidden = cargo !== "Vendedor";
  }

  async salvar() {
    const alerta = this.$("#erro");
    alerta.mensagem = "";
    const nome = this.$("#nome").value.trim();
    const erro = obrigatorio(nome, "O nome");
    if (erro) {
      this.$("#nome").setAttribute("error", erro);
      return;
    }
    this.$("#nome").removeAttribute("error");

    const cargo = this.$("#cargo").value;
    const ehVendedor = cargo === "Vendedor";
    const fornecedor_id = ehVendedor ? this.$("#fornecedor").value : "";

    if (ehVendedor && !fornecedor_id) {
      alerta.mensagem = "Vendedor deve ser vinculado a um fornecedor.";
      return;
    }

    const dados = {
      nome,
      telefone: this.$("#telefone").value.trim(),
      email: this.$("#email").value.trim(),
      cargo,
      fornecedor_id,
      observacao: this.$("#observacao").value.trim(),
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarContato(this.contato.id, dados);
        toastSucesso("Contato atualizado.");
      } else {
        await dataStore.criarContato(dados);
        toastSucesso("Contato criado.");
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

customElements.define("contato-form", ContatoForm);
