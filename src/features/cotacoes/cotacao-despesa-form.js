/**
 * <cotacao-despesa-form> — Modal para REGISTRAR despesa(s) a partir de ofertas. A
 * despesa nasce SEMPRE de uma oferta (inteira). Dois modos (mesmo componente):
 *  • oferta-fixa: `.cotacao`+`.preco` definidos (a partir da cotação/orçamento);
 *    o usuário escolhe a OBRA.
 *  • obra-fixa: `.obraFixaId` definido (a partir da obra). Aqui o usuário escolhe
 *    O QUE registrar: uma OFERTA avulsa (abas Material/Serviço) ou um ORÇAMENTO
 *    COMPLETO da obra (todas as ofertas ainda não registradas viram despesas).
 *
 * A SUBCLASSIFICAÇÃO não é mais escolhida aqui — ela é herdada do ITEM (definida
 * na criação do item; o servidor a aplica). O valor da despesa = valor final
 * (unitário com desconto, se houver) × quantidade da oferta.
 *
 * Eventos: "registrado" ({ obra_id }), "fechar". Reusa registrarDespesaOferta /
 * registrarOrcamentoCompleto do data-store.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { toastSucesso, toastAviso, notificarErro } from "../../core/event-bus.js";
import { totalOferta, qtdOferta, unitFinalOferta } from "./cotacao-util.js";
import { ofertanteNome, rotuloOrcamento } from "../orcamentos/orcamento-util.js";
import "../../components/ui-modal.js";
import "../../components/ui-tabs.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";
import "../despesas/category-badge.js";
import "../despesas/split-editor.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };
const CLASSIFICACOES = ["Material", "Serviço"];

class CotacaoDespesaForm extends BaseElement {
  set cotacao(v) {
    this._cotacao = v || null;
  }
  get cotacao() {
    return this._cotacao || {};
  }
  set preco(v) {
    this._preco = v || null;
  }
  get preco() {
    return this._preco || {};
  }
  set contatoNome(v) {
    this._contatoNome = v || "";
  }
  get contatoNome() {
    return this._contatoNome || "";
  }
  /** Quando definido, abre em modo obra-fixa (escolhe a oferta). */
  set obraFixaId(v) {
    this._obraFixaId = v || "";
  }
  get obraFixaId() {
    return this._obraFixaId || "";
  }

  get modoObra() {
    return !!this._obraFixaId;
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .resumo { background: var(--cor-superficie-2); border-radius: var(--raio-sm);
        padding: var(--esp-3) var(--esp-4); display: flex; flex-direction: column; gap: 4px; }
      .resumo .item { font-weight: var(--peso-semi); }
      .resumo .val { font-size: var(--fs-lg); font-weight: var(--peso-forte);
        color: var(--cor-primaria); }
      .resumo small { color: var(--cor-texto-suave); }
      .secao { border-top: 1px solid var(--cor-borda); padding-top: var(--esp-3); }
      label.tx { font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); display: block; }
      [hidden] { display: none; }
    `;
  }

  template() {
    const titulo = "Registrar Despesa";
    const topo = this.modoObra
      ? `<ui-select id="modoReg" label="O que registrar?"></ui-select>
         <div id="secOferta">
           <ui-tabs id="abas"></ui-tabs>
           <ui-select id="oferta" label="Oferta"></ui-select>
         </div>
         <div id="secOrcamento" hidden>
           <ui-select id="orcamento" label="Orçamento (registra todas as ofertas)"></ui-select>
         </div>`
      : `<ui-select id="obra" label="Obra"></ui-select>`;
    return `
      <ui-modal open title="${titulo}">
        <div class="campos">
          <ui-alert id="erro" tipo="erro"></ui-alert>
          ${topo}
          <div class="resumo" id="resumo" hidden></div>
          <div class="secao">
            <label class="tx">Responsabilidade — % por participante (soma 100%)</label>
            <split-editor id="responsaveis"></split-editor>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="confirmar">Registrar despesa</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    if (this.modoObra) {
      const selModo = this.$("#modoReg");
      selModo.options = [
        { value: "oferta", label: "Uma oferta" },
        { value: "orcamento", label: "Orçamento completo" },
      ];
      selModo.value = "oferta";
      selModo.addEventListener("change", () => this.alternarModoReg());

      this.$("#abas").abas = CLASSIFICACOES.map((c) => ({ id: c, rotulo: c, icone: "tag" }));
      this.$("#abas").addEventListener("mudar", () => this.preencherOfertas());
      this.preencherOfertas();
      this.$("#oferta").addEventListener("change", (e) => this.onOfertaSelecionada(e.detail.value));

      this.preencherOrcamentos();
      this.$("#orcamento").addEventListener("change", (e) => this.onOrcamentoSelecionado(e.detail.value));
    } else {
      const selObra = this.$("#obra");
      selObra.options = dataStore.obras().map((o) => ({ value: o.id, label: o.nome }));
      selObra.value = this.cotacao.obra_id || (dataStore.obras()[0] || {}).id || "";
      selObra.addEventListener("change", () => this.atualizarResponsaveis());
      this.pintarResumo();
    }
    this.atualizarResponsaveis();

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#confirmar").addEventListener("click", () => this.confirmar());
  }

  get classificacao() {
    return (this.$("#abas") && this.$("#abas").ativo) || CLASSIFICACOES[0];
  }

  /** Obra resolvida (fixa ou escolhida). */
  obraAtual() {
    return this.modoObra ? this._obraFixaId : (this.$("#obra") && this.$("#obra").value) || "";
  }

  /** Oferta resolvida { preco, cotacao } (escolhida ou fixa). */
  ofertaAtual() {
    if (this.modoObra) return this._ofertaSel || { preco: {}, cotacao: {} };
    return { preco: this.preco, cotacao: this.cotacao };
  }

  /** Ofertas (preço+cotação) ainda não registradas, da classificação dada. */
  ofertasNaoRegistradas(classificacao) {
    const out = [];
    dataStore.cotacoes().forEach((c) => {
      if (String(c.classificacao || "") !== classificacao) return;
      dataStore.precosDaCotacao(c.id).forEach((p) => {
        if (p.despesa_id) return; // já virou despesa
        out.push({ preco: p, cotacao: c });
      });
    });
    return out;
  }

  rotuloOferta(o) {
    const nome = (o.cotacao.item_id && (dataStore.item(o.cotacao.item_id) || {}).nome) || o.cotacao.descricao || "Cotação";
    const ofert = ofertanteNome(o.preco.contato_id, o.preco.equipe_id);
    return `${nome} · ${qtdOferta(o.preco, o.cotacao)}× · ${ofert} · ${moeda(totalOferta(o.preco, o.cotacao))}`;
  }

  preencherOfertas() {
    const sel = this.$("#oferta");
    if (!sel) return;
    const lista = this.ofertasNaoRegistradas(this.classificacao);
    this._ofertasMap = {};
    lista.forEach((o) => (this._ofertasMap[o.preco.id] = o));
    sel.setAttribute("placeholder", lista.length ? "Selecione uma oferta" : "Nenhuma oferta desta classificação");
    sel.options = lista.map((o) => ({ value: o.preco.id, label: this.rotuloOferta(o) }));
    sel.value = "";
    sel.removeAttribute("error");
    this._ofertaSel = null;
    this.pintarResumo();
  }

  onOfertaSelecionada(precoId) {
    this._ofertaSel = (this._ofertasMap && this._ofertasMap[precoId]) || null;
    this.$("#oferta").removeAttribute("error");
    this.pintarResumo();
  }

  get modoRegistro() {
    return (this.$("#modoReg") && this.$("#modoReg").value) || "oferta";
  }

  /** Alterna entre registrar uma oferta avulsa ou o orçamento completo. */
  alternarModoReg() {
    const ehOrc = this.modoRegistro === "orcamento";
    if (this.$("#secOferta")) this.$("#secOferta").hidden = ehOrc;
    if (this.$("#secOrcamento")) this.$("#secOrcamento").hidden = !ehOrc;
    this.pintarResumo();
  }

  /** Ofertas do orçamento ainda não registradas como despesa. */
  ofertasNaoRegDoOrcamento(orcId) {
    return dataStore.ofertasDoOrcamento(orcId).filter((p) => !p.despesa_id);
  }

  /** Orçamentos desta obra que ainda têm ofertas a registrar. */
  preencherOrcamentos() {
    const sel = this.$("#orcamento");
    if (!sel) return;
    const lista = dataStore
      .orcamentos()
      .filter((o) => String(o.obra_id) === String(this._obraFixaId))
      .filter((o) => this.ofertasNaoRegDoOrcamento(o.id).length);
    this._orcMap = {};
    lista.forEach((o) => (this._orcMap[o.id] = o));
    sel.setAttribute(
      "placeholder",
      lista.length ? "Selecione um orçamento" : "Nenhum orçamento com ofertas a registrar"
    );
    sel.options = lista.map((o) => ({ value: o.id, label: rotuloOrcamento(o) }));
    sel.value = "";
    this._orcSel = null;
  }

  onOrcamentoSelecionado(orcId) {
    this._orcSel = (this._orcMap && this._orcMap[orcId]) || null;
    this.$("#orcamento").removeAttribute("error");
    this.pintarResumo();
  }

  /** Nome da empresa (fornecedor) do contato ofertante. */
  empresaDoContato(contatoId) {
    const c = dataStore.contatos().find((x) => String(x.id) === String(contatoId));
    if (!c || !c.fornecedor_id) return "";
    return (dataStore.fornecedores().find((f) => String(f.id) === String(c.fornecedor_id)) || {}).nome || "";
  }

  pintarResumo() {
    const box = this.$("#resumo");
    if (!box) return;

    // Modo orçamento completo: lista as ofertas e o total a registrar.
    if (this.modoObra && this.modoRegistro === "orcamento") {
      const orc = this._orcSel;
      if (!orc) {
        box.setAttribute("hidden", "");
        return;
      }
      const ofertas = this.ofertasNaoRegDoOrcamento(orc.id);
      const total = ofertas.reduce((s, p) => s + totalOferta(p, dataStore.cotacao(p.cotacao_id)), 0);
      const linhas = ofertas
        .map((p) => {
          const c = dataStore.cotacao(p.cotacao_id) || {};
          const nome = (c.item_id && (dataStore.item(c.item_id) || {}).nome) || c.descricao || "Item";
          return `<small>${nome} · ${qtdOferta(p, c)}× · ${moeda(totalOferta(p, c))}</small>`;
        })
        .join("");
      box.removeAttribute("hidden");
      box.innerHTML = `
        <span class="item">${rotuloOrcamento(orc)}</span>
        ${linhas}
        <span class="val">${moeda(total)} · ${ofertas.length} despesa(s)</span>`;
      return;
    }

    // Modo oferta avulsa / oferta-fixa.
    const { preco, cotacao } = this.ofertaAtual();
    if (!preco || !preco.id) {
      box.setAttribute("hidden", "");
      return;
    }
    box.removeAttribute("hidden");
    const total = totalOferta(preco, cotacao);
    const qtd = qtdOferta(preco, cotacao);
    const unit = unitFinalOferta(preco);
    const temDesc = Number(preco.valor_unit_desconto) > 0;
    // Item próprio da oferta (fallback à cotação, p/ ofertas avulsas/sem cotação).
    const itemObj =
      (preco.item_id && dataStore.item(preco.item_id)) ||
      (cotacao.item_id && dataStore.item(cotacao.item_id)) ||
      null;
    const itemNome = (itemObj && itemObj.nome) || cotacao.descricao || "";
    const classif = (itemObj && itemObj.classificacao) || cotacao.classificacao || "";
    const ofert = ofertanteNome(preco.contato_id, preco.equipe_id);
    const empresa = preco.equipe_id ? "" : this.empresaDoContato(preco.contato_id);
    box.innerHTML = `
      <span class="item">${itemNome}</span>
      ${classif ? `<category-badge nome="${classif}" cor="${COR_CLASSIFICACAO[classif] || "var(--cor-neutro)"}"></category-badge>` : ""}
      <span class="val">${moeda(total)}</span>
      <small>Qtd: ${qtd} × ${moeda(unit)}${temDesc ? " (com desconto)" : ""}</small>
      <small>Ofertante: ${ofert}${empresa ? " · Empresa: " + empresa : ""}</small>
    `;
  }

  /** Editor de responsabilidade (% por participante da obra resolvida). */
  atualizarResponsaveis() {
    const ed = this.$("#responsaveis");
    if (!ed) return;
    ed.modo = "pct";
    ed.participantes = dataStore.participantesDaObra(this.obraAtual());
    ed.limite = 100;
  }

  async confirmar() {
    const alerta = this.$("#erro");
    if (alerta) alerta.mensagem = "";
    const obraId = this.obraAtual();
    if (!obraId) {
      if (this.$("#obra")) this.$("#obra").setAttribute("error", "Selecione uma obra.");
      return;
    }

    // Responsabilidade (% por participante) — aplicada à(s) despesa(s) geradas.
    const responsaveis = this.$("#responsaveis").itens
      .filter((x) => x.chave)
      .map((x) => ({ chave: x.chave, pct: Number(x.valor) || 0 }));
    const somaPct = responsaveis.reduce((s, r) => s + (Number(r.pct) || 0), 0);
    if (somaPct - 100 > 0.01) {
      if (alerta) alerta.mensagem = `A soma das responsabilidades (${Math.round(somaPct * 100) / 100}%) não pode passar de 100%.`;
      return;
    }

    const ehOrc = this.modoObra && this.modoRegistro === "orcamento";
    const btn = this.$("#confirmar");

    // --- Orçamento completo: todas as ofertas não registradas viram despesas. ---
    if (ehOrc) {
      const orc = this._orcSel;
      if (!orc) {
        if (this.$("#orcamento")) this.$("#orcamento").setAttribute("error", "Selecione um orçamento.");
        return;
      }
      const ofertas = this.ofertasNaoRegDoOrcamento(orc.id);
      if (!ofertas.length) {
        if (alerta) alerta.mensagem = "Este orçamento não tem ofertas a registrar.";
        return;
      }
      btn.setAttribute("loading", "");
      try {
        const r = await dataStore.registrarOrcamentoCompleto(orc.id, obraId, responsaveis);
        const obra = dataStore.obra(obraId) || {};
        toastSucesso(`${r.total} despesa(s) lançada(s) em "${obra.nome || "obra"}".`);
        this.emitir("registrado", { obra_id: obraId });
        this.emitir("fechar");
      } catch (e) {
        notificarErro(e);
        btn.removeAttribute("loading");
      }
      return;
    }

    // --- Uma oferta (avulsa ou fixa). ---
    const { preco, cotacao } = this.ofertaAtual();
    if (!preco || !preco.id) {
      if (this.$("#oferta")) this.$("#oferta").setAttribute("error", "Selecione uma oferta.");
      return;
    }
    btn.setAttribute("loading", "");
    try {
      // Cria a despesa E marca a oferta como registrada + fecha a cotação (servidor).
      // A subclassificação é herdada do item; "" deixa o servidor resolvê-la.
      await dataStore.registrarDespesaOferta((cotacao && cotacao.id) || "", preco.id, obraId, "", responsaveis);
      const obra = dataStore.obra(obraId) || {};
      toastSucesso(`Despesa lançada em "${obra.nome || "obra"}".`);
      this.emitir("registrado", { obra_id: obraId });
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("cotacao-despesa-form", CotacaoDespesaForm);

/**
 * Abre o banner ÚNICO "Registrar Despesa" para uma OFERTA (modo oferta-fixa: o
 * usuário escolhe a obra). Entrada PADRONIZADA do botão "Registrar" em toda
 * tabela de ofertas. Reusa o mesmo componente de Registrar Despesa das obras.
 */
export function abrirRegistrarDespesa(oferta) {
  if (!oferta || !oferta.id) return;
  if (String(oferta.despesa_id || "")) {
    toastAviso("Esta oferta já foi registrada como despesa.");
    return;
  }
  const form = document.createElement("cotacao-despesa-form");
  form.preco = oferta;
  if (oferta.cotacao_id) form.cotacao = dataStore.cotacao(oferta.cotacao_id);
  const fechar = () => form.remove();
  form.addEventListener("fechar", fechar);
  form.addEventListener("registrado", fechar);
  document.body.appendChild(form);
}
