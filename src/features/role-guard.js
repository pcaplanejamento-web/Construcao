/**
 * <role-guard> — Mostra/oculta o conteúdo (slot) conforme o papel do usuário.
 *
 * Atributo: role="admin" (exige admin) ou role="usuario" (qualquer autenticado).
 * Princípio nº 7: isto é só UX; a autorização real é server-side.
 */
import { BaseElement } from "../components/base-element.js";
import { auth } from "../core/auth-store.js";
import { bus, EVENTOS } from "../core/event-bus.js";

class RoleGuard extends BaseElement {
  template() {
    return `<slot></slot>`;
  }
  aoConectar() {
    this.atualizar();
    this.aoLimpar(bus.on(EVENTOS.AUTH, () => this.atualizar()));
  }
  atualizar() {
    const precisa = this.getAttribute("role");
    let permitido = auth.estaAutenticado();
    if (precisa === "admin") permitido = auth.ehAdmin();
    this.style.display = permitido ? "" : "none";
  }
}

customElements.define("role-guard", RoleGuard);
