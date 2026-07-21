/**
 * <grupo-form> — Modal para criar/gerir um GRUPO (pasta) de obras: nome + (na
 * edição) o LINK PÚBLICO do grupo (o visitante escolhe qual obra ver) + excluir.
 * Reusa o padrão de link do obra-share-form (compõe ui-modal/ui-input/ui-button).
 *
 * Propriedade: .grupo (objeto p/ edição; null = novo). Eventos: "salvo", "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { urlAbsoluta } from "../../core/router.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";
import "../../components/ui-icon.js";

class GrupoForm extends BaseElement {
  set grupo(v) {
    this._grupo = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get grupo() {
    return this._grupo || null;
  }
  get ehEdicao() {
    return !!(this.grupo && this.grupo.id);
  }

  /** URL pública do grupo (respeita o caminho-base da implantação). */
  _url(token) {
    return urlAbsoluta(`/publico-grupo/${token}`);
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .secao { border-top: 1px solid var(--cor-divisor); padding-top: var(--esp-4); }
      .titulo-secao { display: flex; align-items: center; gap: var(--esp-2);
        font-size: var(--fs-sm); font-weight: var(--peso-semi); margin-bottom: var(--esp-2); }
      .dica { font-size: var(--fs-sm); color: var(--cor-texto-suave); margin-bottom: var(--esp-3); }
      .qtd { font-size: var(--fs-sm); color: var(--cor-texto-fraco); }
      .link-url { padding: var(--esp-2) var(--esp-3); border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-sm); background: var(--cor-superficie-2); color: var(--cor-texto-suave);
        font-size: var(--fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
      .acoes-link { display: flex; gap: var(--esp-2); margin-top: var(--esp-2); flex-wrap: wrap; }
    `;
  }

  template() {
    const g = this.grupo || {};
    const qtd = this.ehEdicao ? dataStore.obrasDoGrupo(g.id).length : 0;
    return `
      <ui-modal open title="${this.ehEdicao ? "Grupo de obras" : "Novo grupo de obras"}">
        <div class="campos">
          <ui-input id="nome" label="Nome do grupo" required value="${(g.nome || "").replace(/"/g, "&quot;")}" placeholder="Ex.: Condomínio Solar"></ui-input>
          ${
            this.ehEdicao
              ? `<div class="qtd">${qtd} obra(s) neste grupo. Coloque/retire obras pelo campo "Grupo" ao criar/editar a obra.</div>`
              : `<div class="dica">Depois de criar, coloque obras neste grupo pelo campo "Grupo" da obra.</div>`
          }
          ${
            this.ehEdicao
              ? `<div class="secao">
                   <div class="titulo-secao"><ui-icon name="olho" size="16"></ui-icon> Link público do grupo</div>
                   <p class="dica">Qualquer pessoa com o link vê a lista de obras do grupo e escolhe qual abrir — somente leitura, sem login.</p>
                   <div id="linkBox"></div>
                 </div>`
              : ""
          }
        </div>
        <div slot="rodape">
          ${this.ehEdicao ? `<ui-button id="excluir" variant="perigo-contorno">Excluir grupo</ui-button>` : ""}
          <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
          <ui-button id="salvar">${this.ehEdicao ? "Salvar" : "Criar grupo"}</ui-button>
        </div>
      </ui-modal>`;
  }

  aposRender() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#salvar").addEventListener("click", () => this.salvar());
    const exc = this.$("#excluir");
    if (exc) exc.addEventListener("click", () => this.excluir());
    if (this.ehEdicao) this.pintarLink();
  }

  pintarLink() {
    const box = this.$("#linkBox");
    if (!box) return;
    const g = dataStore.grupo(this.grupo.id) || this.grupo;
    const token = g.link_token;
    if (token) {
      box.innerHTML = `
        <span class="link-url">${this._url(token)}</span>
        <div class="acoes-link">
          <ui-button id="copiar" tamanho="sm"><ui-icon name="copiar" size="14"></ui-icon> Copiar link</ui-button>
          <ui-button id="abrir" tamanho="sm" variant="secundario">Abrir</ui-button>
          <ui-button id="desativar" tamanho="sm" variant="perigo">Desativar</ui-button>
        </div>`;
      box.querySelector("#copiar").addEventListener("click", () => this.copiar(token));
      box.querySelector("#abrir").addEventListener("click", () => window.open(this._url(token), "_blank"));
      box.querySelector("#desativar").addEventListener("click", () => this.desativar());
    } else {
      box.innerHTML = `<ui-button id="gerar"><ui-icon name="link" size="16"></ui-icon> Gerar link público</ui-button>`;
      box.querySelector("#gerar").addEventListener("click", () => this.gerar());
    }
  }

  async gerar() {
    const btn = this.$("#linkBox ui-button");
    btn && btn.setAttribute("loading", "");
    try {
      await dataStore.gerarLinkGrupo(this.grupo.id);
      toastSucesso("Link do grupo gerado.");
      this.pintarLink();
    } catch (e) {
      notificarErro(e);
      btn && btn.removeAttribute("loading");
    }
  }

  async desativar() {
    if (!(await confirmar({ titulo: "Desativar link", mensagem: "Desativar o link público do grupo? Quem tiver o link perde o acesso.", perigo: true, rotuloOk: "Desativar" }))) return;
    try {
      await dataStore.removerLinkGrupo(this.grupo.id);
      toastSucesso("Link desativado.");
      this.pintarLink();
    } catch (e) {
      notificarErro(e);
    }
  }

  async copiar(token) {
    const url = this._url(token);
    try {
      await navigator.clipboard.writeText(url);
      toastSucesso("Link copiado para a área de transferência.");
    } catch (e) {
      window.prompt("Copie o link:", url);
    }
  }

  async salvar() {
    const nome = this.$("#nome").value.trim();
    const erro = obrigatorio(nome, "O nome");
    if (erro) {
      this.$("#nome").setAttribute("error", erro);
      return;
    }
    this.$("#nome").removeAttribute("error");
    const btn = this.$("#salvar");
    btn.setAttribute("loading", "");
    try {
      if (this.ehEdicao) {
        await dataStore.atualizarGrupo(this.grupo.id, { nome });
        toastSucesso("Grupo atualizado.");
      } else {
        await dataStore.criarGrupo({ nome });
        toastSucesso("Grupo criado.");
      }
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }

  async excluir() {
    if (!(await confirmar({ titulo: "Excluir grupo", mensagem: `Excluir o grupo "${this.grupo.nome}"? As obras NÃO são excluídas — só saem do grupo.`, perigo: true, rotuloOk: "Excluir" }))) return;
    try {
      await dataStore.removerGrupo(this.grupo.id);
      toastSucesso("Grupo excluído.");
      this.emitir("salvo");
      this.emitir("fechar");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("grupo-form", GrupoForm);
