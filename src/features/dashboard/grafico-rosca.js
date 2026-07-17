/**
 * <grafico-rosca> — Donut (SVG) da distribuição, sem número no centro. Preenche a
 * altura do cartão; legenda rola se houver muitos itens. O título é configurável
 * via o atributo `titulo` (padrão "Distribuição por categoria").
 * Propriedade: .porCategoria = [{ nome, cor, total }]
 *   .formato = (item, totalGeral) => string  (opcional; formata o VALOR na legenda —
 *              padrão = "R$ x · y%"; use p/ valores não-monetários, ex.: quantidades).
 * Atributos: titulo, vazio (texto do estado vazio).
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, percentual } from "../../core/formatters.js";

class GraficoRosca extends BaseElement {
  static get observedAttributes() {
    return ["titulo", "vazio"];
  }
  attributeChangedCallback() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  set porCategoria(v) {
    this._lista = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get porCategoria() {
    return this._lista || [];
  }
  /** Formatador do VALOR na legenda (opcional). Não re-renderiza sozinho: defina ANTES
   *  de `porCategoria` (que dispara o render). */
  set formato(fn) {
    this._formato = typeof fn === "function" ? fn : null;
  }
  get titulo() {
    return this.getAttribute("titulo") || "Distribuição por categoria";
  }
  get vazioTexto() {
    return this.getAttribute("vazio") || "Sem despesas ainda.";
  }

  estilos() {
    return `
      :host { display: flex; flex-direction: column; height: 100%; }
      .titulo { font-size: var(--fs-md); font-weight: var(--peso-semi);
        margin-bottom: var(--esp-4); flex: none; }
      .wrap { flex: 1; min-height: 0; display: flex; gap: var(--esp-5);
        align-items: center; justify-content: center; flex-wrap: wrap; }
      svg { width: 130px; height: 130px; flex: none; }
      .legenda { flex: 1; min-width: 140px; max-height: 100%; overflow-y: auto;
        display: flex; flex-direction: column; gap: var(--esp-2); padding-right: var(--esp-1); }
      .li { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-sm); }
      .dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
      .li .nome { color: var(--cor-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .li .val { margin-left: auto; color: var(--cor-texto-suave); white-space: nowrap; }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    const lista = this.porCategoria;
    const total = lista.reduce((s, c) => s + (Number(c.total) || 0), 0);
    if (!total) {
      return `<div class="titulo">${this.titulo}</div><div class="vazio">${this.vazioTexto}</div>`;
    }

    let acc = 0;
    const segmentos = lista
      .map((c) => {
        const pct = ((Number(c.total) || 0) / total) * 100;
        const seg = `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${c.cor || "var(--cor-neutro)"}"
          stroke-width="6" stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}"
          stroke-dashoffset="${(25 - acc).toFixed(2)}"></circle>`;
        acc += pct;
        return seg;
      })
      .join("");

    const valTxt = (c) =>
      this._formato ? this._formato(c, total) : `${moeda(c.total)} · ${percentual(c.total, total)}%`;
    const legenda = lista
      .map(
        (c) =>
          `<div class="li"><span class="dot" style="background:${c.cor || "var(--cor-neutro)"}"></span>
           <span class="nome">${c.nome}</span>
           <span class="val">${valTxt(c)}</span></div>`
      )
      .join("");

    return `
      <div class="titulo">${this.titulo}</div>
      <div class="wrap">
        <svg viewBox="0 0 42 42" role="img" aria-label="${this.titulo}">
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--cor-borda)" stroke-width="6"></circle>
          ${segmentos}
        </svg>
        <div class="legenda">${legenda}</div>
      </div>
    `;
  }
}

customElements.define("grafico-rosca", GraficoRosca);
