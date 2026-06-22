/**
 * <cotacao-detail-view> — Detalhe/comparativo de uma cotação (/cotacoes/:id).
 *
 * Cabeçalho da necessidade + tabela comparativa das ofertas (contato, empresa,
 * valor unit., TOTAL com destaque do menor preço, prazo, obs). Permite escolher
 * a oferta, editar/excluir ofertas e REGISTRAR a escolhida como despesa.
 * Lê do data-store (cache-first) e assina mudanças.
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, numero, data as fmtData } from "../../core/formatters.js";
import { colunasLog } from "../../core/audit-columns.js";
import { abrirBannerVinculos, vinculosDaOferta } from "../shared/vinculos.js";
import { rotuloOrcamento, ofertanteNome } from "../orcamentos/orcamento-util.js";
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
import "./cotacao-despesa-form.js";

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
      <a class="voltar" href="/cotacoes"><ui-icon name="seta-esquerda" size="18"></ui-icon><span>Cotações</span></a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="graficos" class="graficos">
          <ui-card><grafico-evolucao-precos id="evolucao"></grafico-evolucao-precos></ui-card>
          <ui-card><category-breakdown id="comparacao"></category-breakdown></ui-card>
        </div>
        <div slot="ofertas">
          <ui-card title="Ofertas">
            <ui-button slot="acoes" id="addOferta">+ Adicionar oferta</ui-button>
            <ui-data-table id="tabela" fluido
              empty-text="Nenhuma oferta ainda. Adicione ofertas de contatos para comparar."></ui-data-table>
          </ui-card>
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
    this._tabela = alvo.querySelector("#tabela");
    this._tabela.columns = [
      {
        chave: "contato_id",
        titulo: "Ofertante",
        formato: (id, linha) => ofertanteNome(linha.contato_id, linha.equipe_id),
      },
      {
        chave: "contato_id",
        titulo: "Empresa",
        formato: (id, linha) => {
          if (linha.equipe_id) return `<span style="color:var(--cor-texto-fraco)">—</span>`;
          const c = this._mapaContato[id];
          const emp = c && c.fornecedor_id ? this._mapaForn[c.fornecedor_id] : "";
          return emp || `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      { chave: "valor_unit", titulo: "Valor unit.", alinhar: "dir", formato: (v) => moeda(v) },
      {
        chave: "valor_unit",
        titulo: "Total",
        alinhar: "dir",
        formato: (v, linha) => {
          const t = totalOferta(linha, this._cotacao);
          const ehMenor = this._min != null && t === this._min;
          return ehMenor
            ? `<strong style="color:var(--cor-sucesso)">${moeda(t)}</strong>`
            : moeda(t);
        },
      },
      { chave: "prazo_entrega", titulo: "Prazo", formato: (v) => v || "—" },
      { chave: "observacao", titulo: "Obs.", formato: (v) => v || "—" },
      {
        chave: "orcamento_id",
        titulo: "Orçamento",
        formato: (id) => {
          const orc = id ? dataStore.orcamento(id) : null;
          return orc
            ? `<a href="/orcamentos/${orc.id}">${rotuloOrcamento(orc)}</a>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      ...colunasLog(),
      {
        chave: "escolhido",
        titulo: "Status",
        formato: (v, linha) =>
          linha.despesa_id
            ? `<category-badge nome="Registrada" cor="var(--cor-info)"></category-badge>`
            : this._bool(v)
            ? `<category-badge nome="Escolhida" cor="var(--cor-sucesso)"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    this._tabela.acoes = [
      { nome: "escolher", rotulo: "Escolher" },
      { nome: "editar", rotulo: "Editar" },
      { nome: "remover", rotulo: "Excluir", variant: "perigo" },
    ];
    this._tabela.addEventListener("acao", (e) => {
      const acao = e.detail.acao;
      const preco = e.detail.linha;
      if (acao === "escolher") this.escolher(preco);
      else if (acao === "editar") this.abrirPrecoForm(preco);
      else this.removerPreco(preco);
    });
    this._montado = true;
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
    this._min = melhorTotal(precos, c);
    this._tabela.rows = precos; // formato lê this._min/_mapas (já definidos)

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
    // Nome ao vivo do item (reflete renome); `descricao` é fallback.
    const nomeItem = (c.item_id && (dataStore.item(c.item_id) || {}).nome) || c.descricao || "";
    topo.innerHTML = `
      <div>
        <h1>${nomeItem}</h1>
        <div class="meta">
          ${qtd ? `<span>${qtd}</span>` : ""}
          ${c.classificacao ? `<category-badge nome="${c.classificacao}" cor="${COR_CLASSIFICACAO[c.classificacao] || "var(--cor-neutro)"}"></category-badge>` : ""}
          ${cat ? `<category-badge nome="${cat.nome}" cor="${cat.cor}"></category-badge>` : ""}
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
        if (!confirm("Excluir esta oferta?")) return;
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
