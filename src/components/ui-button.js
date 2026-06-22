/**
 * <ui-button> — Botão reutilizável (primitivo, sem regra de negócio).
 *
 * Atributos:
 *   variant: "primario" | "secundario" | "tonal" | "perigo" | "perigo-contorno"
 *            | "fantasma" (padrão primario)
 *   loading: booleano (mostra spinner e desabilita)
 *   disabled: booleano
 *   tamanho: "sm" | "md" (padrão md)
 *   full: booleano (largura total)
 * Conteúdo: via <slot> (texto/ícone do botão).
 * Evento: "click" nativo (composed, borbulha).
 */
import { BaseElement } from "./base-element.js";

class UiButton extends BaseElement {
  static get observedAttributes() {
    return ["variant", "loading", "disabled", "tamanho", "full"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  estilos() {
    return `
      :host { display: inline-block; }
      :host([full]) { display: block; }
      button {
        font-weight: var(--peso-semi);
        border: 1px solid transparent;
        border-radius: var(--raio-md);
        padding: 0 var(--esp-4);
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--esp-2);
        width: 100%;
        transition: var(--transicao);
        white-space: nowrap;
      }
      button:disabled { opacity: .6; cursor: not-allowed; }
      :host([tamanho="sm"]) button { height: 34px; font-size: var(--fs-sm); padding: 0 var(--esp-3); }

      .primario { background: var(--grad-primaria); color: #fff;
        box-shadow: 0 8px 18px -10px rgba(5, 150, 105, .6); }
      .primario:not(:disabled):hover { filter: brightness(1.04); transform: translateY(-1px); }
      .secundario { background: var(--cor-superficie); color: var(--cor-texto);
        border-color: var(--cor-borda-forte); box-shadow: var(--sombra-sm); }
      .secundario:not(:disabled):hover { background: var(--cor-superficie-2); transform: translateY(-1px); }
      /* tonal: ação suave (ex.: Editar) — fundo verde-claro + texto verde-escuro */
      .tonal { background: var(--cor-primaria-suave); color: var(--cor-primaria-escura); }
      .tonal:not(:disabled):hover { filter: brightness(.97); transform: translateY(-1px); }
      .perigo { background: var(--cor-erro); color: #fff; }
      .perigo:not(:disabled):hover { filter: brightness(.95); }
      /* perigo-contorno: destrutivo discreto (ex.: ícone excluir) — outline vermelho */
      .perigo-contorno { background: var(--cor-superficie); color: var(--cor-erro);
        border-color: var(--cor-erro-suave); }
      .perigo-contorno:not(:disabled):hover { background: var(--cor-erro-suave); }
      .fantasma { background: transparent; color: var(--cor-primaria); }
      .fantasma:not(:disabled):hover { background: var(--cor-primaria-suave); }

      .spinner {
        width: 16px; height: 16px; border-radius: 50%;
        border: 2px solid currentColor; border-top-color: transparent;
        animation: girar .7s linear infinite;
      }
      @keyframes girar { to { transform: rotate(360deg); } }
    `;
  }

  template() {
    const variant = this.getAttribute("variant") || "primario";
    const carregando = this.hasAttribute("loading");
    const desabilitado = this.hasAttribute("disabled") || carregando;
    return `
      <button class="${variant}" ${desabilitado ? "disabled" : ""} part="button">
        ${carregando ? '<span class="spinner"></span>' : ""}
        <slot></slot>
      </button>
    `;
  }
}

customElements.define("ui-button", UiButton);
