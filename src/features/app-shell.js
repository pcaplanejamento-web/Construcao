/**
 * <app-shell> — Layout raiz: cabeçalho (logo, navegação, usuário, sair) +
 * <main> que serve de "outlet" para o roteador renderizar a view ativa.
 *
 * O cabeçalho some na tela de login (sem sessão). O outlet NUNCA é destruído
 * em re-render do cabeçalho — só o roteador mexe no seu conteúdo.
 */
import { BaseElement } from "../components/base-element.js";
import { auth } from "../core/auth-store.js";
import { bus, EVENTOS } from "../core/event-bus.js";
import "./app-nav.js";

class AppShell extends BaseElement {
  estilos() {
    return `
      :host { display: block; min-height: 100vh; }
      header {
        background: var(--cor-superficie); border-bottom: 1px solid var(--cor-borda);
        position: sticky; top: 0; z-index: var(--z-nav);
      }
      .barra {
        max-width: 1100px; margin: 0 auto; padding: var(--esp-3) var(--esp-4);
        display: flex; align-items: center; gap: var(--esp-5);
      }
      .marca { display: flex; align-items: center; gap: var(--esp-2);
        font-weight: var(--peso-forte); color: var(--cor-primaria); font-size: var(--fs-lg); }
      .marca .logo { font-size: 1.3rem; }
      .cresce { flex: 1; }
      .usuario { display: flex; align-items: center; gap: var(--esp-3); }
      .nome { font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .nome strong { color: var(--cor-texto); }
      .sair {
        border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        color: var(--cor-texto-suave); border-radius: var(--raio-sm);
        padding: 6px 12px; font-size: var(--fs-sm);
      }
      .sair:hover { background: var(--cor-superficie-2); }
      main { display: block; }
      @media (max-width: 640px) {
        .barra { flex-wrap: wrap; gap: var(--esp-3); }
        .nome { display: none; }
      }
    `;
  }

  template() {
    return `<header id="cab" hidden></header><main id="outlet"></main>`;
  }

  /** O roteador renderiza as views aqui. */
  get outlet() {
    return this.$("#outlet");
  }

  aoConectar() {
    this.renderCabecalho();
    this.aoLimpar(bus.on(EVENTOS.AUTH, () => this.renderCabecalho()));
  }

  renderCabecalho() {
    const cab = this.$("#cab");
    if (!auth.estaAutenticado()) {
      cab.hidden = true;
      cab.innerHTML = "";
      return;
    }
    const u = auth.usuario() || {};
    cab.hidden = false;
    cab.innerHTML = `
      <div class="barra">
        <a class="marca" href="#/obras" style="text-decoration:none">
          <span class="logo">🏗️</span> Gestão de Obras
        </a>
        <app-nav></app-nav>
        <span class="cresce"></span>
        <div class="usuario">
          <span class="nome">Olá, <strong>${u.nome || ""}</strong>${
      u.role === "admin" ? " (admin)" : ""
    }</span>
          <button class="sair" id="sair">Sair</button>
        </div>
      </div>
    `;
    cab.querySelector("#sair").addEventListener("click", () => auth.logout());
  }
}

customElements.define("app-shell", AppShell);
