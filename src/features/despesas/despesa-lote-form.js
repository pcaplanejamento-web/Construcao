/**
 * <despesa-lote-form> — EDIÇÃO EM MASSA das despesas SELECIONADAS. Aplica de uma vez:
 * Excluir pagamentos, Editar data, mudar Ofertante e Empresa. Cada campo é OPCIONAL
 * (só altera o que for preenchido/marcado). Reusa `dataStore.atualizarDespesa` +
 * `excluirPagamento` (nada novo no razão). REGRA: mudar ofertante/empresa só vale p/
 * despesas SEM pagamento — as pagas são IGNORADAS nesse campo (com aviso), preservando
 * o recebedor do pagamento já feito (para trocar, exclua o pagamento no mesmo lote).
 *
 * Propriedade: .obra, .despesas (selecionadas). Eventos: "salvo", "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, toastInfo, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";

const MANTER = "__manter__"; // valor sentinela: "não alterar este campo"

class DespesaLoteForm extends BaseElement {
  set obra(v) {
    this._obra = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get obra() {
    return this._obra || null;
  }
  set despesas(v) {
    this._despesas = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get despesas() {
    return this._despesas || [];
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .tx { font-size: var(--fs-sm); color: var(--cor-texto-suave); display: block; margin-bottom: var(--esp-1); }
      .ck { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-sm);
        font-weight: var(--peso-medio); color: var(--cor-texto); cursor: pointer; }
      .ck input { width: 18px; height: 18px; accent-color: var(--cor-primaria); flex: none; }
      .secao { border-top: 1px solid var(--cor-borda); padding-top: var(--esp-3); }
      .dica { font-size: var(--fs-xs); color: var(--cor-texto-fraco); margin-top: 4px; }
    `;
  }

  template() {
    const n = this.despesas.length;
    return `
      <ui-modal open title="Editar ${n} despesa(s)">
        <div class="campos">
          <ui-alert id="erro" tipo="erro"></ui-alert>
          <ui-alert tipo="info" message="Só altera os campos que você preencher. As demais informações de cada despesa ficam como estão."></ui-alert>
          <div class="secao">
            <label class="ck"><input type="checkbox" id="excluirPag" /> Excluir os pagamentos das selecionadas</label>
            <div class="dica">Zera o que já foi pago (torna-as "A pagar").</div>
          </div>
          <div class="secao">
            <label class="tx" for="data">Nova data (em branco = não alterar)</label>
            <ui-input id="data" type="date"></ui-input>
          </div>
          <div class="secao">
            <ui-select id="ofertante" label="Ofertante (contato ou grupo)"></ui-select>
            <ui-select id="fornecedor" label="Empresa"></ui-select>
            <div class="dica">Ofertante/Empresa só mudam nas despesas SEM pagamento — as pagas são ignoradas (exclua o pagamento acima p/ trocar).</div>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">Aplicar às ${n}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    // Ofertante: contatos + grupos (equipes) — 1ª opção "não alterar".
    const selOf = this.$("#ofertante");
    if (selOf) {
      const opcoes = [
        { value: MANTER, label: "— Não alterar —" },
        { value: "", label: "— Sem ofertante —" },
      ];
      dataStore.contatosAtivos().forEach((c) => opcoes.push({ value: "c:" + c.id, label: c.nome }));
      dataStore.equipes().forEach((e) => opcoes.push({ value: "e:" + e.id, label: `${e.nome} — grupo` }));
      selOf.options = opcoes;
      selOf.value = MANTER;
    }
    // Empresa: fornecedores — 1ª opção "não alterar".
    const selForn = this.$("#fornecedor");
    if (selForn) {
      selForn.options = [
        { value: MANTER, label: "— Não alterar —" },
        { value: "", label: "— Nenhuma —" },
      ].concat(dataStore.fornecedoresAtivos().map((f) => ({ value: f.id, label: f.nome })));
      selForn.value = MANTER;
    }

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  async salvar() {
    const alerta = this.$("#erro");
    if (alerta) alerta.mensagem = "";
    const obraId = (this.obra || {}).id;
    if (!obraId) return;

    const excluirPag = !!(this.$("#excluirPag") || {}).checked;
    const novaData = (((this.$("#data") || {}).value) || "").trim();
    const ofertVal = ((this.$("#ofertante") || {}).value) || MANTER;
    const fornVal = ((this.$("#fornecedor") || {}).value) || MANTER;
    const mudarOfert = ofertVal !== MANTER;
    const mudarForn = fornVal !== MANTER;

    if (!excluirPag && !novaData && !mudarOfert && !mudarForn) {
      if (alerta) alerta.mensagem = "Escolha ao menos uma alteração para aplicar.";
      return;
    }

    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    let bloqueadas = 0;
    let alteradas = 0;
    let pagsExcluidos = 0;
    try {
      for (const dSel of this.despesas) {
        const id = dSel && dSel.id;
        if (!id) continue;
        // 1) Excluir pagamentos (torna a despesa "sem pagamento").
        if (excluirPag) {
          for (const p of dataStore.pagamentosDaDespesa(id)) {
            await dataStore.excluirPagamento(p);
            pagsExcluidos++;
          }
        }
        // 2) Monta o patch com o que mudou (fresca = estado atual no store).
        const d = dataStore.despesas(obraId).find((x) => String(x.id) === String(id)) || dSel;
        const patch = {};
        if (novaData) patch.data = novaData;
        if (mudarOfert || mudarForn) {
          if (dataStore.despesaTemPagamento(d)) {
            bloqueadas++; // paga → não mexe no ofertante/empresa
          } else {
            if (mudarOfert) {
              if (ofertVal.indexOf("c:") === 0) { patch.ofertante_contato_id = ofertVal.slice(2); patch.ofertante_equipe_id = ""; }
              else if (ofertVal.indexOf("e:") === 0) { patch.ofertante_equipe_id = ofertVal.slice(2); patch.ofertante_contato_id = ""; }
              else { patch.ofertante_contato_id = ""; patch.ofertante_equipe_id = ""; }
            }
            if (mudarForn) patch.fornecedor_id = fornVal;
          }
        }
        if (Object.keys(patch).length) {
          await dataStore.atualizarDespesa(obraId, id, patch);
          alteradas++;
        }
      }
      const partes = [];
      if (alteradas) partes.push(`${alteradas} atualizada(s)`);
      if (pagsExcluidos) partes.push(`${pagsExcluidos} pagamento(s) excluído(s)`);
      toastSucesso(partes.length ? `Pronto: ${partes.join(" · ")}.` : "Edição em massa concluída.");
      if (bloqueadas) toastInfo(`${bloqueadas} despesa(s) com pagamento não tiveram ofertante/empresa alterados.`);
      this.emitir("salvo", {});
      this.emitir("fechar");
    } catch (e) {
      if (alerta) alerta.mensagem = (e && e.message) || "Não foi possível aplicar a edição em massa.";
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("despesa-lote-form", DespesaLoteForm);
