/**
 * app.js — Ponto de entrada e composition root da aplicação.
 *
 * Responsabilidades:
 *  - Registrar (via import) os componentes raiz e as views.
 *  - Criar o roteador apontando para o outlet do <app-shell>.
 *  - Restaurar a sessão antes de resolver a primeira rota.
 *  - Re-resolver a rota quando a autenticação muda (login/logout).
 *
 * Princípio de execução: este é o ÚNICO lugar que conhece o mapa de rotas.
 */
import { auth } from "./core/auth-store.js";
import { criarRouter } from "./core/router.js";
import { bus, EVENTOS } from "./core/event-bus.js";
import { CONFIG } from "./core/config.js";

// Notificações (define <toast-host>, usado no index.html).
import "./components/ui-toast.js";

// Shell e views (cada módulo se auto-registra como Custom Element).
import "./features/app-shell.js";
import "./features/auth/login-view.js";
import "./features/obras/obras-list-view.js";
import "./features/obras/obra-detail-view.js";
import "./features/admin/admin-view.js";

async function iniciar() {
  await customElements.whenDefined("app-shell");
  const shell = document.querySelector("app-shell");
  const outlet = shell.outlet;

  const router = criarRouter(outlet);
  router
    .adicionar("#/login", "login-view", { somentePublico: true })
    .adicionar("#/obras", "obras-list-view", { protegida: true })
    .adicionar("#/obras/:id", "obra-detail-view", { protegida: true })
    .adicionar("#/admin", "admin-view", { protegida: true, admin: true });

  // Restaura/valida a sessão (auth.me) antes de decidir a rota inicial.
  await auth.restaurar();

  // Navega conforme login/logout.
  bus.on(EVENTOS.AUTH, ({ autenticado }) => {
    router.navegar(autenticado ? CONFIG.ROTA_INICIAL : "#/login");
  });

  router.iniciar();
}

iniciar();
