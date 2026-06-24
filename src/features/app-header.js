/**
 * <app-header> — Cabeçalho persistente (sticky) no topo.
 *
 * Esquerda: logo + marca "Dattaobra" + botão menu (emite "toggle-sidebar"),
 *   com gaps iguais (logo↔texto == texto↔menu); o logo alinha com a coluna de
 *   ícones da sidebar e a largura da sidebar é igualada a este cluster, então o
 *   menu encosta no limite direito da sidebar.
 * Direita: alternador de tema (sol/lua), chip do usuário → /perfil, Sair.
 * Reage a EVENTOS.AUTH (usuário) e EVENTOS.TEMA (ícone do alternador).
 */
import { BaseElement } from "../components/base-element.js";
import { auth } from "../core/auth-store.js";
import { tema } from "../core/theme.js";
import { bus, EVENTOS } from "../core/event-bus.js";
import { avatarHtml } from "./shared/avatar.js";
import "../components/ui-icon.js";

class AppHeader extends BaseElement {
  estilos() {
    return `
      :host {
        position: sticky; top: 0; z-index: var(--z-nav);
        display: block; background: var(--cor-superficie);
        border-bottom: 1px solid var(--cor-borda);
        /* iOS: área segura — o header desce abaixo do status bar translúcido e
           respeita o notch lateral (env() = 0 em telas sem recortes). */
        padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left);
      }
      /* Só o ícone de menu à esquerda (a logo/marca vive no MENU lateral). */
      .barra { display: flex; align-items: center; gap: var(--esp-3);
        height: 70px; padding: 0 var(--esp-5) 0 var(--esp-4); }
      /* Marca (logo + "Dattaobra") só no modo SOMENTE LEITURA (público, sem sidebar). */
      .marca-bloco { display: flex; align-items: center; gap: var(--esp-2); flex: none; }
      .menu-btn { display: inline-flex; align-items: center; justify-content: center;
        background: none; border: none; color: var(--cor-texto-suave);
        padding: 8px; border-radius: var(--raio-sm); }
      .menu-btn:hover { background: var(--cor-superficie-2); }
      .marca { display: flex; align-items: center; gap: var(--esp-2);
        font-family: var(--fonte-titulo); letter-spacing: -.02em;
        font-weight: var(--peso-forte); color: var(--cor-primaria); font-size: var(--fs-lg);
        text-decoration: none; }
      .marca img { height: 32px; width: auto; display: block; }
      .cresce { flex: 1; }
      .icone-btn { display: inline-flex; align-items: center; justify-content: center;
        width: 40px; height: 40px; border: 1px solid var(--cor-borda-forte);
        background: var(--cor-superficie); color: var(--cor-texto-suave);
        border-radius: var(--raio-md); }
      .icone-btn:hover { background: var(--cor-superficie-2); }
      .chip { display: flex; align-items: center; gap: var(--esp-2);
        text-decoration: none; color: var(--cor-texto); padding: 4px 10px 4px 4px;
        border: 1px solid var(--cor-borda); border-radius: var(--raio-completo);
        transition: var(--transicao); }
      .chip:hover { background: var(--cor-superficie-2); text-decoration: none; }
      .nome { font-size: var(--fs-sm); font-weight: var(--peso-medio); }
      .papel { font-size: var(--fs-xs); color: var(--cor-texto-fraco); }
      .sair { border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        color: var(--cor-texto-suave); border-radius: var(--raio-sm);
        padding: 6px 12px; font-size: var(--fs-sm); }
      .sair:hover { background: var(--cor-superficie-2); }
      .somente-leitura { display: inline-flex; align-items: center; gap: 6px;
        font-size: var(--fs-sm); color: var(--cor-texto-suave);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-completo);
        padding: 6px 14px; margin-right: var(--esp-5); }
      /* MOBILE: header compacto e sem estouro — só logo + tema + avatar + Sair.
         Wordmark e nome do usuário escondidos; alvos de toque ≥ 44px. */
      @media (max-width: 820px) {
        .barra { height: 56px; gap: var(--esp-2); padding-right: var(--esp-3); }
        .marca-bloco { width: auto; padding-left: var(--esp-3); gap: var(--esp-1); }
        .wordmark { display: none; }
        .chip-txt { display: none; }
        .chip { padding: 4px; }
        .menu-btn { padding: 10px; }
        .icone-btn { width: 44px; height: 44px; }
        .sair { padding: 8px 12px; }
        .somente-leitura { margin-right: var(--esp-3); }
      }
    `;
  }

  template() {
    const logoImg = `<img src="src/assets/dattaobra.png" alt="" onerror="this.style.display='none'" />`;
    // Modo SOMENTE LEITURA (link público, sem sessão): mesma marca, sem
    // menu/usuário/sair — apenas o selo "Somente leitura".
    if (!auth.estaAutenticado()) {
      return `
        <div class="barra">
          <div class="marca-bloco"><span class="marca">${logoImg} <span class="wordmark">Dattaobra</span></span></div>
          <span class="cresce"></span>
          <span class="somente-leitura"><ui-icon name="olho" size="14"></ui-icon> Somente leitura</span>
        </div>
      `;
    }
    const u = auth.usuario() || {};
    const iconeTema = tema.efetivo() === "escuro" ? "sol" : "lua";
    return `
      <div class="barra">
        <button class="menu-btn" id="menu" aria-label="Abrir menu"><ui-icon name="menu"></ui-icon></button>
        <span class="cresce"></span>
        <button class="icone-btn" id="tema" aria-label="Alternar tema claro/escuro"><ui-icon name="${iconeTema}"></ui-icon></button>
        <a class="chip" href="/perfil" title="Meu perfil">
          ${avatarHtml(u.nome, 32)}
          <span class="chip-txt">
            <span class="nome">${u.nome || ""}</span>
            <span class="papel">${u.role === "admin" ? "Administrador" : "Usuário"}</span>
          </span>
        </a>
        <button class="sair" id="sair">Sair</button>
      </div>
    `;
  }

  aoConectar() {
    this.aoLimpar(bus.on(EVENTOS.AUTH, () => this.renderizar()));
    this.aoLimpar(bus.on(EVENTOS.TEMA, () => this.renderizar()));
  }

  aposRender() {
    // No modo somente-leitura esses controles não existem — guardas evitam erro.
    const menu = this.$("#menu");
    if (menu) menu.addEventListener("click", () => this.emitir("toggle-sidebar"));
    const btnTema = this.$("#tema");
    if (btnTema) btnTema.addEventListener("click", () => tema.alternar());
    const btnSair = this.$("#sair");
    if (btnSair) btnSair.addEventListener("click", () => auth.logout());
  }
}

customElements.define("app-header", AppHeader);
