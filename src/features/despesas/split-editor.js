/**
 * <split-editor> — Editor de distribuição entre participantes (reutilizável).
 * Usado no banner da despesa para PAGAMENTO (modo "valor", R$) e
 * RESPONSABILIDADE (modo "pct", %). Reusa ui-select/ui-input/ui-button.
 *
 * Propriedades: .participantes=[{chave,nome,origem}], .itens=[{chave,valor}], .modo("valor"|"pct")
 * Evento: "mudar" ({ itens }). Leia também `.itens` diretamente ao salvar.
 */
import { BaseElement } from "../../components/base-element.js";
import { moeda } from "../../core/formatters.js";
import { rotuloOrigem } from "./despesa-split.js";
import "../../components/ui-select.js";
import "../../components/ui-input.js";
import "../../components/ui-button.js";

class SplitEditor extends BaseElement {
  set participantes(v) {
    this._part = Array.isArray(v) ? v : [];
    if (this.shadowRoot.childElementCount) this.pintarLinhas();
  }
  get participantes() {
    return this._part || [];
  }
  set itens(v) {
    this._itens = Array.isArray(v) ? v.map((x) => ({ chave: x.chave, valor: Number(x.valor) || 0 })) : [];
    if (this.shadowRoot.childElementCount) this.pintarLinhas();
  }
  get itens() {
    return (this._itens || []).map((x) => ({ chave: x.chave, valor: Number(x.valor) || 0 }));
  }
  set modo(v) {
    this._modo = v === "pct" ? "pct" : "valor";
    if (this.shadowRoot.childElementCount) this.pintarLinhas();
  }
  get modo() {
    return this._modo || "valor";
  }

  estilos() {
    return `
      :host { display: block; }
      .linha { display: flex; gap: var(--esp-2); align-items: center; margin-bottom: var(--esp-2); }
      .linha ui-select { flex: 2; min-width: 0; }
      .linha ui-input { flex: 1; min-width: 80px; }
      .rem { border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        color: var(--cor-erro); border-radius: var(--raio-sm); width: 34px; height: 42px;
        flex: none; cursor: pointer; }
      .rem:hover { background: var(--cor-superficie-2); }
      .rodape { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); margin-top: var(--esp-1); }
      .total { font-size: var(--fs-sm); color: var(--cor-texto-suave); }
      .total.erro { color: var(--cor-erro); font-weight: var(--peso-semi); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); margin-bottom: var(--esp-2); }
    `;
  }

  template() {
    return `
      <div id="linhas"></div>
      <div class="rodape">
        <ui-button id="add" variant="secundario" tamanho="sm">＋ Adicionar</ui-button>
        <span class="total" id="total"></span>
      </div>
    `;
  }

  aposRender() {
    this.pintarLinhas();
    this.$("#add").addEventListener("click", () => this.adicionar());
  }

  _opcoes() {
    return this.participantes.map((p) => ({
      value: p.chave,
      label: p.nome + (p.origem ? " · " + rotuloOrigem(p.origem) : ""),
    }));
  }

  pintarLinhas() {
    const cont = this.$("#linhas");
    if (!cont) return;
    cont.innerHTML = "";
    const itens = this._itens || [];
    if (!itens.length) {
      cont.innerHTML = `<p class="vazio">Ninguém adicionado.</p>`;
    }
    itens.forEach((it, i) => {
      const row = document.createElement("div");
      row.className = "linha";
      const sel = document.createElement("ui-select");
      sel.options = this._opcoes();
      sel.value = it.chave || "";
      const inp = document.createElement("ui-input");
      inp.setAttribute("type", "number");
      inp.setAttribute("step", this.modo === "pct" ? "1" : "0.01");
      inp.setAttribute("min", "0");
      inp.setAttribute("placeholder", this.modo === "pct" ? "%" : "R$");
      inp.value = it.valor || "";
      const rem = document.createElement("button");
      rem.type = "button";
      rem.className = "rem";
      rem.textContent = "✕";
      sel.addEventListener("change", (e) => {
        this._itens[i].chave = e.detail.value;
        this.emitirMudou();
      });
      inp.addEventListener("input", () => {
        this._itens[i].valor = Number(inp.value) || 0;
        this.atualizarTotal();
        this.emitirMudou();
      });
      rem.addEventListener("click", () => {
        this._itens.splice(i, 1);
        this.pintarLinhas();
        this.emitirMudou();
      });
      row.append(sel, inp, rem);
      cont.appendChild(row);
    });
    this.atualizarTotal();
  }

  adicionar() {
    const usados = new Set((this._itens || []).map((x) => x.chave));
    const livre = (this.participantes.find((p) => !usados.has(p.chave)) || this.participantes[0] || {}).chave || "";
    (this._itens || (this._itens = [])).push({ chave: livre, valor: 0 });
    this.pintarLinhas();
    this.emitirMudou();
  }

  atualizarTotal() {
    const el = this.$("#total");
    if (!el) return;
    const soma = (this._itens || []).reduce((s, x) => s + (Number(x.valor) || 0), 0);
    if (this.modo === "pct") {
      el.textContent = "Soma: " + soma + "%";
      el.classList.toggle("erro", (this._itens || []).length > 0 && Math.round(soma) !== 100);
    } else {
      el.textContent = "Total: " + moeda(soma);
      el.classList.remove("erro");
    }
  }

  emitirMudou() {
    this.emitir("mudar", { itens: this.itens });
  }
}

customElements.define("split-editor", SplitEditor);
