/**
 * <cotacao-detail-view> — Detalhe/comparativo de uma cotação (/cotacoes/:id).
 *
 * Cabeçalho da necessidade + tabela comparativa das ofertas (contato, empresa,
 * valor unit., TOTAL com destaque do menor preço, prazo, obs). Permite escolher
 * a oferta, editar/excluir ofertas e REGISTRAR a escolhida como despesa.
 * Lê do data-store (cache-first) e assina mudanças.
 */
import { rotuloVoltar } from "../../core/router.js";
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, numero, data as fmtData } from "../../core/formatters.js";
import { colunasLog } from "../../core/audit-columns.js";
import { abrirBannerVinculos, vinculosDaOferta } from "../shared/vinculos.js";
import { rotuloOrcamento, ofertanteNome, colunasOferta } from "../orcamentos/orcamento-util.js";
import { editarEmMassa } from "../shared/edicao-massa.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { totalOferta, melhorTotal, resumoOfertas, coresPorContato } from "./cotacao-util.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-data-table.js";
import "../../components/ui-tabs.js";
import "../despesas/category-badge.js";
import "../dashboard/category-breakdown.js";
import "./oferta-kpis.js";
import "./grafico-evolucao-precos.js";
import "./cotacao-form.js";
import "./preco-form.js";
import { abrirRegistrarDespesa } from "./cotacao-despesa-form.js";
import { abrirOferta } from "./preco-form.js";
import { confirmar } from "../../components/confirmar.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };

class CotacaoDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
  }

  get cotacaoId() {
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
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .acoes-topo { display: flex; gap: var(--esp-2); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; }
      /* Gráficos lado a lado, mesmo tamanho (empilham no mobile). */
      .graficos { display: grid; gap: var(--esp-5); grid-template-columns: repeat(2, 1fr); }
      .graficos > * { min-width: 0; height: 320px; }
      @media (max-width: 900px) {
        .graficos { grid-template-columns: 1fr; }
        .graficos > * { height: auto; min-height: 300px; }
      }
      .escolhida { background: var(--cor-superficie-2); border-radius: var(--raio-md);
        padding: var(--esp-4); display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .escolhida .info { display: flex; flex-direction: column; gap: 2px; }
      .escolhida .rot { font-size: var(--fs-xs); text-transform: uppercase;
        letter-spacing: .03em; color: var(--cor-texto-suave); }
      .escolhida .val { font-size: var(--fs-lg); font-weight: var(--peso-forte);
        color: var(--cor-sucesso); }
      .registrada { display: inline-flex; align-items: center; gap: 6px;
        color: var(--cor-sucesso); font-weight: var(--peso-semi); font-size: var(--fs-sm); }
      .dica { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      /* Ofertas AGRUPADAS por item (uma seção/mesa por item da subclassificação). */
      .barra-ofertas { display: flex; justify-content: flex-end; margin-bottom: var(--esp-3); }
      #grupos { display: flex; flex-direction: column; gap: var(--esp-5); }
      .vazio-of { color: var(--cor-texto-fraco); padding: var(--esp-4); text-align: center; }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando cotação..."></ui-spinner></div></div>`;
  }

  aoConectar() {
    if (!dataStore.cotacao(this.cotacaoId)) {
      this.$("#conteudo").innerHTML = `<p>Cotação não encontrada. <a href="/cotacoes">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <oferta-kpis id="kpis"></oferta-kpis>
      <a class="voltar" href="/cotacoes"><ui-icon name="seta-esquerda" size="18"></ui-icon><span>${rotuloVoltar("/cotacoes")}</span></a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="graficos" class="graficos">
          <ui-card><grafico-evolucao-precos id="evolucao"></grafico-evolucao-precos></ui-card>
          <ui-card><category-breakdown id="comparacao"></category-breakdown></ui-card>
        </div>
        <div slot="ofertas">
          <div class="barra-ofertas"><ui-button id="addOferta">+ Adicionar oferta</ui-button></div>
          <div id="grupos"></div>
          <div id="escolhida"></div>
        </div>
      </ui-tabs>
    `;
    alvo.querySelector("#abas").abas = [
      { id: "graficos", rotulo: "Gráficos", icone: "grafico" },
      { id: "ofertas", rotulo: "Ofertas", icone: "cifrao" },
    ];
    alvo.querySelector("#addOferta").addEventListener("click", () => this.abrirPrecoForm(null));
    this._kpis = alvo.querySelector("#kpis");
    this._evolucao = alvo.querySelector("#evolucao");
    this._comparacao = alvo.querySelector("#comparacao");
    this._grupos = alvo.querySelector("#grupos");
    this._montado = true;
  }

  /** Cria uma tabela PADRÃO de ofertas para UM grupo (item) — colunas Item/Subclasse
   * são omitidas (viram o título da seção). Mesmas ações de toda oferta. */
  _tabelaGrupo(ofertas) {
    const t = document.createElement("ui-data-table");
    t.setAttribute("fluido", "");
    t.setAttribute("clicavel", "");
    // Item e Subclassificação são constantes no grupo → ficam no título da seção.
    t.columns = colunasOferta().filter((col) => col.titulo !== "Item" && col.titulo !== "Subclassificação");
    t.acoes = [
      { nome: "registrar", rotulo: "Registrar" },
      { nome: "escolher", rotulo: "Escolher" },
      { nome: "remover", rotulo: "Excluir", variant: "perigo" },
    ];
    t.rows = ofertas;
    t.addEventListener("acao", (e) => {
      const acao = e.detail.acao;
      const preco = e.detail.linha;
      if (acao === "registrar") abrirRegistrarDespesa(preco);
      else if (acao === "escolher") this.escolher(preco);
      else this.removerPreco(preco);
    });
    // Clique na oferta → banner único (a cotação restringe o item à subclasse).
    t.addEventListener("linha", (e) => abrirOferta(e.detail.linha, { cotacao: this._cotacao }));
    // Edição em massa: reusa o preco-form; campos alterados valem p/ todas.
    t.setAttribute("editar-massa", "");
    t.addEventListener("editar-massa", (e) =>
      editarEmMassa(e.detail.linhas, {
        criarForm: (ref) => {
          const f = document.createElement("preco-form");
          f.preco = ref;
          f.cotacao = this._cotacao;
          return f;
        },
        reler: (ref) => dataStore.todasOfertas().find((o) => String(o.id) === String(ref.id)),
        aplicar: (l, diff) => dataStore.atualizarOferta(l.id, diff),
      })
    );
    // Exclusão em massa (a tabela já confirmou).
    t.setAttribute("excluir-massa", "");
    t.addEventListener("excluir-massa", async (e) => {
      let ok = 0;
      for (const p of e.detail.linhas || []) {
        try {
          await dataStore.removerPreco(this.cotacaoId, p.id);
          ok++;
        } catch (err) {
          notificarErro(err);
        }
      }
      if (ok) toastSucesso(`${ok} oferta(s) excluída(s).`);
    });
    return t;
  }

  /** Renderiza as ofertas AGRUPADAS por item — uma "mesa" por item da subclassificação,
   * com nº de ofertas e melhor preço (do grupo) no título; cada grupo ordenado do menor
   * total p/ o maior (melhor preço no topo). */
  _montarGrupos(precos, c) {
    const cont = this._grupos;
    if (!cont) return;
    if (!precos.length) {
      cont.innerHTML = `<ui-card mesa title="Mesa com ofertas"><div class="vazio-of">Nenhuma oferta ainda. Adicione ofertas de contatos (de itens desta subclassificação) para comparar.</div></ui-card>`;
      return;
    }
    cont.replaceChildren();
    dataStore.precosDaCotacaoPorItem(this.cotacaoId).forEach((g) => {
      const itemNome = (g.itemId && (dataStore.item(g.itemId) || {}).nome) || "Sem item definido";
      const melhor = melhorTotal(g.ofertas, c);
      const card = document.createElement("ui-card");
      card.setAttribute("mesa", "");
      card.setAttribute(
        "title",
        `${itemNome} · ${g.ofertas.length} oferta(s)` + (melhor != null ? ` · melhor ${moeda(melhor)}` : "")
      );
      const ordenadas = g.ofertas.slice().sort((a, b) => totalOferta(a, c) - totalOferta(b, c));
      card.appendChild(this._tabelaGrupo(ordenadas));
      cont.appendChild(card);
    });
  }

  sincronizar() {
    if (!this._montado) return;
    const c = dataStore.cotacao(this.cotacaoId);
    if (!c) {
      irPara("/cotacoes");
      return;
    }
    this._cotacao = c;
    this._mapaContato = {};
    dataStore.contatos().forEach((x) => (this._mapaContato[x.id] = x));
    this._mapaForn = {};
    dataStore.fornecedores().forEach((f) => (this._mapaForn[f.id] = f.nome));

    const precos = dataStore.precosDaCotacao(this.cotacaoId);
    // Ofertas AGRUPADAS por item (a cotação é por subclassificação): cada grupo tem o
    // seu próprio "melhor preço" (mesmo item = comparável).
    this._montarGrupos(precos, c);

    // Cores estáveis por contato (mesma cor no gráfico, na comparação e legenda).
    // Inclui contatos do histórico (mesmo os de ofertas já excluídas).
    const historico = dataStore.historicoDaCotacao(this.cotacaoId);
    const idsContato = [];
    precos.forEach((p) => idsContato.indexOf(p.contato_id) < 0 && idsContato.push(p.contato_id));
    historico.forEach((h) => idsContato.indexOf(h.contato_id) < 0 && idsContato.push(h.contato_id));
    this._cores = coresPorContato(idsContato);

    // KPIs (sobre as ofertas atuais).
    this._kpis.resumo = resumoOfertas(precos, c);

    // Gráfico de evolução (uma linha por contato, a partir do histórico).
    this._evolucao.cotacao = c;
    this._evolucao.contatos = this._mapaContato;
    this._evolucao.cores = this._cores;
    this._evolucao.historico = historico;

    // Comparação das ofertas ATUAIS por contato (reusa category-breakdown).
    this._comparacao.porCategoria = precos.map((p) => ({
      categoria_id: p.id,
      nome: (this._mapaContato[p.contato_id] || { nome: "—" }).nome,
      cor: this._cores[p.contato_id] || "var(--cor-primaria)",
      total: totalOferta(p, c),
    }));

    this.pintarTopo();
    this.pintarEscolhida(precos);
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo) return;
    const c = this._cotacao;
    const cat = (dataStore.categorias().find((x) => String(x.id) === String(c.categoria_id)) || null);
    const obra = c.obra_id ? dataStore.obra(c.obra_id) : null;
    const qtd = Number(c.quantidade) > 0 ? `${numero(c.quantidade)} ${c.unidade || ""}`.trim() : "";
    // Título = SUBCLASSIFICAÇÃO da cotação (nome ao vivo da categoria); `descricao` é fallback.
    const nomeSub = (cat && cat.nome) || c.descricao || "Cotação";
    topo.innerHTML = `
      <div>
        <h1>${nomeSub}</h1>
        <div class="meta">
          <span>Cotação por subclassificação</span>
          ${qtd ? `<span>· ${qtd}</span>` : ""}
          ${obra ? `· <a href="/obras/${obra.id}"><ui-icon name="obra" size="14"></ui-icon> ${obra.nome}</a>` : ""}
          <span>· ${c.status === "fechada" ? "Fechada" : "Aberta"}</span>
          ${c.criado_em ? `<span>· <ui-icon name="relogio" size="13"></ui-icon> Criada em ${fmtData(c.criado_em)}</span>` : ""}
        </div>
      </div>
      <div class="acoes-topo">
        <ui-button id="editarCotacao" variant="secundario">Editar cotação</ui-button>
      </div>
    `;
    topo.querySelector("#editarCotacao").addEventListener("click", () => this.editarCotacao());
  }

  pintarEscolhida(precos) {
    const el = this.shadowRoot.querySelector("#escolhida");
    if (!el) return;
    const escolhida = (precos || []).find((p) => this._bool(p.escolhido));
    if (!escolhida) {
      el.innerHTML = `<p class="dica">Marque uma oferta como "Escolhida" para registrá-la como despesa.</p>`;
      return;
    }
    const contato = this._mapaContato[escolhida.contato_id] || { nome: "—" };
    const empresa = contato.fornecedor_id ? this._mapaForn[contato.fornecedor_id] : "";
    const total = totalOferta(escolhida, this._cotacao);
    const registrada = !!escolhida.despesa_id;
    el.innerHTML = `
      <div class="escolhida">
        <div class="info">
          <span class="rot">Oferta escolhida</span>
          <span>${contato.nome}${empresa ? " — " + empresa : ""}</span>
          <span class="val">${moeda(total)}</span>
        </div>
        ${
          registrada
            ? `<span class="registrada"><ui-icon name="sucesso" size="16"></ui-icon> Registrada como despesa</span>`
            : `<ui-button id="registrar">Registrar como despesa</ui-button>`
        }
      </div>
    `;
    const btn = el.querySelector("#registrar");
    if (btn) btn.addEventListener("click", () => this.registrarDespesa(escolhida, contato.nome));
  }

  /* ------------------------------ Ações -------------------------------- */

  abrirPrecoForm(preco) {
    const form = document.createElement("preco-form");
    form.cotacaoId = this.cotacaoId;
    form.preco = preco;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  editarCotacao() {
    const form = document.createElement("cotacao-form");
    form.cotacao = this._cotacao;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  async escolher(preco) {
    try {
      await dataStore.escolherPreco(this.cotacaoId, preco.id);
    } catch (e) {
      notificarErro(e);
    }
  }

  removerPreco(preco) {
    abrirBannerVinculos({
      titulo: "Esta oferta",
      grupos: vinculosDaOferta(preco),
      aoExcluir: async () => {
        if (!(await confirmar({ titulo: "Excluir oferta", mensagem: `Excluir esta oferta?`, perigo: true, rotuloOk: "Excluir" }))) return;
        try {
          await dataStore.removerPreco(this.cotacaoId, preco.id);
          toastSucesso("Oferta removida.");
        } catch (e) {
          notificarErro(e);
        }
      },
    });
  }

  registrarDespesa(preco, contatoNome) {
    const form = document.createElement("cotacao-despesa-form");
    form.cotacao = this._cotacao;
    form.preco = preco;
    form.contatoNome = contatoNome;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }

  _bool(v) {
    return v === true || v === "TRUE" || v === "true";
  }
}

customElements.define("cotacao-detail-view", CotacaoDetailView);
