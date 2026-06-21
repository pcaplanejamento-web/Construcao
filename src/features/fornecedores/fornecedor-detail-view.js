/**
 * <fornecedor-detail-view> — Página de um fornecedor (rota #/fornecedores/:id).
 *
 * Cabeçalho com os dados do fornecedor + ui-tabs com duas abas:
 *  - Contatos: os contatos vinculados a este fornecedor (CRUD via contato-form).
 *  - Ofertas: as ofertas feitas pelos contatos deste fornecedor (em todas as
 *    cotações), com link para a cotação.
 * Lê do data-store (cache-first) e assina mudanças. Reusa ui-tabs, ui-card,
 * ui-data-table, category-badge, contato-form e totalOferta (cotacao-util).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { colunasLog } from "../../core/audit-columns.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { restosESaldos } from "../despesas/despesa-split.js";
import { colunasOferta } from "../orcamentos/orcamento-util.js";
import { montarGradeOrcamentos } from "../orcamentos/orcamento-grade.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "./fornecedor-form.js";
import "../contatos/contato-form.js";

class FornecedorDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
  }

  get fornecedorId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .acoes-topo { display: flex; gap: var(--esp-2); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; margin-top: var(--esp-1); }
      .aba { display: flex; flex-direction: column; gap: var(--esp-4); }
      .barra { display: flex; justify-content: flex-end; }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando fornecedor..."></ui-spinner></div></div>`;
  }

  aoConectar() {
    if (!this._buscar()) {
      this.$("#conteudo").innerHTML = `<p>Fornecedor não encontrado. <a href="#/fornecedores">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  _buscar() {
    return dataStore.fornecedores().find((f) => String(f.id) === String(this.fornecedorId)) || null;
  }

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="#/fornecedores">← Fornecedores</a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="contatos" class="aba">
          <ui-card title="Contatos do fornecedor">
            <ui-button slot="acoes" id="novoContato">+ Novo contato</ui-button>
            <ui-data-table id="tabContatos" fluido
              empty-text="Nenhum contato deste fornecedor ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="ofertas" class="aba">
          <ui-card title="Ofertas deste fornecedor">
            <ui-data-table id="tabOfertas" fluido clicavel
              empty-text="Nenhuma oferta de contatos deste fornecedor ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="orcamentos" class="aba">
          <ui-card title="Orçamentos deste fornecedor">
            <div id="gradeOrc"></div>
          </ui-card>
        </div>
        <div slot="dados" class="aba">
          <ui-card title="Dados — a receber por obra">
            <ui-data-table id="tabDados" fluido clicavel
              empty-text="Nenhuma despesa desta empresa ainda."></ui-data-table>
          </ui-card>
        </div>
      </ui-tabs>
    `;
    alvo.querySelector("#abas").abas = [
      { id: "contatos", rotulo: "Contatos", icone: "contato" },
      { id: "ofertas", rotulo: "Ofertas", icone: "cifrao" },
      { id: "orcamentos", rotulo: "Orçamentos", icone: "carteira" },
      { id: "dados", rotulo: "Dados", icone: "grafico" },
    ];

    this._tabContatos = alvo.querySelector("#tabContatos");
    this._tabContatos.columns = [
      { chave: "nome", titulo: "Contato" },
      { chave: "cargo", titulo: "Cargo", formato: (v) => v || "—" },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
      ...colunasLog(),
    ];
    this._tabContatos.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    this._tabContatos.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirContatoForm(e.detail.linha);
      else this.removerContato(e.detail.linha);
    });

    // Ofertas: MESMA tabela das ofertas das cotações (links navegam).
    this._tabOfertas = alvo.querySelector("#tabOfertas");
    this._tabOfertas.removeAttribute("clicavel");
    this._tabOfertas.columns = colunasOferta();

    this._gradeOrc = alvo.querySelector("#gradeOrc");

    // Dados: Total / Pago / Saldo a receber por obra.
    this._tabDados = alvo.querySelector("#tabDados");
    this._tabDados.columns = [
      { chave: "_obra", titulo: "Obra" },
      { chave: "_total", titulo: "Total", alinhar: "dir", formato: (v) => moeda(v) },
      { chave: "_pago", titulo: "Pago", alinhar: "dir", formato: (v) => moeda(v) },
      {
        chave: "_resto",
        titulo: "Saldo a receber",
        alinhar: "dir",
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`),
      },
    ];
    this._tabDados.addEventListener("linha", (e) => {
      location.hash = "#/obras/" + e.detail.linha.id;
    });

    alvo.querySelector("#novoContato").addEventListener("click", () =>
      this.abrirContatoForm({ fornecedor_id: this.fornecedorId, cargo: "Vendedor" })
    );

    this._montado = true;
  }

  sincronizar() {
    if (!this._montado) return;
    const f = this._buscar();
    if (!f) {
      location.hash = "#/fornecedores";
      return;
    }
    this._fornecedor = f;

    // Contatos deste fornecedor.
    const contatos = dataStore
      .contatosAtivos()
      .filter((c) => String(c.fornecedor_id) === String(f.id));
    this._tabContatos.rows = contatos;

    // Ofertas feitas por esses contatos, em todas as cotações (ofertas cruas).
    const ids = new Set(contatos.map((c) => String(c.id)));
    const ofertas = [];
    dataStore.cotacoes().forEach((cot) => {
      dataStore.precosDaCotacao(cot.id).forEach((p) => {
        if (ids.has(String(p.contato_id))) ofertas.push(p);
      });
    });
    ofertas.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    this._tabOfertas.rows = ofertas;

    // Orçamentos deste fornecedor (grade de cards — mesmo componente de Cotações).
    montarGradeOrcamentos(
      this._gradeOrc,
      dataStore.orcamentos().filter((o) => String(o.fornecedor_id) === String(f.id))
    );

    // Dados: por obra, total/pago/saldo a receber das despesas desta empresa.
    const dados = [];
    dataStore.obras().forEach((o) => {
      const v = restosESaldos(dataStore.despesas(o.id)).porFornecedor[f.id];
      if (v) dados.push({ id: o.id, _obra: o.nome, _total: v.total, _pago: v.pago, _resto: v.resto });
    });
    this._tabDados.rows = dados.sort((a, b) => b._resto - a._resto);

    this.pintarTopo();
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo) return;
    const f = this._fornecedor;
    const cat = dataStore.categorias().find((c) => String(c.id) === String(f.categoria_id)) || null;
    const partes = [];
    if (f.telefone) partes.push(f.telefone);
    if (f.email) partes.push(f.email);
    if (f.cnpj) partes.push("CNPJ " + f.cnpj);
    topo.innerHTML = `
      <div>
        <h1>${f.nome || ""}</h1>
        <div class="meta">
          ${partes.length ? `<span>${partes.join(" · ")}</span>` : ""}
          ${cat ? `<category-badge nome="${cat.nome}" cor="${cat.cor}"></category-badge>` : ""}
        </div>
      </div>
      <div class="acoes-topo">
        <ui-button id="editarForn" variant="secundario">Editar fornecedor</ui-button>
      </div>
    `;
    topo.querySelector("#editarForn").addEventListener("click", () => this.editarFornecedor());
  }

  /* ------------------------------ Ações -------------------------------- */

  abrirContatoForm(contato) {
    const form = document.createElement("contato-form");
    form.contato = contato;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  async removerContato(contato) {
    if (!confirm(`Excluir o contato "${contato.nome}"?`)) return;
    try {
      await dataStore.removerContato(contato.id);
      toastSucesso("Contato removido.");
    } catch (e) {
      notificarErro(e);
    }
  }

  editarFornecedor() {
    const form = document.createElement("fornecedor-form");
    form.fornecedor = this._fornecedor;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  _bool(v) {
    return v === true || v === "TRUE" || v === "true";
  }
}

customElements.define("fornecedor-detail-view", FornecedorDetailView);
