/**
 * <obras-list-view> — Lista as obras do usuário (rota /obras), AGRUPADAS por
 * grupo/pasta (com uma seção "Sem grupo" p/ o resto + as compartilhadas).
 *
 * Lê do data-store (cache-first, sem recarregar): assina o store e repinta.
 * Criar/editar/excluir obras e grupos vão pelas mutações do store (write-through).
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-empty-state.js";
import "./obra-card.js";
import "./obra-form.js";
import "./obra-share-form.js";
import "./grupo-form.js";
import "../inicio/painel-atencao.js";

class ObrasListView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); margin-bottom: var(--esp-5); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
      .acoes-topo { display: flex; gap: var(--esp-2); flex-wrap: wrap; }
      .grupos-wrap { display: flex; flex-direction: column; gap: var(--esp-6); }
      section { display: flex; flex-direction: column; gap: var(--esp-4); }
      .sec-cab { display: flex; align-items: center; gap: var(--esp-3); flex-wrap: wrap; }
      .sec-cab h2 { font-size: var(--fs-lg); font-weight: var(--peso-semi);
        display: flex; align-items: center; gap: var(--esp-2); min-width: 0; }
      .sec-cab .cont { font-size: var(--fs-sm); color: var(--cor-texto-fraco); flex: none; }
      .sec-cab .acoes-sec { margin-left: auto; display: flex; gap: var(--esp-2); flex-wrap: wrap; }
      .grid { display: grid; gap: var(--esp-4); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
      .vazio-grupo { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      @media (max-width: 560px) { .sec-cab .acoes-sec { margin-left: 0; width: 100%; } }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Minhas obras</h1>
            <p class="sub">Cadastre obras, organize em grupos e acompanhe os gastos em tempo real.</p>
          </div>
          <div class="acoes-topo">
            <ui-button id="novoGrupo" variant="secundario"><ui-icon name="tag" size="16"></ui-icon> Novo grupo</ui-button>
            <ui-button id="nova">+ Nova obra</ui-button>
          </div>
        </div>
        <painel-atencao></painel-atencao>
        <div id="conteudo"></div>
      </div>
    `;
  }

  aoConectar() {
    this.$("#nova").addEventListener("click", () => this.abrirForm(null));
    this.$("#novoGrupo").addEventListener("click", () => this.abrirGrupoForm(null));
    // Assina o store: repinta quando obras/grupos (ou totais) mudam.
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const alvo = this.$("#conteudo");
    if (!alvo) return;
    if (!dataStore.carregado()) {
      alvo.innerHTML = `<ui-spinner centro text="Carregando obras..."></ui-spinner>`;
      return;
    }
    const obras = dataStore.obras();
    const grupos = dataStore.grupos();
    if (!obras.length && !grupos.length) {
      alvo.innerHTML = `
        <ui-empty-state icone="obra" titulo="Nenhuma obra ainda"
          texto="Crie sua primeira obra para começar a registrar despesas.">
          <ui-button slot="acao" id="vazioNova">+ Criar obra</ui-button>
        </ui-empty-state>`;
      alvo.querySelector("#vazioNova").addEventListener("click", () => this.abrirForm(null));
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "grupos-wrap";
    const mostradas = new Set();

    // Uma seção por grupo (mesmo vazio — dá p/ gerir/compartilhar).
    grupos.forEach((g) => {
      const doGrupo = dataStore.obrasDoGrupo(g.id);
      doGrupo.forEach((o) => mostradas.add(String(o.id)));
      wrap.appendChild(this._secaoGrupo(g, doGrupo));
    });

    // Resto: obras sem grupo próprio + as compartilhadas comigo.
    const outras = obras.filter((o) => !mostradas.has(String(o.id)));
    if (outras.length) wrap.appendChild(this._secao(grupos.length ? "Sem grupo" : "", outras));

    alvo.replaceChildren(wrap);
  }

  /** Cria um <obra-card> já com os listeners. */
  _card(o) {
    const card = document.createElement("obra-card");
    card.obra = o;
    card.addEventListener("abrir", (e) => irPara("/obras/" + e.detail.obra.id));
    card.addEventListener("editar", (e) => this.abrirForm(e.detail.obra));
    card.addEventListener("compartilhar", (e) => this.abrirShare(e.detail.obra));
    card.addEventListener("remover", (e) => this.remover(e.detail.obra));
    return card;
  }

  /** Grade de cards (ou texto de vazio). */
  _grade(obras, vazioTxt) {
    if (!obras.length) {
      const p = document.createElement("p");
      p.className = "vazio-grupo";
      p.textContent = vazioTxt || "Nenhuma obra aqui.";
      return p;
    }
    const grid = document.createElement("div");
    grid.className = "grid";
    obras.forEach((o) => grid.appendChild(this._card(o)));
    return grid;
  }

  /** Seção de um grupo (cabeçalho com nome + gerir/compartilhar + grade). */
  _secaoGrupo(grupo, obras) {
    const sec = document.createElement("section");
    const cab = document.createElement("div");
    cab.className = "sec-cab";
    cab.innerHTML = `
      <h2><ui-icon name="tag" size="18"></ui-icon> ${grupo.nome}</h2>
      <span class="cont">${obras.length} obra(s)</span>
      <div class="acoes-sec">
        <ui-button class="gerir" variant="secundario" tamanho="sm"><ui-icon name="olho" size="14"></ui-icon> Gerir · compartilhar</ui-button>
      </div>`;
    cab.querySelector(".gerir").addEventListener("click", () => this.abrirGrupoForm(grupo));
    sec.appendChild(cab);
    sec.appendChild(this._grade(obras, "Nenhuma obra neste grupo. Coloque obras aqui pelo campo “Grupo” da obra."));
    return sec;
  }

  /** Seção genérica com título opcional (ex.: "Sem grupo"). */
  _secao(titulo, obras) {
    const sec = document.createElement("section");
    if (titulo) {
      const cab = document.createElement("div");
      cab.className = "sec-cab";
      cab.innerHTML = `<h2>${titulo}</h2><span class="cont">${obras.length} obra(s)</span>`;
      sec.appendChild(cab);
    }
    sec.appendChild(this._grade(obras));
    return sec;
  }

  abrirForm(obra) {
    const form = document.createElement("obra-form");
    form.obra = obra;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  abrirGrupoForm(grupo) {
    const form = document.createElement("grupo-form");
    form.grupo = grupo;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  abrirShare(obra) {
    const form = document.createElement("obra-share-form");
    form.obra = obra;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }

  async remover(obra) {
    if (!(await confirmar({ titulo: "Excluir obra", mensagem: `Excluir a obra "${obra.nome}" e todas as suas despesas?`, perigo: true, rotuloOk: "Excluir" }))) return;
    try {
      await dataStore.removerObra(obra.id);
      toastSucesso("Obra excluída.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("obras-list-view", ObrasListView);
