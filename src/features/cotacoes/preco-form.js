/**
 * <preco-form> — Banner ÚNICO da OFERTA (criar / editar / ver detalhes — tudo no
 * mesmo componente). A oferta é independente: nasce de um ITEM (define
 * classificação + subclassificação) e pode vincular-se a uma cotação e/ou orçamento.
 *
 * Contexto (props) — define o que fica TRAVADO:
 *  - avulsa (nenhuma): escolhe item (select), ofertante, fornecedor.
 *  - `.cotacao`/`.cotacaoId`: item = o da cotação (card, não editável); vincula à cotação.
 *  - `.orcamento`: ofertante + fornecedor herdados e travados; vincula a ele.
 *  - `.preco`: edição (item vira CARD não editável; demais campos editáveis).
 *  - `.somenteLeitura`: só visualização (ex.: aberto pela despesa) — nada editável.
 * Regras: Material → fornecedor obrigatório; Serviço → ofertante obrigatório. Prazo
 * obrigatório. O ITEM é sempre apresentado como CARD clicável → banner de detalhes
 * do item (exceto na CRIAÇÃO sem cotação, em que é um select para escolher).
 *
 * Eventos: "salvo", "fechar". Helper `abrirOferta(oferta, opcoes)` abre o banner.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { moeda } from "../../core/formatters.js";
import { ofertanteNome, COR_CLASSIFICACAO } from "../orcamentos/orcamento-util.js";
import { totalOferta, totalOfertaCheio, qtdOferta } from "./cotacao-util.js";
import { valorPositivo } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";
import "../despesas/category-badge.js";

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
  /** Só visualização (aberto pela despesa) — nada editável. */
  set somenteLeitura(v) {
    this._somenteLeitura = !!v;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get somenteLeitura() {
    return !!this._somenteLeitura;
  }
  get ehEdicao() {
    return !!(this.preco && this.preco.id);
  }
  /** Ofertante/fornecedor travados quando aberto pelo ORÇAMENTO (criar ou editar). */
  get ehOrcTravado() {
    return !!this.orcamento;
  }
  /**
   * Item é um SELECT ao CRIAR sem cotação OU quando a cotação é por SUBCLASSIFICAÇÃO
   * (o item não é fixo — escolhe-se entre os itens da subclasse). Senão é card.
   */
  itemPrecisaSelect() {
    if (this.somenteLeitura || this.ehEdicao) return false;
    const ctx = this.cotacaoCtx();
    return !ctx || String(ctx.modo || "") === "subclasse";
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
      .resumo { background: var(--cor-superficie-2); border-radius: var(--raio-sm);
        padding: var(--esp-3) var(--esp-4); display: flex; flex-direction: column; gap: 4px; }
      .resumo.clicavel { cursor: pointer; border: 1px solid var(--cor-borda);
        transition: border-color var(--transicao), background var(--transicao); }
      .resumo.clicavel:hover { border-color: var(--cor-primaria); background: var(--cor-primaria-suave); }
      .resumo .item { font-weight: var(--peso-semi); font-size: var(--fs-lg); }
      .resumo small { color: var(--cor-texto-suave); }
      .ro-row { display: flex; justify-content: space-between; gap: var(--esp-4);
        padding: var(--esp-2) 0; border-bottom: 1px solid var(--cor-divisor); }
      .ro-row .k { color: var(--cor-texto-suave); }
    `;
  }

  /** Cotação de contexto (objeto), se houver. */
  cotacaoCtx() {
    if (this._cotacao) return this._cotacao;
    if (this._cotacaoId) return dataStore.cotacao(this._cotacaoId);
    if (this.preco && this.preco.cotacao_id) return dataStore.cotacao(this.preco.cotacao_id);
    return null;
  }

  /** Item efetivo da oferta (próprio ou herdado da cotação). */
  itemResolvidoId() {
    const p = this.preco || {};
    if (p.item_id) return String(p.item_id);
    const ctx = this.cotacaoCtx();
    return ctx && ctx.item_id ? String(ctx.item_id) : "";
  }

  /** Item usado ao salvar (do select quando criando sem cotação; senão o resolvido). */
  itemAtualId() {
    if (this.itemPrecisaSelect()) {
      const sel = this.$("#item");
      return sel ? String(sel.value || "") : "";
    }
    return this.itemResolvidoId();
  }

  _fornNome(id) {
    if (!id) return "";
    return (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "";
  }

  /** Card de PRÉVIA do ITEM (clicável → detalhes do item). */
  itemCardHtml(item) {
    if (!item) return `<small>Item não definido</small>`;
    const sub = item.categoria_id
      ? (dataStore.categorias().find((c) => String(c.id) === String(item.categoria_id)) || {}).nome
      : "";
    return `
      <span class="item">${item.nome}</span>
      ${item.classificacao ? `<category-badge nome="${item.classificacao}" cor="${COR_CLASSIFICACAO[item.classificacao] || "var(--cor-neutro)"}"></category-badge>` : ""}
      ${sub ? `<small>Subclassificação: ${sub}</small>` : ""}`;
  }

  /** Banner com os detalhes do ITEM (reusa ui-modal; sem componente novo). */
  abrirDetalheItem(item) {
    if (!item) return;
    const sub = item.categoria_id
      ? (dataStore.categorias().find((c) => String(c.id) === String(item.categoria_id)) || {}).nome
      : "—";
    const linha = (k, v) =>
      `<div style="display:flex;justify-content:space-between;gap:var(--esp-4);padding:var(--esp-2) 0;border-bottom:1px solid var(--cor-divisor)"><span style="color:var(--cor-texto-suave)">${k}</span><span style="text-align:right">${v}</span></div>`;
    const modal = document.createElement("ui-modal");
    modal.setAttribute("open", "");
    modal.setAttribute("title", "Detalhes do item");
    modal.innerHTML = `<div style="display:flex;flex-direction:column">
      ${linha("Nome", item.nome || "—")}
      ${linha("Classificação", item.classificacao || "—")}
      ${linha("Subclassificação", sub || "—")}
      <div style="margin-top:var(--esp-3)"><a href="/itens/${item.id}">Abrir página do item →</a></div>
    </div>`;
    modal.addEventListener("fechar", () => modal.remove());
    document.body.appendChild(modal);
  }

  /** Linhas só-leitura com os campos da oferta (informações completas). */
  camposRoHtml() {
    const p = this.preco || {};
    const cot = this.cotacaoCtx();
    const linha = (k, v) => `<div class="ro-row"><span class="k">${k}</span><span>${v}</span></div>`;
    const empresa = this._fornNome(p.fornecedor_id);
    const temDesc = Number(p.valor_unit_desconto) > 0;
    let html = linha("Ofertante", ofertanteNome(p.contato_id, p.equipe_id) || "—");
    html += linha("Fornecedor", empresa || "—");
    html += linha("Quantidade", String(qtdOferta(p, cot)));
    html += linha("Valor unitário", moeda(p.valor_unit || 0));
    if (temDesc) html += linha("Valor unit. c/ desconto", moeda(p.valor_unit_desconto));
    html += linha("Total", moeda(totalOfertaCheio(p, cot)));
    html += linha("Total c/ desconto", moeda(totalOferta(p, cot)));
    html += linha("Prazo de entrega", p.prazo_entrega || "—");
    if (p.observacao) html += linha("Observação", p.observacao);
    return html;
  }

  template() {
    const p = this.preco || {};
    const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
    const ro = this.somenteLeitura;
    const titulo = ro ? "Detalhes da oferta" : this.ehEdicao ? "Editar oferta" : "Criar oferta";

    const blocoItem = this.itemPrecisaSelect()
      ? `<ui-select id="item" label="Item (define a classificação)"></ui-select>
         <div class="info" id="classInfo"></div>`
      : `<div><label class="tx">Item</label>
           <div class="resumo clicavel" id="itemCard" title="Ver detalhes do item"></div></div>`;

    // Layout SÓ-LEITURA: card do item + campos como linhas (sem editar).
    if (ro) {
      return `
        <ui-modal open title="${titulo}">
          <div class="campos">
            ${blocoItem}
            <div id="detRo"></div>
          </div>
          <div slot="rodape">
            <ui-button id="cancelar" variant="secundario">Fechar</ui-button>
          </div>
        </ui-modal>
      `;
    }

    const orc = this.orcamento;
    const blocoOfertante = this.ehOrcTravado
      ? `<div><label class="tx">Ofertante</label>
           <div class="lido">${ofertanteNome(orc.contato_id, orc.equipe_id)} <small>· definido pelo orçamento</small></div></div>`
      : `<ui-select id="ofertante" label="Ofertante (contato ou grupo)"></ui-select>`;
    const blocoFornecedor = this.ehOrcTravado
      ? `<div><label class="tx">Fornecedor</label>
           <div class="lido">${this._fornNome(orc.fornecedor_id) || "—"} <small>· definido pelo orçamento</small></div></div>`
      : `<ui-select id="fornecedor" label="Fornecedor"></ui-select>`;

    return `
      <ui-modal open title="${titulo}">
        <div class="campos">
          <ui-alert id="erro" tipo="erro"></ui-alert>
          ${blocoItem}
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

    // Card do item (clicável → detalhes do item).
    const itemCard = this.$("#itemCard");
    if (itemCard) {
      const item = dataStore.item(this.itemResolvidoId());
      itemCard.innerHTML = this.itemCardHtml(item);
      if (item) itemCard.addEventListener("click", () => this.abrirDetalheItem(item));
    }

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));

    // Modo só-leitura: pinta as linhas e encerra (sem controles editáveis).
    if (this.somenteLeitura) {
      if (this.$("#detRo")) this.$("#detRo").innerHTML = this.camposRoHtml();
      return;
    }

    // Item (select) — só ao criar sem cotação.
    const selItem = this.$("#item");
    if (selItem) {
      const ctxItem = this.cotacaoCtx();
      let itens =
        ctxItem && String(ctxItem.modo || "") === "subclasse" && ctxItem.categoria_id
          ? dataStore.itensDaSubclasse(ctxItem.categoria_id)
          : dataStore.itensAtivos();
      const resolvidoId = this.itemResolvidoId();
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
      let fid = p.fornecedor_id || "";
      if (!fid && p.contato_id) {
        const ct = dataStore.contatos().find((x) => String(x.id) === String(p.contato_id));
        fid = (ct && ct.fornecedor_id) || "";
      }
      selForn.value = fid;
    }
    // Quantidade: própria ou da cotação (legado), p/ não abrir vazia.
    const selQtd = this.$("#quantidade");
    if (selQtd && !String(selQtd.value || "")) {
      const ctx = this.cotacaoCtx();
      const q = p.quantidade || (ctx && ctx.quantidade) || "";
      if (Number(q) > 0) selQtd.value = q;
    }

    this.atualizarClasse();
    this.$("#salvar").addEventListener("click", () => this.salvar());
  }

  /** Texto de classificação/subclassificação do item (só no modo select). */
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

    let fornecedorId = this.ehOrcTravado
      ? String(this.orcamento.fornecedor_id || "")
      : this.$("#fornecedor")
      ? this.$("#fornecedor").value || ""
      : "";

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

/**
 * Abre o banner ÚNICO da oferta (criar/editar/ver). `opcoes`:
 * { somenteLeitura?, cotacao?, orcamento? }. Usado ao CLICAR numa oferta.
 */
export function abrirOferta(oferta, opcoes = {}) {
  if (!oferta) return;
  const form = document.createElement("preco-form");
  form.preco = oferta;
  if (opcoes.somenteLeitura) form.somenteLeitura = true;
  if (opcoes.cotacao) form.cotacao = opcoes.cotacao;
  if (opcoes.orcamento) form.orcamento = opcoes.orcamento;
  const fechar = () => form.remove();
  form.addEventListener("fechar", fechar);
  form.addEventListener("salvo", fechar);
  document.body.appendChild(form);
}
