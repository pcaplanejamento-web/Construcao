/**
 * <login-form> — Formulário de autenticação (tela de login redesenhada).
 *
 * Campos com ícone (e-mail/usuário, senha com olho), "Manter-me conectado" e
 * botão "Entrar". Chama auth.login(email, senha, lembrar); em sucesso o
 * EVENTOS.AUTH dispara o carregamento + navegação central (app.js) e este form
 * MANTÉM o estado de loading (o carregamento acontece nesta tela) até a view
 * ser substituída. Em erro, mostra mensagem inline + toast.
 *
 * Visual fixo (painel claro): usa cores literais (não segue tema escuro).
 */
import { BaseElement } from "../../components/base-element.js";
import { auth } from "../../core/auth-store.js";
import { api } from "../../core/api-client.js";
import { CONFIG } from "../../core/config.js";
import { notificarErro } from "../../core/event-bus.js";
import { obrigatorio, primeiroErro } from "../../core/validators.js";
import "../../components/ui-button.js";
import "../../components/ui-icon.js";
import "./redefinir-senha.js";

class LoginForm extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      form { display: flex; flex-direction: column; gap: var(--esp-4); }

      .erro-geral { color: #b91c1c; font-size: var(--fs-sm); background: #fef2f2;
        border: 1px solid #fecaca; padding: var(--esp-2) var(--esp-3);
        border-radius: var(--raio-md); }

      .campo { display: flex; flex-direction: column; gap: 6px; }
      label { font-size: 13px; font-weight: 600; color: #334155; }

      .wrap { position: relative; display: flex; align-items: center; }
      .wrap > ui-icon.esq { position: absolute; left: 14px; color: #94a3b8;
        pointer-events: none; }
      input { width: 100%; height: 52px; box-sizing: border-box;
        border: 1px solid #e2e8f0; border-radius: 12px; background: #fff;
        padding: 0 14px 0 44px; font-size: 15px; color: #0f172a;
        font-family: inherit; transition: border-color .15s, box-shadow .15s; }
      input::placeholder { color: #94a3b8; }
      input:focus { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 4px rgba(15, 118, 110, .12); }
      .wrap.senha input { padding-right: 46px; }
      .olho { position: absolute; right: 8px; display: flex; align-items: center;
        justify-content: center; padding: 8px; background: none; border: 0;
        color: #94a3b8; cursor: pointer; border-radius: 8px; }
      .olho:hover { color: #475569; }

      .lembrar { display: flex; align-items: center; gap: 10px; cursor: pointer;
        font-size: 14px; color: #334155; user-select: none; }
      .lembrar input { width: 18px; height: 18px; accent-color: var(--cor-primaria);
        cursor: pointer; }

      ui-button { width: 100%; }
      ui-button::part(button) { background: var(--grad-verde); color: #fff;
        border: none; height: 52px; border-radius: 12px; font-size: 15px;
        font-weight: 700; gap: 8px; box-shadow: 0 10px 22px rgba(16, 185, 129, .28); }
      ui-button::part(button):hover { filter: brightness(1.04); }

      .link { display: block; width: 100%; text-align: center; margin-top: 2px;
        background: none; border: 0; cursor: pointer; color: var(--cor-primaria);
        font-size: 14px; font-weight: 600; font-family: inherit; }
      .link:hover { text-decoration: underline; }

      /* Bloco "Entrar com Google" (oculto até o GIS carregar/estar configurado). */
      .google { display: flex; flex-direction: column; gap: var(--esp-3); }
      .ou { display: flex; align-items: center; gap: 12px; color: #94a3b8;
        font-size: 13px; }
      .ou::before, .ou::after { content: ""; flex: 1; height: 1px; background: #e2e8f0; }
      .gbtn { display: flex; justify-content: center; min-height: 44px; }
    `;
  }

  template() {
    return `
      <form>
        <div class="erro-geral" id="erroGeral" hidden></div>

        <div class="campo">
          <label for="email">Email ou usuário</label>
          <div class="wrap">
            <ui-icon class="esq" name="email" size="18"></ui-icon>
            <input id="email" type="email" name="email" placeholder="voce@empresa.com"
                   autocomplete="username" />
          </div>
        </div>

        <div class="campo">
          <label for="senha">Senha</label>
          <div class="wrap senha">
            <ui-icon class="esq" name="seguranca" size="18"></ui-icon>
            <input id="senha" type="password" name="senha" placeholder="••••••••"
                   autocomplete="current-password" />
            <button class="olho" id="olho" type="button" aria-label="Mostrar senha">
              <ui-icon name="olho" size="18"></ui-icon>
            </button>
          </div>
        </div>

        <label class="lembrar">
          <input type="checkbox" id="lembrar" checked />
          Manter-me conectado
        </label>

        <ui-button id="btn" full>Entrar <ui-icon name="seta-direita" size="18"></ui-icon></ui-button>

        <div class="google" id="googleBloco" hidden>
          <div class="ou"><span>ou</span></div>
          <div class="gbtn" id="googleBtn"></div>
        </div>

        <button class="link" id="esqueci" type="button">Primeiro acesso ou esqueci a senha</button>
      </form>
    `;
  }

  aoConectar() {
    const submeter = () => this.submeter();
    this.$("#btn").addEventListener("click", submeter);
    this.$$("input").forEach((i) =>
      i.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submeter();
      })
    );
    this.$("#olho").addEventListener("click", () => this.alternarSenha());
    this.$("#esqueci").addEventListener("click", () => this.abrirRedefinir());
    this._initGoogle();
  }

  /**
   * Inicializa o botão "Entrar com Google" (GIS). Só aparece quando o Client ID
   * está configurado e o script accounts.google.com/gsi/client já carregou;
   * caso contrário o login por senha segue intacto (bloco fica oculto).
   */
  async _initGoogle() {
    const bloco = this.$("#googleBloco");
    if (!bloco) return;
    const cid = await this._clientId();
    if (!cid || !this.isConnected) return;
    const g = await this._aguardarGoogle();
    if (!g || !this.isConnected) return;
    const alvo = this.$("#googleBtn");
    try {
      g.accounts.id.initialize({
        client_id: cid,
        callback: (resp) => this._onGoogleCredential(resp),
      });
      const largura = Math.min(400, Math.max(240, alvo.clientWidth || 320));
      g.accounts.id.renderButton(alvo, {
        type: "standard",
        theme: "outline", // painel de login é sempre claro
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "center",
        width: largura,
        locale: "pt-BR",
      });
      bloco.hidden = false;
    } catch (e) {
      bloco.hidden = true;
    }
  }

  /**
   * Client ID do Google: usa o de config.js se preenchido (override); senão busca
   * do backend (config.publico → Script Properties). Assim o dono configura em um
   * lugar só. Retorna "" se não configurado (aí o botão fica oculto).
   */
  async _clientId() {
    const fixo = CONFIG.GOOGLE_CLIENT_ID;
    if (fixo && fixo.indexOf("COLE_AQUI") !== 0) return fixo;
    try {
      const r = await api.call("config.publico");
      return (r && r.googleClientId) || "";
    } catch (e) {
      return "";
    }
  }

  /** Aguarda window.google.accounts.id (script async); resolve null se demorar. */
  _aguardarGoogle() {
    const pronto = () =>
      window.google && window.google.accounts && window.google.accounts.id;
    return new Promise((resolve) => {
      if (pronto()) return resolve(window.google);
      let tentativas = 0;
      const id = setInterval(() => {
        if (pronto()) {
          clearInterval(id);
          resolve(window.google);
        } else if (++tentativas > 50) {
          clearInterval(id);
          resolve(null);
        }
      }, 100);
      this.aoLimpar(() => clearInterval(id));
    });
  }

  /** Recebe o ID token do Google e autentica (só e-mails já cadastrados). */
  async _onGoogleCredential(resp) {
    const idToken = resp && resp.credential;
    if (!idToken) return;
    const lembrar = this.$("#lembrar").checked;
    this.mostrarErro("");
    this.$("#btn").setAttribute("loading", "");
    try {
      await auth.loginGoogle(idToken, lembrar);
      // Sucesso: mantém o loading — app.js carrega os dados e troca a view.
    } catch (e) {
      this.$("#btn").removeAttribute("loading");
      this.mostrarErro(e.message || "Não foi possível entrar com o Google.");
      notificarErro(e);
    }
  }

  alternarSenha() {
    const inp = this.$("#senha");
    const mostrando = inp.type === "text";
    inp.type = mostrando ? "password" : "text";
    this.$("#olho").setAttribute("aria-label", mostrando ? "Mostrar senha" : "Ocultar senha");
  }

  async submeter() {
    const email = this.$("#email").value.trim();
    const senha = this.$("#senha").value;
    const lembrar = this.$("#lembrar").checked;

    const erro = primeiroErro(
      obrigatorio(email, "O e-mail ou usuário"),
      obrigatorio(senha, "A senha")
    );
    if (erro) {
      this.mostrarErro(erro);
      return;
    }

    const btn = this.$("#btn");
    btn.setAttribute("loading", "");
    this.mostrarErro("");
    try {
      await auth.login(email, senha, lembrar);
      // Sucesso: NÃO removemos o loading — o carregamento dos dados acontece
      // nesta tela (app.js) e a view é substituída ao navegar para o sistema.
    } catch (e) {
      btn.removeAttribute("loading");
      // Usuário cadastrado mas sem senha → abre o fluxo de primeiro acesso.
      if (e && e.code === "SENHA_NAO_DEFINIDA") {
        this.mostrarErro("");
        this.abrirRedefinir();
        return;
      }
      this.mostrarErro(e.message || "Não foi possível entrar.");
      notificarErro(e);
    }
  }

  /** Abre o fluxo de definir/redefinir senha (primeiro acesso ou esqueci). */
  abrirRedefinir() {
    const el = document.createElement("redefinir-senha");
    el.contexto = "login";
    el.email = (this.$("#email").value || "").trim();
    document.body.appendChild(el);
  }

  mostrarErro(msg) {
    const el = this.$("#erroGeral");
    el.textContent = msg;
    el.hidden = !msg;
  }
}

customElements.define("login-form", LoginForm);
