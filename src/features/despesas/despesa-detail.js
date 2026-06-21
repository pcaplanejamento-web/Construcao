/**
 * <despesa-detail> — Banner (modal) com as informações completas de uma despesa.
 * Permite EDITAR e EXCLUIR aqui. A despesa nasce do REGISTRO de uma oferta:
 * quando tem `preco_id`, o Item/Valor/Ofertante/Empresa vêm da oferta (read-only).
 * O pagamento é por **lançamentos parciais (levas)**: status A pagar / Em pagamento
 * / Pago é derivado; equipe → cada leva desmembra entre integrantes. Pagamento
 * (quem pagou) / Responsabilidade / Recebido planejado / Subclassificação /
 * Observação seguem editáveis. Despesas legadas (sem `preco_id`) mantêm Item/Valor
 * editáveis. Reusa ui-modal/ui-input/ui-select/ui-button/split-editor.
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
import { ofertanteNome } from "../orcamentos/orcamento-util.js";
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
const COR_CLASSIFICACAO = { Material: "#2563eb", "Serviço": "#7c3aed" };

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
      .resumo .item { font-weight: var(--peso-semi); }
      .resumo .val { font-size: var(--fs-lg); font-weight: var(--peso-forte);
        color: var(--cor-primaria); }
      .resumo small { color: var(--cor-texto-suave); }
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

    // Item/Valor: read-only (oferta) ou editáveis (legado).
    let topo;
    if (this.travado) {
      const nomeItem = (d.item_id && (dataStore.item(d.item_id) || {}).nome) || d.item || "—";
      const ofert = ofertanteNome(d.ofertante_contato_id, d.ofertante_equipe_id);
      const empresa = this.empresaNome(d.fornecedor_id);
      topo = `
        <div class="resumo">
          <span class="item">${nomeItem}</span>
          ${d.classificacao ? `<category-badge nome="${d.classificacao}" cor="${COR_CLASSIFICACAO[d.classificacao] || "var(--cor-neutro)"}"></category-badge>` : ""}
          <span class="val">${moeda(d.valor || 0)}</span>
          <small>Ofertante: ${ofert}${empresa ? " · Empresa: " + empresa : ""}</small>
        </div>
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
          <ui-select id="categoria" label="Subclassificação"></ui-select>
          <div>
            <label class="tx">Observação</label>
            <textarea id="observacao" placeholder="Detalhes (opcional)">${d.observacao || ""}</textarea>
          </div>
          <div class="secao" id="secPag">
            <label class="tx">Pagamentos — lançamentos (levas)</label>
            <div class="statuslinha" id="statusLinha"></div>
            <div id="listaPag"></div>
            <div class="lancar">
              <div class="linha">
                <ui-input id="pagValor" label="Valor a lançar (R$)" type="number" step="0.01" min="0" placeholder="0,00"></ui-input>
                <ui-input id="pagData" label="Data" type="date" value="${hojeIso()}"></ui-input>
              </div>
              ${eqp ? `<label class="tx">Distribuir entre integrantes (R$)</label>
              <split-editor id="pagDist"></split-editor>` : ""}
              <ui-button id="lancarPag" variant="secundario" tamanho="sm">＋ Lançar pagamento</ui-button>
            </div>
          </div>
          ${eqp ? `<div class="secao">
            <label class="tx">Recebido por integrante — planejado (R$)</label>
            <split-editor id="recebidos"></split-editor>
          </div>` : ""}
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
    const d = this.despesa;
    if (!this.travado) {
      const inicial = CLASSIFICACOES.indexOf(d.classificacao) >= 0 ? d.classificacao : CLASSIFICACOES[0];
      this.$("#abas").abas = CLASSIFICACOES.map((c) => ({ id: c, rotulo: c, icone: "tag" }));
      this.$("#abas").setAttribute("ativo", inicial);
      this.$("#abas").addEventListener("mudar", () => this.preencherItens());
      this.preencherItens();
    }
    this.preencherCategorias();
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
    const lista = parseLista(this.despesa.pagamentos_realizados);
    if (!lista.length) {
      cont.innerHTML = `<p class="muted">Nenhum pagamento lançado.</p>`;
      return;
    }
    cont.innerHTML = "";
    lista.forEach((p) => {
      const row = document.createElement("div");
      row.className = "lancamento";
      const dist = parseLista(p.distribuicao)
        .map((x) => `${this._nomeChave(x.chave)}: ${moeda(x.valor)}`)
        .join(" · ");
      row.innerHTML = `<div class="lc-info">
          <strong>${moeda(p.valor)}</strong>
          <small class="muted">${fmtData(p.data)} · por ${p.autor_nome || "—"}</small>
          ${dist ? `<small class="muted">${dist}</small>` : ""}
        </div>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rem";
      btn.textContent = "✕";
      btn.addEventListener("click", () => this.removerLancamento(p.id));
      row.appendChild(btn);
      cont.appendChild(row);
    });
  }

  async lancarPagamento() {
    const alerta = this.$("#erro");
    if (alerta) alerta.mensagem = "";
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
    const dados = { valor, data: this.$("#pagData").value || hojeIso() };
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

  async removerLancamento(lancamentoId) {
    if (!confirm("Remover este pagamento lançado?")) return;
    try {
      const atualizada = await dataStore.removerPagamento(this.despesa.obra_id, this.despesa.id, lancamentoId);
      this._despesa = atualizada;
      this.atualizarStatusPag();
      this.pintarLancamentos();
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

  /** Valor da despesa (input no modo legado; fixo no modo oferta). */
  valorAtual() {
    const inp = this.$("#valor");
    return inp ? Number(inp.value) || 0 : Number(this.despesa.valor) || 0;
  }

  /** Popula os editores de recebidos (R$), pagamento (R$) e responsabilidade (%). */
  preencherSplits() {
    const parts = dataStore.participantesDaObra(this.despesa.obra_id);

    // Recebido por integrante (só quando o ofertante é equipe).
    const rec = this.$("#recebidos");
    if (rec && this.despesa.ofertante_equipe_id) {
      rec.modo = "valor";
      rec.participantes = integrantesDaEquipe(this.despesa.ofertante_equipe_id);
      rec.limite = this.valorAtual();
      rec.itens = parseLista(this.despesa.recebidos).map((r) => ({
        chave: r.chave,
        valor: Number(r.valor) || 0,
      }));
    }

    const pg = this.$("#pagamentos");
    if (pg) {
      pg.modo = "valor";
      pg.participantes = parts;
      pg.limite = this.valorAtual(); // soma ≤ valor da despesa
      pg.itens = parseLista(this.despesa.pagamentos).map((p) => ({
        chave: p.chave,
        valor: Number(p.valor) || 0,
      }));
    }
    // Mantém o limite sincronizado com o valor digitado (modo legado).
    const valInput = this.$("#valor");
    if (valInput) {
      valInput.addEventListener("input", () => {
        const lim = Number(valInput.value) || 0;
        if (pg) pg.limite = lim;
        if (rec && this.despesa.ofertante_equipe_id) rec.limite = lim;
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
    // Subclassificação é opcional → 1ª opção vazia.
    sel.options = [{ value: "", label: "Sem subclassificação" }].concat(
      this.categorias.map((c) => ({ value: c.id, label: c.nome }))
    );
    sel.value = this.despesa.categoria_id || "";
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

    const pagamentos = this.$("#pagamentos").itens
      .filter((x) => x.chave && Number(x.valor) > 0)
      .map((x) => ({ chave: x.chave, valor: Number(x.valor) || 0 }));
    const responsaveis = this.$("#responsaveis").itens
      .filter((x) => x.chave)
      .map((x) => ({ chave: x.chave, pct: Number(x.valor) || 0 }));

    // Regras: soma dos pagamentos ≤ valor; soma das % ≤ 100.
    const somaPag = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const somaPct = responsaveis.reduce((s, r) => s + (Number(r.pct) || 0), 0);
    if (somaPag - valor > 0.01) {
      if (alerta) alerta.mensagem = `A soma dos pagamentos (${moeda(somaPag)}) não pode passar do valor da despesa (${moeda(valor)}).`;
      return;
    }
    if (somaPct - 100 > 0.01) {
      if (alerta) alerta.mensagem = `A soma das responsabilidades (${Math.round(somaPct * 100) / 100}%) não pode passar de 100%.`;
      return;
    }

    const dados = {
      item_id: itemId,
      classificacao,
      item: itemNome, // nome denormalizado p/ exibição otimista
      valor,
      categoria_id: this.$("#categoria").value,
      data: this.$("#data").value || String(this.despesa.data || "").substring(0, 10),
      observacao: this.$("#observacao").value.trim(),
      pagamentos,
      responsaveis,
    };

    // Recebidos por integrante (só quando o ofertante é equipe).
    const rec = this.$("#recebidos");
    if (rec && this.despesa.ofertante_equipe_id) {
      const recebidos = rec.itens
        .filter((x) => x.chave && Number(x.valor) > 0)
        .map((x) => ({ chave: x.chave, valor: Number(x.valor) || 0 }));
      const somaRec = recebidos.reduce((s, r) => s + (Number(r.valor) || 0), 0);
      if (somaRec - valor > 0.01) {
        if (alerta) alerta.mensagem = `A soma dos valores recebidos (${moeda(somaRec)}) não pode passar do valor da despesa (${moeda(valor)}).`;
        return;
      }
      dados.recebidos = recebidos;
    }

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
