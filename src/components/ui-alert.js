/**
 * <ui-alert> — Mensagem padrão de alerta/erro (inline). Componente PADRÃO para
 * exibir mensagens de erro/aviso/info/sucesso dentro de formulários e telas.
 *
 * Atributos: tipo (erro|aviso|info|sucesso; padrão erro), message (texto).
 * Propriedade: .mensagem (define/limpa o `message`). Some quando sem mensagem.
 *
 * Uso: <ui-alert id="erro"></ui-alert>  →  el.mensagem = "..."  (mostra) / "" (esconde)
 */
import { BaseElement } from "./base-element.js";
import "./ui-icon.js";

const MAPA = {
  erro: { cor: "var(--cor-erro)", icone: "aviso" },
  aviso: { cor: "var(--cor-aviso)", icone: "aviso" },
  info: { cor: "var(--cor-info)", icone: "info" },
  sucesso: { cor: "var(--cor-sucesso)", icone: "sucesso" },
};

class UiAlert extends BaseElement {
  static get observedAttributes() {
    return ["tipo", "message"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  set mensagem(v) {
    if (v) this.setAttribute("message", v);
    else this.removeAttribute("message");
  }
  get mensagem() {
    return this.getAttribute("message") || "";
  }

  estilos() {
    return `
      :host { display: none; }
      :host([message]) { display: block; }
      .alerta { display: flex; gap: var(--esp-2); align-items: flex-start;
        padding: var(--esp-3) var(--esp-4); border-radius: var(--raio-sm);
        font-size: var(--fs-sm); border: 1px solid; line-height: 1.35; }
      ui-icon { flex: none; margin-top: 1px; }
      .msg { min-width: 0; }
    `;
  }

  template() {
    const m = MAPA[this.getAttribute("tipo")] || MAPA.erro;
    const msg = this.getAttribute("message") || "";
    return `
      <div class="alerta" role="alert" style="
        color: ${m.cor};
        background: color-mix(in srgb, ${m.cor} 12%, var(--cor-superficie));
        border-color: color-mix(in srgb, ${m.cor} 35%, transparent);">
        <ui-icon name="${m.icone}" size="18"></ui-icon>
        <span class="msg">${msg}</span>
      </div>
    `;
  }
}

customElements.define("ui-alert", UiAlert);
