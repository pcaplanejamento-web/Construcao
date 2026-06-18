/**
 * <app-shell> — Layout raiz: <app-header> persistente + <app-sidebar> + <main>
 * outlet onde o roteador renderiza a view ativa.
 *
 * Header e sidebar só aparecem com sessão (somem no login). O outlet é estável
 * (nunca destruído ao alternar auth) — apenas o roteador mexe no seu conteúdo.
 */
import { BaseElement } from "../components/base-element.js";
import { auth } from "../core/auth-store.js";
import { bus, EVENTOS } from "../core/event-bus.js";
import "./app-header.js";
import "./app-sidebar.js";

class AppShell extends BaseElement {
  estilos() {
    return `
      :host { display: flex; flex-direction: column; min-height: 100vh; }
      .corpo { flex: 1; display: flex; align-items: stretch; }
      main { flex: 1; min-width: 0; }
    `;
  }

  template() {
    return `
      <app-header id="hdr" hidden></app-header>
      <div class="corpo">
        <app-sidebar id="sb" hidden></app-sidebar>
        <main id="outlet"></main>
      </div>
    `;
  }

  /** O roteador renderiza as views aqui. */
  get outlet() {
    return this.$("#outlet");
  }

  aoConectar() {
    this.refletirAuth();
    this.aoLimpar(bus.on(EVENTOS.AUTH, () => this.refletirAuth()));

    const hdr = this.$("#hdr");
    const sb = this.$("#sb");
    hdr.addEventListener("toggle-sidebar", () =>
      sb.toggleAttribute("aberto")
    );
    sb.addEventListener("navegou", () => sb.removeAttribute("aberto"));
  }

  refletirAuth() {
    const autenticado = auth.estaAutenticado();
    this.$("#hdr").hidden = !autenticado;
    this.$("#sb").hidden = !autenticado;
    if (!autenticado) this.$("#sb").removeAttribute("aberto");
  }
}

customElements.define("app-shell", AppShell);
