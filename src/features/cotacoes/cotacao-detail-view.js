/**
 * <cotacao-detail-view> — Detalhe/comparativo de uma cotação (#/cotacoes/:id).
 *
 * Cabeçalho da necessidade + tabela comparativa das ofertas (contato, empresa,
 * valor unit., TOTAL com destaque do menor preço, prazo, obs). Permite escolher
 * a oferta, editar/excluir ofertas e REGISTRAR a escolhida como despesa.
 * Lê do data-store (cache-first) e assina mudanças.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, numero } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { totalOferta, melhorTotal } from "./cotacao-util.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "./cotacao-form.js";
import "./preco-form.js";
import "./cotacao-despesa-form.js";

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
      .area { max-width: 1100px; margin: 0 auto; padding: var(--esp-5);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .acoes-topo { display: flex; gap: var(--esp-2); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; }
      .escolhida { background: var(--cor-superficie-2); border-radius: var(--raio-md);
        padding: var(--esp-4); display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .escolhida .info { display: flex; flex-direction: column; gap: 2px; }
      .escolhida .rot { font-size: var(--fs-xs); text-transform: uppercase;
        letter-spacing: .03em; color: var(--cor-texto-suave); }
      .escolhida .val { font-size: var(--fs-lg); font-weight: var(--peso-forte);
        color: var(--cor-sucesso); }
      .dica { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando cotação..."></ui-spinner></div></div>`;
  }

  aoConectar() {
    if (!dataStore.cotacao(this.cotacaoId)) {
      this.$("#conteudo").innerHTML = `<p>Cotação não encontrada. <a href="#/cotacoes">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="#/cotacoes">← Cotações</a>
      <div class="topo" id="topo"></div>
      <ui-card title="Ofertas">
        <ui-data-table id="tabela" fluido
          empty-text="Nenhuma oferta ainda. Adicione ofertas de contatos para comparar."></ui-data-table>
      </ui-card>
      <div id="escolhida"></div>
    `;
    this._tabela = alvo.querySelector("#tabela");
    this._tabela.columns = [
      {
        chave: "contato_id",
        titulo: "Contato",
        formato: (id) => (this._mapaContato[id] || { nome: "—" }).nome,
      },
      {
        chave: "contato_id",
        titulo: "Empresa",
        formato: (id) => {
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
        chave: "escolhido",
        titulo: "Escolhida",
        formato: (v) =>
          this._bool(v)
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
      location.hash = "#/cotacoes";
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
    topo.innerHTML = `
      <div>
        <h1>${c.descricao || ""}</h1>
        <div class="meta">
          ${qtd ? `<span>${qtd}</span>` : ""}
          ${cat ? `<category-badge nome="${cat.nome}" cor="${cat.cor}"></category-badge>` : ""}
          ${obra ? `· <a href="#/obras/${obra.id}"><ui-icon name="obra" size="14"></ui-icon> ${obra.nome}</a>` : ""}
          <span>· ${c.status === "fechada" ? "Fechada" : "Aberta"}</span>
        </div>
      </div>
      <div class="acoes-topo">
        <ui-button id="addOferta">+ Adicionar oferta</ui-button>
        <ui-button id="editarCotacao" variant="secundario">Editar cotação</ui-button>
      </div>
    `;
    topo.querySelector("#addOferta").addEventListener("click", () => this.abrirPrecoForm(null));
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
    el.innerHTML = `
      <div class="escolhida">
        <div class="info">
          <span class="rot">Oferta escolhida</span>
          <span>${contato.nome}${empresa ? " — " + empresa : ""}</span>
          <span class="val">${moeda(total)}</span>
        </div>
        <ui-button id="registrar">Registrar como despesa</ui-button>
      </div>
    `;
    el.querySelector("#registrar").addEventListener("click", () =>
      this.registrarDespesa(escolhida, contato.nome)
    );
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

  async removerPreco(preco) {
    if (!confirm("Excluir esta oferta?")) return;
    try {
      await dataStore.removerPreco(this.cotacaoId, preco.id);
      toastSucesso("Oferta removida.");
    } catch (e) {
      notificarErro(e);
    }
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
