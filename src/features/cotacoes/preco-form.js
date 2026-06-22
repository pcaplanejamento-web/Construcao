/**
 * <preco-form> — Modal para adicionar/editar uma OFERTA (valor unitário, prazo,
 * observação). Dois modos:
 *  - Cotação (padrão): escolhe o contato (.cotacaoId fixo).
 *  - Orçamento (.orcamento definido): o contato é TRAVADO (= ofertante do
 *    orçamento) e o usuário escolhe uma COTAÇÃO (filtrada pela classificação do
 *    orçamento). A oferta vira `orcamento_id` + a cotação escolhida.
 *
 * Propriedades: .cotacaoId, .preco (edição), .orcamento (modo orçamento)
 * Eventos: "salvo", "fechar". Auto-contido (chama o data-store).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { ofertanteNome } from "../orcamentos/orcamento-util.js";
import { primeiroErro, obrigatorio, valorPositivo } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";

class PrecoForm extends BaseElement {
  set cotacaoId(v) {
    this._cotacaoId = v || "";
  }
  get cotacaoId() {
    return this._cotacaoId || "";
  }
  set preco(v) {
    this._preco = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get preco() {
    return this._preco || null;
  }
  set orcamento(v) {
    this._orcamento = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get orcamento() {
    return this._orcamento || null;
  }
  get ehEdicao() {
    return !!(this.preco && this.preco.id);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; }
      label.tx { font-size: var(--fs-sm); font-weight: var(--peso-medio);
        color: var(--cor-texto-suave); margin-bottom: var(--esp-1); display: block; }
      textarea { width: 100%; min-height: 56px; padding: var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        font-family: inherit; resize: vertical; background: var(--cor-superficie);
        color: var(--cor-texto); }
      textarea:focus { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      .lido { padding: var(--esp-3); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-sm); background: var(--cor-superficie-2); color: var(--cor-texto); }
      .lido small { color: var(--cor-texto-fraco); }
    `;
  }

  /** Nome do item (ao vivo) de uma cotação. */
  _nomeCotacao(c) {
    if (!c) return "—";
    return (c.item_id && (dataStore.item(c.item_id) || {}).nome) || c.descricao || "—";
  }

  _camposOrcamento() {
    const orc = this.orcamento;
    const p = this.preco || {};
    const ofertante = ofertanteNome(orc.contato_id, orc.equipe_id);
    const tipoRot = orc.equipe_id ? "Equipe (ofertante)" : "Contato (ofertante)";
    const cotFixaNome = this.ehEdicao ? this._nomeCotacao(dataStore.cotacao(p.cotacao_id)) : "";
    return `
      ${
        this.ehEdicao
          ? `<div><label class="tx">Cotação</label><div class="lido">${cotFixaNome}</div></div>`
          : `<ui-select id="cotacao" label="Cotação (item a ofertar)"></ui-select>`
      }
      <div><label class="tx">${tipoRot}</label>
        <div class="lido">${ofertante} <small>· definido pelo orçamento</small></div></div>
    `;
  }

  template() {
    const p = this.preco || {};
    const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
    return `
      <ui-modal open title="${this.ehEdicao ? "Editar oferta" : "Adicionar oferta"}">
        <div class="campos">
          ${this.orcamento ? this._camposOrcamento() : `<ui-select id="contato" label="Contato (quem ofertou)"></ui-select>`}
          <div class="linha">
            <ui-input id="quantidade" label="Quantidade" type="number" step="0.01" min="0"
              value="${esc(p.quantidade)}" placeholder="Ex.: 10"></ui-input>
            <ui-input id="valor" label="Valor unitário (R$)" type="number" step="0.01" min="0"
              value="${esc(p.valor_unit)}" placeholder="0,00"></ui-input>
          </div>
          <div class="linha">
            <ui-input id="desconto" label="Valor unit. com desconto (R$)" type="number" step="0.01" min="0"
              value="${esc(p.valor_unit_desconto)}" placeholder="opcional"></ui-input>
            <ui-input id="prazo" label="Prazo de entrega" value="${esc(p.prazo_entrega)}"
              placeholder="Ex.: 5 dias"></ui-input>
          </div>
          <div>
            <label class="tx">Observação</label>
            <textarea id="observacao" placeholder="Condições, frete, etc. (opcional)">${p.observacao || ""}</textarea>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Adicionar"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    if (this.orcamento) {
      if (!this.ehEdicao) this.preencherCotacoes();
    } else {
      this.preencherContatos();
    }
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  preencherContatos() {
    const sel = this.$("#contato");
    if (!sel) return;
    const mapaForn = {};
    dataStore.fornecedores().forEach((f) => (mapaForn[f.id] = f.nome));
    const contatos = dataStore.contatosAtivos();
    sel.options = contatos.map((c) => ({
      value: c.id,
      label:
        c.fornecedor_id && mapaForn[c.fornecedor_id]
          ? `${c.nome} — ${mapaForn[c.fornecedor_id]}`
          : c.nome,
    }));
    sel.value = (this.preco || {}).contato_id || (contatos[0] || {}).id || "";
  }

  /** Cotações da MESMA classificação do orçamento (Material/Serviço). */
  preencherCotacoes() {
    const sel = this.$("#cotacao");
    if (!sel) return;
    const tipo = this.orcamento.tipo;
    const cots = dataStore.cotacoes().filter((c) => String(c.classificacao) === String(tipo));
    sel.setAttribute("placeholder", cots.length ? "Selecione a cotação" : `Nenhuma cotação de ${tipo}`);
    sel.options = cots.map((c) => ({ value: c.id, label: this._nomeCotacao(c) }));
    sel.value = "";
  }

  async salvar() {
    const valor = Number(this.$("#valor").value);
    const qtd = this.$("#quantidade").value;
    const desconto = this.$("#desconto").value;
    let cotacaoId;
    let dados;

    if (this.orcamento) {
      cotacaoId = this.ehEdicao ? this.preco.cotacao_id : this.$("#cotacao").value;
      const erroValor = valorPositivo(valor);
      if (!this.ehEdicao && !cotacaoId) this.$("#cotacao").setAttribute("error", "Selecione a cotação.");
      if (erroValor) this.$("#valor").setAttribute("error", erroValor);
      if ((!this.ehEdicao && !cotacaoId) || erroValor) return;
      if (Number(desconto) > 0 && Number(desconto) > valor) {
        this.$("#desconto").setAttribute("error", "Não pode ser maior que o valor unitário.");
        return;
      }
      dados = {
        valor_unit: valor,
        quantidade: qtd,
        valor_unit_desconto: desconto,
        prazo_entrega: this.$("#prazo").value.trim(),
        observacao: this.$("#observacao").value.trim(),
      };
      if (!this.ehEdicao) {
        dados.contato_id = this.orcamento.contato_id;
        dados.orcamento_id = this.orcamento.id;
      }
    } else {
      const contatoId = this.$("#contato").value;
      const erro = primeiroErro(obrigatorio(contatoId, "O contato"), valorPositivo(valor));
      if (erro) {
        if (!contatoId) this.$("#contato").setAttribute("error", "Selecione um contato.");
        this.$("#valor").setAttribute("error", valorPositivo(valor));
        return;
      }
      if (Number(desconto) > 0 && Number(desconto) > valor) {
        this.$("#desconto").setAttribute("error", "Não pode ser maior que o valor unitário.");
        return;
      }
      cotacaoId = this.cotacaoId;
      dados = {
        contato_id: contatoId,
        valor_unit: valor,
        quantidade: qtd,
        valor_unit_desconto: desconto,
        prazo_entrega: this.$("#prazo").value.trim(),
        observacao: this.$("#observacao").value.trim(),
      };
    }

    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarPreco(cotacaoId, this.preco.id, dados);
        toastSucesso("Oferta atualizada.");
      } else {
        await dataStore.adicionarPreco(cotacaoId, dados);
        toastSucesso("Oferta adicionada.");
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

customElements.define("preco-form", PrecoForm);
