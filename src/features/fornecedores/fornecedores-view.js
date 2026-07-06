/**
 * <fornecedores-view> — Agenda de fornecedores (rota /fornecedores), com abas:
 *  - Fornecedores: CRUD próprio (nome/telefone/e-mail/categoria);
 *  - Categoria: lista a entidade `categoria` (a mesma "categoria" dos
 *    itens — o fornecedor usa `categoria_id` como Categoria), reaproveitando
 *    `categoria-form` e o padrão da aba Categorias de itens.
 * Lê do data-store (cache-first) e assina mudanças. Reusa ui-tabs, ui-card,
 * ui-data-table, category-badge, ui-button, ui-empty-state, categoria-form.
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { colunasLog } from "../../core/audit-columns.js";
import {
  abrirBannerVinculos,
  vinculosDoFornecedor,
  vinculosDaSubclassificacao,
} from "../shared/vinculos.js";
import { avatarNomeHtml, avatarHtml, whatsappBtnHtml } from "../shared/avatar.js";
import { editarEmMassa } from "../shared/edicao-massa.js";
import { editarEntidade, excluirEntidade } from "../shared/drop-crud.js";
import { confirmar } from "../../components/confirmar.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../../components/ui-lista-gestos.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./fornecedor-form.js";
import "../categorias/categoria-form.js";
import "../contatos/google-contato-picker.js";

function _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

class FornecedoresView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela);
        display: flex; flex-direction: column; gap: var(--esp-5); }
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
            <h1>Empresas</h1>
            <p class="sub">Cadastre as empresas de onde você compra.</p>
          </div>
        </div>
        <ui-tabs id="abas">
          <div slot="fornecedores">
            <ui-card mesa acao-fixa title="Mesa com empresas">
              ${dataStore.config().google_conectado ? `<ui-button slot="acoes" id="importarGoogle" variant="secundario">Importar do Google</ui-button>` : ""}
              <ui-button slot="acoes" id="novo">+ Nova empresa</ui-button>
              <div id="lista"></div>
            </ui-card>
          </div>
          <div slot="classificacao">
            <ui-card mesa title="Mesa com categorias">
              <ui-button slot="acoes" id="novaClass">+ Nova categoria</ui-button>
              <div id="listaClass"></div>
            </ui-card>
          </div>
        </ui-tabs>
      </div>
    `;
  }

  aoConectar() {
    this.$("#abas").abas = [
      { id: "fornecedores", rotulo: "Empresas", icone: "fornecedor" },
      { id: "classificacao", rotulo: "Categoria", icone: "tag" },
    ];
    this.$("#novo").addEventListener("click", () => this.abrirForm(null));
    const imp = this.$("#importarGoogle");
    if (imp) imp.addEventListener("click", () => this.abrirImportarGoogle());
    this.$("#novaClass").addEventListener("click", () => this.abrirClassForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
    // Re-renderiza ao cruzar o breakpoint mobile↔desktop (tabela ↔ lista de gestos).
    this._mq = window.matchMedia("(max-width: 820px)");
    this._onMq = () => this.pintar();
    if (this._mq.addEventListener) this._mq.addEventListener("change", this._onMq);
    else this._mq.addListener(this._onMq);
    this.aoLimpar(() => { if (this._mq.removeEventListener) this._mq.removeEventListener("change", this._onMq); else this._mq.removeListener(this._onMq); });
  }

  pintar() {
    this.pintarFornecedores();
    this.pintarClassificacoes();
  }

  /* ---------------------------- Fornecedores --------------------------- */

  pintarFornecedores() {
    const el = this.$("#lista");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }

    const fornecedores = dataStore.fornecedoresAtivos();
    if (!fornecedores.length) {
      el.innerHTML = `
        <ui-empty-state icone="fornecedor" titulo="Nenhuma empresa"
          texto="Cadastre empresas para usá-las nas cotações.">
          <ui-button slot="acao" id="vazioNovo">+ Cadastrar empresa</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vazioNovo").addEventListener("click", () => this.abrirForm(null));
      return;
    }

    const mapaCat = {};
    dataStore.categorias().forEach((c) => (mapaCat[c.id] = c));

    // MOBILE: lista estilo telefone (avatar + índice A–Z) com gestos.
    if (this._mq && this._mq.matches) { el.replaceChildren(this._listaFornecedoresMobile(fornecedores, mapaCat)); return; }

    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.setAttribute("clicavel", "");
    tabela.columns = [
      {
        chave: "nome",
        titulo: "Empresa",
        formato: (v) => avatarNomeHtml(v),
      },
      { chave: "telefone", titulo: "", formato: (v) => whatsappBtnHtml(v), largura: "52px" },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
      {
        chave: "categoria_id",
        titulo: "Categoria",
        formato: (id) => {
          const c = mapaCat[id];
          return c
            ? `<category-badge nome="${c.nome}" cor="${c.cor}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      ...colunasLog(),
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = fornecedores;
    tabela.addEventListener("linha", (e) => {
      irPara("/fornecedores/" + e.detail.linha.id);
    });
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirForm(e.detail.linha);
      else this.remover(e.detail.linha);
    });
    tabela.setAttribute("editar-massa", "");
    tabela.setAttribute("excluir-massa", "");
    tabela.addEventListener("editar-massa", (e) =>
      editarEmMassa(e.detail.linhas, {
        criarForm: (ref) => {
          const f = document.createElement("fornecedor-form");
          f.fornecedor = ref;
          return f;
        },
        reler: (ref) => dataStore.fornecedores().find((x) => String(x.id) === String(ref.id)),
        aplicar: (l, diff) => dataStore.atualizarFornecedor(l.id, diff),
      })
    );
    tabela.addEventListener("excluir-massa", async (e) => {
      let ok = 0;
      for (const l of e.detail.linhas || []) {
        try {
          await dataStore.removerFornecedor(l.id);
          ok++;
        } catch (err) {
          notificarErro(err);
        }
      }
      if (ok) toastSucesso(`${ok} empresa(s) excluída(s).`);
    });
    el.replaceChildren(tabela);
  }

  /** Conteúdo de uma linha de empresa (avatar + nome + categoria + WhatsApp). */
  _linhaFornecedor(f, mapaCat) {
    const cat = (mapaCat[f.categoria_id] || {}).nome || "";
    return `<div style="display:flex;align-items:center;gap:12px;width:100%;min-width:0">
      ${avatarHtml(f.nome, 44)}
      <div style="flex:1;min-width:0">
        <div style="font-weight:var(--peso-semi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(f.nome)}</div>
        ${cat ? `<div style="font-size:var(--fs-sm);color:var(--cor-texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(cat)}</div>` : ""}
      </div>
      ${whatsappBtnHtml(f.telefone, 40)}
    </div>`;
  }

  /** Lista MOBILE de empresas (estilo telefone: A–Z + gestos). */
  _listaFornecedoresMobile(fornecedores, mapaCat) {
    const lista = document.createElement("ui-lista-gestos");
    lista.setAttribute("indice", "");
    lista.letraDe = (f) => (String(f.nome || "#").trim()[0] || "#").toUpperCase();
    lista.render = (f) => this._linhaFornecedor(f, mapaCat);
    lista.itens = [...fornecedores].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt", { sensitivity: "base" }));
    lista.addEventListener("abrir", (e) => irPara("/fornecedores/" + e.detail.item.id));
    lista.addEventListener("editar", (e) => editarEntidade("fornecedor", e.detail.item.id));
    lista.addEventListener("excluir", (e) => excluirEntidade("fornecedor", e.detail.item.id, null, { semConfirmacao: true }));
    lista.addEventListener("acao-massa", async (e) => {
      if (e.detail.acao !== "excluir") return;
      let ok = 0;
      for (const f of e.detail.itens || []) {
        try { await dataStore.removerFornecedor(f.id); ok++; } catch (err) { notificarErro(err); }
      }
      if (ok) toastSucesso(`${ok} empresa(s) excluída(s).`);
    });
    return lista;
  }

  abrirForm(fornecedor) {
    const form = document.createElement("fornecedor-form");
    form.fornecedor = fornecedor;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  /** Importa um contato do Google como nova empresa (fornecedor) do app (vinculada). */
  abrirImportarGoogle() {
    const picker = document.createElement("google-contato-picker");
    picker.titulo = "Importar empresa do Google";
    picker.addEventListener("fechar", () => picker.remove());
    picker.addEventListener("escolher", async (e) => {
      const c = e.detail && e.detail.contato;
      if (!c) return;
      try {
        await dataStore.importarGoogle("fornecedor", c.resourceName);
        toastSucesso("Empresa importada do Google.");
      } catch (err) {
        notificarErro(err);
      }
    });
    document.body.appendChild(picker);
  }

  remover(fornecedor) {
    abrirBannerVinculos({
      titulo: `A empresa "${fornecedor.nome}"`,
      grupos: vinculosDoFornecedor(fornecedor.id),
      aoExcluir: async () => {
        if (!(await confirmar({ titulo: "Excluir empresa", mensagem: `Excluir a empresa "${fornecedor.nome}"?`, perigo: true, rotuloOk: "Excluir" }))) return;
        try {
          await dataStore.removerFornecedor(fornecedor.id);
          toastSucesso("Empresa removida.");
        } catch (e) {
          notificarErro(e);
        }
      },
    });
  }

  /* --------------------------- Categoria --------------------------- */
  /* Mesma entidade `categoria` da categoria de itens (reuso total). */

  pintarClassificacoes() {
    const el = this.$("#listaClass");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }

    const todas = dataStore.categoriasFornecedor();
    if (!todas.length) {
      el.innerHTML = `
        <ui-empty-state icone="tag" titulo="Nenhuma categoria"
          texto="Crie categorias para organizar suas empresas.">
          <ui-button slot="acao" id="vaziaClass">+ Criar categoria</ui-button>
        </ui-empty-state>`;
      el.querySelector("#vaziaClass").addEventListener("click", () => this.abrirClassForm(null));
      return;
    }
    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    tabela.columns = [
      {
        chave: "nome",
        titulo: "Categoria",
        formato: (nome, linha) =>
          `<category-badge nome="${nome}" cor="${linha.cor}"></category-badge>`,
      },
      ...colunasLog(),
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tabela.rows = todas;
    tabela.addEventListener("acao", (e) => {
      if (e.detail.acao === "editar") this.abrirClassForm(e.detail.linha);
      else this.removerClass(e.detail.linha);
    });
    el.replaceChildren(tabela);
  }

  abrirClassForm(categoria) {
    const form = document.createElement("categoria-form");
    form.tipo = "fornecedor";
    form.categoria = categoria;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  removerClass(categoria) {
    abrirBannerVinculos({
      titulo: `A categoria "${categoria.nome}"`,
      grupos: vinculosDaSubclassificacao(categoria.id),
      aoExcluir: async () => {
        if (!(await confirmar({ titulo: "Excluir categoria", mensagem: `Excluir a categoria "${categoria.nome}"?`, perigo: true, rotuloOk: "Excluir" }))) return;
        try {
          await dataStore.removerCategoria(categoria.id);
          toastSucesso("Categoria removida.");
        } catch (e) {
          notificarErro(e);
        }
      },
    });
  }
}

customElements.define("fornecedores-view", FornecedoresView);
