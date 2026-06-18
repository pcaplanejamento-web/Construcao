/**
 * <obra-detail-view> — Detalhe da obra: dashboard + despesas em tempo real.
 *
 * Rota: #/obras/:id  (o roteador injeta o atributo "id").
 *
 * Orquestra o requisito de "tempo real" (sem websocket):
 *  1) Otimista: ao adicionar despesa, atualiza a lista e recalcula o resumo
 *     localmente na hora.
 *  2) Confirmação: a resposta de despesas.criar traz o resumo do servidor, que
 *     vira a verdade.
 *  3) Refetch por evento + polling leve (CONFIG.POLLING_RESUMO_MS) enquanto a
 *     view está montada, reconciliando alterações feitas em outra aba.
 *
 * Constrói o DOM dos filhos UMA vez e atualiza por propriedades, para não
 * destruir o formulário (foco) a cada mudança.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { CONFIG } from "../../core/config.js";
import { bus, EVENTOS, toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../despesas/despesa-form.js";
import "../despesas/despesa-table.js";
import "./obra-form.js";
import "./obra-share-form.js";

class ObraDetailView extends BaseElement {
  constructor() {
    super();
    this._obra = null;
    this._categorias = [];
    this._despesas = [];
    this._resumo = {};
    this._mapaCat = {};
    this._montado = false;
  }

  get obraId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { max-width: 1100px; margin: 0 auto; padding: var(--esp-6) var(--esp-4);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .topo { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .acoes-topo { display: flex; gap: var(--esp-2); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .colunas { display: grid; gap: var(--esp-5); grid-template-columns: 2fr 1fr; }
      @media (max-width: 860px) { .colunas { grid-template-columns: 1fr; } }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando obra..."></ui-spinner></div></div>`;
  }

  aoConectar() {
    this.aoLimpar(bus.on(EVENTOS.OBRAS, () => this.recarregarObra()));
    this.carregar();
    this._timer = setInterval(
      () => this.recarregarSilencioso(),
      CONFIG.POLLING_RESUMO_MS
    );
    this.aoLimpar(() => clearInterval(this._timer));
  }

  /* ----------------------------- Carga ------------------------------- */

  async carregar() {
    try {
      const [obraR, despR, resR] = await Promise.all([
        api.call("obras.obter", { id: this.obraId }),
        api.call("despesas.listar", { obra_id: this.obraId }),
        api.call("despesas.resumo", { obra_id: this.obraId }),
      ]);
      this._obra = obraR.obra;
      // Categorias da obra (global + do dono), vindas de obras.obter.
      this._categorias = obraR.categorias || [];
      this._despesas = despR.despesas || [];
      this._resumo = resR;
      this.indexarCategorias();
      this.montarConteudo();
      this.atualizarDados();
    } catch (e) {
      notificarErro(e);
      this.$("#conteudo").innerHTML = `<p>Não foi possível carregar a obra. <a href="#/obras">Voltar</a></p>`;
    }
  }

  async recarregarSilencioso() {
    try {
      const [despR, resR] = await Promise.all([
        api.call("despesas.listar", { obra_id: this.obraId }),
        api.call("despesas.resumo", { obra_id: this.obraId }),
      ]);
      this._despesas = despR.despesas || [];
      this._resumo = resR;
      this.atualizarDados();
    } catch (e) {
      /* silencioso: polling não incomoda o usuário com erros transitórios */
    }
  }

  async recarregarObra() {
    try {
      const r = await api.call("obras.obter", { id: this.obraId });
      this._obra = r.obra;
      this.pintarTopo();
      this._resumo = await api.call("despesas.resumo", { obra_id: this.obraId });
      this.atualizarDados();
    } catch (e) {
      /* obra pode ter sido removida; ignora */
    }
  }

  indexarCategorias() {
    this._mapaCat = {};
    this._categorias.forEach((c) => (this._mapaCat[c.id] = c));
  }

  /* --------------------------- Montagem ------------------------------ */

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="#/obras">← Minhas obras</a>
      <div class="topo" id="topo"></div>
      <dashboard-summary id="dash"></dashboard-summary>
      <ui-card title="Registrar despesa">
        <despesa-form id="form"></despesa-form>
      </ui-card>
      <div class="colunas">
        <ui-card title="Despesas"><despesa-table id="tabela"></despesa-table></ui-card>
        <ui-card><category-breakdown id="break"></category-breakdown></ui-card>
      </div>
    `;
    this._dash = alvo.querySelector("#dash");
    this._break = alvo.querySelector("#break");
    this._tabela = alvo.querySelector("#tabela");
    this._form = alvo.querySelector("#form");

    this._form.categorias = this._categorias;
    this._form.addEventListener("adicionar", (e) => this.adicionar(e.detail));
    this._form.addEventListener("salvar", (e) =>
      this.salvarEdicao(e.detail.id, e.detail.dados)
    );
    this._form.addEventListener("cancelar", () => (this._form.emEdicao = null));

    this._tabela.addEventListener("editar", (e) => this.editar(e.detail.despesa));
    this._tabela.addEventListener("remover", (e) => this.remover(e.detail.despesa));

    this._montado = true;
    this.pintarTopo();
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo || !this._obra) return;
    const o = this._obra;
    const ehDono = o.ehDono !== false;
    topo.innerHTML = `
      <div>
        <h1>${o.nome || ""}</h1>
        <div class="meta">${o.endereco ? "📍 " + o.endereco + " · " : ""}${
      o.descricao || ""
    }${!ehDono && o.dono_email ? ` · 👤 compartilhada por ${o.dono_email}` : ""}</div>
      </div>
      <div class="acoes-topo">
        ${
          ehDono
            ? `<ui-button id="compartilharObra" variant="secundario">Compartilhar</ui-button>
               <ui-button id="editarObra" variant="secundario">Editar obra</ui-button>`
            : ""
        }
      </div>
    `;
    if (ehDono) {
      topo
        .querySelector("#editarObra")
        .addEventListener("click", () => this.editarObra());
      topo
        .querySelector("#compartilharObra")
        .addEventListener("click", () => this.compartilharObra());
    }
  }

  atualizarDados() {
    if (!this._montado) return;
    this._dash.resumo = this._resumo;
    this._break.porCategoria = this._resumo.por_categoria || [];
    this._tabela.categorias = this._categorias;
    this._tabela.despesas = this._despesas;
  }

  /* --------------------------- Ações --------------------------------- */

  recalcularResumoLocal() {
    const orcamento = Number(this._obra && this._obra.orcamento) || 0;
    const acc = {};
    let total = 0;
    this._despesas.forEach((d) => {
      const v = Number(d.valor) || 0;
      total += v;
      acc[d.categoria_id] = (acc[d.categoria_id] || 0) + v;
    });
    const por = Object.keys(acc).map((id) => {
      const c = this._mapaCat[id] || { nome: "Sem categoria", cor: "#94a3b8" };
      return { categoria_id: id, nome: c.nome, cor: c.cor, total: acc[id] };
    });
    por.sort((a, b) => b.total - a.total);
    this._resumo = {
      obra_id: this.obraId,
      total,
      qtd: this._despesas.length,
      orcamento,
      saldo: orcamento - total,
      por_categoria: por,
    };
    this.atualizarDados();
  }

  async adicionar(dados) {
    // 1) Otimista
    const temp = Object.assign(
      { id: "temp-" + Date.now() + "-" + Math.round(Math.random() * 1e6), obra_id: this.obraId },
      dados
    );
    this._despesas = [temp, ...this._despesas];
    this.recalcularResumoLocal();

    // 2) Confirmação
    try {
      const resp = await api.call("despesas.criar", {
        obra_id: this.obraId,
        ...dados,
      });
      this._despesas = this._despesas.map((d) =>
        d.id === temp.id ? resp.despesa : d
      );
      this._resumo = resp.resumo;
      this.atualizarDados();
      bus.emit(EVENTOS.DESPESAS, { tipo: "criada", obra_id: this.obraId });
    } catch (e) {
      this._despesas = this._despesas.filter((d) => d.id !== temp.id);
      this.recalcularResumoLocal();
      notificarErro(e);
    }
  }

  editar(despesa) {
    this._form.emEdicao = despesa;
    this._form.categorias = this._categorias;
    this._form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async salvarEdicao(id, dados) {
    try {
      const resp = await api.call("despesas.atualizar", { id, ...dados });
      this._despesas = this._despesas.map((d) =>
        d.id === id ? resp.despesa : d
      );
      this._resumo = resp.resumo;
      this._form.emEdicao = null;
      this.atualizarDados();
      toastSucesso("Despesa atualizada.");
    } catch (e) {
      notificarErro(e);
    }
  }

  async remover(despesa) {
    if (!confirm(`Excluir a despesa "${despesa.item}"?`)) return;
    const backup = this._despesas;
    this._despesas = this._despesas.filter((d) => d.id !== despesa.id);
    this.recalcularResumoLocal();
    try {
      const resp = await api.call("despesas.remover", { id: despesa.id });
      this._resumo = resp.resumo;
      this.atualizarDados();
    } catch (e) {
      this._despesas = backup;
      this.recalcularResumoLocal();
      notificarErro(e);
    }
  }

  editarObra() {
    const form = document.createElement("obra-form");
    form.obra = this._obra;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  compartilharObra() {
    const form = document.createElement("obra-share-form");
    form.obra = this._obra;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }
}

customElements.define("obra-detail-view", ObraDetailView);
