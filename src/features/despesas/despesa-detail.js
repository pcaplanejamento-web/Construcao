/**
 * <despesa-detail> — Banner (modal) com as informações completas de uma despesa.
 * Permite EDITAR e EXCLUIR aqui (a edição não é mais feita no formulário de
 * adição). Reusa ui-modal/ui-input/ui-select/ui-button.
 *
 * Propriedades: .despesa, .categorias = [{id,nome,cor}]
 * Eventos: "salvar" ({ id, dados }), "remover" ({ despesa }), "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { data as fmtData, moeda } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { primeiroErro, obrigatorio, valorPositivo } from "../../core/validators.js";
import { parseLista } from "./despesa-split.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";
import "./split-editor.js";

class DespesaDetail extends BaseElement {
  set despesa(v) {
    this._despesa = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get despesa() {
    return this._despesa || {};
  }
  set categorias(v) {
    this._categorias = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.preencherCategorias();
  }
  get categorias() {
    return this._categorias || [];
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
      .secao { border-top: 1px solid var(--cor-borda); padding-top: var(--esp-3); }
      .check { display: flex; align-items: center; gap: var(--esp-2); cursor: pointer;
        font-weight: var(--peso-medio); }
      .check input { width: 18px; height: 18px; accent-color: var(--cor-primaria); }
      .auditoria { font-size: var(--fs-xs); color: var(--cor-texto-fraco);
        border-top: 1px solid var(--cor-borda); padding-top: var(--esp-3);
        display: flex; flex-direction: column; gap: 2px; }
      .rodape { display: flex; gap: var(--esp-3); width: 100%; }
      .rodape .cresce { flex: 1; }
    `;
  }

  template() {
    const d = this.despesa;
    const editado =
      d.editor_nome && d.atualizado_em && String(d.atualizado_em) !== String(d.criado_em);
    return `
      <ui-modal open title="Despesa">
        <div class="campos">
          <ui-alert id="erro" tipo="erro"></ui-alert>
          <ui-input id="item" label="Item" value="${(d.item || "").replace(/"/g, "&quot;")}"></ui-input>
          <div class="linha">
            <ui-input id="valor" label="Valor (R$)" type="number" step="0.01" min="0" value="${d.valor || ""}"></ui-input>
            <ui-input id="data" label="Data" type="date" value="${d.data ? String(d.data).substring(0, 10) : ""}"></ui-input>
          </div>
          <ui-select id="categoria" label="Classificação"></ui-select>
          <div>
            <label class="tx">Observação</label>
            <textarea id="observacao" placeholder="Detalhes (opcional)">${d.observacao || ""}</textarea>
          </div>
          <div class="secao">
            <label class="check"><input type="checkbox" id="pago" ${d.pago ? "checked" : ""} /> Pago</label>
          </div>
          <div class="secao">
            <label class="tx">Pagamento — quem pagou quanto (R$)</label>
            <split-editor id="pagamentos"></split-editor>
          </div>
          <div class="secao">
            <label class="tx">Responsabilidade — % por participante (soma 100%)</label>
            <split-editor id="responsaveis"></split-editor>
          </div>
          <div class="auditoria">
            <span>Adicionada em ${fmtData(d.criado_em)} por ${d.autor_nome || "—"}</span>
            ${editado ? `<span>Editado por ${d.editor_nome} em ${fmtData(d.atualizado_em)}</span>` : ""}
          </div>
        </div>
        <div slot="rodape" class="rodape">
          <ui-button id="excluir" variant="perigo">Excluir</ui-button>
          <span class="cresce"></span>
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">Salvar</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.preencherCategorias();
    this.preencherSplits();
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
    this.$("#excluir").addEventListener("click", () => this.excluir());
  }

  /** Popula os editores de pagamento (R$) e responsabilidade (%). */
  preencherSplits() {
    const parts = dataStore.participantesDaObra(this.despesa.obra_id);
    const pg = this.$("#pagamentos");
    if (pg) {
      pg.modo = "valor";
      pg.participantes = parts;
      pg.limite = Number(this.$("#valor").value) || 0; // soma ≤ valor da despesa
      pg.itens = parseLista(this.despesa.pagamentos).map((p) => ({
        chave: p.chave,
        valor: Number(p.valor) || 0,
      }));
    }
    // Mantém o limite do pagamento sincronizado com o valor digitado.
    const valInput = this.$("#valor");
    if (valInput && pg) {
      valInput.addEventListener("input", () => {
        pg.limite = Number(valInput.value) || 0;
      });
    }
    const rp = this.$("#responsaveis");
    if (rp) {
      rp.modo = "pct";
      rp.participantes = parts;
      rp.itens = parseLista(this.despesa.responsaveis).map((r) => ({
        chave: r.chave,
        valor: Number(r.pct) || 0,
      }));
    }
  }

  preencherCategorias() {
    const sel = this.$("#categoria");
    if (!sel) return;
    sel.options = this.categorias.map((c) => ({ value: c.id, label: c.nome }));
    sel.value = this.despesa.categoria_id || (this.categorias[0] || {}).id || "";
  }

  async salvar() {
    const alerta = this.$("#erro");
    if (alerta) alerta.mensagem = "";
    const item = this.$("#item").value.trim();
    const valor = Number(this.$("#valor").value);
    const erro = primeiroErro(obrigatorio(item, "O item"), valorPositivo(valor));
    if (erro) {
      this.$("#item").setAttribute("error", obrigatorio(item, "O item"));
      this.$("#valor").setAttribute("error", valorPositivo(valor));
      return;
    }
    const pagamentos = this.$("#pagamentos").itens
      .filter((x) => x.chave && Number(x.valor) > 0)
      .map((x) => ({ chave: x.chave, valor: Number(x.valor) || 0 }));
    const responsaveis = this.$("#responsaveis").itens
      .filter((x) => x.chave)
      .map((x) => ({ chave: x.chave, pct: Number(x.valor) || 0 }));

    // Regras: soma dos pagamentos ≤ valor da despesa; soma das % ≤ 100.
    const somaPag = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const somaPct = responsaveis.reduce((s, r) => s + (Number(r.pct) || 0), 0);
    if (somaPag - valor > 0.01) {
      if (alerta)
        alerta.mensagem = `A soma dos pagamentos (${moeda(somaPag)}) não pode passar do valor da despesa (${moeda(valor)}).`;
      return;
    }
    if (somaPct - 100 > 0.01) {
      if (alerta)
        alerta.mensagem = `A soma das responsabilidades (${Math.round(somaPct * 100) / 100}%) não pode passar de 100%.`;
      return;
    }

    const dados = {
      item,
      valor,
      categoria_id: this.$("#categoria").value,
      data: this.$("#data").value || String(this.despesa.data || "").substring(0, 10),
      observacao: this.$("#observacao").value.trim(),
      pago: this.$("#pago").checked,
      pagamentos,
      responsaveis,
    };
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      await dataStore.atualizarDespesa(this.despesa.obra_id, this.despesa.id, dados);
      toastSucesso("Despesa atualizada.");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }

  async excluir() {
    if (!confirm(`Excluir a despesa "${this.despesa.item}"?`)) return;
    const btn = this.$("#excluir");
    btn.setAttribute("loading", "");
    try {
      await dataStore.removerDespesa(this.despesa.obra_id, this.despesa.id);
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("despesa-detail", DespesaDetail);
