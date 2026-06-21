/**
 * <app-header> — Cabeçalho persistente (sticky) no topo.
 *
 * Esquerda: logo + marca "Dattaobra" + botão menu (emite "toggle-sidebar"),
 *   com gaps iguais (logo↔texto == texto↔menu); o logo alinha com a coluna de
 *   ícones da sidebar e a largura da sidebar é igualada a este cluster, então o
 *   menu encosta no limite direito da sidebar.
 * Direita: alternador de tema (sol/lua), chip do usuário → #/perfil, Sair.
 * Reage a EVENTOS.AUTH (usuário) e EVENTOS.TEMA (ícone do alternador).
 */
import { BaseElement } from "../components/base-element.js";
import { auth } from "../core/auth-store.js";
import { tema } from "../core/theme.js";
import { bus, EVENTOS } from "../core/event-bus.js";
import "../components/ui-icon.js";

function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

class AppHeader extends BaseElement {
  estilos() {
    return `
      :host {
        position: sticky; top: 0; z-index: var(--z-nav);
        display: block; background: var(--cor-superficie);
        border-bottom: 1px solid var(--cor-borda);
      }
      .barra { display: flex; align-items: center; gap: var(--esp-3);
        padding: var(--esp-3) var(--esp-5) var(--esp-3) 0; } /* esq.=0: o marca-bloco controla o gutter (alinha com a sidebar) */
      /* Cluster logo+marca+menu com gaps IGUAIS (--esp-2 entre logo/texto e
         texto/menu); largura natural do conteúdo. padding-left = --esp-5 alinha o
         logo com a coluna de ícones da sidebar. A largura do nav (app-sidebar.js)
         é igualada a este cluster, então o menu encosta no limite direito da sidebar. */
      .marca-bloco { display: flex; align-items: center; gap: var(--esp-2);
        flex: none; padding-left: var(--esp-5); }
      .menu-btn { display: inline-flex; align-items: center; justify-content: center;
        background: none; border: none; color: var(--cor-texto-suave);
        padding: 8px; border-radius: var(--raio-sm); }
      .menu-btn:hover { background: var(--cor-superficie-2); }
      .marca { display: flex; align-items: center; gap: var(--esp-2);
        font-weight: var(--peso-forte); color: var(--cor-primaria); font-size: var(--fs-lg);
        text-decoration: none; }
      .marca img { height: 32px; width: auto; display: block; }
      .cresce { flex: 1; }
      .icone-btn { display: inline-flex; align-items: center; justify-content: center;
        width: 38px; height: 38px; border: 1px solid var(--cor-borda-forte);
        background: var(--cor-superficie); color: var(--cor-texto-suave);
        border-radius: var(--raio-sm); }
      .icone-btn:hover { background: var(--cor-superficie-2); }
      .chip { display: flex; align-items: center; gap: var(--esp-2);
        text-decoration: none; color: var(--cor-texto); padding: 4px 10px 4px 4px;
        border: 1px solid var(--cor-borda); border-radius: var(--raio-completo);
        transition: var(--transicao); }
      .chip:hover { background: var(--cor-superficie-2); text-decoration: none; }
      .avatar { width: 30px; height: 30px; border-radius: 50%;
        background: var(--cor-primaria); color: #fff; display: flex;
        align-items: center; justify-content: center; font-size: var(--fs-xs);
        font-weight: var(--peso-forte); }
      .nome { font-size: var(--fs-sm); font-weight: var(--peso-medio); }
      .papel { font-size: var(--fs-xs); color: var(--cor-texto-fraco); }
      .sair { border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        color: var(--cor-texto-suave); border-radius: var(--raio-sm);
        padding: 6px 12px; font-size: var(--fs-sm); }
      .sair:hover { background: var(--cor-superficie-2); }
      @media (max-width: 820px) {
        .papel { display: none; }
        /* no mobile a sidebar é drawer: o cluster vira compacto (sem trancar 230px). */
        .marca-bloco { width: auto; padding-left: var(--esp-3); }
      }
    `;
  }

  template() {
    const u = auth.usuario() || {};
    const iconeTema = tema.efetivo() === "escuro" ? "sol" : "lua";
    return `
      <div class="barra">
        <div class="marca-bloco">
          <a class="marca" href="#/obras"><img src="src/assets/dattaobra.png" alt="Dattaobra" /> Dattaobra</a>
          <button class="menu-btn" id="menu" aria-label="Abrir menu"><ui-icon name="menu"></ui-icon></button>
        </div>
        <span class="cresce"></span>
        <button class="icone-btn" id="tema" aria-label="Alternar tema claro/escuro"><ui-icon name="${iconeTema}"></ui-icon></button>
        <a class="chip" href="#/perfil" title="Meu perfil">
          <span class="avatar">${iniciais(u.nome)}</span>
          <span>
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
    this.$("#menu").addEventListener("click", () => this.emitir("toggle-sidebar"));
    this.$("#tema").addEventListener("click", () => tema.alternar());
    this.$("#sair").addEventListener("click", () => auth.logout());
  }
}

customElements.define("app-header", AppHeader);
