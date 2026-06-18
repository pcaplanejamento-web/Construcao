/**
 * <user-config-form> — Modal para o admin ver/definir configurações por usuário.
 *
 * Modelo chave-valor: o admin define chaves arbitrárias (ex.: moeda, tema,
 * limite_obras). Carrega via admin.config.obter; grava via admin.config.definir.
 *
 * Propriedade: .usuario  Eventos: "fechar".
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { obrigatorio } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

const CHAVES_SUGERIDAS = ["moeda", "tema", "limite_obras", "categorias_padrao"];

class UserConfigForm extends BaseElement {
  set usuario(v) {
    this._usuario = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get usuario() {
    return this._usuario || null;
  }

  estilos() {
    return `
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .lista { display: flex; flex-direction: column; gap: var(--esp-2); }
      .item { display: flex; justify-content: space-between; gap: var(--esp-3);
        padding: var(--esp-2) var(--esp-3); background: var(--cor-superficie-2);
        border-radius: var(--raio-sm); font-size: var(--fs-sm); }
      .item .chave { font-weight: var(--peso-semi); }
      .item .valor { color: var(--cor-texto-suave); word-break: break-all; }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
      .linha { display: flex; gap: var(--esp-3); align-items: end; }
      .linha > ui-input { flex: 1; }
      .sep { border: none; border-top: 1px solid var(--cor-borda); margin: var(--esp-2) 0; }
      .titulo { font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto-suave); }
    `;
  }

  template() {
    const u = this.usuario || {};
    return `
      <ui-modal open title="Configurações — ${u.nome || ""}">
        <div class="campos">
          <div>
            <div class="titulo">Configurações atuais</div>
            <div class="lista" id="lista"><div class="vazio">Carregando...</div></div>
          </div>
          <hr class="sep" />
          <div class="titulo">Definir / atualizar</div>
          <div class="linha">
            <ui-input id="chave" label="Chave" placeholder="ex.: moeda" list="sugestoes"></ui-input>
            <ui-input id="valor" label="Valor" placeholder="ex.: BRL"></ui-input>
          </div>
          <ui-button id="definir">Salvar configuração</ui-button>
        </div>
        <div slot="rodape">
          <ui-button id="fechar" variant="secundario">Fechar</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aposRender() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#definir").addEventListener("click", () => this.definir());
    this.carregar();
  }

  async carregar() {
    try {
      const r = await api.call("admin.config.obter", {
        usuario_id: this.usuario.id,
      });
      this.pintarLista(r.config || {});
    } catch (e) {
      notificarErro(e);
    }
  }

  pintarLista(config) {
    const lista = this.$("#lista");
    const chaves = Object.keys(config);
    if (!chaves.length) {
      lista.innerHTML = `<div class="vazio">Nenhuma configuração definida.</div>`;
      return;
    }
    lista.innerHTML = chaves
      .map(
        (k) =>
          `<div class="item"><span class="chave">${k}</span><span class="valor">${String(
            config[k]
          )}</span></div>`
      )
      .join("");
  }

  async definir() {
    const chave = this.$("#chave").value.trim();
    const valor = this.$("#valor").value;
    const erro = obrigatorio(chave, "A chave");
    if (erro) {
      this.$("#chave").setAttribute("error", erro);
      return;
    }
    this.$("#chave").removeAttribute("error");

    const btn = this.$("#definir");
    btn.setAttribute("loading", "");
    try {
      const r = await api.call("admin.config.definir", {
        usuario_id: this.usuario.id,
        chave,
        valor,
      });
      toastSucesso("Configuração salva.");
      this.pintarLista(r.config || {});
      this.$("#chave").value = "";
      this.$("#valor").value = "";
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("user-config-form", UserConfigForm);
