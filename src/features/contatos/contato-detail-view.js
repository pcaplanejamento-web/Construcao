/**
 * <contato-detail-view> — Página de um contato (rota #/contatos/:id).
 *
 * Cabeçalho + ui-tabs (conforme o cargo):
 *  - Obras (sempre): obras onde o contato participa.
 *  - Fornecedores (se vinculado a um fornecedor — Vendedor): dados do fornecedor.
 *  - Equipe (Pedreiro/Mestre de Obra/Engenheiro): Pedreiro → superior + colegas;
 *    Mestre/Engenheiro → subordinados.
 * Lê do data-store (cache-first). Espelha fornecedor-detail-view.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { data as fmtData } from "../../core/formatters.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "./contato-form.js";

const CARGOS_EQUIPE = ["Pedreiro", "Mestre de Obra", "Engenheiro"];

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
      .voltar { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
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
      this.$("#conteudo").innerHTML = `<p>Contato não encontrado. <a href="#/contatos">Voltar</a></p>`;
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
      <a class="voltar" href="#/contatos">← Contatos</a>
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
        <div slot="equipe">
          <ui-card title="Equipe">
            <ui-data-table id="tabEquipe" fluido clicavel
              empty-text="Nenhum integrante vinculado."></ui-data-table>
          </ui-card>
        </div>
      </ui-tabs>
    `;

    const abas = [{ id: "obras", rotulo: "Obras", icone: "obra" }];
    if (c.fornecedor_id) abas.push({ id: "fornecedores", rotulo: "Fornecedores", icone: "fornecedor" });
    if (CARGOS_EQUIPE.indexOf(c.cargo) >= 0) abas.push({ id: "equipe", rotulo: "Equipe", icone: "usuario" });
    alvo.querySelector("#abas").abas = abas;

    this._tabObras = alvo.querySelector("#tabObras");
    this._tabObras.columns = [{ chave: "nome", titulo: "Obra" }];
    this._tabObras.addEventListener("linha", (e) => {
      location.hash = "#/obras/" + e.detail.linha.id;
    });

    this._tabForn = alvo.querySelector("#tabForn");
    this._tabForn.columns = [
      { chave: "nome", titulo: "Fornecedor" },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
      { chave: "cnpj", titulo: "CNPJ", formato: (v) => v || "—" },
    ];
    this._tabForn.addEventListener("linha", (e) => {
      location.hash = "#/fornecedores/" + e.detail.linha.id;
    });

    this._tabEquipe = alvo.querySelector("#tabEquipe");
    this._tabEquipe.columns = [
      { chave: "nome", titulo: "Integrante" },
      { chave: "cargo", titulo: "Cargo", formato: (v) => v || "—" },
      {
        chave: "_papel",
        titulo: "Vínculo",
        formato: (v) => `<category-badge nome="${v}" cor="var(--cor-info)"></category-badge>`,
      },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
    ];
    this._tabEquipe.addEventListener("linha", (e) => {
      location.hash = "#/contatos/" + e.detail.linha.id;
    });

    this._montado = true;
  }

  sincronizar() {
    if (!this._montado) return;
    const c = this._buscar();
    if (!c) {
      location.hash = "#/contatos";
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

    // Equipe.
    const todos = dataStore.contatosAtivos();
    let equipe = [];
    if (c.cargo === "Pedreiro") {
      const sup = todos.find((x) => String(x.id) === String(c.superior_id));
      if (sup) equipe.push({ ...sup, _papel: "Superior" });
      if (c.superior_id) {
        todos
          .filter((x) => String(x.id) !== String(c.id) && String(x.superior_id) === String(c.superior_id))
          .forEach((x) => equipe.push({ ...x, _papel: "Colega" }));
      }
    } else if (c.cargo === "Mestre de Obra" || c.cargo === "Engenheiro") {
      todos
        .filter((x) => String(x.superior_id) === String(c.id))
        .forEach((x) => equipe.push({ ...x, _papel: "Subordinado" }));
    }
    this._tabEquipe.rows = equipe;

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
