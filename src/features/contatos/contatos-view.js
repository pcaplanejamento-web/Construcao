/**
 * <contatos-view> — Agenda de contatos (rota #/contatos), com abas:
 *  - Contatos: tabela (clicável → página do contato);
 *  - Cargos: cargos fixos (referência) + cargos extras do usuário (CRUD).
 * Lê do data-store (cache-first) e assina mudanças.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { data as fmtData } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./contato-form.js";
import "./cargo-form.js";

class ContatosView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Contatos</h1>
            <p class="sub">Cadastre pessoas, defina cargos e vincule-as à obra.</p>
          </div>
        </div>
        <ui-tabs id="abas">
          <div slot="contatos">
            <ui-card title="Meus contatos">
              <ui-button slot="acoes" id="novo">+ Novo contato</ui-button>
              <div id="lista"></div>
            </ui-card>
          </div>
          <div slot="cargos">
            <ui-card title="Cargos">
              <ui-button slot="acoes" id="novoCargo">+ Novo cargo</ui-button>
              <div id="listaCargos"></div>
            </ui-card>
          </div>
        </ui-tabs>
      </div>
    `;
  }

  aoConectar() {
    this.$("#abas").abas = [
      { id: "contatos", rotulo: "Contatos", icone: "contato" },
      { id: "cargos", rotulo: "Cargos", icone: "tag" },
    ];
    this.$("#novo").addEventListener("click", () => this.abrirForm(null));
    this.$("#novoCargo").addEventListener("click", () => this.abrirCargoForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    this.pintarContatos();
    this.pintarCargos();
  }

  pintarContatos() {
    const el = this.$("#lista");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }
    const contatos = dataStore.contatosAtivos();
    if (!contatos.length) {
      el.innerHTML = `
        <ui-empty-state icone="contato" titulo="Nenhum contato"
          texto="Cadastre contatos (pessoas) e defina seus cargos.">
          <ui-button slot="acao" id="vazioNovo">+ Cadastrar contato</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vazioNovo").addEventListener("click", () => this.abrirForm(null));
      return;
    }
    const mapaForn = {};
    dataStore.fornecedores().forEach((f) => (mapaForn[f.id] = f.nome));

    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.setAttribute("clicavel", "");
    tabela.columns = [
      { chave: "nome", titulo: "Contato" },
      { chave: "cargo", titulo: "Cargo", formato: (v) => v || "—" },
      {
        chave: "fornecedor_id",
        titulo: "Empresa",
        formato: (id) => mapaForn[id] || `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
      { chave: "criado_em", titulo: "Criado em", formato: (v) => (v ? fmtData(v) : "—") },
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = contatos;
    tabela.addEventListener("linha", (e) => {
      location.hash = "#/contatos/" + e.detail.linha.id;
    });
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirForm(e.detail.linha);
      else this.remover(e.detail.linha);
    });
    el.replaceChildren(tabela);
  }

  pintarCargos() {
    const el = this.$("#listaCargos");
    if (!el || !dataStore.carregado()) return;
    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.columns = [
      { chave: "nome", titulo: "Cargo" },
      {
        chave: "fixo",
        titulo: "Tipo",
        formato: (fixo) =>
          fixo
            ? `<category-badge nome="Fixo" cor="var(--cor-neutro)"></category-badge>`
            : `<category-badge nome="Personalizado" cor="var(--cor-info)"></category-badge>`,
      },
      { chave: "criado_em", titulo: "Criado em", formato: (v) => (v ? fmtData(v) : "—") },
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = dataStore.cargos();
    tabela.addEventListener("acao", (e) => {
      const cargo = e.detail.linha;
      if (cargo.fixo) {
        toastSucesso("Cargos obrigatórios são fixos e não podem ser alterados.");
        return;
      }
      if (e.detail.acao === "editar") this.abrirCargoForm(cargo);
      else this.removerCargo(cargo);
    });
    el.replaceChildren(tabela);
  }

  abrirForm(contato) {
    const form = document.createElement("contato-form");
    form.contato = contato;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  abrirCargoForm(cargo) {
    const form = document.createElement("cargo-form");
    form.cargo = cargo;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  async remover(contato) {
    if (!confirm(`Excluir o contato "${contato.nome}"?`)) return;
    try {
      await dataStore.removerContato(contato.id);
      toastSucesso("Contato removido.");
    } catch (e) {
      notificarErro(e);
    }
  }

  async removerCargo(cargo) {
    if (!confirm(`Excluir o cargo "${cargo.nome}"?`)) return;
    try {
      await dataStore.removerCargo(cargo.id);
      toastSucesso("Cargo removido.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("contatos-view", ContatosView);
