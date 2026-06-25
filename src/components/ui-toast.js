/**
 * <ui-toast> + <toast-host> — Sistema de notificações.
 *
 * <toast-host> é um singleton montado no index.html. Ele ouve EVENTOS.TOAST no
 * barramento e cria <ui-toast> que se auto-removem. Princípio nº 12: todo erro
 * vira um toast legível.
 *
 * Disparo (de qualquer lugar): import { toastSucesso } from core/event-bus.js
 */
import { BaseElement } from "./base-element.js";
import { bus, EVENTOS } from "../core/event-bus.js";
import "./ui-icon.js";

class UiToast extends BaseElement {
  static get observedAttributes() {
    return ["tipo", "message"];
  }

  estilos() {
    return `
      :host { display: block; }
      .toast {
        display: flex; align-items: center; gap: var(--esp-2);
        padding: var(--esp-3) var(--esp-4); border-radius: var(--raio-md);
        box-shadow: var(--vidro-realce), var(--sombra-md); color: var(--cor-texto);
        background: var(--vidro-fundo-forte);
        -webkit-backdrop-filter: var(--vidro-blur); backdrop-filter: var(--vidro-blur);
        border: 1px solid var(--vidro-borda); border-left: 4px solid var(--cor-info);
        min-width: 240px; max-width: 380px; animation: entrar .16s ease;
      }
      @keyframes entrar { from { transform: translateX(12px); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
      .sucesso { border-left-color: var(--cor-sucesso); }
      .erro { border-left-color: var(--cor-erro); }
      .aviso { border-left-color: var(--cor-aviso); }
      .info { border-left-color: var(--cor-info); }
      .icone { font-weight: var(--peso-forte); }
      .sucesso .icone { color: var(--cor-sucesso); }
      .erro .icone { color: var(--cor-erro); }
      .aviso .icone { color: var(--cor-aviso); }
      .info .icone { color: var(--cor-info); }
    `;
  }

  template() {
    const tipo = this.getAttribute("tipo") || "info";
    const msg = this.getAttribute("message") || "";
    const icones = { sucesso: "sucesso", erro: "aviso", aviso: "aviso", info: "info" };
    return `
      <div class="toast ${tipo}" role="status">
        <span class="icone"><ui-icon name="${icones[tipo] || "info"}" size="18"></ui-icon></span>
        <span>${msg}</span>
      </div>
    `;
  }
}
customElements.define("ui-toast", UiToast);

class ToastHost extends BaseElement {
  estilos() {
    return `
      :host {
        position: fixed; top: var(--esp-4); right: var(--esp-4);
        display: flex; flex-direction: column; gap: var(--esp-2);
        z-index: var(--z-toast);
      }
    `;
  }
  template() {
    return `<div id="pilha"></div>`;
  }
  aoConectar() {
    this.aoLimpar(
      bus.on(EVENTOS.TOAST, ({ tipo, mensagem }) => this.mostrar(tipo, mensagem))
    );
  }
  mostrar(tipo, mensagem) {
    const pilha = this.$("#pilha");
    const toast = document.createElement("ui-toast");
    toast.setAttribute("tipo", tipo || "info");
    toast.setAttribute("message", mensagem || "");
    pilha.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = "opacity .2s";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 220);
    }, 3800);
  }
}
customElements.define("toast-host", ToastHost);
