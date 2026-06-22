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
  /** Quando definido, o orçamento nasce VINCULADO a esta obra (campo travado). */
  set obraFixaId(v) {
    this._obraFixaId = v || "";
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get obraFixaId() {
    return this._obraFixaId || "";
  }
  get ehEdicao() {
    return !!(this.orcamento && this.orcamento.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
      label.tx { font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); display: block; }
      .lido { padding: var(--esp-3); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-sm); background: var(--cor-superficie-2); color: var(--cor-texto); }
      .lido small { color: var(--cor-texto-fraco); }
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
          <ui-select id="contato" label="Ofertante (contato; ou equipe no Serviço)"></ui-select>
          ${
            this.obraFixaId
              ? `<div><label class="tx">Obra (vinculada)</label>
                   <div class="lido">${esc((dataStore.obra(this.obraFixaId) || {}).nome || "—")} <small>· vinculada a esta obra, não pode ser alterada</small></div></div>`
              : `<ui-select id="obra" label="Obra (opcional)"></ui-select>`
          }
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
    if (selObra) {
      selObra.options = [{ value: "", label: "— Nenhuma (geral) —" }].concat(
        dataStore.obras().map((ob) => ({ value: ob.id, label: ob.nome }))
      );
      selObra.value = o.obra_id || "";
    }

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

  /**
   * Ofertante. Material → contatos do fornecedor. Serviço → contatos + EQUIPES.
   * Valores codificados: "c:<id>" (contato) / "e:<id>" (equipe).
   */
  preencherContatos() {
    const sel = this.$("#contato");
    if (!sel) return;
    const opcoes = [];
    if (this.tipo === "Material") {
      const fornId = this.$("#fornecedor").value;
      dataStore
        .contatosAtivos()
        .filter((c) => fornId && String(c.fornecedor_id) === String(fornId))
        .forEach((c) => opcoes.push({ value: "c:" + c.id, label: c.nome }));
    } else {
      dataStore.contatosAtivos().forEach((c) => opcoes.push({ value: "c:" + c.id, label: c.nome }));
      dataStore.equipes().forEach((e) => opcoes.push({ value: "e:" + e.id, label: `${e.nome} — equipe` }));
    }
    sel.setAttribute("placeholder", opcoes.length ? "Selecione o ofertante" : "Nenhum ofertante disponível");
    sel.options = opcoes;
    const o = this.orcamento || {};
    const atual = o.equipe_id ? "e:" + o.equipe_id : o.contato_id ? "c:" + o.contato_id : "";
    sel.value = opcoes.some((op) => op.value === atual) ? atual : "";
  }

  async salvar() {
    const tipo = this.tipo;
    const ofertante = this.$("#contato").value; // "c:<id>" / "e:<id>"
    const fornecedorId = tipo === "Material" ? this.$("#fornecedor").value : "";
    if (tipo === "Material" && !fornecedorId) {
      this.$("#fornecedor").setAttribute("error", "Selecione o fornecedor.");
      return;
    }
    if (!ofertante) {
      this.$("#contato").setAttribute("error", "Selecione o ofertante.");
      return;
    }
    const contatoId = ofertante.indexOf("c:") === 0 ? ofertante.slice(2) : "";
    const equipeId = ofertante.indexOf("e:") === 0 ? ofertante.slice(2) : "";
    const dados = {
      titulo: this.$("#titulo").value.trim(),
      tipo,
      fornecedor_id: fornecedorId,
      contato_id: contatoId,
      equipe_id: equipeId,
      obra_id: this.obraFixaId || (this.$("#obra") ? this.$("#obra").value : ""),
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
