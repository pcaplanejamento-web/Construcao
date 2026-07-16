/**
 * <ui-filtro-data> — Filtro EXCLUSIVO de colunas de DATA (substitui o `ui-coluna-menu`
 * quando a coluna é de datas). Espelha o padrão do print: atalhos (Todo o período /
 * Hoje / Esta semana / Este mês), chips de ANO e MÊS **adaptados aos dados presentes
 * na coluna** e um INTERVALO De/Até. Produz um RANGE `{ de, ate }` em ISO (AAAA-MM-DD)
 * que o `ui-data-table` aplica na coluna (linha visível ⇔ data no intervalo).
 *
 * Uso (pelo ui-data-table): `.coluna`, `.datas` (ISO distintas/presentes na coluna),
 * `.estado` ({ordem,de,ate}) e `.ancora` (DOMRect do th). Eventos:
 *   "aplicar" ({ ordem, de, ate })  // de/ate "" => sem filtro (Todo o período)
 *   "remover" ()                    // limpa ordem + filtro da coluna
 *   "fechar"  ()
 */
import { BaseElement } from "./base-element.js";
import "./ui-button.js";

const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const _pad = (n) => String(n).padStart(2, "0");
const _isoLocal = (d) => `${d.getFullYear()}-${_pad(d.getMonth() + 1)}-${_pad(d.getDate())}`;

class UiFiltroData extends BaseElement {
  set coluna(v) {
    this._coluna = v || {};
  }
  get coluna() {
    return this._coluna || {};
  }
  /** Datas ISO ("AAAA-MM-DD") PRESENTES na coluna (adapta os chips de Ano/Mês). */
  set datas(v) {
    this._datas = Array.isArray(v) ? v.filter(Boolean).map((s) => String(s).slice(0, 10)) : [];
  }
  get datas() {
    return this._datas || [];
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
      .painel { position: fixed; width: 340px; max-width: calc(100vw - 16px);
        background: var(--vidro-fundo-forte); -webkit-backdrop-filter: var(--vidro-blur);
        backdrop-filter: var(--vidro-blur); border: 1px solid var(--vidro-borda);
        border-top: 2px solid var(--cor-primaria); border-radius: 0 0 var(--raio-md) var(--raio-md);
        box-shadow: var(--vidro-realce), var(--sombra-lg); display: flex; flex-direction: column;
        max-height: min(80vh, 560px); overflow: auto; padding: var(--esp-3); gap: var(--esp-3); }
      .ordem { display: flex; gap: var(--esp-2); }
      .ord { flex: 1; border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        border-radius: var(--raio-sm); padding: var(--esp-2); font-size: var(--fs-sm);
        color: var(--cor-texto-suave); cursor: pointer; min-height: 40px; }
      .ord.ativo { border-color: var(--cor-primaria); color: var(--cor-primaria);
        background: var(--cor-primaria-suave); font-weight: var(--peso-semi); }
      .presets { display: flex; flex-wrap: wrap; gap: var(--esp-2); }
      .chip { border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        color: var(--cor-texto-suave); border-radius: 999px; padding: 8px 14px; font: inherit;
        font-size: var(--fs-sm); cursor: pointer; min-height: 40px; }
      .chip:hover { border-color: var(--cor-primaria); color: var(--cor-primaria); }
      .chip.ativo { background: var(--cor-primaria); border-color: var(--cor-primaria);
        color: #fff; font-weight: var(--peso-semi); }
      .secao > label { display: block; font-size: var(--fs-xs); font-weight: var(--peso-forte);
        text-transform: uppercase; letter-spacing: .06em; color: var(--cor-texto-fraco);
        margin: 0 0 var(--esp-2); }
      .chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: var(--esp-2); }
      .chips.anos { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); }
      .chips .chip { border-radius: var(--raio-md); padding: 10px 8px; text-align: center; }
      .intervalo .linha { display: flex; gap: var(--esp-3); }
      .intervalo .campo { flex: 1; min-width: 0; }
      .intervalo .campo span { display: block; font-size: var(--fs-xs); color: var(--cor-texto-fraco); margin-bottom: 4px; }
      .intervalo input { width: 100%; box-sizing: border-box; min-height: 44px; font: inherit;
        color: var(--cor-texto); background: var(--cor-superficie); border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-sm); padding: var(--esp-2) var(--esp-3); }
      .intervalo input:focus { outline: none; border-color: var(--cor-primaria);
        box-shadow: 0 0 0 3px var(--cor-primaria-suave); }
      .rodape { display: flex; gap: var(--esp-2); border-top: 1px solid var(--cor-divisor); padding-top: var(--esp-3); }
      .rodape ui-button { flex: 1; }
      @media (max-width: 600px) { .painel { width: calc(100vw - 16px); } }
    `;
  }

  template() {
    return `
      <div class="backdrop"></div>
      <div class="painel" role="dialog" aria-label="Filtrar ${this.coluna.titulo || "data"}">
        <div class="ordem">
          <button type="button" class="ord" data-ord="asc">↑ Crescente</button>
          <button type="button" class="ord" data-ord="desc">↓ Decrescente</button>
        </div>
        <div class="presets">
          <button type="button" class="chip" data-preset="tudo">Todo o período</button>
          <button type="button" class="chip" data-preset="hoje">Hoje</button>
          <button type="button" class="chip" data-preset="semana">Esta semana</button>
          <button type="button" class="chip" data-preset="mes">Este mês</button>
        </div>
        <div class="secao" id="secAno" hidden><label>Ano</label><div class="chips anos" id="anos"></div></div>
        <div class="secao" id="secMes" hidden><label>Mês</label><div class="chips" id="meses"></div></div>
        <div class="secao intervalo">
          <label>Intervalo</label>
          <div class="linha">
            <div class="campo"><span>De</span><input type="date" id="de" /></div>
            <div class="campo"><span>Até</span><input type="date" id="ate" /></div>
          </div>
        </div>
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
    this.$$(".ord").forEach((b) => {
      b.classList.toggle("ativo", b.dataset.ord === this._ordemSel);
      b.addEventListener("click", () => {
        this._ordemSel = this._ordemSel === b.dataset.ord ? null : b.dataset.ord;
        this.$$(".ord").forEach((x) => x.classList.toggle("ativo", x.dataset.ord === this._ordemSel));
      });
    });
    // Ano selecionado (contexto p/ os chips de mês). Default: o mais recente presente.
    const anos = this._anosPresentes();
    this._anoSel = anos[0] || String(new Date().getFullYear());
    // Estado inicial vindo do filtro atual da coluna.
    const de = (this.estado && this.estado.de) || "";
    const ate = (this.estado && this.estado.ate) || "";
    if (this.$("#de")) this.$("#de").value = de;
    if (this.$("#ate")) this.$("#ate").value = ate;

    this._pintarAnos();
    this._pintarMeses();
    this.posicionar();

    this.$$(".presets .chip").forEach((b) =>
      b.addEventListener("click", () => this._preset(b.dataset.preset))
    );
    this.$("#aplicar").addEventListener("click", () => {
      const d = this.$("#de").value || "";
      const a = this.$("#ate").value || "";
      // Normaliza (De ≤ Até): se invertido, troca.
      const [dd, aa] = d && a && d > a ? [a, d] : [d, a];
      this.emitir("aplicar", { ordem: this._ordemSel, de: dd, ate: aa });
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

  /** Anos DISTINTOS presentes na coluna (desc). */
  _anosPresentes() {
    const set = new Set();
    this.datas.forEach((iso) => {
      const y = String(iso).slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    });
    return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }

  /** Meses (1..12) DISTINTOS presentes num ano (desc). */
  _mesesPresentes(ano) {
    const set = new Set();
    this.datas.forEach((iso) => {
      if (String(iso).slice(0, 4) === String(ano)) set.add(String(iso).slice(5, 7));
    });
    return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }

  _pintarAnos() {
    const anos = this._anosPresentes();
    const sec = this.$("#secAno");
    const box = this.$("#anos");
    if (!sec || !box) return;
    sec.hidden = anos.length === 0;
    box.innerHTML = anos
      .map((a) => `<button type="button" class="chip ${a === this._anoSel ? "ativo" : ""}" data-ano="${a}">${a}</button>`)
      .join("");
    box.querySelectorAll("[data-ano]").forEach((b) =>
      b.addEventListener("click", () => {
        this._anoSel = b.dataset.ano;
        this._pintarAnos();
        this._pintarMeses();
        // Ano inteiro no intervalo.
        this.$("#de").value = `${this._anoSel}-01-01`;
        this.$("#ate").value = `${this._anoSel}-12-31`;
      })
    );
  }

  _pintarMeses() {
    const meses = this._mesesPresentes(this._anoSel);
    const sec = this.$("#secMes");
    const box = this.$("#meses");
    if (!sec || !box) return;
    sec.hidden = meses.length === 0;
    box.innerHTML = meses
      .map((m) => `<button type="button" class="chip" data-mes="${m}">${MESES_CURTO[Number(m) - 1] || m}</button>`)
      .join("");
    box.querySelectorAll("[data-mes]").forEach((b) =>
      b.addEventListener("click", () => {
        const m = b.dataset.mes;
        const ano = this._anoSel;
        const ultimo = new Date(Number(ano), Number(m), 0).getDate();
        this.$("#de").value = `${ano}-${m}-01`;
        this.$("#ate").value = `${ano}-${m}-${_pad(ultimo)}`;
      })
    );
  }

  _preset(p) {
    const de = this.$("#de");
    const ate = this.$("#ate");
    if (!de || !ate) return;
    if (p === "tudo") {
      de.value = "";
      ate.value = "";
      this.emitir("aplicar", { ordem: this._ordemSel, de: "", ate: "" }); // aplica na hora (limpa o filtro)
      return;
    }
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    if (p === "hoje") {
      de.value = _isoLocal(hoje);
      ate.value = _isoLocal(hoje);
    } else if (p === "semana") {
      const ini = new Date(hoje);
      ini.setDate(hoje.getDate() - hoje.getDay()); // domingo (padrão BR)
      const fim = new Date(ini);
      fim.setDate(ini.getDate() + 6);
      de.value = _isoLocal(ini);
      ate.value = _isoLocal(fim);
    } else if (p === "mes") {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      de.value = _isoLocal(ini);
      ate.value = _isoLocal(fim);
    }
    this.emitir("aplicar", { ordem: this._ordemSel, de: de.value, ate: ate.value }); // atalho aplica direto
  }

  posicionar() {
    const r = this._ancora;
    const p = this.$(".painel");
    if (!r || !p) return;
    const w = p.offsetWidth || 340;
    const h = p.offsetHeight || 460;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    let top = r.bottom;
    if (top + h > window.innerHeight - 8) {
      const acima = r.top - h;
      top = acima >= 8 ? acima : Math.max(8, window.innerHeight - 8 - h);
    }
    p.style.left = left + "px";
    p.style.top = top + "px";
  }
}

customElements.define("ui-filtro-data", UiFiltroData);
