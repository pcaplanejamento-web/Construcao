/**
 * <obra-share-form> — Modal para o DONO compartilhar a obra com outros usuários.
 *
 * Propriedade: .obra (a obra a compartilhar)
 * Evento: "fechar".
 * Carrega a lista de usuários (usuarios.listar) e os compartilhamentos atuais
 * (obras.compartilhamentos); cada usuário tem um botão alternar (compartilhar /
 * remover) que chama a API na hora.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { bus, EVENTOS, toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";

class ObraShareForm extends BaseElement {
  set obra(v) {
    this._obra = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get obra() {
    return this._obra || null;
  }

  estilos() {
    return `
      .lista { display: flex; flex-direction: column; gap: var(--esp-2); min-height: 60px; }
      .item { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); padding: var(--esp-3); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-sm); }
      .item.ativo { border-color: var(--cor-primaria); background: var(--cor-primaria-suave); }
      .info { display: flex; flex-direction: column; }
      .nome { font-weight: var(--peso-medio); }
      .email { font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); padding: var(--esp-4); text-align: center; }
      .dica { font-size: var(--fs-sm); color: var(--cor-texto-suave); margin-bottom: var(--esp-3); }
    `;
  }

  template() {
    const o = this.obra || {};
    return `
      <ui-modal open title="Compartilhar: ${o.nome || ""}">
        <p class="dica">Selecione com quem compartilhar esta obra. Os convidados
        poderão ver a obra e lançar despesas, mas não editá-la nem excluí-la.</p>
        <div class="lista" id="lista"><ui-spinner centro text="Carregando usuários..."></ui-spinner></div>
        <div slot="rodape">
          <ui-button id="fechar" variant="secundario">Concluir</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    this.carregar();
  }

  async carregar() {
    try {
      const [usuariosR, compR] = await Promise.all([
        api.call("usuarios.listar"),
        api.call("obras.compartilhamentos", { obra_id: this.obra.id }),
      ]);
      this._usuarios = usuariosR.usuarios || [];
      this._compartilhados = new Set(
        (compR.compartilhamentos || []).map((c) => c.usuario_id)
      );
      this.pintar();
    } catch (e) {
      notificarErro(e);
      this.emitir("fechar");
    }
  }

  pintar() {
    const lista = this.$("#lista");
    if (!this._usuarios.length) {
      lista.innerHTML = `<div class="vazio">Nenhum outro usuário cadastrado. Peça ao administrador para criar usuários.</div>`;
      return;
    }
    lista.innerHTML = "";
    this._usuarios.forEach((u) => {
      const ativo = this._compartilhados.has(u.id);
      const item = document.createElement("div");
      item.className = "item" + (ativo ? " ativo" : "");
      item.innerHTML = `
        <div class="info">
          <span class="nome">${u.nome}</span>
          <span class="email">${u.email}</span>
        </div>
        <ui-button tamanho="sm" variant="${ativo ? "perigo" : "primario"}">
          ${ativo ? "Remover" : "Compartilhar"}
        </ui-button>`;
      item.querySelector("ui-button").addEventListener("click", () =>
        this.alternar(u, item)
      );
      lista.appendChild(item);
    });
  }

  async alternar(u, item) {
    const btn = item.querySelector("ui-button");
    const estavaAtivo = this._compartilhados.has(u.id);
    btn.setAttribute("loading", "");
    try {
      const acao = estavaAtivo ? "obras.descompartilhar" : "obras.compartilhar";
      const r = await api.call(acao, { obra_id: this.obra.id, usuario_id: u.id });
      this._compartilhados = new Set(
        (r.compartilhamentos || []).map((c) => c.usuario_id)
      );
      toastSucesso(estavaAtivo ? "Compartilhamento removido." : "Obra compartilhada.");
      bus.emit(EVENTOS.OBRAS, { tipo: "compartilhamento" });
      this.pintar();
    } catch (e) {
      notificarErro(e);
      btn.removeAttribute("loading");
    }
  }
}

customElements.define("obra-share-form", ObraShareForm);
