/**
 * <orcamento-form> — Modal para criar/editar um orçamento (container de ofertas).
 *
 * Tipo Material → fornecedor + vendedor desse fornecedor (obrigatórios).
 * Tipo Serviço → qualquer contato (sem fornecedor). Obra é opcional.
 *
 * Propriedade: .orcamento (objeto p/ edição; ausente = novo)
 * Eventos: "salvo" ({ orcamento }), "fechar". Auto-contido (chama o data-store).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

const TIPOS = ["Material", "Serviço"];

class OrcamentoForm extends BaseElement {
  set orcamento(v) {
    this._orcamento = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get orcamento() {
    return this._orcamento || null;
  }
  get ehEdicao() {
    return !!(this.orcamento && this.orcamento.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
    `;
  }

  template() {
    const o = this.orcamento || {};
    const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar orçamento" : "Novo orçamento"}">
        <div class="campos">
          <ui-input id="titulo" label="Título (opcional)" value="${esc(o.titulo)}"
            placeholder="Ex.: Cimento e areia — Loja X"></ui-input>
          <div class="linha">
            <ui-select id="tipo" label="Tipo"></ui-select>
            <ui-select id="fornecedor" label="Fornecedor"></ui-select>
          </div>
          <ui-select id="contato" label="Ofertante (vendedor/contato)"></ui-select>
          <ui-select id="obra" label="Obra (opcional)"></ui-select>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    const o = this.orcamento || {};
    const selTipo = this.$("#tipo");
    selTipo.options = TIPOS.map((t) => ({ value: t, label: t }));
    selTipo.value = o.tipo || TIPOS[0];

    const selForn = this.$("#fornecedor");
    selForn.options = [{ value: "", label: "Selecione o fornecedor" }].concat(
      dataStore.fornecedoresAtivos().map((f) => ({ value: f.id, label: f.nome }))
    );
    selForn.value = o.fornecedor_id || "";

    const selObra = this.$("#obra");
    selObra.options = [{ value: "", label: "— Nenhuma (geral) —" }].concat(
      dataStore.obras().map((ob) => ({ value: ob.id, label: ob.nome }))
    );
    selObra.value = o.obra_id || "";

    this.preencherContatos();
    this.atualizarVisibilidade();

    selTipo.addEventListener("change", () => {
      this.atualizarVisibilidade();
      this.preencherContatos();
    });
    selForn.addEventListener("change", () => this.preencherContatos());

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  get tipo() {
    return this.$("#tipo").value || TIPOS[0];
  }

  atualizarVisibilidade() {
    const ehMaterial = this.tipo === "Material";
    this.$("#fornecedor").style.display = ehMaterial ? "" : "none";
  }

  /** Material → contatos do fornecedor; Serviço → qualquer contato. */
  preencherContatos() {
    const sel = this.$("#contato");
    if (!sel) return;
    let contatos = dataStore.contatosAtivos();
    if (this.tipo === "Material") {
      const fornId = this.$("#fornecedor").value;
      contatos = contatos.filter((c) => fornId && String(c.fornecedor_id) === String(fornId));
    }
    sel.setAttribute("placeholder", contatos.length ? "Selecione o ofertante" : "Nenhum contato disponível");
    sel.options = contatos.map((c) => ({ value: c.id, label: c.nome }));
    const atual = (this.orcamento || {}).contato_id || "";
    sel.value = contatos.some((c) => String(c.id) === String(atual)) ? atual : "";
  }

  async salvar() {
    const tipo = this.tipo;
    const contatoId = this.$("#contato").value;
    const fornecedorId = tipo === "Material" ? this.$("#fornecedor").value : "";
    if (tipo === "Material" && !fornecedorId) {
      this.$("#fornecedor").setAttribute("error", "Selecione o fornecedor.");
      return;
    }
    if (!contatoId) {
      this.$("#contato").setAttribute("error", "Selecione o ofertante.");
      return;
    }
    const dados = {
      titulo: this.$("#titulo").value.trim(),
      tipo,
      fornecedor_id: fornecedorId,
      contato_id: contatoId,
      obra_id: this.$("#obra").value,
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      let orc;
      if (this.ehEdicao) {
        orc = await dataStore.atualizarOrcamento(this.orcamento.id, dados);
        toastSucesso("Orçamento atualizado.");
      } else {
        orc = await dataStore.criarOrcamento(dados);
        toastSucesso("Orçamento criado.");
      }
      this.emitir("salvo", { orcamento: orc });
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("orcamento-form", OrcamentoForm);
