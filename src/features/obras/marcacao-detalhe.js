/**
 * <marcacao-detalhe> — Modal com os DADOS COMPLETOS de uma marcação da agenda
 * (despesa, transferência, nota ou prazo), buscados do data-store por `ref`.
 * Auto-contido: emite "fechar" e "ir-aba" ({ aba }) — o <obra-agenda> troca a aba
 * de origem (Despesas/Transferência/Notas). Eventos do Google não passam aqui
 * (o <obra-agenda> abre o formulário de edição direto).
 *
 * Propriedades: .marcacao ({ tipo, ref:{tipo,id}, titulo, ... }), .obraId (string)
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { ROTULO_TIPO } from "./marcacoes.js";
import { textoPrazo } from "./prazo-util.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function ehVerdade(v) { return v === true || v === "TRUE" || v === "true"; }

// Aba de origem (id do <ui-tabs id="abas"> em obra-detail-view) por tipo.
const ABA_ORIGEM = { despesa: "despesas", transferencia: "pagamentos", nota: "notas" };

class MarcacaoDetalhe extends BaseElement {
  set marcacao(v) { this._m = v || null; if (this.shadowRoot.childElementCount) this.renderizar(); }
  get marcacao() { return this._m || null; }
  set obraId(v) { this._obraId = v; }
  get obraId() { return this._obraId; }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-3); margin: 0; }
      .linha { display: grid; grid-template-columns: 132px 1fr; gap: var(--esp-3); align-items: start; }
      dt { color: var(--cor-texto-suave); font-size: var(--fs-sm); font-weight: var(--peso-semi); }
      dd { margin: 0; color: var(--cor-texto); font-size: var(--fs-md); word-break: break-word; }
      dd.pre { white-space: pre-wrap; line-height: 1.5; }
      @media (max-width: 480px) { .linha { grid-template-columns: 1fr; gap: 2px; } }
    `;
  }

  _naoEncontrado(rotulo) {
    return { titulo: rotulo, campos: [{ rotulo: "Aviso", valor: "Registro não encontrado (pode ter sido removido)." }] };
  }

  /** Monta { titulo, campos:[{rotulo, valor, pre?}] } conforme o tipo da marcação. */
  _dados() {
    const m = this.marcacao || {};
    const ref = m.ref || {};
    const oid = this.obraId;

    if (ref.tipo === "despesa") {
      const d = (dataStore.despesas(oid) || []).find((x) => String(x.id) === String(ref.id));
      if (!d) return this._naoEncontrado("Despesa");
      const nome = d.item || (dataStore.item(d.item_id) || {}).nome || "Despesa";
      return { titulo: "Despesa", campos: [
        { rotulo: "Item", valor: nome },
        { rotulo: "Classificação", valor: d.classificacao },
        { rotulo: "Valor", valor: moeda(d.valor) },
        { rotulo: "Data", valor: fmtData(d.data) },
        { rotulo: "Pago", valor: ehVerdade(d.pago) ? "Sim" : "Não" },
        { rotulo: "Observação", valor: d.observacao, pre: true },
        { rotulo: "Autor", valor: d.autor_nome },
      ] };
    }

    if (ref.tipo === "transferencia") {
      const t = dataStore.transferencia(ref.id);
      if (!t) return this._naoEncontrado("Transferência");
      const v = t.valor_total != null ? t.valor_total : t.valor;
      return { titulo: "Transferência", campos: [
        { rotulo: "Valor", valor: moeda(v) },
        { rotulo: "Data", valor: fmtData(t.data) },
        { rotulo: "Tipo", valor: t.tipo },
        { rotulo: "Observação", valor: t.observacao, pre: true },
        { rotulo: "Autor", valor: t.autor_nome },
      ] };
    }

    if (ref.tipo === "nota") {
      const n = (dataStore.notasDaObra(oid) || []).find((x) => String(x.id) === String(ref.id));
      if (!n) return this._naoEncontrado("Nota");
      return { titulo: n.titulo || "Nota", campos: [
        { rotulo: "Texto", valor: n.texto, pre: true },
        { rotulo: "Autor", valor: n.autor_nome },
        { rotulo: "Criada", valor: fmtData(n.criado_em) },
        { rotulo: "Atualizada", valor: fmtData(n.atualizado_em) },
      ] };
    }

    if (ref.tipo === "prazo") {
      const o = dataStore.obra(oid) || {};
      return { titulo: "Prazo de entrega", campos: [
        { rotulo: "Obra", valor: o.nome },
        { rotulo: "Prazo", valor: fmtData(o.prazo) },
        { rotulo: "Situação", valor: textoPrazo(o) },
      ] };
    }

    return { titulo: ROTULO_TIPO[m.tipo] || "Marcação", campos: [{ rotulo: "Título", valor: m.titulo }] };
  }

  template() {
    const info = this._dados();
    const aba = ABA_ORIGEM[(this.marcacao || {}).tipo];
    const linhas = info.campos
      .filter((c) => c.valor != null && String(c.valor).trim() !== "")
      .map((c) => `<div class="linha"><dt>${esc(c.rotulo)}</dt><dd class="${c.pre ? "pre" : ""}">${esc(c.valor)}</dd></div>`)
      .join("");
    return `
      <ui-modal open title="${esc(info.titulo)}">
        <dl class="campos">${linhas}</dl>
        <div slot="rodape">
          ${aba ? `<ui-button id="origem" variant="secundario">Abrir na aba de origem</ui-button>` : ""}
          <ui-button id="fechar">Fechar</ui-button>
        </div>
      </ui-modal>`;
  }

  aposRender() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    const origem = this.$("#origem");
    if (origem) origem.addEventListener("click", () => this.emitir("ir-aba", { aba: ABA_ORIGEM[(this.marcacao || {}).tipo] }));
  }
}

customElements.define("marcacao-detalhe", MarcacaoDetalhe);
