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

  /** Ação opcional: { rotulo, onAcao }. Renderiza um botão (ex.: "Desfazer"). */
  set acao(v) {
    this._acao = v || null;
    if (this.shadowRoot && this.shadowRoot.childElementCount) this.renderizar();
  }
  get acao() {
    return this._acao || null;
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
      .msg { flex: 1; min-width: 0; }
      .acao { margin-left: var(--esp-2); flex: none; border: none; background: none; cursor: pointer;
        color: var(--cor-primaria); font-family: inherit; font-weight: var(--peso-semi);
        font-size: var(--fs-sm); padding: 4px 8px; border-radius: var(--raio-sm); white-space: nowrap; }
      .acao:hover { background: var(--cor-primaria-suave); }
      .acao:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
    `;
  }

  template() {
    const tipo = this.getAttribute("tipo") || "info";
    const msg = this.getAttribute("message") || "";
    const icones = { sucesso: "sucesso", erro: "aviso", aviso: "aviso", info: "info" };
    const rotulo = this._acao && this._acao.rotulo
      ? String(this._acao.rotulo).replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "";
    return `
      <div class="toast ${tipo}" role="status">
        <span class="icone"><ui-icon name="${icones[tipo] || "info"}" size="18"></ui-icon></span>
        <span class="msg">${msg}</span>
        ${rotulo ? `<button class="acao" type="button">${rotulo}</button>` : ""}
      </div>
    `;
  }

  aposRender() {
    const b = this.$(".acao");
    if (b) {
      b.addEventListener("click", () => {
        const fn = this._acao && this._acao.onAcao;
        this.emitir("dispensar");
        if (fn) fn();
      });
    }
  }
}
customElements.define("ui-toast", UiToast);

class ToastHost extends BaseElement {
  estilos() {
    return `
      :host {
        position: fixed;
        /* Respeita as safe areas (notch/Dynamic Island e cantos arredondados): no
           PWA em tela cheia os toasts não escorregam para baixo da ilha nem para
           fora da borda direita. */
        top: calc(var(--esp-4) + env(safe-area-inset-top));
        right: calc(var(--esp-4) + env(safe-area-inset-right));
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
      bus.on(EVENTOS.TOAST, (detalhe) => this.mostrar(detalhe || {}))
    );
  }
  mostrar({ tipo, mensagem, acao, duracao }) {
    const pilha = this.$("#pilha");
    const toast = document.createElement("ui-toast");
    toast.setAttribute("tipo", tipo || "info");
    toast.setAttribute("message", mensagem || "");
    if (acao) toast.acao = acao;
    pilha.appendChild(toast);
    const sumir = () => {
      toast.style.transition = "opacity .2s";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 220);
    };
    const timer = setTimeout(sumir, duracao || 3800);
    // Clique em "Desfazer" (ou outra ação) fecha o toast na hora.
    toast.addEventListener("dispensar", () => { clearTimeout(timer); sumir(); });
  }
}
customElements.define("toast-host", ToastHost);
