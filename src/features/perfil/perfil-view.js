/**
 * <perfil-view> — Página do usuário (rota /perfil).
 * Mostra os dados do usuário (do data-store), permite trocar a senha e conectar
 * a conta Google (agenda). Reusa ui-card + <senha-form> + ui-button/ui-badge.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { auth } from "../../core/auth-store.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, toastAviso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-badge.js";
import "../../components/ui-button.js";
import "../../components/ui-switch.js";
import "./senha-form.js";

function _liga(v) {
  return v === true || v === "TRUE" || v === "true";
}

class PerfilView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela);
        display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); margin-bottom: var(--esp-2); }
      .dados { display: grid; grid-template-columns: 1fr 1fr; gap: var(--esp-4); }
      @media (max-width: 560px) { .dados { grid-template-columns: 1fr; } }
      .campo .rotulo { font-size: var(--fs-xs); text-transform: uppercase;
        letter-spacing: .04em; color: var(--cor-texto-fraco); font-weight: var(--peso-semi); }
      .campo .valor { font-size: var(--fs-md); margin-top: 2px; }

      /* Card "Conta Google". */
      .google { display: flex; flex-direction: column; gap: var(--esp-4); max-width: 520px; }
      .g-status { display: flex; align-items: center; gap: var(--esp-3); flex-wrap: wrap; }
      .g-sub { color: var(--cor-texto-suave); font-size: var(--fs-sm); line-height: 1.5; }
      .g-acoes { display: flex; gap: var(--esp-3); flex-wrap: wrap; }
      @media (max-width: 560px) {
        .g-acoes { flex-direction: column; align-items: stretch; }
        .g-acoes ui-button { width: 100%; }
      }
      .g-sync { display: flex; flex-direction: column; gap: var(--esp-2);
        border-top: 1px solid var(--cor-divisor); padding-top: var(--esp-4); }
      .g-sync-tit { font-weight: var(--peso-semi); }
    `;
  }

  template() {
    const u = dataStore.usuario() || {};
    const papel = u.role === "admin" ? "Administrador" : "Usuário";
    return `
      <div class="area">
        <div>
          <h1>Meu perfil</h1>
          <p class="sub">Seus dados e segurança da conta.</p>
        </div>
        <ui-card title="Meus dados">
          <div class="dados">
            <div class="campo"><div class="rotulo">Nome</div><div class="valor">${u.nome || "—"}</div></div>
            <div class="campo"><div class="rotulo">E-mail</div><div class="valor">${u.email || "—"}</div></div>
            <div class="campo"><div class="rotulo">Papel</div><div class="valor">
              <ui-badge color="${u.role === "admin" ? "var(--cor-roxo)" : "var(--cor-info)"}" text="${papel}"></ui-badge>
            </div></div>
            <div class="campo"><div class="rotulo">Status</div><div class="valor">
              <ui-badge color="${u.ativo ? "var(--cor-sucesso)" : "var(--cor-neutro)"}" text="${u.ativo ? "Ativo" : "Inativo"}"></ui-badge>
            </div></div>
          </div>
        </ui-card>
        <ui-card title="Segurança">
          <senha-form></senha-form>
        </ui-card>
        <ui-card title="Conta Google">
          <div class="google">${this._googleConteudo()}</div>
        </ui-card>
      </div>
    `;
  }

  /** Conteúdo do card Google conforme o estado carregado (this._google). */
  _googleConteudo() {
    const g = this._google;
    if (!g) return `<p class="g-sub">Verificando conexão…</p>`;
    if (g.conectado) {
      const quem = g.google_email ? ` (${g.google_email})` : "";
      return `
        <div class="g-status">
          <ui-badge color="var(--cor-sucesso)" text="Conectado"></ui-badge>
          <span class="g-sub">Sua conta Google está conectada${quem}.</span>
        </div>
        <div class="g-acoes">
          <ui-button id="gTestar" variant="secundario">Testar conexão</ui-button>
          <ui-button id="gDesconectar" variant="perigo-contorno">Desconectar</ui-button>
        </div>
        <div class="g-sync">
          <div class="g-sync-tit">Sincronização com o Google Calendar</div>
          <ui-switch id="swAgenda" label="Sincronizar a agenda (despesas, transferências, prazos)" ${_liga((auth.config() || {}).sync_agenda) ? "checked" : ""}></ui-switch>
          <ui-switch id="swNotas" label="Sincronizar as notas" ${_liga((auth.config() || {}).sync_notas) ? "checked" : ""}></ui-switch>
          <p class="g-sub">Ao ligar, suas marcações são enviadas ao seu Google Calendar como eventos de dia inteiro.</p>
        </div>`;
    }
    return `
      <p class="g-sub">Conecte sua conta Google para vincular sua agenda às obras.</p>
      <div class="g-acoes">
        <ui-button id="gConectar">Conectar Google</ui-button>
      </div>`;
  }

  aposRender() {
    // Primeira renderização: busca o status e re-renderiza (evita laço com a guarda).
    if (this._google === undefined) {
      this._buscarStatus();
      return;
    }
    const conectar = this.$("#gConectar");
    if (conectar) conectar.addEventListener("click", () => this._conectar());
    const testar = this.$("#gTestar");
    if (testar) testar.addEventListener("click", () => this._testar());
    const desconectar = this.$("#gDesconectar");
    if (desconectar) desconectar.addEventListener("click", () => this._desconectar());
    const swA = this.$("#swAgenda");
    if (swA) swA.addEventListener("change", (e) => this._definirSync("sync_agenda", e.detail.checked));
    const swN = this.$("#swNotas");
    if (swN) swN.addEventListener("change", (e) => this._definirSync("sync_notas", e.detail.checked));
  }

  async _definirSync(chave, valor) {
    try {
      await auth.definirConfig(chave, valor);
      toastSucesso(valor ? "Sincronização ligada." : "Sincronização desligada.");
    } catch (e) {
      notificarErro(e);
    }
  }

  async _buscarStatus() {
    try {
      this._google = await api.call("google.status");
    } catch (e) {
      this._google = { conectado: false, google_email: "" };
    }
    this.renderizar();
  }

  /** Abre a janela de consentimento e ouve o retorno (postMessage do callback). */
  async _conectar() {
    const btn = this.$("#gConectar");
    if (btn) btn.setAttribute("loading", "");
    try {
      const { authUrl } = await api.call("google.iniciarOAuth");
      this._ouvirMensagem();
      const pop = window.open(authUrl, "gconnect", "width=480,height=640");
      if (!pop) toastAviso("Permita pop-ups para conectar sua conta Google.");
    } catch (e) {
      notificarErro(e);
    } finally {
      if (btn) btn.removeAttribute("loading");
    }
  }

  /** Registra (uma vez) o ouvinte de mensagens da janela de callback. */
  _ouvirMensagem() {
    if (this._msgHandler) return;
    this._msgHandler = (e) => {
      const d = e && e.data;
      if (!d || (d.tipo !== "google_conectado" && d.tipo !== "google_erro")) return;
      if (d.tipo === "google_conectado") {
        toastSucesso("Conta Google conectada.");
        this._buscarStatus();
      } else {
        toastAviso("Não foi possível conectar. Tente novamente.");
      }
    };
    window.addEventListener("message", this._msgHandler);
    this.aoLimpar(() => window.removeEventListener("message", this._msgHandler));
  }

  async _testar() {
    const btn = this.$("#gTestar");
    if (btn) btn.setAttribute("loading", "");
    try {
      const r = await api.call("google.testarConexao");
      toastSucesso(`Conexão OK — agenda "${r.agenda}".`);
    } catch (e) {
      notificarErro(e);
    } finally {
      if (btn) btn.removeAttribute("loading");
    }
  }

  async _desconectar() {
    const btn = this.$("#gDesconectar");
    if (btn) btn.setAttribute("loading", "");
    try {
      await api.call("google.desconectar");
      toastSucesso("Conta Google desconectada.");
      this._google = { conectado: false, google_email: "" };
      this.renderizar();
    } catch (e) {
      notificarErro(e);
      if (btn) btn.removeAttribute("loading");
    }
  }
}

customElements.define("perfil-view", PerfilView);
