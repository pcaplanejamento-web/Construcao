/**
 * <ui-coluna-menu> — Dropdown ÚNICO de cabeçalho de coluna (ordenar + filtrar por
 * Valores), reusado por `ui-data-table` em todas as tabelas. Espelha o padrão do
 * print: Crescente/Decrescente, abas Condições|Valores (Valores ativa), Filtro
 * (busca), Selecionar Todos, checklist de valores, Aplicar/Cancelar/Remover.
 *
 * Uso (pelo ui-data-table): cria o elemento, define `.coluna`, `.valores` (textos
 * distintos), `.estado` ({ordem:'asc'|'desc'|null, selecionados:Set|null}) e
 * `.ancora` (DOMRect do th), e ouve os eventos:
 *   "aplicar" ({ ordem, selecionados })  // selecionados=null => sem filtro (todos)
 *   "remover" ()                         // limpa ordem + filtro da coluna
 *   "fechar"  ()
 */
import { BaseElement } from "./base-element.js";
import "./ui-button.js";

class UiColunaMenu extends BaseElement {
  set coluna(v) {
    this._coluna = v || {};
  }
  get coluna() {
    return this._coluna || {};
  }
  set valores(v) {
    this._valores = Array.isArray(v) ? v : [];
  }
  get valores() {
    return this._valores || [];
  }
  set estado(v) {
    this._estado = v || {};
  }
  get estado() {
    return this._estado || {};
  }
  set ancora(v) {
    this._ancora = v || null;
  }

  estilos() {
    return `
      :host { position: fixed; inset: 0; z-index: var(--z-modal, 1000); }
      .backdrop { position: fixed; inset: 0; }
      .painel { position: fixed; width: 300px; max-width: calc(100vw - 16px);
        background: var(--cor-superficie); border: 1px solid var(--cor-borda); border-top: 2px solid var(--cor-primaria);
        border-radius: 0 0 var(--raio-md) var(--raio-md); box-shadow: var(--sombra-lg);
        display: flex; flex-direction: column; max-height: min(70vh, 460px); }
      .ordem { display: flex; gap: var(--esp-2); padding: var(--esp-3); }
      .ord { flex: 1; border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        border-radius: var(--raio-sm); padding: var(--esp-2); font-size: var(--fs-sm);
        color: var(--cor-texto-suave); cursor: pointer; }
      .ord.ativo { border-color: var(--cor-primaria); color: var(--cor-primaria);
        background: var(--cor-primaria-suave); font-weight: var(--peso-semi); }
      .busca { margin: 0 var(--esp-3) var(--esp-2); padding: var(--esp-2) var(--esp-3);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        font-family: inherit; font-size: var(--fs-sm); background: var(--cor-superficie); color: var(--cor-texto); }
      .busca:focus { outline: none; border-color: var(--cor-primaria); box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      .todos { display: flex; align-items: center; gap: var(--esp-2);
        padding: var(--esp-2) var(--esp-3); border-bottom: 1px solid var(--cor-divisor); font-size: var(--fs-sm); }
      .lista { overflow-y: auto; padding: var(--esp-2) var(--esp-3); display: flex;
        flex-direction: column; gap: var(--esp-1); flex: 1; min-height: 0; max-height: 220px; }
      .item { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-sm);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .vazio-lista { color: var(--cor-texto-fraco); font-size: var(--fs-sm); padding: var(--esp-2); }
      input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--cor-primaria); flex: none; }
      .rodape { display: flex; gap: var(--esp-2); padding: var(--esp-3);
        border-top: 1px solid var(--cor-divisor); }
      .rodape ui-button { flex: 1; }
    `;
  }

  template() {
    const o = (this.estado && this.estado.ordem) || null;
    return `
      <div class="backdrop"></div>
      <div class="painel" role="dialog" aria-label="Filtrar ${this.coluna.titulo || ""}">
        <div class="ordem">
          <button class="ord ${o === "asc" ? "ativo" : ""}" data-ord="asc">↑ Crescente</button>
          <button class="ord ${o === "desc" ? "ativo" : ""}" data-ord="desc">↓ Decrescente</button>
        </div>
        <input id="busca" class="busca" placeholder="Filtro" />
        <label class="todos"><input type="checkbox" id="todos" /> <b>Selecionar Todos</b></label>
        <div class="lista" id="lista"></div>
        <div class="rodape">
          <ui-button id="aplicar" tamanho="sm">Aplicar</ui-button>
          <ui-button id="cancelar" variant="secundario" tamanho="sm">Cancelar</ui-button>
          <ui-button id="remover" variant="perigo-contorno" tamanho="sm">Remover</ui-button>
        </div>
      </div>
    `;
  }

  aposRender() {
    this._ordemSel = (this.estado && this.estado.ordem) || null;
    const sel = this.estado && this.estado.selecionados;
    // Marcados: o filtro atual (Set) ou TODOS quando não há filtro.
    this._marcados = new Set(sel ? Array.from(sel) : this.valores);

    this.posicionar();
    this.pintarLista();

    this.$$(".ord").forEach((b) =>
      b.addEventListener("click", () => {
        this._ordemSel = this._ordemSel === b.dataset.ord ? null : b.dataset.ord;
        this.$$(".ord").forEach((x) => x.classList.toggle("ativo", x.dataset.ord === this._ordemSel));
      })
    );
    this.$("#busca").addEventListener("input", () => this.pintarLista());
    this.$("#todos").addEventListener("change", (ev) => {
      const vis = this._filtrados();
      vis.forEach((v) => (ev.target.checked ? this._marcados.add(v) : this._marcados.delete(v)));
      this.pintarLista();
    });
    this.$("#aplicar").addEventListener("click", () => {
      const todos = this.valores.every((v) => this._marcados.has(v));
      this.emitir("aplicar", {
        ordem: this._ordemSel,
        selecionados: todos ? null : new Set(this._marcados),
      });
    });
    this.$("#cancelar").addEventListener("click", () => this.emitir("fechar"));
    this.$("#remover").addEventListener("click", () => this.emitir("remover"));
    this.$(".backdrop").addEventListener("click", () => this.emitir("fechar"));
    if (!this._esc) {
      this._esc = (ev) => {
        if (ev.key === "Escape") this.emitir("fechar");
      };
      document.addEventListener("keydown", this._esc);
      this.aoLimpar(() => document.removeEventListener("keydown", this._esc));
    }
  }

  _filtrados() {
    const q = (this.$("#busca").value || "").toLowerCase();
    return this.valores.filter((v) => !q || String(v).toLowerCase().includes(q));
  }

  pintarLista() {
    const lista = this.$("#lista");
    const vis = this._filtrados();
    lista.innerHTML =
      vis
        .map(
          (v, i) =>
            `<label class="item"><input type="checkbox" data-i="${i}" ${
              this._marcados.has(v) ? "checked" : ""
            }/> <span title="${String(v).replace(/"/g, "&quot;")}">${v}</span></label>`
        )
        .join("") || `<div class="vazio-lista">Nenhum valor.</div>`;
    lista.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const v = vis[Number(cb.dataset.i)];
        if (cb.checked) this._marcados.add(v);
        else this._marcados.delete(v);
        this.$("#todos").checked = vis.length > 0 && vis.every((x) => this._marcados.has(x));
      });
    });
    this.$("#todos").checked = vis.length > 0 && vis.every((x) => this._marcados.has(x));
  }

  posicionar() {
    const r = this._ancora;
    const p = this.$(".painel");
    if (!r || !p) return;
    const w = 300;
    // Colado ao tópico: alinhado à esquerda do cabeçalho e SEM espaço (borda-topo encosta no th).
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = Math.max(8, Math.min(r.bottom, window.innerHeight - 470));
    p.style.left = left + "px";
    p.style.top = top + "px";
  }
}

customElements.define("ui-coluna-menu", UiColunaMenu);
