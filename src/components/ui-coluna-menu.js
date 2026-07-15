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

// Nomes dos meses em pt-BR (o filtro de data agrupa por Ano › Mês › Dia).
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const RE_DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

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
        background: var(--vidro-fundo-forte);
        -webkit-backdrop-filter: var(--vidro-blur); backdrop-filter: var(--vidro-blur);
        border: 1px solid var(--vidro-borda); border-top: 2px solid var(--cor-primaria);
        border-radius: 0 0 var(--raio-md) var(--raio-md); box-shadow: var(--vidro-realce), var(--sombra-lg);
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
      /* A lista OCUPA o espaço restante do painel (flex:1, min-height:0) e ROLA
         internamente (overflow-y:auto) — dá p/ ver/marcar todos os valores sem
         empurrar o rodapé (Aplicar/Cancelar) p/ fora da tela. */
      .lista { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
        padding: var(--esp-2) var(--esp-3); display: flex; flex-direction: column;
        gap: var(--esp-1); flex: 1; min-height: 0; }
      /* flex:none = NÃO encolher: numa lista flex-column com altura limitada, sem isto
         os itens comprimiam (~3px) em vez de a lista ROLAR. Agora transbordam → scroll. */
      .item { flex: none; min-height: 28px; display: flex; align-items: center; gap: var(--esp-2);
        font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
      .vazio-lista { color: var(--cor-texto-fraco); font-size: var(--fs-sm); padding: var(--esp-2); }
      input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--cor-primaria); flex: none; }
      /* Filtro de DATA agrupado (Ano › Mês › Dia). Grupos com seta de expandir +
         checkbox tri-estado; dias recuados. */
      .grp { flex: none; display: flex; align-items: center; gap: 4px; min-height: 28px; }
      .grp > label { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--esp-2);
        cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .grp-ano > label { font-weight: var(--peso-semi); }
      .grp-mes { padding-left: 18px; }
      .grp small { color: var(--cor-texto-fraco); font-weight: 400; font-size: var(--fs-xs); }
      .exp { flex: none; border: none; background: none; color: var(--cor-texto-suave); cursor: pointer;
        width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center;
        font-size: 11px; padding: 0; }
      .exp:hover { color: var(--cor-primaria); }
      .item.day { padding-left: 36px; }
      .rodape { display: flex; gap: var(--esp-2); padding: var(--esp-3);
        border-top: 1px solid var(--cor-divisor); }
      .rodape ui-button { flex: 1; }
      /* MOBILE/touch: painel quase full-width, alvos maiores e mais espaço de lista. */
      @media (max-width: 600px) {
        .painel { width: calc(100vw - 16px); max-height: 80vh; }
        .item { padding: 6px 0; }
        .todos { padding: var(--esp-3); }
        input[type="checkbox"] { width: 20px; height: 20px; }
      }
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

    this.pintarLista();
    this.posicionar(); // depois de pintar: mede a altura real p/ clampar à tela

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

  /** Coluna de DATA? (todos os valores no padrão brasileiro "DD/MM/AAAA".) */
  _ehData() {
    const vs = this.valores;
    return vs.length > 0 && vs.every((v) => RE_DATA_BR.test(String(v)));
  }

  _parseBR(v) {
    const m = RE_DATA_BR.exec(String(v));
    return m ? { d: m[1], mes: m[2], ano: m[3] } : null;
  }

  _filtrados() {
    const q = (this.$("#busca").value || "").toLowerCase().trim();
    if (!q) return this.valores.slice();
    // Em data, a busca também casa pelo NOME do mês (ex.: "abril") além dos dígitos.
    if (this._ehData()) {
      return this.valores.filter((v) => {
        if (String(v).toLowerCase().includes(q)) return true;
        const p = this._parseBR(v);
        return p ? (MESES[Number(p.mes) - 1] || "").toLowerCase().includes(q) : false;
      });
    }
    return this.valores.filter((v) => String(v).toLowerCase().includes(q));
  }

  pintarLista() {
    if (this._ehData()) return this._pintarArvore();
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

  /** Agrupa as datas-folha visíveis em Ano › Mês › Dia, tudo DESC (mais recente 1º). */
  _arvore(leaves) {
    const anos = new Map();
    leaves.forEach((v) => {
      const p = this._parseBR(v);
      if (!p) return;
      if (!anos.has(p.ano)) anos.set(p.ano, new Map());
      const meses = anos.get(p.ano);
      if (!meses.has(p.mes)) meses.set(p.mes, []);
      meses.get(p.mes).push(v);
    });
    const desc = (a, b) => (a < b ? 1 : a > b ? -1 : 0);
    return [...anos.keys()].sort(desc).map((ano) => ({
      ano,
      meses: [...anos.get(ano).keys()].sort(desc).map((mes) => ({
        mes,
        nome: MESES[Number(mes) - 1] || mes,
        dias: anos
          .get(ano)
          .get(mes)
          .slice()
          .sort((a, b) => desc(this._parseBR(a).d, this._parseBR(b).d)),
      })),
    }));
  }

  /** Datas-folha VISÍVEIS (respeita a busca) sob uma chave de grupo "y:AAAA" ou "m:AAAA-MM". */
  _diasDaChave(k) {
    const leaves = this._filtrados();
    if (k.indexOf("y:") === 0) {
      const ano = k.slice(2);
      return leaves.filter((v) => { const p = this._parseBR(v); return p && p.ano === ano; });
    }
    const alvo = k.slice(2); // "AAAA-MM"
    return leaves.filter((v) => {
      const p = this._parseBR(v);
      return p && p.ano + "-" + p.mes === alvo;
    });
  }

  /** Filtro de DATA agrupado (Ano › Mês › Dia). Folhas = "DD/MM/AAAA" (contrato do filtro
   * inalterado); grupos são só UI que marca/desmarca as folhas embaixo. */
  _pintarArvore() {
    const lista = this.$("#lista");
    if (!this._colapsado) this._colapsado = new Set();
    const buscando = !!(this.$("#busca").value || "").trim();
    const colapsado = (k) => !buscando && this._colapsado.has(k); // busca força expandir
    const esc = (s) => String(s).replace(/"/g, "&quot;");
    const leavesVis = this._filtrados();
    const arvore = this._arvore(leavesVis);
    const todosMarc = (dias) => dias.length > 0 && dias.every((v) => this._marcados.has(v));

    let html = "";
    arvore.forEach((a) => {
      const diasAno = a.meses.reduce((s, m) => s.concat(m.dias), []);
      const kAno = "y:" + a.ano;
      const colAno = colapsado(kAno);
      html += `<div class="grp grp-ano"><button type="button" class="exp" data-k="${kAno}" aria-label="Expandir/recolher">${colAno ? "▸" : "▾"}</button><label><input type="checkbox" class="ck-grp" data-k="${kAno}" ${todosMarc(diasAno) ? "checked" : ""}/> <span>${a.ano}</span> <small>(${diasAno.length})</small></label></div>`;
      if (colAno) return;
      a.meses.forEach((m) => {
        const kMes = "m:" + a.ano + "-" + m.mes;
        const colMes = colapsado(kMes);
        html += `<div class="grp grp-mes"><button type="button" class="exp" data-k="${kMes}" aria-label="Expandir/recolher">${colMes ? "▸" : "▾"}</button><label><input type="checkbox" class="ck-grp" data-k="${kMes}" ${todosMarc(m.dias) ? "checked" : ""}/> <span>${m.nome}</span> <small>(${m.dias.length})</small></label></div>`;
        if (colMes) return;
        m.dias.forEach((v) => {
          html += `<label class="item day"><input type="checkbox" class="ck-leaf" data-v="${esc(v)}" ${this._marcados.has(v) ? "checked" : ""}/> <span>${v}</span></label>`;
        });
      });
    });
    lista.innerHTML = html || `<div class="vazio-lista">Nenhum valor.</div>`;

    // Tri-estado dos grupos (indeterminado quando parte das folhas está marcada).
    lista.querySelectorAll(".ck-grp").forEach((cb) => {
      const dias = this._diasDaChave(cb.dataset.k);
      const marc = dias.filter((v) => this._marcados.has(v)).length;
      cb.indeterminate = marc > 0 && marc < dias.length;
    });
    // Expandir/recolher (só reflete no #lista — a busca no topo mantém o foco).
    lista.querySelectorAll(".exp").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const k = btn.dataset.k;
        if (this._colapsado.has(k)) this._colapsado.delete(k);
        else this._colapsado.add(k);
        this.pintarLista();
      })
    );
    // Marcar 1 dia.
    lista.querySelectorAll(".ck-leaf").forEach((cb) =>
      cb.addEventListener("change", () => {
        if (cb.checked) this._marcados.add(cb.dataset.v);
        else this._marcados.delete(cb.dataset.v);
        this.pintarLista();
      })
    );
    // Marcar um Ano/Mês inteiro = marca/desmarca todas as folhas VISÍVEIS embaixo.
    lista.querySelectorAll(".ck-grp").forEach((cb) =>
      cb.addEventListener("change", () => {
        this._diasDaChave(cb.dataset.k).forEach((v) =>
          cb.checked ? this._marcados.add(v) : this._marcados.delete(v)
        );
        this.pintarLista();
      })
    );
    this.$("#todos").checked = leavesVis.length > 0 && leavesVis.every((v) => this._marcados.has(v));
  }

  posicionar() {
    const r = this._ancora;
    const p = this.$(".painel");
    if (!r || !p) return;
    const w = p.offsetWidth || 300;
    const h = p.offsetHeight || 460; // altura REAL (após pintar a lista)
    // Alinhado à esquerda do cabeçalho, dentro da tela.
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    // Abaixo do tópico; se não couber, sobe (acima do tópico) ou cola no topo —
    // assim o rodapé (Aplicar) NUNCA fica fora da tela e a lista rola internamente.
    let top = r.bottom;
    if (top + h > window.innerHeight - 8) {
      const acima = r.top - h;
      top = acima >= 8 ? acima : Math.max(8, window.innerHeight - 8 - h);
    }
    p.style.left = left + "px";
    p.style.top = top + "px";
  }
}

customElements.define("ui-coluna-menu", UiColunaMenu);
