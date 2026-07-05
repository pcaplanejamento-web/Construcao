/**
 * <contato-form> — Modal para criar/editar um contato (pessoa).
 *
 * O Cargo é escolhido numa lista (cargos fixos + extras). Campo "Empresa":
 *  - vínculo OPCIONAL a uma Empresa p/ qualquer contato (obrigatório só p/ Vendedor).
 * (Pedreiro agora é organizado por Equipes — sem campo de superior aqui.)
 * Auto-contido: chama o data-store e emite "salvo"/"fechar".
 *
 * Propriedade: .contato (objeto p/ edição; ausente = novo)
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import { avisarDuplicado } from "../shared/duplicado.js";
import { editarEntidade, excluirEntidade } from "../shared/drop-crud.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";
import "./cargo-form.js";
import "../fornecedores/fornecedor-form.js";

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
          <ui-select id="cargo" label="Cargo" criar="Cadastrar cargo"></ui-select>
          <ui-select id="fornecedor" label="Empresa" criar="Cadastrar empresa"></ui-select>
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
    this._preencherSelects();

    const selCargo = this.$("#cargo");
    if (selCargo && !selCargo._ligado) {
      selCargo.addEventListener("criar", () => this.abrirNovoCargo());
      selCargo.addEventListener("editar", (e) => editarEntidade("cargo", e.detail.value, () => this._preencherSelects()));
      selCargo.addEventListener("excluir", (e) => excluirEntidade("cargo", e.detail.value, () => this._preencherSelects()));
      selCargo._ligado = true;
    }
    const selForn = this.$("#fornecedor");
    if (selForn && !selForn._ligado) {
      selForn.addEventListener("criar", () => this.abrirNovaEmpresa());
      selForn.addEventListener("editar", (e) => editarEntidade("fornecedor", e.detail.value, () => this._preencherSelects()));
      selForn.addEventListener("excluir", (e) => excluirEntidade("fornecedor", e.detail.value, () => this._preencherSelects()));
      selForn._ligado = true;
    }

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  /** (Re)popula Cargo e Empresa (com ícones editar/excluir; primários sem ações), preservando a seleção. */
  _preencherSelects() {
    const c = this.contato || {};
    const selCargo = this.$("#cargo");
    if (selCargo) {
      const ops = [{ value: "", label: "— Sem cargo —" }].concat(
        dataStore.cargos().map((x) => ({ value: x.nome, label: x.nome, editavel: !x.fixo, removivel: !x.fixo }))
      );
      const atual = selCargo.value || c.cargo || "";
      selCargo.options = ops;
      selCargo.value = ops.some((o) => String(o.value) === String(atual)) ? atual : "";
    }
    const selForn = this.$("#fornecedor");
    if (selForn) {
      const ops = [{ value: "", label: "— Sem empresa —" }].concat(
        dataStore.fornecedoresAtivos().map((f) => ({ value: f.id, label: f.nome, editavel: true, removivel: true }))
      );
      const atual = selForn.value || c.fornecedor_id || "";
      selForn.options = ops;
      selForn.value = ops.some((o) => String(o.value) === String(atual)) ? atual : "";
    }
  }

  /** Abre o <cargo-form> e seleciona o novo cargo (por nome) ao voltar. */
  abrirNovoCargo() {
    const antes = new Set(dataStore.cargos().map((x) => String(x.nome).toLowerCase()));
    const form = document.createElement("cargo-form");
    form.addEventListener("fechar", () => form.remove());
    form.addEventListener("salvo", () => {
      const novo = dataStore.cargos().find((x) => !antes.has(String(x.nome).toLowerCase()));
      this._preencherSelects();
      if (novo && this.$("#cargo")) this.$("#cargo").value = novo.nome;
    });
    document.body.appendChild(form);
  }

  /** Abre o <fornecedor-form> e seleciona a nova empresa ao voltar. */
  abrirNovaEmpresa() {
    const antes = new Set(dataStore.fornecedores().map((f) => String(f.id)));
    const form = document.createElement("fornecedor-form");
    form.addEventListener("fechar", () => form.remove());
    form.addEventListener("salvo", () => {
      const novo = dataStore.fornecedores().find((f) => !antes.has(String(f.id)));
      this._preencherSelects();
      if (novo && this.$("#fornecedor")) this.$("#fornecedor").value = novo.id;
    });
    document.body.appendChild(form);
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
    // Empresa é opcional p/ qualquer contato; obrigatória apenas p/ Vendedor.
    const fornecedor_id = this.$("#fornecedor").value;

    if (cargo === "Vendedor" && !fornecedor_id) {
      alerta.mensagem = "Vendedor deve ser vinculado a uma empresa.";
      return;
    }

    // Aviso de duplicado (só ao criar): se já existe um contato com esse nome,
    // o usuário escolhe continuar ou não.
    if (!this.ehEdicao && !(await avisarDuplicado("contato", nome, dataStore.contatosAtivos()))) return;

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
