/**
 * <cotacao-despesa-form> — Modal para REGISTRAR uma oferta como DESPESA. A
 * despesa nasce SEMPRE de uma oferta (inteira). Dois modos (mesmo componente):
 *  • oferta-fixa: `.cotacao`+`.preco` definidos (a partir da cotação/orçamento);
 *    o usuário escolhe a OBRA.
 *  • obra-fixa: `.obraFixaId` definido (a partir da obra); o usuário escolhe a
 *    OFERTA (abas Material/Serviço + ofertas ainda não registradas).
 *
 * Em ambos: Subclassificação + Responsabilidade (% por participante) e — quando
 * o ofertante é uma EQUIPE — quanto cada integrante recebeu. A despesa guarda o
 * ofertante (contato/equipe) e a empresa (fornecedor) da oferta.
 *
 * Eventos: "registrado" ({ obra_id }), "fechar". Reusa dataStore.registrarDespesaOferta.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { totalOferta } from "./cotacao-util.js";
import { ofertanteNome } from "../orcamentos/orcamento-util.js";
import "../../components/ui-modal.js";
import "../../components/ui-tabs.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";
import "../despesas/category-badge.js";
import "../despesas/split-editor.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#2563eb", "Serviço": "#7c3aed" };
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
    const titulo = this.modoObra ? "Registrar oferta" : "Registrar como despesa";
    const topo = this.modoObra
      ? `<ui-tabs id="abas"></ui-tabs>
         <ui-select id="oferta" label="Oferta"></ui-select>`
      : `<ui-select id="obra" label="Obra"></ui-select>`;
    return `
      <ui-modal open title="${titulo}">
        <div class="campos">
          <ui-alert id="erro" tipo="erro"></ui-alert>
          ${topo}
          <div class="resumo" id="resumo" hidden></div>
          <ui-select id="categoria" label="Subclassificação"></ui-select>
          <div class="secao">
            <label class="tx">Responsabilidade — % por participante (soma 100%)</label>
            <split-editor id="responsaveis"></split-editor>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="confirmar">${this.modoObra ? "Registrar despesa" : "Lançar despesa"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    // Subclassificação (comum aos dois modos).
    const selCat = this.$("#categoria");
    selCat.options = [{ value: "", label: "— Sem subclassificação —" }].concat(
      dataStore.categoriasItem().map((c) => ({ value: c.id, label: c.nome }))
    );
    selCat.value = this.modoObra ? "" : this.cotacao.categoria_id || "";

    if (this.modoObra) {
      this.$("#abas").abas = CLASSIFICACOES.map((c) => ({ id: c, rotulo: c, icone: "tag" }));
      this.$("#abas").addEventListener("mudar", () => this.preencherOfertas());
      this.preencherOfertas();
      this.$("#oferta").addEventListener("change", (e) => this.onOfertaSelecionada(e.detail.value));
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
    return `${nome} · ${ofert} · ${moeda(totalOferta(o.preco, o.cotacao))}`;
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

  /** Nome da empresa (fornecedor) do contato ofertante. */
  empresaDoContato(contatoId) {
    const c = dataStore.contatos().find((x) => String(x.id) === String(contatoId));
    if (!c || !c.fornecedor_id) return "";
    return (dataStore.fornecedores().find((f) => String(f.id) === String(c.fornecedor_id)) || {}).nome || "";
  }

  pintarResumo() {
    const box = this.$("#resumo");
    if (!box) return;
    const { preco, cotacao } = this.ofertaAtual();
    if (!preco || !preco.id) {
      box.setAttribute("hidden", "");
      return;
    }
    box.removeAttribute("hidden");
    const total = totalOferta(preco, cotacao);
    const itemNome = (cotacao.item_id && (dataStore.item(cotacao.item_id) || {}).nome) || cotacao.descricao || "";
    const ofert = ofertanteNome(preco.contato_id, preco.equipe_id);
    const empresa = preco.equipe_id ? "" : this.empresaDoContato(preco.contato_id);
    box.innerHTML = `
      <span class="item">${itemNome}</span>
      ${cotacao.classificacao ? `<category-badge nome="${cotacao.classificacao}" cor="${COR_CLASSIFICACAO[cotacao.classificacao] || "var(--cor-neutro)"}"></category-badge>` : ""}
      <span class="val">${moeda(total)}</span>
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
    const { preco, cotacao } = this.ofertaAtual();
    if (!preco || !preco.id) {
      if (this.$("#oferta")) this.$("#oferta").setAttribute("error", "Selecione uma oferta.");
      return;
    }

    const responsaveis = this.$("#responsaveis").itens
      .filter((x) => x.chave)
      .map((x) => ({ chave: x.chave, pct: Number(x.valor) || 0 }));
    const somaPct = responsaveis.reduce((s, r) => s + (Number(r.pct) || 0), 0);
    if (somaPct - 100 > 0.01) {
      if (alerta) alerta.mensagem = `A soma das responsabilidades (${Math.round(somaPct * 100) / 100}%) não pode passar de 100%.`;
      return;
    }

    const btn = this.$("#confirmar");
    btn.setAttribute("loading", "");
    try {
      // Cria a despesa E marca a oferta como registrada + fecha a cotação (servidor).
      // A distribuição por integrante (equipe) é feita depois, em cada leva de pagamento.
      await dataStore.registrarDespesaOferta(
        cotacao.id,
        preco.id,
        obraId,
        this.$("#categoria").value,
        responsaveis
      );
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
