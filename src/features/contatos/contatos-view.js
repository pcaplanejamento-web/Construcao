/**
 * <contatos-view> — Agenda de contatos (rota #/contatos).
 *
 * Lê do data-store (cache-first) e assina mudanças. CRUD próprio do usuário.
 * Mostra a empresa (fornecedor) vinculada a cada contato.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { data as fmtData } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "./contato-form.js";

class ContatosView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { max-width: 1100px; margin: 0 auto; padding: var(--esp-5);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Contatos</h1>
            <p class="sub">Cadastre pessoas e vincule-as às cotações por oferta.</p>
          </div>
          <ui-button id="novo">+ Novo contato</ui-button>
        </div>
        <ui-card title="Meus contatos"><div id="lista"></div></ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#novo").addEventListener("click", () => this.abrirForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
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
          texto="Cadastre contatos (pessoas) para usá-los nas ofertas das cotações.">
          <ui-button slot="acao" id="vazioNovo">+ Cadastrar contato</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vazioNovo").addEventListener("click", () => this.abrirForm(null));
      return;
    }

    const mapaForn = {};
    dataStore.fornecedores().forEach((f) => (mapaForn[f.id] = f.nome));

    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.columns = [
      { chave: "nome", titulo: "Contato" },
      {
        chave: "fornecedor_id",
        titulo: "Empresa",
        formato: (id) => mapaForn[id] || `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      { chave: "cargo", titulo: "Cargo", formato: (v) => v || "—" },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
      { chave: "criado_em", titulo: "Criado em", formato: (v) => (v ? fmtData(v) : "—") },
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = contatos;
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirForm(e.detail.linha);
      else this.remover(e.detail.linha);
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

  async remover(contato) {
    if (!confirm(`Excluir o contato "${contato.nome}"?`)) return;
    try {
      await dataStore.removerContato(contato.id);
      toastSucesso("Contato removido.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("contatos-view", ContatosView);
