/**
 * <app-sidebar> — Menu lateral em abas. Reusa <role-guard> e <ui-icon>.
 *
 * Atributos:
 *   aberto    — no mobile, controla o drawer (slide in/out).
 *   recolhido — no desktop, vira uma régua só de ícones (rótulos somem; o ícone
 *               permanece na MESMA posição horizontal; a largura fica
 *               proporcional ao ícone). No mobile o recolhimento não se aplica
 *               (o drawer mostra sempre os rótulos).
 * Evento: "navegou" (após clicar num item — o shell fecha o drawer no mobile).
 */
import { BaseElement } from "../components/base-element.js";
import "./role-guard.js";
import "../components/ui-icon.js";

// Itens principais (antes de Admin e Perfil).
const ITENS = [
  { rota: "/obras", rotulo: "Minhas obras", icone: "obra" },
  { rota: "/financeiro", rotulo: "Financeiro", icone: "carteira" },
  { rota: "/fornecedores", rotulo: "Fornecedores", icone: "fornecedor" },
  { rota: "/contatos", rotulo: "Contatos", icone: "contato" },
  { rota: "/cotacoes", rotulo: "Cotações", icone: "cotacao" },
  { rota: "/orcamentos", rotulo: "Orçamentos", icone: "carteira" },
  { rota: "/ofertas", rotulo: "Ofertas", icone: "cifrao" },
  { rota: "/itens", rotulo: "Itens", icone: "tag" },
];
const ITEM_PERFIL = { rota: "/perfil", rotulo: "Meu perfil", icone: "usuario" };

class AppSidebar extends BaseElement {
  static get observedAttributes() {
    return ["aberto", "recolhido"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.marcarAtivo();
  }

  estilos() {
    return `
      :host { display: block; }
      .backdrop { display: none; }
      /* padding-top = --esp-tela: alinha o topo do 1º item com o topo do
         conteúdo (KPIs), que usa a MESMA distância padrão do header. */
      /* Largura = cluster do app-header (logo + "Dattaobra" + menu): o ícone do
         item alinha com o logo (à esq.) e a borda direita do nav encosta no
         sanduíche (à dir.). Manter proporcional a esse cluster. */
      nav { display: flex; flex-direction: column; gap: var(--esp-2);
        width: 195px; padding: var(--esp-tela) var(--esp-3) var(--esp-4);
        background: var(--cor-superficie); border-right: 1px solid var(--cor-borda);
        height: 100%; overflow: hidden; transition: width .2s ease; }
      a { display: flex; align-items: center; gap: var(--esp-3);
        min-height: 48px; padding: 0 var(--esp-3); border-radius: var(--raio-md);
        color: var(--cor-texto-suave); text-decoration: none;
        font-weight: var(--peso-medio); font-size: var(--fs-sm); }
      a:hover { background: var(--cor-divisor); text-decoration: none; }
      a.ativo { color: var(--cor-primaria-escura); background: var(--cor-primaria-suave);
        font-weight: var(--peso-semi); }
      a ui-icon { color: inherit; flex: none; } /* ícone nunca encolhe */
      .rotulo { white-space: nowrap; overflow: hidden; max-width: 160px; opacity: 1;
        transition: opacity .15s ease, max-width .2s ease; }
      role-guard { display: contents; }
      .sep { height: 1px; background: var(--cor-borda); margin: var(--esp-2) 0; }

      /* DESKTOP: recolhido = régua de ícones (ícone fica no mesmo x). */
      @media (min-width: 821px) {
        :host([recolhido]) nav { width: 66px; }
        :host([recolhido]) a { gap: 0; }
        :host([recolhido]) .rotulo { opacity: 0; max-width: 0; }
      }

      /* MOBILE: drawer (sempre com rótulos; ignora "recolhido"). */
      @media (max-width: 820px) {
        :host { position: fixed; inset: 0 auto 0 0; z-index: var(--z-nav);
          transform: translateX(-100%); transition: transform .2s ease; }
        :host([aberto]) { transform: translateX(0); }
        nav { box-shadow: var(--sombra-lg); width: 195px; }
        .backdrop { display: block; position: fixed; inset: 0; z-index: -1;
          background: var(--cor-overlay); opacity: 0; pointer-events: none;
          transition: opacity .2s; }
        :host([aberto]) .backdrop { opacity: 1; pointer-events: auto; }
      }
    `;
  }

  template() {
    const link = (it) =>
      `<a href="${it.rota}" data-rota="${it.rota}" title="${it.rotulo}">
        <ui-icon name="${it.icone}" size="18"></ui-icon><span class="rotulo">${it.rotulo}</span>
      </a>`;
    return `
      <div class="backdrop" id="backdrop"></div>
      <nav>
        ${ITENS.map(link).join("")}
        <role-guard role="admin">
          <a href="/admin" data-rota="/admin" title="Administração">
            <ui-icon name="config" size="18"></ui-icon><span class="rotulo">Administração</span>
          </a>
        </role-guard>
        <div class="sep"></div>
        ${link(ITEM_PERFIL)}
      </nav>
    `;
  }

  aoConectar() {
    this._onRota = () => this.marcarAtivo();
    window.addEventListener("rotamudou", this._onRota);
    this.aoLimpar(() => window.removeEventListener("rotamudou", this._onRota));
    this.marcarAtivo();
    this.$$("a").forEach((a) =>
      a.addEventListener("click", () => this.emitir("navegou"))
    );
    this.$("#backdrop").addEventListener("click", () => this.emitir("navegou"));
  }

  marcarAtivo() {
    const atual = location.pathname || "/";
    this.$$("a").forEach((a) => {
      const rota = a.dataset.rota;
      a.classList.toggle("ativo", atual === rota || atual.startsWith(rota + "/"));
    });
  }
}

customElements.define("app-sidebar", AppSidebar);
