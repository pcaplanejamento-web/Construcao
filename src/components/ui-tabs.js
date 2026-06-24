/**
 * <ui-tabs> — Abas reutilizáveis (primitivo). Mostra o conteúdo da aba ativa via
 * slots nomeados; o consumidor fornece um elemento por aba com slot="<id>".
 *
 * Propriedade: .abas = [{ id, rotulo, icone? }]
 * Atributo: ativo (id da aba ativa; padrão = primeira)
 * Evento: "mudar" ({ id }).
 *
 * Uso:
 *   <ui-tabs id="t">
 *     <div slot="a">...</div>
 *     <div slot="b">...</div>
 *   </ui-tabs>
 *   t.abas = [{id:"a",rotulo:"A"},{id:"b",rotulo:"B"}];
 */
import { BaseElement } from "./base-element.js";
import "./ui-icon.js";

class UiTabs extends BaseElement {
  static get observedAttributes() {
    return ["ativo"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  set abas(v) {
    this._abas = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get abas() {
    return this._abas || [];
  }
  // Chave de cache da aba ativa: por rota + assinatura das abas (não colide com
  // abas de outro conjunto na mesma rota, ex.: modais/forms).
  _chaveCache() {
    return "aba:" + (location.pathname || "/") + "#" + this.abas.map((a) => a.id).join(",");
  }
  get ativo() {
    const attr = this.getAttribute("ativo");
    if (attr) return attr;
    // Restaura a aba ativa salva (estado da página ao voltar).
    try {
      const s = sessionStorage.getItem(this._chaveCache());
      if (s && this.abas.some((a) => a.id === s)) return s;
    } catch (e) {
      /* sessionStorage indisponível */
    }
    return (this.abas[0] || {}).id || "";
  }

  estilos() {
    return `
      :host { display: block; }
      /* Em telas estreitas as abas NÃO quebram: rolam na horizontal (sem barra
         de rolagem visível) — o conteúdo nunca estoura a proporção da tela. */
      .barra { display: flex; gap: var(--esp-1); border-bottom: 1px solid var(--cor-borda);
        margin-bottom: var(--esp-5); flex-wrap: nowrap; overflow-x: auto;
        -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .barra::-webkit-scrollbar { display: none; }
      button { display: inline-flex; align-items: center; gap: var(--esp-2); flex: none;
        white-space: nowrap; background: none; border: none; cursor: pointer;
        padding: var(--esp-3) var(--esp-4);
        font-size: var(--fs-sm); font-weight: var(--peso-medio); color: var(--cor-texto-suave);
        border-bottom: 2.5px solid transparent; margin-bottom: -1px; }
      button:hover { color: var(--cor-texto); }
      /* Ativo: muda APENAS a cor (texto + ícone via currentColor) e a barra
         inferior. Sem alterar font-weight/size → não há reflow nem deslocamento. */
      button.ativo { color: var(--cor-primaria); border-bottom-color: var(--cor-primaria); }
    `;
  }

  template() {
    const ativo = this.ativo;
    const botoes = this.abas
      .map(
        (a) =>
          `<button data-id="${a.id}" class="${a.id === ativo ? "ativo" : ""}">${
            a.icone ? `<ui-icon name="${a.icone}" size="16"></ui-icon>` : ""
          }${a.rotulo}</button>`
      )
      .join("");
    return `
      <div class="barra" role="tablist">${botoes}</div>
      <div class="painel"><slot name="${ativo}"></slot></div>
    `;
  }

  aposRender() {
    this.$$("button").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.id === this.ativo) return;
        try {
          sessionStorage.setItem(this._chaveCache(), b.dataset.id); // lembra a aba (estado da página)
        } catch (e) {
          /* sessionStorage indisponível */
        }
        this.setAttribute("ativo", b.dataset.id); // dispara re-render
        this.emitir("mudar", { id: b.dataset.id });
      })
    );
  }
}

customElements.define("ui-tabs", UiTabs);
