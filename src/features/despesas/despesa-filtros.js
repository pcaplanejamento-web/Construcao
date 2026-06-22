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
    if (this.shadowRoot.childElementCount) {
      this.preencher();
      // Restaura busca/filtro salvos (estado da página) UMA vez, após as opções
      // estarem prontas e o listener do parent já ligado.
      if (!this._restaurado) {
        this._restaurado = true;
        this._restaurar();
      }
    }
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
    const texto = this.$("#busca").value.trim();
    const categoria = this.$("#categoria").value || "";
    // Persiste o estado (busca + filtro) por rota → ao voltar, continua de onde saiu.
    try {
      sessionStorage.setItem(this._chave(), JSON.stringify({ texto, categoria }));
    } catch (e) {
      /* indisponível */
    }
    this.emitir("filtrar", { texto, categoria });
  }

  _chave() {
    return "filtro-desp:" + (location.pathname || "/");
  }

  /** Restaura busca/filtro salvos e re-aplica no parent (emite "filtrar"). */
  _restaurar() {
    let s = null;
    try {
      s = JSON.parse(sessionStorage.getItem(this._chave()) || "null");
    } catch (e) {
      /* ignora */
    }
    if (!s || (!s.texto && !s.categoria)) return;
    this.$("#busca").value = s.texto || "";
    this.$("#categoria").value = s.categoria || "";
    this.emitir("filtrar", { texto: s.texto || "", categoria: s.categoria || "" });
  }
}

customElements.define("despesa-filtros", DespesaFiltros);
