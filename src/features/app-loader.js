/**
 * <app-loader> — Tela de carregamento inicial (overlay full-screen).
 * Exibida enquanto o snapshot é carregado no primeiro acesso. Reusa <ui-spinner>.
 * Atributo: texto (mensagem opcional).
 */
import { BaseElement } from "../components/base-element.js";
import "../components/ui-spinner.js";

class AppLoader extends BaseElement {
  estilos() {
    return `
      :host { position: fixed; inset: 0; z-index: var(--z-modal);
        display: flex; align-items: center; justify-content: center;
        background: var(--cor-fundo); }
      .box { text-align: center; display: flex; flex-direction: column;
        align-items: center; gap: var(--esp-4); animation: surgir .2s ease; }
      @keyframes surgir { from { opacity: 0; } }
      .logo { font-size: 3rem; }
      h1 { font-size: var(--fs-xl); font-weight: var(--peso-forte); color: var(--cor-primaria); }
      p { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
    `;
  }
  template() {
    const texto = this.getAttribute("texto") || "Carregando seus dados...";
    return `
      <div class="box">
        <div class="logo">🏗️</div>
        <h1>Gestão de Obras</h1>
        <ui-spinner></ui-spinner>
        <p>${texto}</p>
      </div>
    `;
  }
}

customElements.define("app-loader", AppLoader);
