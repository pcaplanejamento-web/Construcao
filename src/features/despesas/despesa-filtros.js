/**
 * <despesa-filtros> — Barra de pesquisa + filtro por classificação das despesas.
 *
 * Propriedade: .categorias = [{ id, nome }]
 * Evento: "filtrar" ({ texto, categoria }) a cada digitação/seleção.
 * Reusa ui-input/ui-select/ui-icon. O filtro é aplicado em obra-detail-view.
 */
import { BaseElement } from "../../components/base-element.js";
import "../../components/ui-input.js";
import "../../components/ui-select.js";
import "../../components/ui-icon.js";

class DespesaFiltros extends BaseElement {
  set categorias(v) {
    this._categorias = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.preencher();
  }
  get categorias() {
    return this._categorias || [];
  }

  estilos() {
    return `
      :host { display: block; margin-bottom: var(--esp-4); }
      .barra { display: flex; gap: var(--esp-3); align-items: end; flex-wrap: wrap; }
      .busca { flex: 1; min-width: 200px; position: relative; }
      .busca ui-icon { position: absolute; left: 10px; bottom: 11px; color: var(--cor-texto-fraco); pointer-events: none; }
      .busca ui-input::part(input) { } /* placeholder padding tratado abaixo */
      .filtro-cat { min-width: 180px; }
    `;
  }

  template() {
    return `
      <div class="barra">
        <div class="busca">
          <ui-input id="busca" label="Pesquisar" placeholder="Buscar por item..."></ui-input>
        </div>
        <div class="filtro-cat">
          <ui-select id="categoria" label="Classificação"></ui-select>
        </div>
      </div>
    `;
  }

  aoConectar() {
    this.preencher();
    this.$("#busca").addEventListener("input", () => this.emitirFiltro());
    this.$("#categoria").addEventListener("change", () => this.emitirFiltro());
  }

  preencher() {
    const sel = this.$("#categoria");
    if (!sel) return;
    sel.options = [{ value: "", label: "Todas" }].concat(
      this.categorias.map((c) => ({ value: c.id, label: c.nome }))
    );
  }

  emitirFiltro() {
    this.emitir("filtrar", {
      texto: this.$("#busca").value.trim(),
      categoria: this.$("#categoria").value || "",
    });
  }
}

customElements.define("despesa-filtros", DespesaFiltros);
