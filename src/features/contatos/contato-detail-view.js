/**
 * <contato-detail-view> — Página de um contato (rota /contatos/:id).
 *
 * Cabeçalho + ui-tabs (conforme o cargo):
 *  - Obras (sempre): obras onde o contato participa.
 *  - Fornecedores (se vinculado a um fornecedor — Vendedor): dados do fornecedor.
 *  - Equipes (sempre): equipes onde o contato é líder ou membro (nova lógica).
 *  - Ofertas / Orçamentos.
 * Lê do data-store (cache-first). Espelha fornecedor-detail-view.
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { balancos } from "../despesas/despesa-split.js";
import { colunasOferta } from "../orcamentos/orcamento-util.js";
import { montarGradeOrcamentos } from "../orcamentos/orcamento-grade.js";
import { montarGradeEquipes } from "../equipes/equipe-grade.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "./contato-form.js";

class ContatoDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
  }

  get contatoId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--esp-2); color: var(--cor-primaria); font-size: var(--fs-md); font-weight: var(--peso-forte); text-decoration: none; }
      .voltar:hover { text-decoration: none; color: var(--cor-primaria-escura); }
      #conteudo { display: flex; flex-direction: column; gap: var(--esp-5); }
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; margin-top: var(--esp-1); }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando contato..."></ui-spinner></div></div>`;
  }

  _buscar() {
    return dataStore.contatosAtivos().find((c) => String(c.id) === String(this.contatoId)) || null;
  }

  aoConectar() {
    if (!this._buscar()) {
      this.$("#conteudo").innerHTML = `<p>Contato não encontrado. <a href="/contatos">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  montarConteudo() {
    const c = this._buscar();
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="/contatos"><ui-icon name="seta-esquerda" size="18"></ui-icon><span>Contatos</span></a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="obras">
          <ui-card title="Obras vinculadas">
            <ui-data-table id="tabObras" fluido clicavel
              empty-text="Este contato não participa de nenhuma obra ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="fornecedores">
          <ui-card title="Fornecedor vinculado">
            <ui-data-table id="tabForn" fluido clicavel
              empty-text="Sem fornecedor vinculado."></ui-data-table>
          </ui-card>
        </div>
        <div slot="equipes">
          <ui-card title="Equipes do contato">
            <div id="gradeEquipes"></div>
          </ui-card>
        </div>
        <div slot="ofertas">
          <ui-card title="Ofertas deste contato">
            <ui-data-table id="tabOfertas" fluido
              empty-text="Este contato não tem ofertas ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="orcamentos">
          <ui-card title="Orçamentos deste contato">
            <div id="gradeOrc"></div>
          </ui-card>
        </div>
        <div slot="dados">
          <ui-card title="Dados — a receber e a pagar por obra">
            <ui-data-table id="tabDados" fluido clicavel
              empty-text="Sem valores a receber ou a pagar."></ui-data-table>
          </ui-card>
        </div>
      </ui-tabs>
    `;

    const abas = [{ id: "obras", rotulo: "Obras", icone: "obra" }];
    if (c.fornecedor_id) abas.push({ id: "fornecedores", rotulo: "Fornecedores", icone: "fornecedor" });
    abas.push({ id: "equipes", rotulo: "Equipes", icone: "usuario" });
    abas.push({ id: "ofertas", rotulo: "Ofertas", icone: "cifrao" });
    abas.push({ id: "orcamentos", rotulo: "Orçamentos", icone: "carteira" });
    abas.push({ id: "dados", rotulo: "Dados", icone: "grafico" });
    alvo.querySelector("#abas").abas = abas;

    this._tabObras = alvo.querySelector("#tabObras");
    this._tabObras.columns = [{ chave: "nome", titulo: "Obra" }];
    this._tabObras.addEventListener("linha", (e) => {
      irPara("/obras/" + e.detail.linha.id);
    });

    this._tabForn = alvo.querySelector("#tabForn");
    this._tabForn.columns = [
      { chave: "nome", titulo: "Fornecedor" },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
      { chave: "cnpj", titulo: "CNPJ", formato: (v) => v || "—" },
    ];
    this._tabForn.addEventListener("linha", (e) => {
      irPara("/fornecedores/" + e.detail.linha.id);
    });

    this._gradeEquipes = alvo.querySelector("#gradeEquipes");

    // Ofertas: MESMA tabela das ofertas das cotações (links navegam).
    this._tabOfertas = alvo.querySelector("#tabOfertas");
    this._tabOfertas.columns = colunasOferta();
    this._gradeOrc = alvo.querySelector("#gradeOrc");

    // Dados: Pago/Recebido + Saldo a pagar/Saldo a receber, por obra.
    this._tabDados = alvo.querySelector("#tabDados");
    this._tabDados.columns = [
      { chave: "_obra", titulo: "Obra" },
      { chave: "_pago", titulo: "Pago", alinhar: "dir", formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", formato: (v) => moeda(v) },
      {
        chave: "_pagar",
        titulo: "Saldo a pagar",
        alinhar: "dir",
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-erro)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`),
      },
      {
        chave: "_receber",
        titulo: "Saldo a receber",
        alinhar: "dir",
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`),
      },
    ];
    this._tabDados.addEventListener("linha", (e) => {
      irPara("/obras/" + e.detail.linha.id);
    });

    this._montado = true;
  }

  sincronizar() {
    if (!this._montado) return;
    const c = this._buscar();
    if (!c) {
      irPara("/contatos");
      return;
    }
    this._contato = c;

    // Obras onde o contato participa (chave c:<id> em participantesPorObra).
    const chave = "c:" + c.id;
    const obras = dataStore.obras().filter((o) =>
      dataStore.participantesDaObra(o.id).some((p) => p.chave === chave)
    );
    this._tabObras.rows = obras.map((o) => ({ id: o.id, nome: o.nome }));

    // Fornecedor vinculado.
    const forn = dataStore.fornecedores().find((f) => String(f.id) === String(c.fornecedor_id));
    this._tabForn.rows = forn ? [forn] : [];

    // Equipes onde este contato é líder ou membro (nova lógica; grade de cards).
    montarGradeEquipes(this._gradeEquipes, dataStore.equipesDoContato(c.id));

    // Ofertas deste contato (ofertas cruas), em todas as cotações.
    const ofertas = [];
    dataStore.cotacoes().forEach((cot) => {
      dataStore.precosDaCotacao(cot.id).forEach((p) => {
        if (String(p.contato_id) === String(c.id)) ofertas.push(p);
      });
    });
    ofertas.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    this._tabOfertas.rows = ofertas;

    // Orçamentos onde este contato é o ofertante (grade de cards).
    montarGradeOrcamentos(
      this._gradeOrc,
      dataStore.orcamentos().filter((o) => String(o.contato_id) === String(c.id))
    );

    // Dados: por obra, Pago/Recebido + Saldo a pagar/receber (modelo paga ↔ recebe).
    const dados = [];
    dataStore.obras().forEach((o) => {
      const v = balancos(dataStore.despesas(o.id)).porChave[chave];
      if (v && (v.pago > 0.01 || v.recebido > 0.01 || v.saldoApagar > 0.01 || v.saldoReceber > 0.01)) {
        dados.push({ id: o.id, _obra: o.nome, _pago: v.pago, _recebido: v.recebido, _pagar: v.saldoApagar, _receber: v.saldoReceber });
      }
    });
    this._tabDados.rows = dados;

    this.pintarTopo();
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo) return;
    const c = this._contato;
    const partes = [];
    if (c.telefone) partes.push(c.telefone);
    if (c.email) partes.push(c.email);
    topo.innerHTML = `
      <div>
        <h1>${c.nome || ""}</h1>
        <div class="meta">
          ${c.cargo ? `<category-badge nome="${c.cargo}" cor="var(--cor-primaria)"></category-badge>` : ""}
          ${partes.length ? `<span>${partes.join(" · ")}</span>` : ""}
        </div>
      </div>
      <div><ui-button id="editar" variant="secundario">Editar contato</ui-button></div>
    `;
    topo.querySelector("#editar").addEventListener("click", () => this.editar());
  }

  editar() {
    const form = document.createElement("contato-form");
    form.contato = this._contato;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }
}

customElements.define("contato-detail-view", ContatoDetailView);
