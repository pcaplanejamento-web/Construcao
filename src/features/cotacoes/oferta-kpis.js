/**
 * <oferta-kpis> — KPIs das ofertas de uma cotação, em cartões com gradiente.
 * Reusa o estilo do <dashboard-summary> (helper cartao + tokens --grad-*).
 *
 * Propriedade: .resumo = { num, menor, media, maior, economia } (totais)
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda, numero } from "../../core/formatters.js";
import "../../components/ui-icon.js";

class OfertaKpis extends BaseElement {
  set resumo(v) {
    this._resumo = v || null;
    if (this.shadowRoot.childElementCount) this.renderizar();
  }
  get resumo() {
    return this._resumo || { num: 0, menor: 0, media: 0, maior: 0, economia: 0 };
  }

  estilos() {
    return `
      :host { display: block; }
      .grid { display: grid; gap: var(--esp-5);
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
      @media (max-width: 600px) { .grid { grid-template-columns: repeat(2, 1fr); gap: var(--esp-3); } }
      .cartao { position: relative; overflow: hidden; color: #fff;
        border-radius: var(--raio-lg); padding: var(--esp-5); box-shadow: var(--sombra-md);
        min-height: 128px; display: flex; flex-direction: column; gap: var(--esp-2); }
      .cartao::after { content: ""; position: absolute; top: -28px; right: -28px;
        width: 110px; height: 110px; border-radius: 50%; background: rgba(255,255,255,.12); }
      .azul { background: var(--grad-azul); }
      .verde { background: var(--grad-verde); }
      .laranja { background: var(--grad-laranja); }
      .roxo { background: var(--grad-roxo); }
      .vermelho { background: var(--grad-vermelho); }
      .icone { width: 40px; height: 40px; border-radius: var(--raio-md);
        background: rgba(255,255,255,.18); display: flex; align-items: center;
        justify-content: center; position: relative; z-index: 1; }
      .rotulo { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .05em;
        font-weight: var(--peso-semi); opacity: .9; position: relative; z-index: 1; }
      .valor { font-size: var(--fs-2xl); font-weight: var(--peso-forte); line-height: 1.1;
        position: relative; z-index: 1; }
      .dica { font-size: var(--fs-xs); opacity: .85; position: relative; z-index: 1; }
    `;
  }

  cartao(cor, icone, rotulo, valor, dica) {
    return `
      <div class="cartao ${cor}">
        <div class="icone"><ui-icon name="${icone}" size="20"></ui-icon></div>
        <div class="rotulo">${rotulo}</div>
        <div class="valor">${valor}</div>
        ${dica ? `<div class="dica">${dica}</div>` : ""}
      </div>`;
  }

  template() {
    const r = this.resumo;
    const vazio = !r.num;
    const preco = (v) => (vazio ? "—" : moeda(v));
    return `
      <div class="grid">
        ${this.cartao("roxo", "recibo", "Ofertas", numero(r.num), vazio ? "Sem ofertas" : "")}
        ${this.cartao("verde", "tendencia", "Menor preço", preco(r.menor), "")}
        ${this.cartao("azul", "cifrao", "Preço médio", preco(r.media), "")}
        ${this.cartao("vermelho", "carteira", "Maior preço", preco(r.maior), "")}
        ${this.cartao("laranja", "grafico", "Economia potencial", preco(r.economia),
          vazio ? "" : "maior − menor")}
      </div>
    `;
  }
}

customElements.define("oferta-kpis", OfertaKpis);
