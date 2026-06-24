/**
 * <ui-modal> — Diálogo overlay reutilizável.
 *
 * Atributos: open (booleano), title
 * Slots: default (corpo) e name="rodape" (ações)
 * Eventos: "fechar" (X, backdrop ou Esc).
 *
 * Uso:
 *   <ui-modal title="Nova obra" open>
 *     ...corpo...
 *     <div slot="rodape"><ui-button>Salvar</ui-button></div>
 *   </ui-modal>
 */
import { BaseElement } from "./base-element.js";

class UiModal extends BaseElement {
  static get observedAttributes() {
    return ["open", "title"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  estilos() {
    return `
      :host { display: none; }
      :host([open]) { display: block; }
      .backdrop {
        position: fixed; inset: 0; background: var(--cor-overlay);
        display: flex; align-items: center; justify-content: center;
        z-index: var(--z-modal);
        /* área segura iOS: o diálogo nunca encosta no notch/home indicator. */
        padding: max(var(--esp-4), env(safe-area-inset-top)) max(var(--esp-4), env(safe-area-inset-right))
                 max(var(--esp-4), env(safe-area-inset-bottom)) max(var(--esp-4), env(safe-area-inset-left));
      }
      .dialogo {
        background: var(--cor-superficie); border-radius: var(--raio-lg);
        box-shadow: var(--sombra-lg); width: 100%; max-width: 520px;
        max-height: 90dvh; display: flex; flex-direction: column;
        animation: surgir .14s ease;
      }
      @keyframes surgir { from { transform: translateY(8px); opacity: 0; } }
      header {
        display: flex; align-items: center; justify-content: space-between;
        padding: var(--esp-4) var(--esp-5); border-bottom: 1px solid var(--cor-borda);
      }
      h2 { font-size: var(--fs-lg); font-weight: var(--peso-semi); }
      .fechar { background: none; border: none; font-size: 1.4rem; line-height: 1;
        color: var(--cor-texto-suave); padding: var(--esp-1); }
      .corpo { padding: var(--esp-5); overflow: auto; }
      footer { padding: var(--esp-4) var(--esp-5); border-top: 1px solid var(--cor-borda);
        display: flex; justify-content: flex-end; gap: var(--esp-3); }
      footer:empty { display: none; }
    `;
  }

  template() {
    const titulo = this.getAttribute("title") || "";
    return `
      <div class="backdrop" part="backdrop">
        <div class="dialogo" role="dialog" aria-modal="true">
          <header>
            <h2>${titulo}</h2>
            <button class="fechar" aria-label="Fechar">&times;</button>
          </header>
          <div class="corpo"><slot></slot></div>
          <footer><slot name="rodape"></slot></footer>
        </div>
      </div>
    `;
  }

  aposRender() {
    const fechar = () => this.emitir("fechar");
    this.$(".fechar").addEventListener("click", fechar);
    this.$(".backdrop").addEventListener("click", (e) => {
      if (e.target === this.$(".backdrop")) fechar();
    });
    // Esc fecha (registrado no documento; limpo no disconnect).
    if (!this._escHandler) {
      this._escHandler = (e) => {
        if (e.key === "Escape" && this.hasAttribute("open")) fechar();
      };
      document.addEventListener("keydown", this._escHandler);
      this.aoLimpar(() =>
        document.removeEventListener("keydown", this._escHandler)
      );
    }
    // Navegar (trocar de rota) fecha o modal — comportamento comum de SPA: um link
    // interno (ex.: "abrir página do item") não deixa banners flutuantes sobrepostos.
    if (!this._rotaHandler) {
      this._rotaHandler = () => {
        if (this.hasAttribute("open")) fechar();
      };
      window.addEventListener("rotamudou", this._rotaHandler);
      this.aoLimpar(() => window.removeEventListener("rotamudou", this._rotaHandler));
    }
  }
}

customElements.define("ui-modal", UiModal);
