/**
 * <despesa-detail> — Banner (modal) com as informações completas de uma despesa.
 * Permite EDITAR e EXCLUIR aqui. A despesa nasce do REGISTRO de uma oferta:
 * quando tem `preco_id`, o Item/Valor/Ofertante/Empresa vêm da oferta (read-only).
 * O pagamento é por **lançamentos parciais (levas)**: cada leva tem **quem pagou**
 * (participante), valor e data; status A pagar / Em pagamento / Pago é derivado e o
 * "quem pagou quanto" (acerto) é **derivado das levas** (não há editor manual).
 * Equipe → cada leva desmembra entre integrantes (a distribuição vive só na leva).
 * Responsabilidade / Subclassificação / Observação seguem editáveis. Despesas legadas
 * (sem `preco_id`) mantêm Item/Valor editáveis. Reusa ui-modal/ui-input/ui-select/split-editor.
 *
 * Propriedades: .despesa, .categorias = [{id,nome,cor}]
 * Eventos: "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { data as fmtData, moeda, hojeIso } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { valorPositivo } from "../../core/validators.js";
import { parseLista, statusPagamento, totalRealizado, restoDespesa } from "./despesa-split.js";
import { ofertanteNome, previaOfertaHtml } from "../orcamentos/orcamento-util.js";
import { previaPagamentoHtml, abrirPagamento } from "../pagamentos/pagamento-util.js";
import { abrirOferta } from "../cotacoes/preco-form.js";
import { integrantesDaEquipe } from "../equipes/equipe-util.js";
import "../../components/ui-modal.js";
import "../../components/ui-tabs.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";
import "./split-editor.js";
import "./category-badge.js";

const CLASSIFICACOES = ["Material", "Serviço"];
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };

class DespesaDetail extends BaseElement {
  set despesa(v) {
    this._despesa = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get despesa() {
    return this._despesa || {};
  }
  set categorias(v) {
    // Mantido por compat (a subclassificação não é mais editada aqui — vem do item).
    this._categorias = Array.isArray(v) ? v : [];
  }
  get categorias() {
    return this._categorias || [];
  }

  /** Despesa vinda de uma oferta (Item/Valor/Ofertante fixos). */
  get travado() {
    return !!this.despesa.preco_id;
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
      .resumo { background: var(--cor-superficie-2); border-radius: var(--raio-sm);
        padding: var(--esp-3) var(--esp-4); display: flex; flex-direction: column; gap: 4px; }
      .resumo.clicavel { cursor: pointer; border: 1px solid var(--cor-borda);
        transition: border-color var(--transicao), background var(--transicao); }
      .resumo.clicavel:hover { border-color: var(--cor-primaria); background: var(--cor-primaria-suave); }
      .resumo .item { font-weight: var(--peso-semi); }
      .resumo .val { font-size: var(--fs-lg); font-weight: var(--peso-forte);
        color: var(--cor-primaria); }
      .resumo small { color: var(--cor-texto-suave); }
      /* Card de PAGAMENTO: levemente esverdeado (espelha o card de oferta). */
      .resumo.pag { position: relative; background: var(--cor-sucesso-suave, rgba(22,163,74,.10)); }
      .resumo.pag .val { color: var(--cor-sucesso); }
      .resumo.pag.clicavel:hover { border-color: var(--cor-sucesso); background: rgba(22,163,74,.16); }
      .resumo.pag .rem { position: absolute; top: var(--esp-2); right: var(--esp-2); }
      .pag-cards { display: flex; flex-direction: column; gap: var(--esp-2); }
      .pag-aviso { font-size: var(--fs-sm); color: var(--cor-texto-suave);
        background: var(--cor-superficie-2); border-radius: var(--raio-sm); padding: var(--esp-2) var(--esp-3); }
      .secao { border-top: 1px solid var(--cor-borda); padding-top: var(--esp-3); }
      .statuslinha { display: flex; align-items: center; gap: var(--esp-2);
        margin-bottom: var(--esp-2); flex-wrap: wrap; }
      .muted { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      .lancamento { display: flex; align-items: center; gap: var(--esp-2);
        padding: var(--esp-2) 0; border-bottom: 1px solid var(--cor-borda); }
      .lc-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
      .lancar { display: flex; flex-direction: column; gap: var(--esp-3); margin-top: var(--esp-2); }
      .rem { border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        color: var(--cor-erro); border-radius: var(--raio-sm); width: 30px; height: 30px;
        flex: none; cursor: pointer; }
      .rem:hover { background: var(--cor-superficie-2); }
      .auditoria { font-size: var(--fs-xs); color: var(--cor-texto-fraco);
        border-top: 1px solid var(--cor-borda); padding-top: var(--esp-3);
        display: flex; flex-direction: column; gap: 2px; }
      .rodape { display: flex; gap: var(--esp-3); width: 100%; }
      .rodape .cresce { flex: 1; }
    `;
  }

  /** Nome da empresa (fornecedor) pelo id. */
  empresaNome(id) {
    if (!id) return "";
    return (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "";
  }

  template() {
    const d = this.despesa;
    const editado =
      d.editor_nome && d.atualizado_em && String(d.atualizado_em) !== String(d.criado_em);
    const dataVal = d.data ? String(d.data).substring(0, 10) : "";

    // Item/Valor: da OFERTA (read-only — edita-se a oferta, não a despesa) ou editáveis (legado).
    let topo;
    if (this.travado) {
      topo = `
        <label class="tx">Oferta de origem</label>
        <div class="resumo clicavel" id="ofertaBox" title="Ver detalhes da oferta"></div>
        <ui-input id="data" label="Data" type="date" value="${dataVal}"></ui-input>`;
    } else {
      topo = `
        <ui-tabs id="abas"></ui-tabs>
        <ui-select id="item" label="Item"></ui-select>
        <div class="linha">
          <ui-input id="valor" label="Valor (R$)" type="number" step="0.01" min="0" value="${d.valor || ""}"></ui-input>
          <ui-input id="data" label="Data" type="date" value="${dataVal}"></ui-input>
        </div>`;
    }

    const eqp = !!d.ofertante_equipe_id;
    return `
      <ui-modal open title="Despesa">
        <div class="campos">
          <ui-alert id="erro" tipo="erro"></ui-alert>
          ${topo}
          <div>
            <label class="tx">Observação</label>
            <textarea id="observacao" placeholder="Detalhes (opcional)">${d.observacao || ""}</textarea>
          </div>
          <div class="secao" id="secPag">
            <label class="tx">Pagamentos</label>
            <div class="statuslinha" id="statusLinha"></div>
            <div class="pag-cards" id="listaPag"></div>
            <div class="lancar" id="lancarBox">
              <ui-select id="pagPagador" label="Quem pagou"></ui-select>
              <div class="linha">
                <ui-input id="pagValor" label="Valor a lançar (R$)" type="number" step="0.01" min="0" placeholder="0,00"></ui-input>
                <ui-input id="pagData" label="Data" type="date" value="${hojeIso()}"></ui-input>
              </div>
              ${eqp ? `<label class="tx">Distribuir entre integrantes (R$)</label>
              <split-editor id="pagDist"></split-editor>` : ""}
              <ui-button id="lancarPag" variant="secundario" tamanho="sm">＋ Lançar pagamento</ui-button>
            </div>
            <div class="pag-aviso" id="pagAviso" hidden>Para lançar outro pagamento, exclua o pagamento atual (a despesa volta ao estado sem pagamento).</div>
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
    const d = this.despesa;
    if (!this.travado) {
      const inicial = CLASSIFICACOES.indexOf(d.classificacao) >= 0 ? d.classificacao : CLASSIFICACOES[0];
      this.$("#abas").abas = CLASSIFICACOES.map((c) => ({ id: c, rotulo: c, icone: "tag" }));
      this.$("#abas").setAttribute("ativo", inicial);
      this.$("#abas").addEventListener("mudar", () => this.preencherItens());
      this.preencherItens();
    } else {
      // Card de PRÉVIA da oferta (o mesmo do banner Registrar Despesa); clique →
      // banner com as informações completas. Para EDITAR, edita-se a oferta.
      const oferta = dataStore.todasOfertas().find((o) => String(o.id) === String(d.preco_id));
      const box = this.$("#ofertaBox");
      if (oferta && box) {
        box.innerHTML = previaOfertaHtml(oferta);
        // Banner ÚNICO da oferta em modo só-leitura (edita-se a oferta na origem).
        box.addEventListener("click", () => abrirOferta(oferta, { somenteLeitura: true }));
      }
    }
    this.preencherSplits();
    this.preencherPagamentos();
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
    this.$("#excluir").addEventListener("click", () => this.excluir());
  }

  /* ---------------- Pagamentos parciais (lançamentos/levas) -------------- */

  /** Liga o mini-form de lançamento + pinta status e lista. */
  preencherPagamentos() {
    // Quem pagou: participantes da obra (mesmas chaves do acerto).
    const parts = dataStore.participantesDaObra(this.despesa.obra_id);
    const selPag = this.$("#pagPagador");
    if (selPag) {
      selPag.setAttribute("placeholder", parts.length ? "Selecione quem pagou" : "Sem participantes");
      selPag.options = parts.map((p) => ({ value: p.chave, label: p.nome }));
      selPag.value = (parts[0] || {}).chave || "";
    }
    const dist = this.$("#pagDist");
    if (dist && this.despesa.ofertante_equipe_id) {
      dist.modo = "valor";
      dist.participantes = integrantesDaEquipe(this.despesa.ofertante_equipe_id);
      dist.itens = [];
    }
    const pagValor = this.$("#pagValor");
    if (pagValor && dist) {
      pagValor.addEventListener("input", () => (dist.limite = Number(pagValor.value) || 0));
    }
    const btn = this.$("#lancarPag");
    if (btn) btn.addEventListener("click", () => this.lancarPagamento());
    this.atualizarStatusPag();
    this.pintarLancamentos();
  }

  _corStatus(st) {
    return st === "Pago" ? "var(--cor-sucesso)" : st === "Em pagamento" ? "var(--cor-aviso)" : "var(--cor-neutro)";
  }

  atualizarStatusPag() {
    const el = this.$("#statusLinha");
    if (!el) return;
    const d = this.despesa;
    const st = statusPagamento(d);
    el.innerHTML = `<category-badge nome="${st}" cor="${this._corStatus(st)}"></category-badge>
      <span class="muted">Pago ${moeda(totalRealizado(d))} de ${moeda(Number(d.valor) || 0)} · Resto ${moeda(restoDespesa(d))}</span>`;
  }

  /** Nome ao vivo de uma chave (c:contato / e:equipe). */
  _nomeChave(chave) {
    const s = String(chave || "");
    const id = s.slice(2);
    if (s.startsWith("c:")) return (dataStore.contatos().find((c) => String(c.id) === id) || {}).nome || "—";
    if (s.startsWith("e:")) return (dataStore.equipe(id) || {}).nome || "—";
    return "—";
  }

  pintarLancamentos() {
    const cont = this.$("#listaPag");
    if (!cont) return;
    cont.innerHTML = "";
    // Fonte 1: pagamentos (entidade) que cobrem a despesa. Fonte 2 (fallback p/ o
    // backend atual, sem a entidade): as levas embutidas em pagamentos_realizados.
    // Em ambos os casos é possível EXCLUIR — e a exclusão desvincula a despesa.
    const pags = dataStore.pagamentosDaDespesa(this.despesa.id);
    let cards;
    if (pags.length) {
      cards = pags.map((p) => ({ pg: p, del: () => this.removerPagamentoCard(p.id) }));
    } else {
      cards = parseLista(this.despesa.pagamentos_realizados).map((lv) => ({
        pg: this._levaComoPagamento(lv),
        del: () => this.removerLancamento(lv.id),
      }));
    }
    if (!cards.length) cont.innerHTML = `<p class="muted">Nenhum pagamento lançado.</p>`;
    cards.forEach(({ pg, del }) => {
      // Card de pagamento (esverdeado), clicável → banner com os dados completos.
      const card = document.createElement("div");
      card.className = "resumo pag clicavel";
      card.title = "Ver detalhes do pagamento";
      card.innerHTML = previaPagamentoHtml(pg);
      card.addEventListener("click", (e) => {
        if (e.target.closest(".rem")) return;
        abrirPagamento(pg);
      });
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rem";
      btn.textContent = "✕";
      btn.title = "Excluir pagamento";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        del();
      });
      card.appendChild(btn);
      cont.appendChild(card);
    });
    // Regra: não dá p/ lançar em despesa que já tem pagamento — exclua antes.
    const tem = cards.length > 0;
    if (this.$("#lancarBox")) this.$("#lancarBox").hidden = tem;
    if (this.$("#pagAviso")) this.$("#pagAviso").hidden = !tem;
  }

  /** Converte uma leva embutida num objeto compatível com previaPagamentoHtml/abrirPagamento. */
  _levaComoPagamento(lv) {
    const d = this.despesa;
    return {
      id: lv.id,
      obra_id: d.obra_id,
      data: lv.data,
      valor: Number(lv.valor) || 0,
      pagador_chave: lv.pagador || "",
      pagador_contato_id: String(lv.pagador || "").indexOf("c:") === 0 ? String(lv.pagador).slice(2) : "",
      recebedor_contato_id: lv.contato_id || d.ofertante_contato_id || "",
      recebedor_equipe_id: d.ofertante_equipe_id || "",
      fornecedor_id: lv.fornecedor_id || "",
      alocacoes: [{ despesa_id: d.id, valor: Number(lv.valor) || 0 }],
      distribuicao: parseLista(lv.distribuicao),
    };
  }

  /** Exclui uma LEVA embutida (modelo atual) — desvincula da despesa. */
  async removerLancamento(lancamentoId) {
    if (!confirm("Excluir este pagamento? A despesa volta ao estado anterior, sem pagamento.")) return;
    try {
      const atualizada = await dataStore.removerPagamento(this.despesa.obra_id, this.despesa.id, lancamentoId);
      this._despesa = atualizada;
      this.atualizarStatusPag();
      this.pintarLancamentos();
      toastSucesso("Pagamento excluído.");
    } catch (e) {
      notificarErro(e);
    }
  }

  async lancarPagamento() {
    const alerta = this.$("#erro");
    if (alerta) alerta.mensagem = "";
    const pagador = this.$("#pagPagador") ? this.$("#pagPagador").value : "";
    if (!pagador) {
      if (alerta) alerta.mensagem = "Selecione quem pagou.";
      return;
    }
    const valorInp = this.$("#pagValor");
    const valor = Number(valorInp.value);
    if (!(valor > 0)) {
      valorInp.setAttribute("error", "Informe um valor.");
      return;
    }
    valorInp.removeAttribute("error");
    const resto = restoDespesa(this.despesa);
    if (valor - resto > 0.01) {
      if (alerta) alerta.mensagem = `O valor (${moeda(valor)}) passa do que falta pagar (${moeda(resto)}).`;
      return;
    }
    const dados = { valor, pagador, data: this.$("#pagData").value || hojeIso() };
    const dist = this.$("#pagDist");
    if (dist && this.despesa.ofertante_equipe_id) {
      const distribuicao = dist.itens
        .filter((x) => x.chave && Number(x.valor) > 0)
        .map((x) => ({ chave: x.chave, valor: Number(x.valor) || 0 }));
      const somaDist = distribuicao.reduce((s, x) => s + x.valor, 0);
      if (somaDist - valor > 0.01) {
        if (alerta) alerta.mensagem = `A distribuição (${moeda(somaDist)}) passa do valor da leva (${moeda(valor)}).`;
        return;
      }
      dados.distribuicao = distribuicao;
    }
    const btn = this.$("#lancarPag");
    btn.setAttribute("loading", "");
    try {
      const atualizada = await dataStore.lancarPagamento(this.despesa.obra_id, this.despesa.id, dados);
      this._despesa = atualizada; // sem re-render total (preserva edições não salvas)
      this.atualizarStatusPag();
      this.pintarLancamentos();
      valorInp.value = "";
      if (dist) dist.itens = [];
      toastSucesso("Pagamento lançado.");
    } catch (e) {
      notificarErro(e);
    }
    btn.removeAttribute("loading");
  }

  /** Exclui o PAGAMENTO (entidade) — desvincula da despesa, que volta ao estado sem pagamento. */
  async removerPagamentoCard(pagamentoId) {
    if (!confirm("Excluir este pagamento? A despesa volta ao estado anterior, sem pagamento.")) return;
    try {
      await dataStore.removerPagamentoV2(pagamentoId);
      const atual = dataStore
        .despesas(this.despesa.obra_id)
        .find((d) => String(d.id) === String(this.despesa.id));
      if (atual) this._despesa = atual;
      this.atualizarStatusPag();
      this.pintarLancamentos();
      toastSucesso("Pagamento excluído.");
    } catch (e) {
      notificarErro(e);
    }
  }

  get classificacao() {
    return (this.$("#abas") && this.$("#abas").ativo) || this.despesa.classificacao || CLASSIFICACOES[0];
  }

  preencherItens() {
    const sel = this.$("#item");
    if (!sel) return;
    const itens = dataStore.itensAtivos().filter((i) => i.classificacao === this.classificacao);
    sel.setAttribute("placeholder", itens.length ? "Selecione um item" : "Nenhum item desta classificação");
    sel.options = itens.map((i) => ({ value: i.id, label: i.nome }));
    // Pré-seleciona o item da despesa quando bate com a classificação ativa.
    const id = this.despesa.item_id || "";
    sel.value = itens.some((i) => String(i.id) === String(id)) ? id : "";
    sel.removeAttribute("error");
  }


  /** Popula o editor de responsabilidade (%). */
  preencherSplits() {
    const rp = this.$("#responsaveis");
    if (rp) {
      rp.modo = "pct";
      rp.participantes = dataStore.participantesDaObra(this.despesa.obra_id);
      rp.itens = parseLista(this.despesa.responsaveis).map((r) => ({
        chave: r.chave,
        valor: Number(r.pct) || 0,
      }));
    }
  }

  async salvar() {
    const alerta = this.$("#erro");
    if (alerta) alerta.mensagem = "";

    // Item/Valor/Classificação: da oferta (travado) ou dos campos (legado).
    let itemId, valor, classificacao, itemNome;
    if (this.travado) {
      itemId = this.despesa.item_id || "";
      valor = Number(this.despesa.valor) || 0;
      classificacao = this.despesa.classificacao || "";
      itemNome = this.despesa.item || "";
    } else {
      itemId = this.$("#item").value;
      valor = Number(this.$("#valor").value);
      const erroValor = valorPositivo(valor);
      if (!itemId) this.$("#item").setAttribute("error", "Selecione um item.");
      if (erroValor) this.$("#valor").setAttribute("error", erroValor);
      if (!itemId || erroValor) return;
      this.$("#item").removeAttribute("error");
      const item = dataStore.itensAtivos().find((i) => String(i.id) === String(itemId)) || {};
      itemNome = item.nome || "";
      classificacao = this.classificacao;
    }

    // "Quem pagou" (pagamentos) é DERIVADO das levas no servidor — não enviado aqui.
    const responsaveis = this.$("#responsaveis").itens
      .filter((x) => x.chave)
      .map((x) => ({ chave: x.chave, pct: Number(x.valor) || 0 }));

    // Regra: soma das % ≤ 100.
    const somaPct = responsaveis.reduce((s, r) => s + (Number(r.pct) || 0), 0);
    if (somaPct - 100 > 0.01) {
      if (alerta) alerta.mensagem = `A soma das responsabilidades (${Math.round(somaPct * 100) / 100}%) não pode passar de 100%.`;
      return;
    }

    const dados = {
      item_id: itemId,
      classificacao,
      item: itemNome, // nome denormalizado p/ exibição otimista
      valor,
      // Subclassificação NÃO é editada aqui — vem do item (só alterável no item).
      data: this.$("#data").value || String(this.despesa.data || "").substring(0, 10),
      observacao: this.$("#observacao").value.trim(),
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
