/**
 * app.js — Ponto de entrada e composition root.
 *
 * Boot cache-first: restaura sessão → carrega o estado (snapshot único) com
 * <app-loader> no primeiro acesso (ou instantâneo via cache) → roteia. Mantém
 * o cache fresco com refresh em 2º plano (foco da aba + intervalo). Único lugar
 * que conhece o mapa de rotas.
 */
import { auth } from "./core/auth-store.js";
import { dataStore } from "./core/data-store.js";
import { criarRouter } from "./core/router.js";
import { bus, EVENTOS, notificarErro } from "./core/event-bus.js";
import { CONFIG } from "./core/config.js";
import { tema } from "./core/theme.js";

// Notificações (define <toast-host>, usado no index.html).
import "./components/ui-toast.js";

// Shell, loader e views (cada módulo se auto-registra como Custom Element).
import "./features/app-shell.js";
import "./features/app-loader.js";
import "./features/auth/login-view.js";
import "./features/obras/obras-list-view.js";
import "./features/obras/obra-detail-view.js";
import "./features/itens/itens-view.js";
import "./features/itens/item-detail-view.js";
import "./features/fornecedores/fornecedores-view.js";
import "./features/fornecedores/fornecedor-detail-view.js";
import "./features/contatos/contatos-view.js";
import "./features/contatos/contato-detail-view.js";
import "./features/cotacoes/cotacoes-view.js";
import "./features/cotacoes/cotacao-detail-view.js";
import "./features/orcamentos/orcamento-detail-view.js";
import "./features/equipes/equipe-detail-view.js";
import "./features/perfil/perfil-view.js";
import "./features/admin/admin-view.js";
import "./features/publico/publico-view.js";

let loaderEl = null;
function mostrarLoader() {
  if (loaderEl) return;
  loaderEl = document.createElement("app-loader");
  document.body.appendChild(loaderEl);
}
function esconderLoader() {
  if (loaderEl) {
    loaderEl.remove();
    loaderEl = null;
  }
}

/**
 * Garante o estado carregado.
 * @param {boolean} forcar  true (login) força snapshot com loader; false (boot)
 *                          usa cache instantâneo + refresh em 2º plano.
 */
async function carregarDados(forcar) {
  if (!forcar && dataStore.restaurarCache()) {
    dataStore.atualizarEmSegundoPlano();
    return;
  }
  mostrarLoader();
  try {
    await dataStore.inicializar();
  } catch (e) {
    notificarErro(e);
  } finally {
    esconderLoader();
  }
}

async function iniciar() {
  tema.init(); // aplica tema salvo + reage a mudanças do SO
  await customElements.whenDefined("app-shell");
  const shell = document.querySelector("app-shell");
  const outlet = shell.outlet;

  const router = criarRouter(outlet);
  router
    .adicionar("#/publico/:token", "publico-view", {}) // pública: sem login, só leitura
    .adicionar("#/login", "login-view", { somentePublico: true })
    .adicionar("#/obras", "obras-list-view", { protegida: true })
    .adicionar("#/obras/:id", "obra-detail-view", { protegida: true })
    .adicionar("#/itens", "itens-view", { protegida: true })
    .adicionar("#/itens/:id", "item-detail-view", { protegida: true })
    .adicionar("#/fornecedores", "fornecedores-view", { protegida: true })
    .adicionar("#/fornecedores/:id", "fornecedor-detail-view", { protegida: true })
    .adicionar("#/contatos", "contatos-view", { protegida: true })
    .adicionar("#/contatos/:id", "contato-detail-view", { protegida: true })
    .adicionar("#/cotacoes", "cotacoes-view", { protegida: true })
    .adicionar("#/cotacoes/:id", "cotacao-detail-view", { protegida: true })
    .adicionar("#/orcamentos/:id", "orcamento-detail-view", { protegida: true })
    .adicionar("#/equipes/:id", "equipe-detail-view", { protegida: true })
    .adicionar("#/perfil", "perfil-view", { protegida: true })
    .adicionar("#/admin", "admin-view", { protegida: true, admin: true });

  await auth.restaurar();
  if (auth.estaAutenticado()) await carregarDados(false);

  bus.on(EVENTOS.AUTH, async ({ autenticado }) => {
    if (autenticado) {
      await carregarDados(true);
      router.navegar(CONFIG.ROTA_INICIAL);
    } else {
      dataStore.limparCache();
      router.navegar("#/login");
    }
  });

  // Refresh em 2º plano: ao focar a aba e em intervalo lento.
  window.addEventListener("focus", () => {
    if (auth.estaAutenticado()) dataStore.atualizarEmSegundoPlano();
  });
  setInterval(() => {
    if (auth.estaAutenticado()) dataStore.atualizarEmSegundoPlano();
  }, 60000);

  router.iniciar();
}

iniciar();
