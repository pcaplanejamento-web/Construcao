/**
 * <app-header> — Cabeçalho persistente (sticky) no topo.
 *
 * Esquerda: botão ☰ (mobile, emite "toggle-sidebar"), marca.
 * Direita: chip do usuário (iniciais + nome) que leva a #/perfil, e botão Sair.
 * Reage a EVENTOS.AUTH para refletir o usuário logado.
 */
import { BaseElement } from "../components/base-element.js";
import { auth } from "../core/auth-store.js";
import { bus, EVENTOS } from "../core/event-bus.js";

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
        padding: var(--esp-3) var(--esp-4); }
      .menu-btn { display: none; background: none; border: none; font-size: 1.4rem;
        color: var(--cor-texto-suave); padding: 4px 8px; border-radius: var(--raio-sm); }
      .menu-btn:hover { background: var(--cor-superficie-2); }
      .marca { display: flex; align-items: center; gap: var(--esp-2);
        font-weight: var(--peso-forte); color: var(--cor-primaria); font-size: var(--fs-lg);
        text-decoration: none; }
      .logo { font-size: 1.3rem; }
      .cresce { flex: 1; }
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
        .menu-btn { display: block; }
        .papel { display: none; }
      }
    `;
  }

  template() {
    const u = auth.usuario() || {};
    return `
      <div class="barra">
        <button class="menu-btn" id="menu" aria-label="Abrir menu">☰</button>
        <a class="marca" href="#/obras"><span class="logo">🏗️</span> Gestão de Obras</a>
        <span class="cresce"></span>
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
  }

  aposRender() {
    this.$("#menu").addEventListener("click", () => this.emitir("toggle-sidebar"));
    this.$("#sair").addEventListener("click", () => auth.logout());
  }
}

customElements.define("app-header", AppHeader);
