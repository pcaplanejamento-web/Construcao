/**
 * <pagamento-form> — Modal para REGISTRAR um pagamento que pode cobrir VÁRIAS
 * despesas da obra (entidade Pagamentos). Seleciona despesas (com alocação por
 * despesa, default = resto), pagador (participante), recebedor (contato OU
 * equipe/grupo), fornecedor opcional e data. Auto-contido (chama o data-store).
 *
 * Propriedade: .obra (objeto). Eventos: "salvo" ({pagamento}), "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { restoDespesa } from "../despesas/despesa-split.js";
import { ofertanteNome } from "../orcamentos/orcamento-util.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-select.js";
import "../../components/ui-input.js";
import "../../components/ui-alert.js";
import "../../components/ui-button.js";

class PagamentoForm extends BaseElement {
  set obra(v) {
    this._obra = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get obra() {
    return this._obra || null;
  }
  /** Quando vem das selecionadas: lista SÓ essas, já marcadas. */
  set despesasSelecionadas(v) {
    this._restritas = Array.isArray(v) ? v : null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  /** Aviso opcional (ex.: despesas já pagas foram ignoradas) — mostrado no topo. */
  set aviso(v) {
    this._aviso = v || "";
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  /** Recebedor da despesa = ofertante (contato OU equipe/grupo). */
  _recebedorDespesa(d) {
    return ofertanteNome(d.ofertante_contato_id, d.ofertante_equipe_id);
  }

  /** Despesas a oferecer: as selecionadas (restritas) ou as da obra com saldo > 0. */
  _despesas() {
    if (this._restritas) return this._restritas;
    const id = (this.obra || {}).id;
    return dataStore.despesas(id).filter((d) => restoDespesa(d) > 0.01);
  }
  _nomeDespesa(d) {
    return (d.item_id && (dataStore.item(d.item_id) || {}).nome) || d.item || "Despesa";
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
      .tx { font-size: var(--fs-sm); color: var(--cor-texto-suave); display:block; margin-bottom: var(--esp-1); }
      .lista { display: flex; flex-direction: column; gap: var(--esp-2); max-height: 220px; overflow:auto;
        border: 1px solid var(--cor-divisor); border-radius: var(--raio-sm); padding: var(--esp-2); }
      .desp { display: grid; grid-template-columns: 20px 1fr 120px; align-items: center; gap: var(--esp-2); }
      .desp .nome { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .desp small { color: var(--cor-texto-fraco); }
      .total { font-family: var(--fonte-titulo); font-weight: var(--peso-forte); text-align:right; }
      input[type="checkbox"] { width:16px; height:16px; accent-color: var(--cor-primaria); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    const despesas = this._despesas();
    const linhasDesp = despesas.length
      ? despesas
          .map(
            (d) => `
        <label class="desp">
          <input type="checkbox" class="chk" data-id="${d.id}" ${this._restritas ? "checked" : ""} />
          <span class="nome" title="${this._nomeDespesa(d)}">${this._nomeDespesa(d)}
            <small>· resto ${moeda(restoDespesa(d))} · recebe: ${this._recebedorDespesa(d)}</small></span>
          <ui-input class="aloc" data-id="${d.id}" type="number" step="0.01" min="0"
            value="${restoDespesa(d).toFixed(2)}" ${this._restritas ? "" : "disabled"}></ui-input>
        </label>`
          )
          .join("")
      : `<div class="vazio">Nenhuma despesa com saldo a pagar nesta obra.</div>`;

    return `
      <ui-modal open title="Registrar pagamento">
        <div class="campos">
          ${this._aviso ? `<ui-alert tipo="aviso" message="${String(this._aviso).replace(/"/g, "&quot;")}"></ui-alert>` : ""}
          <div>
            <label class="tx">Despesas a pagar (o recebedor é o ofertante de cada uma)</label>
            <div class="lista" id="lista">${linhasDesp}</div>
            <div class="total" id="total">Total: ${moeda(0)}</div>
          </div>
          <div class="linha">
            <ui-select id="pagador" label="Quem pagou"></ui-select>
            <ui-input id="data" label="Data do pagamento" type="date"></ui-input>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">Registrar</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    // Pagador: participantes da obra (chave/nome); fallback p/ contatos ativos.
    const parts = dataStore.participantesDaObra((this.obra || {}).id);
    const optsPag = parts.length
      ? parts.map((p) => ({ value: p.chave, label: p.nome }))
      : dataStore.contatosAtivos().map((c) => ({ value: "c:" + c.id, label: c.nome }));
    const selPag = this.$("#pagador");
    selPag.setAttribute("placeholder", "Selecione quem pagou");
    selPag.options = optsPag;

    // Data: padrão hoje + NÃO permite futuro (max no input interno).
    const hoje = new Date().toISOString().substring(0, 10);
    this.$("#data").value = hoje;
    const inpData = this.$("#data").shadowRoot && this.$("#data").shadowRoot.querySelector("input");
    if (inpData) inpData.max = hoje;

    // Checkbox habilita/desabilita o valor + recalcula o total.
    this.$$(".chk").forEach((cb) => {
      cb.addEventListener("change", () => {
        const aloc = this._alocInput(cb.dataset.id);
        if (aloc) aloc.disabled = !cb.checked;
        this._recalcular();
      });
    });
    this.$$(".aloc").forEach((inp) => inp.addEventListener("input", () => this._recalcular()));

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
    this._recalcular(); // total inicial (despesas pré-marcadas)
  }

  _alocInput(id) {
    return this.$$(".aloc").find((i) => String(i.dataset.id) === String(id));
  }

  /** Alocações marcadas → [{despesa_id, valor}]. */
  _alocacoes() {
    return this.$$(".chk")
      .filter((cb) => cb.checked)
      .map((cb) => ({ despesa_id: cb.dataset.id, valor: Number((this._alocInput(cb.dataset.id) || {}).value) || 0 }))
      .filter((a) => a.valor > 0);
  }

  _recalcular() {
    const total = this._alocacoes().reduce((s, a) => s + a.valor, 0);
    if (this.$("#total")) this.$("#total").textContent = `Total: ${moeda(total)}`;
  }

  async salvar() {
    const alocacoes = this._alocacoes();
    if (!alocacoes.length) {
      notificarErro(new Error("Selecione ao menos uma despesa e informe o valor."));
      return;
    }
    const pagador = this.$("#pagador").value || "";
    if (!pagador) {
      this.$("#pagador").setAttribute("error", "Selecione quem pagou.");
      return;
    }
    this.$("#pagador").removeAttribute("error");

    const hoje = new Date().toISOString().substring(0, 10);
    const dataPg = this.$("#data").value || hoje;
    if (dataPg > hoje) {
      this.$("#data").setAttribute("error", "A data não pode ser futura.");
      return;
    }
    this.$("#data").removeAttribute("error");

    const obraId = (this.obra || {}).id;
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      // 1 pagamento por despesa — o recebedor/empresa são derivados de cada despesa
      // (ofertante/fornecedor) no servidor. Quem paga e a data são comuns.
      for (const a of alocacoes) {
        await dataStore.lancarPagamento(obraId, a.despesa_id, { valor: a.valor, pagador, data: dataPg });
      }
      toastSucesso(`${alocacoes.length} pagamento(s) registrado(s).`);
      this.emitir("salvo", {});
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("pagamento-form", PagamentoForm);
