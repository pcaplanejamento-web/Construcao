/**
 * <obra-detail-view> — Detalhe da obra (rota /obras/:id).
 *
 * Layout: cabeçalho → dashboard → GRÁFICOS (categoria/rosca/mês) → formulário de
 * adição → TABELA full-width. Lê do data-store (cache-first) e sincroniza os
 * filhos por propriedade. A edição de um item é feita no BANNER <despesa-detail>
 * (clique na linha ou em Editar), não mais no formulário de adição.
 */
import { rotuloVoltar } from "../../core/router.js";
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { balancos, restoDespesa } from "../despesas/despesa-split.js";
import { avatarNomeHtml } from "../shared/avatar.js";
import { montarGradeOrcamentos } from "../orcamentos/orcamento-grade.js";
import { montarGradeEquipes } from "../equipes/equipe-grade.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../dashboard/grafico-rosca.js";
import "../dashboard/grafico-mensal.js";
import "../cotacoes/cotacao-despesa-form.js";
import "../orcamentos/orcamento-form.js";
import "../despesas/despesa-table.js";
import "../despesas/despesa-detail.js";
import "../despesas/split-editor.js";
import "../../components/ui-modal.js";
import "./obra-form.js";
import "./obra-share-form.js";
import "./obra-participantes.js";
import "../pagamentos/pagamento-form.js";
import { abrirTransferencia, nomeTipo, excluirTransferenciaComAviso } from "../pagamentos/pagamento-util.js";
import { confirmar, avisar } from "../../components/confirmar.js";

class ObraDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
    this._catSig = null;
  }

  get obraId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--esp-2); color: var(--cor-primaria); font-size: var(--fs-md); font-weight: var(--peso-forte); text-decoration: none; }
      .voltar:hover { text-decoration: none; color: var(--cor-primaria-escura); }
      #conteudo { display: flex; flex-direction: column; gap: var(--esp-5); }
      .topo { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .acoes-topo { display: flex; gap: var(--esp-2); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      /* Gráficos em grade 1 x 3, todos do MESMO tamanho (largura e altura). */
      .graficos { display: grid; gap: var(--esp-5); grid-template-columns: repeat(3, 1fr); }
      .graficos > * { min-width: 0; height: 340px; }
      @media (max-width: 900px) {
        .graficos { grid-template-columns: 1fr; }
        .graficos > * { height: auto; min-height: 300px; }
      }
      .despesas-aba { display: flex; flex-direction: column; gap: var(--esp-5); }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando obra..."></ui-spinner></div></div>`;
  }

  aoConectar() {
    if (!dataStore.obra(this.obraId)) {
      this.$("#conteudo").innerHTML = `<p>Obra não encontrada. <a href="/obras">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  /* --------------------------- Montagem ------------------------------ */

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <dashboard-summary id="dash"></dashboard-summary>
      <a class="voltar" href="/obras"><ui-icon name="seta-esquerda" size="18"></ui-icon><span>${rotuloVoltar("/obras")}</span></a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="graficos" class="graficos">
          <ui-card><category-breakdown id="break" titulo="Gastos por subclassificação"></category-breakdown></ui-card>
          <ui-card><grafico-rosca id="rosca" titulo="Distribuição por classificação"></grafico-rosca></ui-card>
          <ui-card><grafico-mensal id="mensal"></grafico-mensal></ui-card>
        </div>
        <div slot="despesas" class="despesas-aba">
          <ui-card mesa title="Mesa com despesas da obra">
            <ui-button slot="acoes" id="addDespesa">+ Registrar Despesa</ui-button>
            <despesa-table id="tabela"></despesa-table>
          </ui-card>
        </div>
        <div slot="participantes">
          <obra-participantes obra-id="${this.obraId}"></obra-participantes>
        </div>
        <div slot="responsaveis">
          <obra-participantes obra-id="${this.obraId}" modo="responsaveis"></obra-participantes>
        </div>
        <div slot="orcamentos">
          <ui-card mesa title="Mesa com orçamentos da obra">
            <ui-button slot="acoes" id="addOrc">+ Novo orçamento</ui-button>
            <div id="gradeOrc"></div>
          </ui-card>
        </div>
        <div slot="equipes">
          <ui-card mesa title="Mesa com equipes da obra">
            <div id="gradeEquipes"></div>
          </ui-card>
        </div>
        <div slot="fornecedores">
          <ui-card mesa title="Mesa com fornecedores da obra">
            <ui-data-table id="tabForn" fluido clicavel
              empty-text="Nenhum fornecedor usado nesta obra ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="pagamentos">
          <ui-tabs id="abasPag">
            <div slot="transferencias">
              <ui-card mesa title="Mesa com transferências da obra">
                <ui-button slot="acoes" id="addPag">+ Registrar transferência</ui-button>
                <ui-data-table id="tabTransf" fluido clicavel
                  empty-text="Nenhuma transferência registrada nesta obra."></ui-data-table>
              </ui-card>
            </div>
            <div slot="pagamentos">
              <ui-card mesa title="Mesa com pagamentos da obra">
                <ui-data-table id="tabPag" fluido
                  empty-text="Nenhum pagamento registrado nesta obra."></ui-data-table>
              </ui-card>
            </div>
          </ui-tabs>
        </div>
      </ui-tabs>
    `;
    alvo.querySelector("#abas").abas = [
      { id: "graficos", rotulo: "Gráficos", icone: "grafico" },
      { id: "despesas", rotulo: "Despesas", icone: "recibo" },
      { id: "participantes", rotulo: "Participantes", icone: "usuario" },
      { id: "responsaveis", rotulo: "Responsáveis", icone: "seguranca" },
      { id: "orcamentos", rotulo: "Orçamentos", icone: "carteira" },
      { id: "equipes", rotulo: "Equipes", icone: "usuario" },
      { id: "fornecedores", rotulo: "Fornecedores", icone: "fornecedor" },
      { id: "pagamentos", rotulo: "Transferência", icone: "cifrao" },
    ];
    const abasPag = alvo.querySelector("#abasPag");
    if (abasPag)
      abasPag.abas = [
        { id: "transferencias", rotulo: "Transferências", icone: "cifrao" },
        { id: "pagamentos", rotulo: "Pagamentos", icone: "recibo" },
      ];
    this._gradeOrc = alvo.querySelector("#gradeOrc");
    this._gradeEquipes = alvo.querySelector("#gradeEquipes");
    this._tabForn = alvo.querySelector("#tabForn");
    this._tabForn.addEventListener("linha", (e) => {
      irPara("/fornecedores/" + e.detail.linha.id);
    });
    this._dash = alvo.querySelector("#dash");
    this._break = alvo.querySelector("#break");
    this._rosca = alvo.querySelector("#rosca");
    this._mensal = alvo.querySelector("#mensal");
    this._tabela = alvo.querySelector("#tabela");

    alvo.querySelector("#addDespesa").addEventListener("click", () => this.abrirDespesaForm());
    alvo.querySelector("#addOrc").addEventListener("click", () => this.abrirOrcamentoForm());
    this._tabela.addEventListener("abrir", (e) => this.abrirBanner(e.detail.despesa));
    this._tabela.addEventListener("editar", (e) => this.abrirBanner(e.detail.despesa));
    this._tabela.addEventListener("remover", (e) => this.remover(e.detail.despesa));
    this._tabela.addEventListener("excluir-massa", (e) => this.removerMassa(e.detail.despesas));
    this._tabela.addEventListener("acao-massa", (e) => this.acaoMassa(e.detail.acao, e.detail.despesas));

    // Aba Transferência → sub-abas [Transferências | Pagamentos].
    this._tabTransf = alvo.querySelector("#tabTransf");
    this._tabPag = alvo.querySelector("#tabPag");
    alvo.querySelector("#addPag").addEventListener("click", () => this.abrirPagamentoForm());
    this._tabTransf.acoes = [{ nome: "remover", rotulo: "Excluir", variant: "perigo" }];
    this._tabTransf.columns = [
      { chave: "data", titulo: "Data", formato: (v) => fmtData(v) },
      { chave: "valor_total", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "tipo", titulo: "Tipo", formato: (v) => nomeTipo(v) },
      { chave: "pagador_chave", titulo: "Pagou", formato: (v) => this._nomeChave(v) },
      { chave: "_recebedor", titulo: "Recebedor", formato: (_, l) => this._nomeRecebedor(l) },
      { chave: "pagamento_ids", titulo: "Pagamentos", alinhar: "dir", formato: (v) => String((v || []).length) },
    ];
    this._tabTransf.addEventListener("linha", (e) => abrirTransferencia(e.detail.linha));
    this._tabTransf.addEventListener("acao", (e) => {
      if (e.detail.acao === "remover") this.removerTransferenciaObra(e.detail.linha);
    });
    this._tabPag.acoes = [{ nome: "remover", rotulo: "Excluir", variant: "perigo" }];
    this._tabPag.columns = [
      { chave: "data", titulo: "Data", formato: (v) => fmtData(v) },
      { chave: "valor", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "pagador_chave", titulo: "Pagou", formato: (v) => this._nomeChave(v) },
      { chave: "_recebedor", titulo: "Recebedor", formato: (_, l) => this._nomeRecebedor(l) },
      { chave: "alocacoes", titulo: "Despesas", alinhar: "dir", formato: (v) => String((v || []).length) },
    ];
    this._tabPag.addEventListener("acao", (e) => {
      if (e.detail.acao === "remover") this.removerPagamentoObra(e.detail.linha);
    });

    this._montado = true;
  }

  sincronizar() {
    if (!this._montado) return;
    const o = dataStore.obra(this.obraId);
    if (!o) {
      irPara("/obras");
      return;
    }
    this._obra = o;
    // Subclassificações de ITEM (exclui classificações de fornecedor).
    const categorias = dataStore.categoriasDaObra(this.obraId).filter((c) => String(c.tipo || "") !== "fornecedor");
    const resumo = dataStore.resumo(this.obraId);
    const despesas = dataStore.despesas(this.obraId);

    this._despesas = despesas; // todas (KPIs/gráficos usam o total; tabela é filtrada)
    this._dash.resumo = resumo;
    // Barras = Subclassificação; Rosca = Classificação (Material/Serviço).
    this._break.porCategoria = resumo.por_subclassificacao || resumo.por_categoria || [];
    this._rosca.porCategoria = resumo.por_classificacao || [];
    this._mensal.despesas = despesas;
    this._tabela.categorias = categorias;
    this._tabela.participantes = dataStore.participantesDaObra(this.obraId);
    montarGradeOrcamentos(
      this._gradeOrc,
      dataStore.orcamentos().filter((o) => String(o.obra_id) === String(this.obraId))
    );
    montarGradeEquipes(this._gradeEquipes, dataStore.equipesDaObra(this.obraId));
    this.montarFornecedores(despesas);
    // Tabela recebe TODAS as despesas; busca (campo da tabela) e filtro de
    // Classificação (dropdown do tópico) acontecem dentro da própria tabela.
    this._tabela.despesas = despesas;
    // Pagamentos / Repasses da obra.
    this._mapaPart = {};
    dataStore.participantesDaObra(this.obraId).forEach((p) => (this._mapaPart[p.chave] = p.nome));
    if (this._tabTransf) this._tabTransf.rows = dataStore.transferenciasDaObra(this.obraId);
    if (this._tabPag) this._tabPag.rows = dataStore.pagamentosDaObra(this.obraId);
    this.pintarTopo();
  }

  /* ----------------------- Pagamentos / Repasses ----------------------- */

  _nomeContato(id) {
    if (!id) return "—";
    return (dataStore.contatos().find((c) => String(c.id) === String(id)) || {}).nome || "—";
  }
  /** Nome de uma chave de participante ("c:"/"e:"/"u:") ou contato direto. */
  _nomeChave(chave) {
    const s = String(chave || "");
    if (this._mapaPart && this._mapaPart[s]) return this._mapaPart[s];
    if (s.indexOf("c:") === 0) return this._nomeContato(s.slice(2));
    if (s.indexOf("e:") === 0) return (dataStore.equipe(s.slice(2)) || {}).nome || "—";
    return s || "—";
  }
  _nomeRecebedor(p) {
    if (p.recebedor_equipe_id) return ((dataStore.equipe(p.recebedor_equipe_id) || {}).nome || "—") + " (grupo)";
    return this._nomeContato(p.recebedor_contato_id);
  }

  abrirPagamentoForm(despesasSelecionadas, aviso) {
    const form = document.createElement("pagamento-form");
    form.obra = this._obra;
    if (despesasSelecionadas) form.despesasSelecionadas = despesasSelecionadas;
    if (aviso) form.aviso = aviso;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  /** Re-resolve as despesas selecionadas para a versão VIVA do store (por id). A
   * tabela guarda a seleção por referência de objeto; após uma mutação (pagar/excluir),
   * o objeto na seleção pode ficar DESATUALIZADO. Agir sempre sobre o estado atual evita
   * falsos "já quitada"/"já tem pagamento" (restoDespesa lê pagamentos_realizados do objeto). */
  _frescas(despesas) {
    const porId = new Map(dataStore.despesas(this.obraId).map((d) => [String(d.id), d]));
    return (despesas || []).map((d) => porId.get(String((d || {}).id)) || d);
  }

  /** Ações em massa sobre as despesas selecionadas (vindas da tabela). */
  acaoMassa(acao, despesas) {
    const frescas = this._frescas(despesas);
    if (acao === "pagar") this.pagarMassa(frescas);
    else if (acao === "responsavel") this.responsabilidadeMassa(frescas);
  }

  /** Lançar pagamento nas selecionadas — ignora as já QUITADAS (sem saldo a pagar).
   * Usa o saldo VISÍVEL (restoDespesa), o MESMO critério do pagamento-form e do status
   * na tela — assim uma despesa "A pagar" nunca é tratada como já paga. */
  pagarMassa(despesas) {
    const lista = despesas || [];
    const quitadas = lista.filter((d) => restoDespesa(d) <= 0.01);
    const disponiveis = lista.filter((d) => restoDespesa(d) > 0.01);
    if (!disponiveis.length) {
      notificarErro(new Error("Todas as selecionadas já estão quitadas (sem saldo a pagar)."));
      return;
    }
    const aviso = quitadas.length
      ? `${quitadas.length} despesa(s) já quitada(s) foram ignoradas (sem saldo a pagar).`
      : "";
    this.abrirPagamentoForm(disponiveis, aviso);
  }

  /** Definir a MESMA responsabilidade (% por participante) nas selecionadas. */
  responsabilidadeMassa(despesas) {
    const lista = despesas || [];
    if (!lista.length) return;
    const modal = document.createElement("ui-modal");
    modal.setAttribute("open", "");
    modal.setAttribute("title", `Definir responsabilidade · ${lista.length} despesa(s)`);
    const corpo = document.createElement("div");
    const ed = document.createElement("split-editor");
    ed.modo = "pct";
    ed.limite = 100;
    ed.participantes = dataStore.participantesDaObra(this.obraId);
    ed.itens = [];
    corpo.appendChild(ed);
    modal.appendChild(corpo);
    const rod = document.createElement("div");
    rod.setAttribute("slot", "rodape");
    const cancelar = document.createElement("ui-button");
    cancelar.setAttribute("variant", "secundario");
    cancelar.textContent = "Cancelar";
    cancelar.addEventListener("click", () => modal.remove());
    const salvar = document.createElement("ui-button");
    salvar.textContent = "Aplicar";
    salvar.addEventListener("click", async () => {
      const responsaveis = ed.itens
        .filter((x) => x.chave && Number(x.valor) > 0)
        .map((x) => ({ chave: x.chave, pct: Number(x.valor) || 0 }));
      salvar.setAttribute("loading", "");
      try {
        for (const d of lista) await dataStore.atualizarDespesa(this.obraId, d.id, { responsaveis });
        toastSucesso(`Responsabilidade definida em ${lista.length} despesa(s).`);
        modal.remove();
      } catch (e) {
        notificarErro(e);
      }
      salvar.removeAttribute("loading");
    });
    rod.appendChild(cancelar);
    rod.appendChild(salvar);
    modal.appendChild(rod);
    modal.addEventListener("fechar", () => modal.remove());
    document.body.appendChild(modal);
  }

  async removerPagamentoObra(pagamento) {
    const t = dataStore.transferenciaDoPagamento(pagamento.id);
    const nPags = t ? (t.pagamento_ids || []).length : 1;
    if (nPags > 1) {
      await avisar({
        titulo: "Não é possível excluir só este pagamento",
        mensagem:
          "Este pagamento faz parte de uma transferência com vários pagamentos. Exclua a transferência inteira — todos os pagamentos saem juntos.",
      });
      return;
    }
    const ok = await confirmar({
      titulo: "Excluir pagamento",
      mensagem: "Isso exclui o pagamento e a transferência. As despesas cobertas voltam a ficar em aberto.",
      perigo: true,
      rotuloOk: "Excluir",
    });
    if (!ok) return;
    try {
      if (t) await dataStore.excluirTransferencia(t);
      else await dataStore.excluirPagamento(pagamento);
      toastSucesso("Pagamento e transferência excluídos.");
    } catch (e) {
      notificarErro(e);
    }
  }

  async removerTransferenciaObra(transferencia) {
    // Aviso lista os pagamentos; após aceite, cascata (pagamentos + repasses + vínculos).
    await excluirTransferenciaComAviso(transferencia);
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo || !this._obra) return;
    const o = this._obra;
    const ehDono = o.ehDono !== false;
    topo.innerHTML = `
      <div>
        <h1>${o.nome || ""}</h1>
        <div class="meta">${
          o.endereco
            ? `<ui-icon name="local" size="14"></ui-icon> ${o.endereco} · `
            : ""
        }${o.descricao || ""}${
      !ehDono && o.dono_email
        ? ` · <ui-icon name="usuario" size="14"></ui-icon> compartilhada por ${o.dono_email}`
        : ""
    }</div>
      </div>
      <div class="acoes-topo">
        ${
          ehDono
            ? `<ui-button id="compartilharObra" variant="secundario">Compartilhar</ui-button>
               <ui-button id="editarObra" variant="secundario">Editar obra</ui-button>`
            : ""
        }
      </div>
    `;
    if (ehDono) {
      topo.querySelector("#editarObra").addEventListener("click", () => this.editarObra());
      topo.querySelector("#compartilharObra").addEventListener("click", () => this.compartilharObra());
    }
  }

  /* --------------------------- Ações --------------------------------- */

  /**
   * Abre o modal para REGISTRAR uma oferta como despesa nesta obra (obra-fixa;
   * escolhe a oferta). Não há mais cadastro manual — a despesa nasce da oferta.
   */
  abrirDespesaForm() {
    const form = document.createElement("cotacao-despesa-form");
    form.obraFixaId = this.obraId;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("registrado", fechar);
    document.body.appendChild(form);
  }

  /** Abre o modal para criar um orçamento JÁ VINCULADO a esta obra (campo travado). */
  abrirOrcamentoForm() {
    const form = document.createElement("orcamento-form");
    form.obraFixaId = this.obraId;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", () => this.sincronizar());
    document.body.appendChild(form);
  }

  /** Aba Fornecedores: empresas usadas na obra + Total/Pago/Saldo a receber. */
  montarFornecedores(despesas) {
    const tab = this._tabForn;
    if (!tab) return;
    const { porFornecedor } = balancos(despesas);
    const qtd = {};
    despesas.forEach((d) => {
      if (d.fornecedor_id) qtd[d.fornecedor_id] = (qtd[d.fornecedor_id] || 0) + 1;
    });
    tab.columns = [
      { chave: "_nome", titulo: "Fornecedor", formato: (v) => avatarNomeHtml(v) },
      { chave: "_qtd", titulo: "Despesas", alinhar: "dir" },
      { chave: "_total", titulo: "Total", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      {
        chave: "_resto",
        titulo: "Saldo a receber",
        alinhar: "dir",
        moeda: true,
        formato: (v) =>
          v > 0.01
            ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    tab.rows = Object.keys(porFornecedor)
      .map((fid) => {
        const f = dataStore.fornecedores().find((x) => String(x.id) === String(fid)) || {};
        const v = porFornecedor[fid];
        return { id: fid, _nome: f.nome || "—", _qtd: qtd[fid] || 0, _total: v.total, _recebido: v.recebido, _resto: v.saldoReceber };
      })
      .sort((a, b) => b._resto - a._resto);
  }

  /** Abre o banner com a despesa (ver/editar/excluir). O banner é autossuficiente. */
  abrirBanner(despesa) {
    const banner = document.createElement("despesa-detail");
    banner.despesa = despesa;
    banner.categorias = dataStore.categoriasDaObra(this.obraId).filter((c) => String(c.tipo || "") !== "fornecedor");
    banner.addEventListener("fechar", () => banner.remove());
    document.body.appendChild(banner);
  }

  async remover(despesa) {
    // Trava: não excluir despesa com pagamento vinculado.
    if (dataStore.despesaTemPagamento(despesa)) {
      await avisar({
        titulo: "Despesa com pagamento vinculado",
        mensagem:
          "Esta despesa tem pagamento vinculado. Exclua o pagamento (ou a transferência) antes de excluir a despesa.",
      });
      return;
    }
    const ok = await confirmar({
      titulo: "Excluir despesa",
      mensagem: `Excluir a despesa "${despesa.item}"?`,
      perigo: true,
      rotuloOk: "Excluir",
    });
    if (!ok) return;
    try {
      await dataStore.removerDespesa(this.obraId, despesa.id);
    } catch (e) {
      notificarErro(e);
    }
  }

  /** Exclusão em massa (a tabela já confirmou) — remove cada selecionada. */
  async removerMassa(despesas) {
    const lista = this._frescas(despesas);
    const comPag = lista.filter((d) => dataStore.despesaTemPagamento(d));
    if (comPag.length) {
      await avisar({
        titulo: "Despesas com pagamento vinculado",
        mensagem: `${comPag.length} das ${lista.length} despesas selecionadas têm pagamento vinculado. Exclua os pagamentos/transferências antes — nenhuma foi excluída.`,
        listaHtml: comPag.map((d) => `<span>• ${d.item || "Despesa"}</span>`).join(""),
      });
      return;
    }
    try {
      for (const d of lista) await dataStore.removerDespesa(this.obraId, d.id);
      toastSucesso(`${lista.length} despesa(s) excluída(s).`);
    } catch (e) {
      notificarErro(e);
    }
  }

  editarObra() {
    const form = document.createElement("obra-form");
    form.obra = this._obra;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  compartilharObra() {
    const form = document.createElement("obra-share-form");
    form.obra = this._obra;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }
}

customElements.define("obra-detail-view", ObraDetailView);
