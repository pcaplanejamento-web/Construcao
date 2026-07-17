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
import { moeda, hojeIso } from "../../core/formatters.js";
import { toastSucesso, toastAviso, notificarErro } from "../../core/event-bus.js";
import { totalOferta, qtdOferta, unitFinalOferta } from "./cotacao-util.js";
import { ofertanteNome, rotuloOrcamento, previaOfertaHtml } from "../orcamentos/orcamento-util.js";
import { nomeTipo } from "../pagamentos/pagamento-util.js";
import { valorPositivo } from "../../core/validators.js";
import { editarEntidade, excluirEntidade } from "../shared/drop-crud.js";
import { focarPrimeiroErro } from "../shared/foco-erro.js";
import "../../components/ui-modal.js";
import "../../components/ui-tabs.js";
import "../../components/ui-select.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";
import "../../components/ui-alert.js";
import "../../components/ui-ajuda.js";
import "../despesas/split-editor.js";
import "../itens/item-form.js";
import "../contatos/contato-form.js";
import "../fornecedores/fornecedor-form.js";
import { CLASSIFICACOES, exigeEmpresa, exigeOfertante } from "../../core/classificacao.js";

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
      /* Título curto de cada modo (reduz a carga do form multi-modo). */
      .secao-titulo { font-size: var(--fs-sm); font-weight: var(--peso-semi);
        color: var(--cor-texto); margin: 0 0 var(--esp-2); }
      /* Seção "Nova despesa" (cria item + oferta inline). */
      .secNova { display: flex; flex-direction: column; gap: var(--esp-3); }
      .linha { display: flex; gap: var(--esp-3); }
      .linha > * { flex: 1; min-width: 0; }
      .linha-item { display: flex; gap: var(--esp-2); align-items: flex-end; }
      .linha-item ui-select { flex: 1; min-width: 0; }
      .linha-item ui-button { flex: none; white-space: nowrap; }
      .info { font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .info b { color: var(--cor-texto); }
      /* "Registrar como paga agora": checkbox + campos do pagamento inline. */
      .ck { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-sm);
        font-weight: var(--peso-medio); color: var(--cor-texto); cursor: pointer; }
      .ck input { width: 18px; height: 18px; accent-color: var(--cor-primaria); flex: none; }
      .pag-box { display: flex; flex-direction: column; gap: var(--esp-3); margin-top: var(--esp-3); }
      textarea { width: 100%; box-sizing: border-box; min-height: 56px; padding: var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        font-family: inherit; font-size: var(--fs-md); resize: vertical; background: var(--cor-superficie); color: var(--cor-texto); }
      textarea:focus { outline: none; border-color: var(--cor-primaria); box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      @media (max-width: 560px) {
        .linha { flex-direction: column; }
        .linha-item { flex-wrap: wrap; }
        .linha-item ui-button { width: 100%; }
      }
      [hidden] { display: none; }
    `;
  }

  template() {
    const titulo = "Registrar Despesa";
    const topo = this.modoObra
      ? `<ui-select id="modoReg" label="O que registrar?" ajuda="o-que-registrar"></ui-select>
         <div id="secOferta">
           <div class="secao-titulo">Registrar uma oferta já cotada</div>
           <ui-tabs id="abas"></ui-tabs>
           <ui-select id="oferta" label="Oferta"></ui-select>
         </div>
         <div id="secNova" class="secNova" hidden>
           <div class="secao-titulo">Criar e registrar uma despesa nova</div>
           <ui-select id="novoItem" label="Item" required criar="Cadastrar item"></ui-select>
           <div class="info" id="novaClasse"></div>
           <ui-select id="novoOfertante" label="Ofertante (contato ou grupo)" ajuda="ofertante" criar="Cadastrar contato"></ui-select>
           <ui-select id="novoFornecedor" label="Empresa" criar="Cadastrar empresa"></ui-select>
           <div class="linha">
             <ui-input id="novaQtd" label="Quantidade" type="number" step="0.01" min="0" placeholder="Ex.: 10"></ui-input>
             <ui-input id="novoValor" label="Valor unitário (R$)" required formato="moeda" placeholder="0,00"></ui-input>
           </div>
           <div class="linha">
             <ui-input id="novoDesc" label="Valor unit. com desconto (R$)" formato="moeda" placeholder="opcional"></ui-input>
             <ui-input id="novoPrazo" label="Data/prazo de entrega" required placeholder="Ex.: 5 dias"></ui-input>
           </div>
           <div>
             <label class="tx">Observação</label>
             <textarea id="novaObs" placeholder="Condições, frete, etc. (opcional)"></textarea>
           </div>
         </div>
         <div id="secOrcamento" hidden>
           <div class="secao-titulo">Registrar todas as ofertas de um orçamento</div>
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
            <label class="tx" for="dataDespesa">Data da despesa</label>
            <ui-input id="dataDespesa" type="date"></ui-input>
          </div>
          <div class="secao">
            <label class="ck"><input type="checkbox" id="jaPaga" /> Registrar como paga agora</label>
            <div class="pag-box" id="pagBox" hidden>
              <div class="linha">
                <ui-select id="pagPagador" label="Quem pagou"></ui-select>
                <ui-select id="pagTipo" label="Como"></ui-select>
              </div>
            </div>
          </div>
          <div class="secao">
            <label class="tx">Responsabilidade <ui-ajuda termo="responsabilidade"></ui-ajuda> — % por participante (soma 100%)</label>
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
        { value: "nova", label: "Uma despesa nova" },
        { value: "orcamento", label: "Orçamento completo" },
      ];
      selModo.value = "oferta";
      selModo.addEventListener("change", () => this.alternarModoReg());

      this.$("#abas").abas = dataStore.nomesClassificacaoItem().map((c) => ({ id: c, rotulo: c, icone: "tag" }));
      this.$("#abas").addEventListener("mudar", () => this.preencherOfertas());
      this.preencherOfertas();
      this.$("#oferta").addEventListener("change", (e) => this.onOfertaSelecionada(e.detail.value));

      this.preencherNova();

      this.preencherOrcamentos();
      this.$("#orcamento").addEventListener("change", (e) => this.onOrcamentoSelecionado(e.detail.value));
    } else {
      const selObra = this.$("#obra");
      selObra.options = dataStore.obras().map((o) => ({ value: o.id, label: o.nome }));
      selObra.value = this.cotacao.obra_id || (dataStore.obras()[0] || {}).id || "";
      selObra.addEventListener("change", () => { this.atualizarResponsaveis(); this.preencherPagamento(); });
      this.pintarResumo();
    }
    this.atualizarResponsaveis();

    // Data da despesa: padrão hoje (o servidor usa hoje se vier vazio).
    if (this.$("#dataDespesa")) this.$("#dataDespesa").value = hojeIso();
    // "Registrar como paga agora": revela pagador/tipo e, no submit, lança o
    // pagamento TOTAL já na criação (data = a da própria despesa).
    const chkPaga = this.$("#jaPaga");
    if (chkPaga) {
      chkPaga.addEventListener("change", () => {
        const box = this.$("#pagBox");
        if (box) box.hidden = !chkPaga.checked;
        if (chkPaga.checked) this.preencherPagamento();
      });
    }

    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#confirmar").addEventListener("click", async () => { await this.confirmar(); focarPrimeiroErro(this); });
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

  /** Alterna entre registrar uma oferta existente, uma despesa nova ou o orçamento completo. */
  alternarModoReg() {
    const modo = this.modoRegistro;
    if (this.$("#secOferta")) this.$("#secOferta").hidden = modo !== "oferta";
    if (this.$("#secNova")) this.$("#secNova").hidden = modo !== "nova";
    if (this.$("#secOrcamento")) this.$("#secOrcamento").hidden = modo !== "orcamento";
    this.pintarResumo();
  }

  /* --------------------------- Modo "Nova despesa" --------------------------- */
  /**
   * Preenche os campos da oferta nova (item + ofertante + fornecedor + valores),
   * espelhando o <preco-form>. Cria a oferta avulsa e registra a despesa em um só
   * passo (mesma lógica de registrarDespesaOferta). Chamado no início e após
   * cadastrar um item novo (para refrescar a lista).
   */
  preencherNova() {
    const refresh = () => this.preencherNova();
    const selItem = this.$("#novoItem");
    if (selItem) {
      const itens = dataStore.itensAtivos();
      const atual = selItem.value;
      selItem.setAttribute("placeholder", itens.length ? "Buscar o item…" : "Nenhum item — cadastre um");
      selItem.options = itens.map((i) => ({ value: i.id, label: `${i.nome} — ${i.classificacao}`, editavel: true, removivel: true }));
      selItem.value = itens.some((i) => String(i.id) === String(atual)) ? atual : "";
      if (!selItem._ligado) {
        selItem.addEventListener("change", () => { this.atualizarNovaClasse(); this.pintarResumo(); });
        selItem.addEventListener("criar", () => this.abrirNovoItem());
        selItem.addEventListener("editar", (e) => editarEntidade("item", e.detail.value, refresh));
        selItem.addEventListener("excluir", (e) => excluirEntidade("item", e.detail.value, refresh));
        selItem._ligado = true;
      }
    }
    const selOf = this.$("#novoOfertante");
    if (selOf) {
      const atual = selOf.value;
      // Contatos ganham editar/excluir; equipes (grupos) não (geridas em Equipes).
      const opcoes = [{ value: "", label: "— Sem ofertante —" }];
      dataStore.contatosAtivos().forEach((c) => opcoes.push({ value: "c:" + c.id, label: c.nome, editavel: true, removivel: true }));
      dataStore.equipes().forEach((e) => opcoes.push({ value: "e:" + e.id, label: `${e.nome} — grupo` }));
      selOf.options = opcoes;
      selOf.value = opcoes.some((o) => String(o.value) === String(atual)) ? atual : "";
      if (!selOf._ligado) {
        selOf.addEventListener("change", () => this.autoFornecedorNova());
        selOf.addEventListener("criar", () => this.abrirNovoContato());
        selOf.addEventListener("editar", (e) => { const v = String(e.detail.value || ""); if (v.indexOf("c:") === 0) editarEntidade("contato", v.slice(2), refresh); });
        selOf.addEventListener("excluir", (e) => { const v = String(e.detail.value || ""); if (v.indexOf("c:") === 0) excluirEntidade("contato", v.slice(2), refresh); });
        selOf._ligado = true;
      }
    }
    const selForn = this.$("#novoFornecedor");
    if (selForn) {
      const atual = selForn.value;
      const opcoes = [{ value: "", label: "— Nenhuma —" }].concat(
        dataStore.fornecedoresAtivos().map((f) => ({ value: f.id, label: f.nome, editavel: true, removivel: true }))
      );
      selForn.options = opcoes;
      selForn.value = opcoes.some((o) => String(o.value) === String(atual)) ? atual : "";
      if (!selForn._ligado) {
        selForn.addEventListener("criar", () => this.abrirNovoFornecedor());
        selForn.addEventListener("editar", (e) => editarEntidade("fornecedor", e.detail.value, refresh));
        selForn.addEventListener("excluir", (e) => excluirEntidade("fornecedor", e.detail.value, refresh));
        selForn._ligado = true;
      }
    }
    ["#novaQtd", "#novoValor", "#novoDesc"].forEach((sel) => {
      const el = this.$(sel);
      if (el && !el._ligado) { el.addEventListener("input", () => this.pintarResumo()); el._ligado = true; }
    });
    // Feedback ao SAIR do campo desconto (change = blur após digitar): avisa na
    // hora se o desconto ficou maior que o valor unitário (só quando preenchido).
    const desc = this.$("#novoDesc");
    if (desc && !desc._ligadoBlur) {
      desc.addEventListener("change", () => {
        const d = Number(desc.value) || 0;
        const v = Number((this.$("#novoValor") || {}).value) || 0;
        if (d > 0 && v > 0 && d > v) desc.setAttribute("error", "Não pode ser maior que o valor unitário.");
        else desc.removeAttribute("error");
      });
      desc._ligadoBlur = true;
    }
    this.atualizarNovaClasse();
  }

  /** Texto de classificação/categoria do item escolhido (nova despesa). */
  atualizarNovaClasse() {
    const box = this.$("#novaClasse");
    if (!box) return;
    const it = dataStore.item(((this.$("#novoItem") || {}).value) || "");
    if (!it) { box.innerHTML = ""; return; }
    const sub = it.categoria_id
      ? (dataStore.categorias().find((c) => String(c.id) === String(it.categoria_id)) || {}).nome
      : "";
    const exige = exigeEmpresa(it.classificacao)
      ? "empresa obrigatória"
      : exigeOfertante(it.classificacao)
      ? "ofertante obrigatório"
      : "empresa ou ofertante";
    box.innerHTML = `Classificação: <b>${it.classificacao || "—"}</b>${sub ? ` · Categoria <ui-ajuda termo="categoria"></ui-ajuda>: <b>${sub}</b>` : ""} <small>(${exige})</small>`;
  }

  /** Auto-preenche a empresa pelo contato ofertante (se vinculado). */
  autoFornecedorNova() {
    const selOf = this.$("#novoOfertante");
    const selForn = this.$("#novoFornecedor");
    if (selOf && selForn) {
      const v = selOf.value || "";
      if (v.indexOf("c:") === 0) {
        const ct = dataStore.contatos().find((x) => String(x.id) === String(v.slice(2)));
        if (ct && ct.fornecedor_id) selForn.value = String(ct.fornecedor_id);
      }
    }
    this.pintarResumo();
  }

  /** Abre o <item-form> para cadastrar um item e o seleciona ao voltar. */
  abrirNovoItem() {
    const antes = new Set(dataStore.itens().map((i) => String(i.id)));
    const form = document.createElement("item-form");
    form.addEventListener("fechar", () => form.remove());
    form.addEventListener("salvo", () => {
      const novo = dataStore.itens().find((i) => !antes.has(String(i.id)));
      this.preencherNova();
      if (novo && this.$("#novoItem")) {
        this.$("#novoItem").value = novo.id;
        this.atualizarNovaClasse();
        this.pintarResumo();
      }
    });
    document.body.appendChild(form);
  }

  /** Abre o <contato-form> para cadastrar um contato e o define como ofertante. */
  abrirNovoContato() {
    const antes = new Set(dataStore.contatos().map((c) => String(c.id)));
    const form = document.createElement("contato-form");
    form.addEventListener("fechar", () => form.remove());
    form.addEventListener("salvo", () => {
      const novo = dataStore.contatos().find((c) => !antes.has(String(c.id)));
      this.preencherNova();
      if (novo && this.$("#novoOfertante")) {
        this.$("#novoOfertante").value = "c:" + novo.id;
        this.autoFornecedorNova();
      }
    });
    document.body.appendChild(form);
  }

  /** Abre o <fornecedor-form> para cadastrar uma empresa e a seleciona. */
  abrirNovoFornecedor() {
    const antes = new Set(dataStore.fornecedores().map((f) => String(f.id)));
    const form = document.createElement("fornecedor-form");
    form.addEventListener("fechar", () => form.remove());
    form.addEventListener("salvo", () => {
      const novo = dataStore.fornecedores().find((f) => !antes.has(String(f.id)));
      this.preencherNova();
      if (novo && this.$("#novoFornecedor")) {
        this.$("#novoFornecedor").value = novo.id;
        this.pintarResumo();
      }
    });
    document.body.appendChild(form);
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

    // Modo NOVA despesa: prévia do total a partir dos campos digitados.
    if (this.modoObra && this.modoRegistro === "nova") {
      const it = dataStore.item(((this.$("#novoItem") || {}).value) || "");
      const valor = Number((this.$("#novoValor") || {}).value) || 0;
      const desc = Number((this.$("#novoDesc") || {}).value) || 0;
      const qtd = Number((this.$("#novaQtd") || {}).value) || 0;
      const unit = desc > 0 ? desc : valor;
      const q = qtd > 0 ? qtd : 1;
      if (!it || !(unit > 0)) { box.setAttribute("hidden", ""); return; }
      box.removeAttribute("hidden");
      box.innerHTML = `
        <span class="item">${it.nome}</span>
        <small>${q}× · ${moeda(unit)}${desc > 0 ? " (c/ desconto)" : ""}</small>
        <span class="val">${moeda(unit * q)}</span>`;
      return;
    }

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

    // Modo oferta avulsa / oferta-fixa — MESMO card de prévia da oferta (helper único).
    const { preco, cotacao } = this.ofertaAtual();
    if (!preco || !preco.id) {
      box.setAttribute("hidden", "");
      return;
    }
    box.removeAttribute("hidden");
    // Garante o vínculo da cotação (oferta-fixa pode receber a cotação separada).
    const ofertaParaPrevia = preco.cotacao_id || !cotacao || !cotacao.id ? preco : { ...preco, cotacao_id: cotacao.id };
    box.innerHTML = previaOfertaHtml(ofertaParaPrevia);
  }

  /** Editor de responsabilidade (% por participante da obra resolvida). */
  atualizarResponsaveis() {
    const ed = this.$("#responsaveis");
    if (!ed) return;
    ed.modo = "pct";
    ed.participantes = dataStore.participantesDaObra(this.obraAtual());
    ed.limite = 100;
  }

  /** Popula "Quem pagou" (participantes da obra) + "Como" (tipos) do pagamento inline. */
  preencherPagamento() {
    const selPag = this.$("#pagPagador");
    if (selPag) {
      const u = dataStore.usuario();
      const opts = dataStore.participantesDaObra(this.obraAtual()).map((p) => ({ value: p.chave, label: p.nome }));
      if (!opts.length) {
        if (u) opts.push({ value: "u:" + u.id, label: (u.nome || "Você") + " (você)" });
        dataStore.contatosAtivos().forEach((c) => opts.push({ value: "c:" + c.id, label: c.nome }));
      }
      const atual = selPag.value;
      selPag.setAttribute("placeholder", opts.length ? "Selecione quem pagou" : "Sem participantes");
      selPag.options = opts;
      selPag.value = opts.some((o) => o.value === atual) ? atual : (opts[0] || {}).value || "";
    }
    const selTipo = this.$("#pagTipo");
    if (selTipo && !(selTipo.options || []).length) {
      const tipos = dataStore.tiposTransferencia();
      selTipo.options = tipos.map((t) => ({ value: t.nome, label: nomeTipo(t.nome) }));
      selTipo.value = (tipos[0] && tipos[0].nome) || "dinheiro";
    }
  }

  /**
   * Lê o pagamento inline ("Registrar como paga agora"). Retorna { ok, pag }:
   * `pag = null` quando não está marcado; `ok = false` (com erro no campo) quando
   * marcado sem pagador — o chamador aborta sem criar a despesa.
   */
  _lerPagamento() {
    const chk = this.$("#jaPaga");
    if (!chk || !chk.checked) return { ok: true, pag: null };
    const pagador = ((this.$("#pagPagador") || {}).value) || "";
    if (!pagador) {
      if (this.$("#pagPagador")) this.$("#pagPagador").setAttribute("error", "Selecione quem pagou.");
      return { ok: false };
    }
    if (this.$("#pagPagador")) this.$("#pagPagador").removeAttribute("error");
    const tipo = ((this.$("#pagTipo") || {}).value) || "dinheiro";
    return { ok: true, pag: { pagador, tipo } };
  }

  /**
   * Marca como paga: lança um pagamento TOTAL (o `resto` = valor cheio de uma
   * despesa recém-criada) em cada despesa, com a MESMA data da despesa. Reusa o
   * fluxo de pagamento existente (despesas.lancarPagamento → transferência).
   */
  async _quitarSePaga(lista, obraId, dataDespesa, pag) {
    if (!pag) return;
    for (const d of lista || []) {
      const valor = Number(d && d.valor) || 0;
      if (!d || !d.id || !(valor > 0)) continue;
      await dataStore.lancarPagamento(obraId, d.id, {
        valor,
        pagador: pag.pagador,
        tipo: pag.tipo,
        data: dataDespesa || d.data || "",
        distribuicao: [],
      });
    }
  }

  /**
   * ORÇAMENTO pago: UMA ÚNICA transferência agrupando TODAS as despesas do orçamento
   * (todas herdam o MESMO ofertante/empresa do orçamento → passa na regra de ouro).
   * Reusa `lancarTransferencia` (1 transferência / N pagamentos). Se por acaso não
   * forem homogêneas (raro), cai no pagamento por despesa (`_quitarSePaga`).
   */
  async _quitarOrcamento(lista, obraId, dataDespesa, pag) {
    if (!pag) return;
    const alocacoes = (lista || [])
      .filter((d) => d && d.id && Number(d.valor) > 0)
      .map((d) => ({ despesa_id: d.id, valor: Number(d.valor) || 0 }));
    if (!alocacoes.length) return;
    try {
      await dataStore.lancarTransferencia({
        obra_id: obraId,
        alocacoes,
        pagador: pag.pagador,
        tipo: pag.tipo,
        data: dataDespesa || "",
        distribuicao: [],
      });
    } catch (e) {
      await this._quitarSePaga(lista, obraId, dataDespesa, pag);
    }
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

    // Data da despesa (vazio → o servidor usa hoje) + pagamento inline opcional.
    const dataDespesa = ((this.$("#dataDespesa") || {}).value) || "";
    const lerPag = this._lerPagamento();
    if (!lerPag.ok) return; // "paga" marcada sem pagador — erro já sinalizado
    const pag = lerPag.pag;

    // --- Nova despesa: cria a oferta (avulsa) e registra em um passo. ---
    if (this.modoObra && this.modoRegistro === "nova") {
      return this.confirmarNova(obraId, responsaveis, dataDespesa, pag);
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
        const r = await dataStore.registrarOrcamentoCompleto(orc.id, obraId, responsaveis, dataDespesa);
        await this._quitarOrcamento(r.despesas, obraId, dataDespesa, pag); // 1 transferência p/ o orçamento inteiro
        const obra = dataStore.obra(obraId) || {};
        toastSucesso(`${r.total} despesa(s) lançada(s)${pag ? " e paga(s)" : ""} em "${obra.nome || "obra"}".`);
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
      // A categoria é herdada do item; "" deixa o servidor resolvê-la.
      const r = await dataStore.registrarDespesaOferta((cotacao && cotacao.id) || "", preco.id, obraId, "", responsaveis, dataDespesa);
      await this._quitarSePaga([r.despesa], obraId, dataDespesa, pag);
      const obra = dataStore.obra(obraId) || {};
      toastSucesso(`Despesa lançada${pag ? " e paga" : ""} em "${obra.nome || "obra"}".`);
      this.emitir("registrado", { obra_id: obraId });
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }

  /**
   * Nova despesa manual: valida os dados da oferta (mesmas regras do preco-form),
   * cria a oferta AVULSA (`criarOferta`) e registra a despesa em seguida
   * (`registrarDespesaOferta`) — tudo em um passo, mesma lógica existente.
   */
  async confirmarNova(obraId, responsaveis, dataDespesa, pag) {
    const alerta = this.$("#erro");
    if (alerta) alerta.mensagem = "";
    ["#novoItem", "#novoOfertante", "#novoFornecedor", "#novoValor", "#novoDesc", "#novoPrazo"].forEach((s) => {
      const el = this.$(s);
      if (el) el.removeAttribute("error");
    });
    const itemId = String(((this.$("#novoItem") || {}).value) || "");
    if (!itemId) {
      if (this.$("#novoItem")) this.$("#novoItem").setAttribute("error", "Selecione ou cadastre um item.");
      return;
    }
    const item = dataStore.item(itemId) || {};
    const cl = String(item.classificacao);

    const vOf = ((this.$("#novoOfertante") || {}).value) || "";
    let contatoId = "";
    let equipeId = "";
    if (vOf.indexOf("c:") === 0) contatoId = vOf.slice(2);
    else if (vOf.indexOf("e:") === 0) equipeId = vOf.slice(2);
    const fornecedorId = ((this.$("#novoFornecedor") || {}).value) || "";

    // Regra por classificação: Material→empresa; Serviço→ofertante; demais (ex.:
    // "Documentação e Inicial")→FLEXÍVEL, exige empresa OU ofertante (ao menos um).
    if (exigeEmpresa(cl) && !fornecedorId) {
      if (this.$("#novoFornecedor")) this.$("#novoFornecedor").setAttribute("error", "Material exige uma empresa.");
      return;
    }
    if (exigeOfertante(cl) && !contatoId && !equipeId) {
      if (this.$("#novoOfertante")) this.$("#novoOfertante").setAttribute("error", "Serviço exige um ofertante.");
      return;
    }
    if (!exigeEmpresa(cl) && !exigeOfertante(cl) && !fornecedorId && !contatoId && !equipeId) {
      if (this.$("#novoOfertante")) this.$("#novoOfertante").setAttribute("error", "Informe uma empresa ou um ofertante.");
      return;
    }

    const valor = Number((this.$("#novoValor") || {}).value);
    const erroValor = valorPositivo(valor);
    if (erroValor) { this.$("#novoValor").setAttribute("error", erroValor); return; }
    const desconto = (this.$("#novoDesc") || {}).value;
    if (Number(desconto) > 0 && Number(desconto) > valor) {
      this.$("#novoDesc").setAttribute("error", "Não pode ser maior que o valor unitário.");
      return;
    }
    const prazo = (((this.$("#novoPrazo") || {}).value) || "").trim();
    if (!prazo) { this.$("#novoPrazo").setAttribute("error", "Informe a data/prazo de entrega."); return; }

    const btn = this.$("#confirmar");
    btn.setAttribute("loading", "");
    try {
      const oferta = await dataStore.criarOferta({
        item_id: itemId,
        contato_id: contatoId,
        equipe_id: equipeId,
        fornecedor_id: fornecedorId,
        valor_unit: valor,
        quantidade: (this.$("#novaQtd") || {}).value,
        valor_unit_desconto: desconto,
        prazo_entrega: prazo,
        observacao: (((this.$("#novaObs") || {}).value) || "").trim(),
        obra_id: obraId, // libera o catálogo do dono numa obra compartilhada
      });
      const r = await dataStore.registrarDespesaOferta(oferta.cotacao_id || "", oferta.id, obraId, "", responsaveis, dataDespesa);
      await this._quitarSePaga([r.despesa], obraId, dataDespesa, pag);
      const obra = dataStore.obra(obraId) || {};
      toastSucesso(`Despesa lançada${pag ? " e paga" : ""} em "${obra.nome || "obra"}".`);
      this.emitir("registrado", { obra_id: obraId });
      this.emitir("fechar");
    } catch (e) {
      if (alerta) alerta.mensagem = (e && e.message) || "Não foi possível registrar a despesa.";
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
