/**
 * <ui-modal> — Diálogo overlay reutilizável.
 *
 * Atributos: open (booleano), title, largo (booleano — diálogo mais largo, ex.: e-mail)
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

const SEL_FOCAVEL = 'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]';

/** Elemento realmente focado, atravessando shadow roots aninhados. */
function focoProfundo() {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

/** `el` está dentro de `host` (subindo pela árvore, cruzando shadow boundaries)? */
function dentroDe(host, el) {
  let n = el;
  while (n) {
    if (n === host) return true;
    n = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode;
  }
  return false;
}

function visivel(el) {
  return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length));
}

class UiModal extends BaseElement {
  static get observedAttributes() {
    return ["open", "title", "largo"];
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
        -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: var(--z-modal);
        /* área segura iOS: o diálogo nunca encosta no notch/home indicator. */
        padding: max(var(--esp-4), env(safe-area-inset-top)) max(var(--esp-4), env(safe-area-inset-right))
                 max(var(--esp-4), env(safe-area-inset-bottom)) max(var(--esp-4), env(safe-area-inset-left));
      }
      .dialogo {
        background: var(--vidro-fundo-forte);
        -webkit-backdrop-filter: var(--vidro-blur); backdrop-filter: var(--vidro-blur);
        border: 1px solid var(--vidro-borda); border-radius: var(--raio-lg);
        box-shadow: var(--vidro-realce), var(--sombra-lg); width: 100%; max-width: 520px;
        max-height: 90dvh; display: flex; flex-direction: column;
        overflow: hidden; /* nada vaza na horizontal */
        animation: surgir .14s ease;
      }
      :host([largo]) .dialogo { max-width: 840px; }
      @keyframes surgir { from { transform: translateY(8px); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .dialogo { animation: none; } }
      header {
        display: flex; align-items: center; justify-content: space-between;
        padding: var(--esp-4) var(--esp-5); border-bottom: 1px solid var(--cor-borda);
      }
      h2 { font-size: var(--fs-lg); font-weight: var(--peso-semi); }
      .fechar { background: none; border: none; font-size: 1.4rem; line-height: 1;
        color: var(--cor-texto-suave); padding: var(--esp-1); cursor: pointer; border-radius: var(--raio-sm); }
      .fechar:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--cor-primaria-suave); color: var(--cor-texto); }
      .dialogo:focus { outline: none; }
      /* Banner flutuante: rola só na VERTICAL (sem deriva horizontal). */
      .corpo { padding: var(--esp-5); overflow-y: auto; overflow-x: hidden; touch-action: pan-y; }
      footer { padding: var(--esp-4) var(--esp-5); border-top: 1px solid var(--cor-borda);
        display: flex; justify-content: flex-end; gap: var(--esp-3); }
      footer:empty { display: none; }
    `;
  }

  template() {
    const titulo = this.getAttribute("title") || "";
    return `
      <div class="backdrop" part="backdrop">
        <div class="dialogo" role="dialog" aria-modal="true" tabindex="-1">
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

    // Focus-trap: prende o Tab dentro do diálogo e devolve o foco ao fechar.
    // Seguro p/ modais EMPILHADOS: só age quando o foco já está DENTRO deste
    // modal, então um modal de fundo nunca rouba o foco de outro por cima.
    if (this.hasAttribute("open") && !this._trapOn) this._ativarTrap();
  }

  /** Lista de focáveis em ORDEM (X do header + conteúdo/rodapé, atravessando shadows). */
  _focaveis() {
    const out = [];
    const x = this.$(".fechar");
    if (x && visivel(x)) out.push(x);
    const percorrer = (no) => {
      Array.from(no.children || []).forEach((el) => {
        if (el.matches && el.matches(SEL_FOCAVEL) && el.tabIndex >= 0 && !el.disabled && visivel(el)) out.push(el);
        if (el.shadowRoot) percorrer(el.shadowRoot);
        percorrer(el);
      });
    };
    percorrer(this); // conteúdo distribuído (light DOM) — pierce nos custom elements
    return out;
  }

  _ativarTrap() {
    this._trapOn = true;
    this._focoAnterior = focoProfundo();
    // Foco inicial no diálogo (leitor de tela anuncia; Tab segue p/ o 1º campo).
    const dlg = this.$(".dialogo");
    if (dlg && dlg.focus) { try { dlg.focus({ preventScroll: true }); } catch (_) { dlg.focus(); } }

    this._trapKey = (e) => {
      if (e.key !== "Tab" || !this.hasAttribute("open")) return;
      if (!dentroDe(this, focoProfundo())) return; // foco noutro modal/diálogo → não mexe
      const f = this._focaveis();
      if (!f.length) { e.preventDefault(); return; }
      const atual = focoProfundo();
      const primeiro = f[0];
      const ultimo = f[f.length - 1];
      if (e.shiftKey) {
        if (atual === primeiro || f.indexOf(atual) === -1) { e.preventDefault(); ultimo.focus(); }
      } else if (atual === ultimo || f.indexOf(atual) === -1) {
        e.preventDefault(); primeiro.focus();
      }
    };
    document.addEventListener("keydown", this._trapKey, true);
    this.aoLimpar(() => {
      document.removeEventListener("keydown", this._trapKey, true);
      const alvo = this._focoAnterior;
      if (alvo && alvo.focus && document.contains(alvo)) { try { alvo.focus({ preventScroll: true }); } catch (_) { alvo.focus(); } }
    });
  }
}

customElements.define("ui-modal", UiModal);
