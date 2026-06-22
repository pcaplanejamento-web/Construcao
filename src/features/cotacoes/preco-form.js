/**
 * <preco-form> — Banner ÚNICO "Criar oferta" (reusado em todo lugar que cria
 * ofertas). A oferta é independente: nasce de um ITEM (define classificação +
 * subclassificação) e pode vincular-se a uma cotação e/ou orçamento.
 *
 * Contexto (props):
 *  - avulsa (nenhuma): escolhe item, ofertante, fornecedor.
 *  - `.cotacao` ou `.cotacaoId`: item TRAVADO (= item da cotação); vincula à cotação.
 *  - `.orcamento`: ofertante + fornecedor herdados do orçamento e TRAVADOS; vincula a ele.
 *  - `.preco`: edição (item travado).
 * Regras pela classificação do item — Material: fornecedor obrigatório, ofertante
 * opcional; Serviço: ofertante obrigatório, fornecedor opcional. Prazo obrigatório.
 *
 * Eventos: "salvo", "fechar". Auto-contido (chama o data-store).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { ofertanteNome } from "../orcamentos/orcamento-util.js";
import { valorPositivo } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";

class PrecoForm extends BaseElement {
  set cotacaoId(v) {
    this._cotacaoId = v || "";
  }
  get cotacaoId() {
    return this._cotacaoId || "";
  }
  set cotacao(v) {
    this._cotacao = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get cotacao() {
    return this._cotacao || null;
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
  /** Ofertante/fornecedor vêm travados do orçamento (só ao criar). */
  get ehOrcTravado() {
    return !!this.orcamento && !this.ehEdicao;
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
      .info { font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .info b { color: var(--cor-texto); }
    `;
  }

  /** Cotação de contexto (objeto), se houver. */
  cotacaoCtx() {
    if (this._cotacao) return this._cotacao;
    if (this._cotacaoId) return dataStore.cotacao(this._cotacaoId);
    if (this.ehEdicao && this.preco.cotacao_id) return dataStore.cotacao(this.preco.cotacao_id);
    return null;
  }

  /** Id do item TRAVADO: só ao CRIAR a partir de uma cotação (item da cotação).
   * Na EDIÇÃO tudo é editável — o item vira select pré-preenchido. */
  itemTravadoId() {
    if (this.ehEdicao) return "";
    const ctx = this.cotacaoCtx();
    return ctx && ctx.item_id ? String(ctx.item_id) : "";
  }

  /** Item efetivo (travado ou selecionado). */
  itemAtualId() {
    const trav = this.itemTravadoId();
    if (trav) return trav;
    const sel = this.$("#item");
    return sel ? String(sel.value || "") : "";
  }

  _fornNome(id) {
    if (!id) return "";
    return (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "";
  }

  template() {
    const p = this.preco || {};
    const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
    const travId = this.itemTravadoId();
    const itemTravado = travId ? dataStore.item(travId) : null;
    const orc = this.orcamento;

    const blocoItem = travId
      ? `<div><label class="tx">Item</label>
           <div class="lido">${(itemTravado || {}).nome || "—"}</div></div>`
      : `<ui-select id="item" label="Item (define a classificação)"></ui-select>`;

    const blocoOfertante = this.ehOrcTravado
      ? `<div><label class="tx">Ofertante</label>
           <div class="lido">${ofertanteNome(orc.contato_id, orc.equipe_id)} <small>· definido pelo orçamento</small></div></div>`
      : `<ui-select id="ofertante" label="Ofertante (contato ou grupo)"></ui-select>`;

    const blocoFornecedor = this.ehOrcTravado
      ? `<div><label class="tx">Fornecedor</label>
           <div class="lido">${this._fornNome(orc.fornecedor_id) || "—"} <small>· definido pelo orçamento</small></div></div>`
      : `<ui-select id="fornecedor" label="Fornecedor"></ui-select>`;

    return `
      <ui-modal open title="${this.ehEdicao ? "Editar oferta" : "Criar oferta"}">
        <div class="campos">
          <ui-alert id="erro" tipo="erro"></ui-alert>
          ${blocoItem}
          <div class="info" id="classInfo"></div>
          ${blocoOfertante}
          ${blocoFornecedor}
          <div class="linha">
            <ui-input id="quantidade" label="Quantidade" type="number" step="0.01" min="0"
              value="${esc(p.quantidade)}" placeholder="Ex.: 10"></ui-input>
            <ui-input id="valor" label="Valor unitário (R$)" type="number" step="0.01" min="0"
              value="${esc(p.valor_unit)}" placeholder="0,00"></ui-input>
          </div>
          <div class="linha">
            <ui-input id="desconto" label="Valor unit. com desconto (R$)" type="number" step="0.01" min="0"
              value="${esc(p.valor_unit_desconto)}" placeholder="opcional"></ui-input>
            <ui-input id="prazo" label="Data/prazo de entrega" value="${esc(p.prazo_entrega)}"
              placeholder="Ex.: 5 dias"></ui-input>
          </div>
          <div>
            <label class="tx">Observação</label>
            <textarea id="observacao" placeholder="Condições, frete, etc. (opcional)">${p.observacao || ""}</textarea>
          </div>
        </div>
        <div slot="rodape">
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar oferta"}</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    const p = this.preco || {};
    // Item (quando livre). Pré-preenche com o item próprio OU o da cotação (legado).
    const selItem = this.$("#item");
    if (selItem) {
      const ctx = this.cotacaoCtx();
      const resolvidoId = p.item_id || (ctx && ctx.item_id) || "";
      let itens = dataStore.itensAtivos();
      // Garante que o item atual da oferta apareça na lista (mesmo se inativo).
      if (resolvidoId && !itens.some((i) => String(i.id) === String(resolvidoId))) {
        const it = dataStore.item(resolvidoId);
        if (it) itens = [it, ...itens];
      }
      selItem.setAttribute("placeholder", itens.length ? "Selecione o item" : "Nenhum item cadastrado");
      selItem.options = itens.map((i) => ({ value: i.id, label: `${i.nome} — ${i.classificacao}` }));
      selItem.value = resolvidoId;
      selItem.addEventListener("change", () => this.atualizarClasse());
    }
    // Ofertante (quando livre).
    const selOf = this.$("#ofertante");
    if (selOf) {
      const opcoes = [{ value: "", label: "— Sem ofertante —" }];
      dataStore.contatosAtivos().forEach((c) => opcoes.push({ value: "c:" + c.id, label: c.nome }));
      dataStore.equipes().forEach((e) => opcoes.push({ value: "e:" + e.id, label: `${e.nome} — grupo` }));
      selOf.options = opcoes;
      selOf.value = p.equipe_id ? "e:" + p.equipe_id : p.contato_id ? "c:" + p.contato_id : "";
      selOf.addEventListener("change", () => this.autoFornecedor());
    }
    // Fornecedor (quando livre).
    const selForn = this.$("#fornecedor");
    if (selForn) {
      selForn.options = [{ value: "", label: "— Nenhum —" }].concat(
        dataStore.fornecedoresAtivos().map((f) => ({ value: f.id, label: f.nome }))
      );
      // Fornecedor próprio, ou do contato ofertante.
      let fid = p.fornecedor_id || "";
      if (!fid && p.contato_id) {
        const ct = dataStore.contatos().find((x) => String(x.id) === String(p.contato_id));
        fid = (ct && ct.fornecedor_id) || "";
      }
      selForn.value = fid;
    }
    // Quantidade: própria da oferta OU a da cotação (legado), p/ não abrir vazia.
    const selQtd = this.$("#quantidade");
    if (selQtd && !String(selQtd.value || "")) {
      const ctx = this.cotacaoCtx();
      const q = p.quantidade || (ctx && ctx.quantidade) || "";
      if (Number(q) > 0) selQtd.value = q;
    }

    this.atualizarClasse();
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  /** Atualiza o texto de classificação/subclassificação do item efetivo. */
  atualizarClasse() {
    const box = this.$("#classInfo");
    if (!box) return;
    const item = dataStore.item(this.itemAtualId());
    if (!item) {
      box.innerHTML = "";
      return;
    }
    const sub = item.categoria_id
      ? (dataStore.categorias().find((c) => String(c.id) === String(item.categoria_id)) || {}).nome
      : "";
    const exige = item.classificacao === "Material" ? "fornecedor obrigatório" : "ofertante obrigatório";
    box.innerHTML = `Classificação: <b>${item.classificacao || "—"}</b>${
      sub ? ` · Subclassificação: <b>${sub}</b>` : ""
    } <small>(${exige})</small>`;
  }

  /** Auto-preenche o fornecedor pelo contato ofertante (se vinculado). */
  autoFornecedor() {
    const selOf = this.$("#ofertante");
    const selForn = this.$("#fornecedor");
    if (!selOf || !selForn) return;
    const v = selOf.value || "";
    if (v.indexOf("c:") === 0) {
      const ct = dataStore.contatos().find((x) => String(x.id) === String(v.slice(2)));
      if (ct && ct.fornecedor_id) selForn.value = String(ct.fornecedor_id);
    }
  }

  async salvar() {
    const alerta = this.$("#erro");
    const itemId = this.itemAtualId();
    if (!itemId) {
      if (this.$("#item")) this.$("#item").setAttribute("error", "Selecione o item.");
      return;
    }
    const item = dataStore.item(itemId) || {};
    const ehMaterial = String(item.classificacao) === "Material";

    // Ofertante (contato XOR equipe).
    let contatoId = "";
    let equipeId = "";
    if (this.ehOrcTravado) {
      contatoId = String(this.orcamento.contato_id || "");
      equipeId = String(this.orcamento.equipe_id || "");
    } else {
      const v = this.$("#ofertante") ? this.$("#ofertante").value || "" : "";
      if (v.indexOf("c:") === 0) contatoId = v.slice(2);
      else if (v.indexOf("e:") === 0) equipeId = v.slice(2);
    }

    // Fornecedor.
    let fornecedorId = this.ehOrcTravado
      ? String(this.orcamento.fornecedor_id || "")
      : this.$("#fornecedor")
      ? this.$("#fornecedor").value || ""
      : "";

    // Regras por classificação.
    if (ehMaterial && !fornecedorId) {
      if (this.$("#fornecedor")) this.$("#fornecedor").setAttribute("error", "Material exige um fornecedor.");
      return;
    }
    if (!ehMaterial && !contatoId && !equipeId) {
      if (this.$("#ofertante")) this.$("#ofertante").setAttribute("error", "Serviço exige um ofertante.");
      return;
    }

    const valor = Number(this.$("#valor").value);
    const erroValor = valorPositivo(valor);
    if (erroValor) {
      this.$("#valor").setAttribute("error", erroValor);
      return;
    }
    const desconto = this.$("#desconto").value;
    if (Number(desconto) > 0 && Number(desconto) > valor) {
      this.$("#desconto").setAttribute("error", "Não pode ser maior que o valor unitário.");
      return;
    }
    const prazo = this.$("#prazo").value.trim();
    if (!prazo) {
      this.$("#prazo").setAttribute("error", "Informe a data/prazo de entrega.");
      return;
    }

    const dados = {
      item_id: itemId,
      contato_id: contatoId,
      equipe_id: equipeId,
      fornecedor_id: fornecedorId,
      valor_unit: valor,
      quantidade: this.$("#quantidade").value,
      valor_unit_desconto: desconto,
      prazo_entrega: prazo,
      observacao: this.$("#observacao").value.trim(),
    };
    // Vínculos (só ao criar): cotação e/ou orçamento de contexto.
    if (!this.ehEdicao) {
      const ctx = this.cotacaoCtx();
      if (ctx) dados.cotacao_id = ctx.id;
      if (this.orcamento) dados.orcamento_id = this.orcamento.id;
    }

    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarOferta(this.preco.id, dados);
        toastSucesso("Oferta atualizada.");
      } else {
        await dataStore.criarOferta(dados);
        toastSucesso("Oferta criada.");
      }
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      if (alerta) alerta.mensagem = (e && e.message) || "Não foi possível salvar a oferta.";
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("preco-form", PrecoForm);
