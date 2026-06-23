/**
 * <obra-share-form> — Modal do DONO: compartilhar a obra com usuários (acesso
 * de colaboração) E gerar um LINK PÚBLICO somente-leitura.
 *
 * Propriedade: .obra  Evento: "fechar".
 * - Link público: via data-store (gerar/remover); qualquer pessoa com o link vê
 *   itens e gastos, sem login e sem editar.
 * - Por usuário: chama a API de compartilhamento (colaboração).
 */
import { BaseElement } from "../../components/base-element.js";
import { urlAbsoluta } from "../../core/router.js";
import { api } from "../../core/api-client.js";
import { dataStore } from "../../core/data-store.js";
import { data as fmtData } from "../../core/formatters.js";
import { bus, EVENTOS, toastSucesso, notificarErro } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";

class ObraShareForm extends BaseElement {
  set obra(v) {
    this._obra = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get obra() {
    return this._obra || null;
  }

  /** URL pública (limpa) a partir do token — respeita o caminho-base da implantação. */
  _url(token) {
    return urlAbsoluta(`/publico/${token}`);
  }

  estilos() {
    return `
      .secao { margin-bottom: var(--esp-5); }
      .titulo-secao { display: flex; align-items: center; gap: var(--esp-2);
        font-size: var(--fs-sm); font-weight: var(--peso-semi); margin-bottom: var(--esp-2); }
      .dica { font-size: var(--fs-sm); color: var(--cor-texto-suave); margin-bottom: var(--esp-3); }
      .link-row { display: flex; gap: var(--esp-2); align-items: center; }
      .link-url { flex: 1; min-width: 0; padding: var(--esp-2) var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        background: var(--cor-superficie-2); color: var(--cor-texto-suave);
        font-size: var(--fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .acoes-link { display: flex; gap: var(--esp-2); margin-top: var(--esp-2); flex-wrap: wrap; }
      hr { border: none; border-top: 1px solid var(--cor-borda); margin: var(--esp-4) 0; }
      .lista { display: flex; flex-direction: column; gap: var(--esp-2); min-height: 50px; }
      .item { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); padding: var(--esp-3); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-sm); }
      .item.ativo { border-color: var(--cor-primaria); background: var(--cor-primaria-suave); }
      .info { display: flex; flex-direction: column; }
      .nome { font-weight: var(--peso-medio); }
      .email { font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); padding: var(--esp-4); text-align: center; }
      .acessos { margin-top: var(--esp-3); font-size: var(--fs-sm); }
      .acessos-lista { margin: var(--esp-2) 0 0; padding-left: var(--esp-5);
        max-height: 160px; overflow: auto; color: var(--cor-texto-suave); }
      .acessos-lista li { margin-bottom: 2px; }
    `;
  }

  template() {
    const o = this.obra || {};
    return `
      <ui-modal open title="Compartilhar: ${o.nome || ""}">
        <div class="secao">
          <div class="titulo-secao"><ui-icon name="olho" size="16"></ui-icon> Link público (somente leitura)</div>
          <p class="dica">Qualquer pessoa com o link vê os itens e os gastos desta
          obra, sem login e sem poder editar.</p>
          <div id="linkBox"></div>
        </div>
        <hr />
        <div class="secao">
          <div class="titulo-secao"><ui-icon name="compartilhar" size="16"></ui-icon> Convidar usuários (colaboração)</div>
          <p class="dica">Convidados podem ver a obra e lançar despesas, mas não
          editá-la nem excluí-la.</p>
          <div class="lista" id="lista"><ui-spinner centro text="Carregando usuários..."></ui-spinner></div>
        </div>
        <div slot="rodape">
          <ui-button id="fechar" variant="secundario">Concluir</ui-button>
        </div>
      </ui-modal>
    `;
  }

  aoConectar() {
    this.$("ui-modal").addEventListener("fechar", () => this.emitir("fechar"));
    this.$("#fechar").addEventListener("click", () => this.emitir("fechar"));
    this.pintarLink();
    this.carregar();
  }

  /* ----------------------- Link público ------------------------------ */

  pintarLink() {
    const box = this.$("#linkBox");
    const atual = dataStore.obra(this.obra.id) || this.obra;
    const token = atual.link_token;
    if (token) {
      box.innerHTML = `
        <div class="link-row">
          <span class="link-url" id="url">${this._url(token)}</span>
        </div>
        <div class="acoes-link">
          <ui-button id="copiar" tamanho="sm"><ui-icon name="copiar" size="14"></ui-icon> Copiar link</ui-button>
          <ui-button id="abrir" tamanho="sm" variant="secundario">Abrir</ui-button>
          <ui-button id="acessos" tamanho="sm" variant="secundario"><ui-icon name="relogio" size="14"></ui-icon> Log de acessos</ui-button>
          <ui-button id="desativar" tamanho="sm" variant="perigo">Desativar</ui-button>
        </div>
        <div id="acessosBox"></div>`;
      box.querySelector("#copiar").addEventListener("click", () => this.copiar(token));
      box.querySelector("#abrir").addEventListener("click", () =>
        window.open(this._url(token), "_blank")
      );
      box.querySelector("#acessos").addEventListener("click", () => this.carregarAcessos());
      box.querySelector("#desativar").addEventListener("click", () => this.desativarLink());
    } else {
      box.innerHTML = `<ui-button id="gerar"><ui-icon name="link" size="16"></ui-icon> Gerar link público</ui-button>`;
      box.querySelector("#gerar").addEventListener("click", () => this.gerarLink());
    }
  }

  async gerarLink() {
    const btn = this.$("#linkBox ui-button");
    btn && btn.setAttribute("loading", "");
    try {
      await dataStore.gerarLinkPublico(this.obra.id);
      toastSucesso("Link público gerado.");
      this.pintarLink();
    } catch (e) {
      notificarErro(e);
      btn && btn.removeAttribute("loading");
    }
  }

  async desativarLink() {
    if (!(await confirmar({ titulo: "Desativar link público", mensagem: `Desativar o link público? Quem tiver o link perderá o acesso.`, perigo: true, rotuloOk: "Desativar" }))) return;
    try {
      await dataStore.removerLinkPublico(this.obra.id);
      toastSucesso("Link público desativado.");
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

  async carregarAcessos() {
    const box = this.$("#acessosBox");
    box.innerHTML = `<ui-spinner text="Carregando acessos..."></ui-spinner>`;
    try {
      const r = await api.call("obras.acessosLink", { obra_id: this.obra.id });
      const itens = (r.acessos || [])
        .map((a) => `<li>${this._fmtDataHora(a.acessado_em)}</li>`)
        .join("");
      box.innerHTML = `
        <div class="acessos">
          <strong>${r.total} acesso(s)</strong>
          ${
            r.total
              ? `<ul class="acessos-lista">${itens}</ul>`
              : `<div class="vazio">Ninguém acessou o link ainda.</div>`
          }
        </div>`;
    } catch (e) {
      notificarErro(e);
      box.innerHTML = "";
    }
  }

  _fmtDataHora(iso) {
    if (!iso) return "—";
    const hora = String(iso).substring(11, 16);
    return `${fmtData(iso)}${hora ? " " + hora : ""}`;
  }

  /* --------------------- Convite por usuário -------------------------- */

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
    }
  }

  pintar() {
    const lista = this.$("#lista");
    if (!lista) return;
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
