/**
 * <app-nav> — Navegação principal. Itens admin só aparecem para admins
 * (via <role-guard>). Marca o item ativo conforme o hash atual.
 */
import { BaseElement } from "../components/base-element.js";
import "./role-guard.js";

class AppNav extends BaseElement {
  estilos() {
    return `
      nav { display: flex; gap: var(--esp-1); align-items: center; }
      a {
        color: var(--cor-texto-suave); text-decoration: none;
        padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm);
        font-weight: var(--peso-medio); font-size: var(--fs-sm);
      }
      a:hover { background: var(--cor-superficie-2); text-decoration: none; }
      a.ativo { color: var(--cor-primaria); background: var(--cor-primaria-suave); }
      role-guard { display: contents; }
    `;
  }

  template() {
    return `
      <nav>
        <a href="#/obras" data-rota="#/obras">Minhas obras</a>
        <a href="#/categorias" data-rota="#/categorias">Classificações</a>
        <role-guard role="admin">
          <a href="#/admin" data-rota="#/admin">Administração</a>
        </role-guard>
      </nav>
    `;
  }

  aoConectar() {
    this._onHash = () => this.marcarAtivo();
    window.addEventListener("hashchange", this._onHash);
    this.aoLimpar(() => window.removeEventListener("hashchange", this._onHash));
    this.marcarAtivo();
  }

  marcarAtivo() {
    const hash = location.hash || "";
    this.$$("a").forEach((a) => {
      const rota = a.dataset.rota;
      a.classList.toggle("ativo", hash === rota || hash.startsWith(rota + "/"));
    });
  }
}

customElements.define("app-nav", AppNav);
