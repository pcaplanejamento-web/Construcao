/**
 * <redefinir-senha> — Fluxo de 3 passos para DEFINIR/REDEFINIR a senha via PIN
 * por e-mail. Serve o **primeiro acesso** e o **esqueci a senha** (na tela de
 * login) e a **troca de senha** (no perfil) — o mesmo backend (AuthSenha.gs).
 *
 * Passos: 1) e-mail → envia código · 2) confirma o código · 3) nova senha → entra.
 *
 * Propriedades:
 *   .email    (string) pré-preenche o e-mail (no perfil vem travado).
 *   .contexto ("login" | "perfil") — "perfil" não re-navega ao concluir.
 * Eventos: "concluido" (senha definida), "fechar" (cancelou/fechou).
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { auth } from "../../core/auth-store.js";
import { toastSucesso, notificarErro, toastInfo } from "../../core/event-bus.js";
import { email as validarEmail, senhaMinima } from "../../core/validators.js";
import "../../components/ui-modal.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

class RedefinirSenha extends BaseElement {
  constructor() {
    super();
    this._passo = 1;
    this._email = "";
    this._contexto = "login";
    this._resetToken = "";
  }
  set email(v) { this._email = String(v || "").trim(); if (this._montado) this.renderizar(); }
  get email() { return this._email; }
  set contexto(v) { this._contexto = v === "perfil" ? "perfil" : "login"; if (this._montado) this.renderizar(); }
  get ehPerfil() { return this._contexto === "perfil"; }

  estilos() {
    return `
      :host { display: block; }
      .sub { margin: 0 0 var(--esp-4); font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .campos { display: flex; flex-direction: column; gap: var(--esp-4); }
      .erro { color: var(--cor-erro); font-size: var(--fs-sm); background: var(--cor-erro-suave);
        padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); }
      .destino { font-weight: var(--peso-semi); color: var(--cor-texto); }
      .pin { width: 100%; box-sizing: border-box; text-align: center; text-transform: uppercase;
        font-size: 1.6rem; letter-spacing: .5em; padding: var(--esp-3); font-family: inherit;
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-md); color: var(--cor-texto);
        background: var(--cor-superficie); }
      .pin:focus { outline: none; border-color: var(--cor-primaria); }
      .passos { display: flex; gap: 6px; margin: 0 0 var(--esp-4); }
      .passos i { flex: 1; height: 4px; border-radius: 2px; background: var(--cor-borda); }
      .passos i.on { background: var(--cor-primaria); }
      .link { background: none; border: none; padding: 0; margin-top: var(--esp-2); cursor: pointer;
        color: var(--cor-primaria); font-size: var(--fs-sm); font-weight: var(--peso-medio); }
      .link:hover { text-decoration: underline; }
    `;
  }

  template() {
    const titulo = this.ehPerfil ? "Alterar senha" : "Acesso — definir senha";
    const marca = (n) => `<i class="${this._passo >= n ? "on" : ""}"></i>`;
    return `
      <ui-modal open title="${titulo}">
        <div class="passos">${marca(1)}${marca(2)}${marca(3)}</div>
        <div class="campos">${this._conteudo()}</div>
        <div slot="rodape">${this._rodape()}</div>
      </ui-modal>`;
  }

  _conteudo() {
    if (this._passo === 1) {
      const campoEmail = this.ehPerfil
        ? `<p class="sub">Enviaremos um código de confirmação para <span class="destino">${esc(this._email)}</span>.</p>`
        : `<p class="sub">Informe seu e-mail cadastrado. Enviaremos um código para você definir a senha.</p>
           <ui-input id="email" label="E-mail" type="email" value="${esc(this._email)}" autocomplete="username"></ui-input>`;
      return `<div class="erro" id="erro" hidden></div>${campoEmail}`;
    }
    if (this._passo === 2) {
      return `
        <p class="sub">Enviamos um código de 6 caracteres para <span class="destino">${esc(this._email)}</span>. Digite-o abaixo.</p>
        <div class="erro" id="erro" hidden></div>
        <input id="pin" class="pin" maxlength="6" inputmode="text" autocapitalize="characters"
          autocomplete="one-time-code" placeholder="••••••" aria-label="Código">
        <button class="link" id="reenviar" type="button">Reenviar código</button>`;
    }
    return `
      <p class="sub">Crie sua nova senha (mínimo 6 caracteres).</p>
      <div class="erro" id="erro" hidden></div>
      <ui-input id="nova" label="Nova senha" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></ui-input>
      <ui-input id="conf" label="Confirmar nova senha" type="password" autocomplete="new-password"></ui-input>`;
  }

  _rodape() {
    if (this._passo === 1) return `<ui-button id="cancelar" variant="secundario">Cancelar</ui-button><ui-button id="acao">Enviar código</ui-button>`;
    if (this._passo === 2) return `<ui-button id="voltar" variant="secundario">Voltar</ui-button><ui-button id="acao">Confirmar</ui-button>`;
    return `<ui-button id="cancelar" variant="secundario">Cancelar</ui-button><ui-button id="acao">Salvar senha</ui-button>`;
  }

  aoConectar() { this._montado = true; }

  aposRender() {
    this.$("ui-modal").addEventListener("fechar", () => this._cancelar());
    const cancelar = this.$("#cancelar"); if (cancelar) cancelar.addEventListener("click", () => this._cancelar());
    const acao = this.$("#acao");
    if (this._passo === 1) {
      const em = this.$("#email"); if (em) em.addEventListener("enter", () => this._enviarCodigo());
      acao.addEventListener("click", () => this._enviarCodigo());
    } else if (this._passo === 2) {
      const pin = this.$("#pin");
      pin.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });
      pin.addEventListener("keydown", (e) => { if (e.key === "Enter") this._confirmar(); });
      setTimeout(() => pin.focus(), 30);
      this.$("#reenviar").addEventListener("click", () => this._enviarCodigo(true));
      this.$("#voltar").addEventListener("click", () => { this._passo = 1; this.renderizar(); });
      acao.addEventListener("click", () => this._confirmar());
    } else {
      this.$$("ui-input").forEach((i) => i.addEventListener("enter", () => this._salvar()));
      acao.addEventListener("click", () => this._salvar());
    }
  }

  _erro(msg) { const el = this.$("#erro"); if (el) { el.textContent = msg || ""; el.hidden = !msg; } }
  _ocupar(v) { const b = this.$("#acao"); if (b) v ? b.setAttribute("loading", "") : b.removeAttribute("loading"); }

  _cancelar() { this.emitir("fechar"); this.remove(); }

  async _enviarCodigo(reenvio) {
    const email = this.ehPerfil ? this._email : ((this.$("#email") || {}).value || "").trim().toLowerCase();
    const err = validarEmail(email);
    if (err) return this._erro(err);
    this._email = email;
    this._erro("");
    this._ocupar(true);
    try {
      await api.call("auth.solicitarPin", { email });
      if (reenvio) toastInfo("Enviamos um novo código.");
      this._passo = 2; this.renderizar();
    } catch (e) {
      // CONFLITO = cooldown: já há um código válido → segue para digitar.
      if (e && e.code === "CONFLITO") { toastInfo(e.message); this._passo = 2; this.renderizar(); return; }
      this._erro(e.message || "Não foi possível enviar o código.");
      notificarErro(e);
      this._ocupar(false);
    }
  }

  async _confirmar() {
    const pin = ((this.$("#pin") || {}).value || "").trim();
    if (pin.length < 6) return this._erro("Digite os 6 caracteres do código.");
    this._erro("");
    this._ocupar(true);
    try {
      const r = await api.call("auth.confirmarPin", { email: this._email, pin });
      this._resetToken = r.resetToken;
      this._passo = 3; this.renderizar();
    } catch (e) {
      this._erro(e.message || "Código inválido.");
      this._ocupar(false);
    }
  }

  async _salvar() {
    const nova = this.$("#nova").value;
    const conf = this.$("#conf").value;
    const err = senhaMinima(nova) || (nova === conf ? "" : "A confirmação não confere.");
    if (err) return this._erro(err);
    this._erro("");
    this._ocupar(true);
    try {
      const data = await api.call("auth.definirSenha", { resetToken: this._resetToken, novaSenha: nova });
      if (this.ehPerfil) {
        auth.aplicarSessao(data, undefined, false); // troca o token sem re-navegar
        toastSucesso("Senha alterada com sucesso.");
      } else {
        toastSucesso("Senha definida! Bem-vindo(a).");
        auth.aplicarSessao(data, true, true); // login automático → app carrega e navega
      }
      this.emitir("concluido");
      this.remove();
    } catch (e) {
      this._erro(e.message || "Não foi possível salvar a senha.");
      notificarErro(e);
      this._ocupar(false);
    }
  }
}

customElements.define("redefinir-senha", RedefinirSenha);
