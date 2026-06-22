/**
 * <item-detail-view> — Página de um item (rota /itens/:id).
 *
 * Faixa de KPIs (Total gasto · Despesas · Cotações · Obras) + cabeçalho com o
 * nome e a classificação + ui-tabs com tudo vinculado ao item:
 *  - Despesas: despesas deste item em todas as obras (clique → obra).
 *  - Cotações: cotações deste item (clique → cotação), com melhor preço.
 *  - Obras: obras onde o item foi usado, com nº de despesas e valor gasto.
 * Lê do data-store (cache-first) e assina mudanças. Espelha fornecedor-detail-view.
 * Reusa ui-tabs, ui-card, ui-data-table, category-badge, item-form, formatters,
 * melhorTotal (cotacao-util) e os tokens --grad-* (mesmo estilo de oferta-kpis).
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, numero, data as fmtData } from "../../core/formatters.js";
import { colunasLog } from "../../core/audit-columns.js";
import { melhorTotal } from "../cotacoes/cotacao-util.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "./item-form.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };

function _bool(v) {
  return v === true || v === "TRUE" || v === "true";
}

class ItemDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
  }

  get itemId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--esp-1); color: var(--cor-primaria); font-size: var(--fs-sm); font-weight: var(--peso-semi); }
      #conteudo { display: flex; flex-direction: column; gap: var(--esp-5); }
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; margin-top: var(--esp-1); }
      .aba { display: flex; flex-direction: column; gap: var(--esp-4); }
      /* KPIs — mesmo estilo de oferta-kpis (cards com gradiente + tokens --grad-*). */
      .kpis { display: grid; gap: var(--esp-5);
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
      .cartao { position: relative; overflow: hidden; color: #fff;
        border-radius: var(--raio-lg); padding: var(--esp-5); box-shadow: var(--sombra-md);
        min-height: 128px; display: flex; flex-direction: column; gap: var(--esp-2); }
      .cartao::after { content: ""; position: absolute; top: -28px; right: -28px;
        width: 110px; height: 110px; border-radius: 50%; background: rgba(255,255,255,.12); }
      .verde { background: var(--grad-verde); }
      .azul { background: var(--grad-azul); }
      .roxo { background: var(--grad-roxo); }
      .laranja { background: var(--grad-laranja); }
      .icone { width: 40px; height: 40px; border-radius: var(--raio-md);
        background: rgba(255,255,255,.18); display: flex; align-items: center;
        justify-content: center; position: relative; z-index: 1; }
      .rotulo { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .05em;
        font-weight: var(--peso-semi); opacity: .9; position: relative; z-index: 1; }
      .valor { font-size: var(--fs-2xl); font-weight: var(--peso-forte); line-height: 1.1;
        position: relative; z-index: 1; }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando item..."></ui-spinner></div></div>`;
  }

  _buscar() {
    return dataStore.itensAtivos().find((i) => String(i.id) === String(this.itemId)) || null;
  }

  /** Todas as despesas deste item, em todas as obras acessíveis. */
  _despesasDoItem() {
    const id = String(this.itemId);
    return dataStore
      .obras()
      .flatMap((o) => dataStore.despesas(o.id))
      .filter((d) => String(d.item_id) === id);
  }

  /** Cotações deste item. */
  _cotacoesDoItem() {
    const id = String(this.itemId);
    return dataStore.cotacoes().filter((c) => String(c.item_id) === id);
  }

  aoConectar() {
    if (!this._buscar()) {
      this.$("#conteudo").innerHTML = `<p>Item não encontrado. <a href="/itens">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <div class="kpis" id="kpis"></div>
      <a class="voltar" href="/itens">← Itens</a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="despesas" class="aba">
          <ui-card title="Despesas deste item">
            <ui-data-table id="tabDespesas" fluido clicavel
              empty-text="Nenhuma despesa com este item ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="cotacoes" class="aba">
          <ui-card title="Cotações deste item">
            <ui-data-table id="tabCotacoes" fluido clicavel
              empty-text="Nenhuma cotação com este item ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="obras" class="aba">
          <ui-card title="Obras onde foi usado">
            <ui-data-table id="tabObras" fluido clicavel
              empty-text="Este item ainda não foi usado em nenhuma obra."></ui-data-table>
          </ui-card>
        </div>
      </ui-tabs>
    `;
    alvo.querySelector("#abas").abas = [
      { id: "despesas", rotulo: "Despesas", icone: "recibo" },
      { id: "cotacoes", rotulo: "Cotações", icone: "cotacao" },
      { id: "obras", rotulo: "Obras", icone: "obra" },
    ];

    const mapaCat = {};
    dataStore.categorias().forEach((c) => (mapaCat[c.id] = c));
    this._mapaCat = mapaCat;
    const mapaObra = {};
    dataStore.obras().forEach((o) => (mapaObra[o.id] = o.nome));
    this._mapaObra = mapaObra;

    this._tabDespesas = alvo.querySelector("#tabDespesas");
    this._tabDespesas.columns = [
      { chave: "obra_id", titulo: "Obra", formato: (id) => this._mapaObra[id] || "—" },
      { chave: "data", titulo: "Data", formato: (v) => (v ? fmtData(v) : "—") },
      {
        chave: "categoria_id",
        titulo: "Subclassificação",
        formato: (id) =>
          this._mapaCat[id]
            ? `<category-badge nome="${this._mapaCat[id].nome}" cor="${this._mapaCat[id].cor}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      { chave: "valor", titulo: "Valor", alinhar: "dir", formato: (v) => moeda(v) },
      {
        chave: "pago",
        titulo: "Pago",
        formato: (v) =>
          _bool(v)
            ? `<category-badge nome="Pago" cor="var(--cor-sucesso)"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      ...colunasLog(),
    ];
    this._tabDespesas.addEventListener("linha", (e) => {
      if (e.detail.linha.obra_id) irPara("/obras/" + e.detail.linha.obra_id);
    });

    this._tabCotacoes = alvo.querySelector("#tabCotacoes");
    this._tabCotacoes.columns = [
      // Nome ao vivo (é sempre este item); `descricao` denormalizado é fallback.
      { chave: "descricao", titulo: "Cotação", formato: (v) => (this._item || {}).nome || v || "—" },
      {
        chave: "obra_id",
        titulo: "Obra",
        formato: (id) => this._mapaObra[id] || `<span style="color:var(--cor-texto-fraco)">Geral</span>`,
      },
      {
        chave: "quantidade",
        titulo: "Qtd.",
        formato: (q, l) => (Number(q) > 0 ? `${numero(q)} ${l.unidade || ""}`.trim() : "—"),
      },
      {
        chave: "id",
        titulo: "Melhor preço",
        alinhar: "dir",
        formato: (id, linha) => {
          const min = melhorTotal(dataStore.precosDaCotacao(id), linha);
          return min == null ? "—" : moeda(min);
        },
      },
      {
        chave: "status",
        titulo: "Situação",
        formato: (s) =>
          s === "fechada"
            ? `<span style="color:var(--cor-texto-fraco)">Fechada</span>`
            : `<span style="color:var(--cor-sucesso)">Aberta</span>`,
      },
      ...colunasLog(),
    ];
    this._tabCotacoes.addEventListener("linha", (e) => {
      irPara("/cotacoes/" + e.detail.linha.id);
    });

    this._tabObras = alvo.querySelector("#tabObras");
    this._tabObras.columns = [
      { chave: "nome", titulo: "Obra" },
      { chave: "qtd", titulo: "Despesas", alinhar: "dir", formato: (v) => numero(v) },
      { chave: "valor", titulo: "Valor gasto", alinhar: "dir", formato: (v) => moeda(v) },
    ];
    this._tabObras.addEventListener("linha", (e) => {
      irPara("/obras/" + e.detail.linha.id);
    });

    this._montado = true;
  }

  sincronizar() {
    if (!this._montado) return;
    const item = this._buscar();
    if (!item) {
      irPara("/itens");
      return;
    }
    this._item = item;

    const despesas = this._despesasDoItem();
    const cotacoes = this._cotacoesDoItem();
    const totalGasto = despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0);

    // Agrega despesas por obra (nº + valor gasto), ordenado por valor desc.
    const porObra = {};
    despesas.forEach((d) => {
      const k = d.obra_id;
      if (!porObra[k]) porObra[k] = { id: k, nome: this._mapaObra[k] || "—", qtd: 0, valor: 0 };
      porObra[k].qtd += 1;
      porObra[k].valor += Number(d.valor) || 0;
    });
    const obras = Object.values(porObra).sort((a, b) => b.valor - a.valor);

    // Tabelas (mais recentes primeiro p/ despesas e cotações).
    this._tabDespesas.rows = despesas
      .slice()
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
    this._tabCotacoes.rows = cotacoes
      .slice()
      .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    this._tabObras.rows = obras;

    this.pintarKpis({ totalGasto, despesas: despesas.length, cotacoes: cotacoes.length, obras: obras.length });
    this.pintarTopo();
  }

  pintarKpis(k) {
    const el = this.shadowRoot.querySelector("#kpis");
    if (!el) return;
    const cartao = (cor, icone, rotulo, valor) => `
      <div class="cartao ${cor}">
        <div class="icone"><ui-icon name="${icone}" size="20"></ui-icon></div>
        <div class="rotulo">${rotulo}</div>
        <div class="valor">${valor}</div>
      </div>`;
    el.innerHTML =
      cartao("verde", "cifrao", "Total gasto", moeda(k.totalGasto)) +
      cartao("azul", "recibo", "Despesas", numero(k.despesas)) +
      cartao("roxo", "cotacao", "Cotações", numero(k.cotacoes)) +
      cartao("laranja", "obra", "Obras", numero(k.obras));
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo) return;
    const i = this._item;
    topo.innerHTML = `
      <div>
        <h1>${i.nome || ""}</h1>
        <div class="meta">
          <category-badge nome="${i.classificacao || "—"}" cor="${COR_CLASSIFICACAO[i.classificacao] || "var(--cor-neutro)"}"></category-badge>
        </div>
      </div>
      <div><ui-button id="editar" variant="secundario">Editar item</ui-button></div>
    `;
    topo.querySelector("#editar").addEventListener("click", () => this.editar());
  }

  editar() {
    const form = document.createElement("item-form");
    form.item = this._item;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }
}

customElements.define("item-detail-view", ItemDetailView);
