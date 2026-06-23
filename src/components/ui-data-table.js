/**
 * <ui-data-table> — Tabela/data-grid genérica (primitivo). Além de exibir dados,
 * faz internamente: seleção de linhas, ordenação/filtro por coluna (dropdown
 * `ui-coluna-menu` no cabeçalho), linha de TOTAIS e soma dos selecionados.
 *
 * Propriedades:
 *   .columns = [{ chave, titulo, formato?(valor,linha)=>string, alinhar?, largura?,
 *                 secundaria?, moeda?, valorNum?(linha)=>number }]
 *     moeda: true   → entra no somatório (linha de Total + soma dos selecionados).
 *     valorNum      → número a somar (p/ colunas com total derivado; default Number(linha[chave])).
 *     largura/secundaria/alinhar/formato: como antes.
 *   .rows  = [ objeto, ... ]
 *   .acoes = [{ nome, rotulo, variant? }]
 * Atributos: empty-text, fluido, clicavel, editar-massa, excluir-massa.
 *   A COLUNA DE SELEÇÃO só aparece quando há `editar-massa` e/ou `excluir-massa`
 *   (a seleção serve às operações em massa; tabelas só-leitura não a mostram).
 *   `editar-massa` → botão "Editar selecionadas"; `excluir-massa` → "Excluir selecionadas".
 * Eventos: "acao" ({acao,linha}), "linha" ({linha}), "selecao" ({linhas}),
 *          "editar-massa" ({linhas}), "excluir-massa" ({linhas}).
 *
 * Não conhece o domínio: quem usa fornece colunas/formatadores e (opcional) liga
 * `editar-massa`/`excluir-massa` ao seu form/remove. Ordenação/filtro/seleção são
 * estado interno e PERSISTEM quando `.rows` é re-atribuído (refresh não perde o filtro).
 */
import { BaseElement } from "./base-element.js";
import { moeda } from "../core/formatters.js";
import "./ui-coluna-menu.js";
import { injetarBuscaNoCard } from "./ui-busca.js";
import { confirmar } from "./confirmar.js";

class UiDataTable extends BaseElement {
  static get observedAttributes() {
    return ["empty-text", "fluido", "clicavel", "editar-massa", "excluir-massa"];
  }

  /** A seleção (e a barra de ações em massa) só existe em tabelas editáveis/excluíveis. */
  _temSelecao() {
    return this.hasAttribute("editar-massa") || this.hasAttribute("excluir-massa") || this.acoesMassa.length > 0;
  }

  /** Ações em massa CUSTOMIZADAS na barra de seleção: [{nome, rotulo, variant?}]. */
  set acoesMassa(v) {
    this._acoesMassa = v || [];
    this._talvezRenderizar();
  }
  get acoesMassa() {
    return this._acoesMassa || [];
  }

  set columns(v) {
    this._columns = v || [];
    this._talvezRenderizar();
  }
  get columns() {
    return this._columns || [];
  }
  set rows(v) {
    this._rows = v || [];
    this._talvezRenderizar();
  }
  get rows() {
    return this._rows || [];
  }
  set acoes(v) {
    this._acoes = v || [];
    this._talvezRenderizar();
  }
  get acoes() {
    return this._acoes || [];
  }

  _talvezRenderizar() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  /* ----------------------- Estado de ordenar/filtrar/selecionar -------------- */
  get _ordem() {
    return this.__ordem || null;
  } // { col: idx, dir: 'asc'|'desc' }
  set _ordem(v) {
    this.__ordem = v;
  }
  get _filtros() {
    if (!this.__filtros) this.__filtros = {};
    return this.__filtros;
  } // { idx: Set<texto> }
  get _sel() {
    if (!this.__sel) this.__sel = new Set();
    return this.__sel;
  } // Set<linha (objeto)>

  /* ----------------------------- Helpers de valor ---------------------------- */
  _texto(c, linha) {
    const v = c.formato ? c.formato(linha[c.chave], linha) : linha[c.chave];
    return String(v == null ? "" : v)
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  _num(c, linha) {
    const n = c.valorNum ? c.valorNum(linha) : linha[c.chave];
    return Number(n) || 0;
  }
  _temMoeda() {
    return this.columns.some((c) => c.moeda);
  }

  /** Valores distintos (textos exibidos) de uma coluna — p/ o dropdown. */
  _distintos(i) {
    const c = this.columns[i];
    const vistos = new Set();
    const out = [];
    this.rows.forEach((l) => {
      const t = this._texto(c, l);
      if (!vistos.has(t)) {
        vistos.add(t);
        out.push(l);
      }
    });
    out.sort((a, b) =>
      c.moeda ? this._num(c, a) - this._num(c, b) : this._texto(c, a).localeCompare(this._texto(c, b))
    );
    return out.map((l) => this._texto(c, l));
  }

  /** Linhas visíveis (filtro + ordenação) como [{ linha, i }] (i = índice original). */
  _visiveis() {
    let arr = this.rows.map((linha, i) => ({ linha, i }));
    Object.keys(this._filtros).forEach((idx) => {
      const c = this.columns[idx];
      if (!c) return;
      const permitidos = this._filtros[idx];
      arr = arr.filter((o) => permitidos.has(this._texto(c, o.linha)));
    });
    // Busca global (qualquer coluna) — campo da <ui-busca> no cabeçalho.
    const q = this._buscaTexto || "";
    if (q) arr = arr.filter((o) => this.columns.some((c) => this._texto(c, o.linha).toLowerCase().includes(q)));
    if (this._ordem && this.columns[this._ordem.col]) {
      const c = this.columns[this._ordem.col];
      const dir = this._ordem.dir === "desc" ? -1 : 1;
      arr.sort((a, b) => {
        const r = c.moeda
          ? this._num(c, a.linha) - this._num(c, b.linha)
          : this._texto(c, a.linha).localeCompare(this._texto(c, b.linha), "pt", { numeric: true });
        return r * dir;
      });
    }
    return arr;
  }

  estilos() {
    return `
      :host { display: block; }
      /* Área rolável com altura limitada: cabeçalho e totais ficam fixos (sticky)
         e a barra de rolagem horizontal fica sempre na base da tabela. */
      .wrap { overflow: auto; max-height: 70vh; -webkit-overflow-scrolling: touch; }
      .sem-result td { text-align: center; color: var(--cor-texto-fraco); padding: var(--esp-5); }
      /* Tabela = MESA: cada LINHA do corpo é um card branco; leve espaçamento entre elas. */
      table { width: 100%; border-collapse: separate; border-spacing: 0 var(--esp-2); font-size: var(--fs-sm); }
      th, td { padding: var(--esp-3) var(--esp-3); text-align: left; white-space: nowrap; vertical-align: middle; }
      :host([fluido]) table { table-layout: auto; }
      :host([fluido]) td { white-space: normal; }
      :host([clicavel]) tbody tr { cursor: pointer; }
      th { color: var(--cor-texto-fraco); font-weight: var(--peso-semi);
        font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
      /* cabeçalho sticky na cor da MESA (os vãos entre os cards mostram a mesa, não branco). */
      thead th { position: sticky; top: 0; z-index: 3; background: var(--cor-fundo); }
      /* LINHA-CARD: fundo branco, cantos arredondados nas pontas, sombra + elevação no hover. */
      tbody td { background: var(--cor-superficie); }
      tbody tr td:first-child { border-top-left-radius: var(--raio-sm); border-bottom-left-radius: var(--raio-sm); }
      tbody tr td:last-child { border-top-right-radius: var(--raio-sm); border-bottom-right-radius: var(--raio-sm); }
      tbody tr { box-shadow: var(--sombra-sm); transition: transform var(--transicao), box-shadow var(--transicao); }
      tbody tr:hover { transform: translateY(-2px); box-shadow: var(--sombra-md); }
      .dir { text-align: right; }
      td.dir { font-family: var(--fonte-titulo); font-weight: var(--peso-forte); }
      /* Coluna inicial de seleção: fixa à esquerda. */
      .sel { width: 36px; text-align: center; position: sticky; left: 0;
        background: var(--cor-superficie); z-index: 2; }
      thead th.sel { z-index: 4; background: var(--cor-fundo); }
      input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--cor-primaria); cursor: pointer; }
      .th-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
        font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit;
        cursor: pointer; padding: 0; }
      .th-btn:hover { color: var(--cor-primaria); }
      .th-btn .seta { font-size: 10px; opacity: .6; }
      .th-btn.ativo { color: var(--cor-primaria); }
      .acoes { display: flex; gap: var(--esp-2); justify-content: flex-end; }
      .btn-acao { border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        border-radius: var(--raio-sm); padding: 4px 10px; font-size: var(--fs-xs); color: var(--cor-texto-suave); }
      .btn-acao:hover { background: var(--cor-superficie-2); }
      .btn-acao.perigo { color: var(--cor-erro); border-color: var(--cor-erro-suave); }
      /* Linha de TOTAIS: fixa na base da área da tabela. */
      tfoot td { position: sticky; bottom: 0; z-index: 2; background: var(--cor-superficie);
        border-top: 2px solid var(--cor-borda); font-family: var(--fonte-titulo);
        font-weight: var(--peso-forte); }
      tfoot td.sel { z-index: 3; }
      tfoot .rotulo { font-family: var(--fonte-base); font-weight: var(--peso-semi);
        color: var(--cor-texto-suave); text-transform: uppercase; font-size: 11px; letter-spacing: .06em; }
      /* Barra de seleção (análise dos selecionados). */
      .selbar { display: flex; align-items: center; gap: var(--esp-3); flex-wrap: wrap;
        padding: var(--esp-2) var(--esp-3); margin-bottom: var(--esp-2);
        background: var(--cor-primaria-suave); border: 1px solid var(--cor-primaria);
        border-radius: var(--raio-sm); font-size: var(--fs-sm); }
      .selbar .n { font-weight: var(--peso-semi); color: var(--cor-primaria-escura); }
      .selbar .somas { display: flex; gap: var(--esp-3); flex-wrap: wrap; flex: 1; }
      .selbar .soma b { font-family: var(--fonte-titulo); }
      .selbar .acao-massa { border: 1px solid var(--cor-primaria); background: var(--cor-primaria);
        color: #fff; border-radius: var(--raio-sm); padding: 4px 12px; font-size: var(--fs-xs);
        cursor: pointer; font-weight: var(--peso-semi); }
      .selbar .acao-massa:first-of-type { margin-left: auto; }
      .selbar .acao-massa:hover { background: var(--cor-primaria-escura); }
      .selbar .editar { margin-left: auto; border: 1px solid var(--cor-primaria);
        background: var(--cor-primaria); color: #fff; border-radius: var(--raio-sm);
        padding: 4px 12px; font-size: var(--fs-xs); cursor: pointer; font-weight: var(--peso-semi); }
      .selbar .editar:hover { background: var(--cor-primaria-escura); }
      .selbar .editar + .excluir { margin-left: 0; }
      .selbar .excluir { margin-left: auto; border: 1px solid var(--cor-erro-suave);
        background: var(--cor-superficie); color: var(--cor-erro); border-radius: var(--raio-sm);
        padding: 4px 12px; font-size: var(--fs-xs); cursor: pointer; }
      .vazio { padding: var(--esp-6); text-align: center; color: var(--cor-texto-fraco); }
      @media (max-width: 820px) { th.sec, td.sec { display: none; } }
    `;
  }

  template() {
    const cols = this.columns;
    const acoes = this.acoes;
    const temAcoes = acoes.length > 0;

    // Poda a seleção para linhas ainda presentes.
    this.__sel = new Set([...this._sel].filter((l) => this.rows.includes(l)));

    if (!this.rows.length) {
      const txt = this.getAttribute("empty-text") || "Nenhum registro.";
      return `<div class="vazio">${txt}</div>`;
    }

    const estilo = (c) => (c.largura ? ` style="min-width:${c.largura}"` : "");
    const classe = (c) => [c.alinhar === "dir" ? "dir" : "", c.secundaria ? "sec" : ""].filter(Boolean).join(" ");
    const ativa = (i) => (this._ordem && this._ordem.col === i) || this._filtros[i];

    const temSel = this._temSelecao();
    const cabecalho =
      (temSel ? `<th class="sel"><input type="checkbox" id="selTodos"></th>` : "") +
      cols
        .map(
          (c, i) =>
            `<th class="${classe(c)}"${estilo(c)}><button class="th-btn ${ativa(i) ? "ativo" : ""}" data-col="${i}">${c.titulo}${ativa(i) ? " •" : ""} <span class="seta">▾</span></button></th>`
        )
        .join("") +
      (temAcoes ? "<th></th>" : "");

    const selbar = this._sel.size ? this._selbarHtml() : "";

    return `${selbar}<div class="wrap"><table><thead><tr>${cabecalho}</tr></thead><tbody>${this._corpoHtml()}</tbody>${this._rodapeHtml()}</table></div>`;
  }

  /** Busca global (chamada pela <ui-busca> no cabeçalho do card) — só atualiza o corpo. */
  buscar(texto) {
    this._buscaTexto = (texto || "").toLowerCase();
    this._atualizarCorpo();
  }

  /** HTML do corpo (tbody) — linhas visíveis (filtro + busca + ordenação). */
  _corpoHtml() {
    const cols = this.columns;
    const acoes = this.acoes;
    const temAcoes = acoes.length > 0;
    const temSel = this._temSelecao();
    const estilo = (c) => (c.largura ? ` style="min-width:${c.largura}"` : "");
    const classe = (c) => [c.alinhar === "dir" ? "dir" : "", c.secundaria ? "sec" : ""].filter(Boolean).join(" ");
    const vis = this._visiveis();
    if (!vis.length) {
      const span = cols.length + (temSel ? 1 : 0) + (temAcoes ? 1 : 0);
      return `<tr class="sem-result"><td colspan="${span}">Nenhum resultado para a pesquisa.</td></tr>`;
    }
    return vis
      .map(({ linha, i }) => {
        const marcada = this._sel.has(linha);
        const sel = temSel
          ? `<td class="sel"><input type="checkbox" class="rowsel" data-i="${i}" ${marcada ? "checked" : ""}></td>`
          : "";
        const celulas = cols
          .map((c) => {
            const v = c.formato ? c.formato(linha[c.chave], linha) : linha[c.chave];
            return `<td class="${classe(c)}"${estilo(c)}>${v == null ? "" : v}</td>`;
          })
          .join("");
        const botoes = temAcoes
          ? `<td><div class="acoes">${acoes
              .map(
                (a) =>
                  `<button class="btn-acao ${a.variant || ""}" data-acao="${a.nome}" data-idx="${i}">${a.rotulo}</button>`
              )
              .join("")}</div></td>`
          : "";
        return `<tr data-idx="${i}">${sel}${celulas}${botoes}</tr>`;
      })
      .join("");
  }

  /** HTML do rodapé (tfoot) — soma das colunas monetárias das linhas visíveis. */
  _rodapeHtml() {
    if (!this._temMoeda() || !this.rows.length) return "";
    const cols = this.columns;
    const temAcoes = this.acoes.length > 0;
    const vis = this._visiveis().map((o) => o.linha);
    let primeira = true;
    const cels = cols
      .map((c) => {
        if (c.moeda) {
          const soma = vis.reduce((s, l) => s + this._num(c, l), 0);
          primeira = false;
          return `<td class="dir">${moeda(soma)}</td>`;
        }
        const cel = primeira ? `<td class="rotulo">Total</td>` : `<td></td>`;
        primeira = false;
        return cel;
      })
      .join("");
    return `<tfoot><tr>${this._temSelecao() ? '<td class="sel"></td>' : ""}${cels}${temAcoes ? "<td></td>" : ""}</tr></tfoot>`;
  }

  _selbarHtml() {
    const selecionadas = [...this._sel];
    const somas = this.columns
      .filter((c) => c.moeda)
      .map((c) => {
        const soma = selecionadas.reduce((s, l) => s + this._num(c, l), 0);
        return `<span class="soma">${c.titulo}: <b>${moeda(soma)}</b></span>`;
      })
      .join("");
    const custom = this.acoesMassa
      .map((a, i) => `<button class="acao-massa ${a.variant || ""}" data-i="${i}">${a.rotulo}</button>`)
      .join("");
    const editar = this.hasAttribute("editar-massa")
      ? `<button class="editar" id="editarMassa">Editar selecionadas</button>`
      : "";
    const excluir = this.hasAttribute("excluir-massa")
      ? `<button class="excluir" id="excluirMassa">Excluir selecionadas</button>`
      : "";
    return `<div class="selbar"><span class="n">${selecionadas.length} selecionada(s)</span><div class="somas">${somas}</div>${custom}${editar}${excluir}</div>`;
  }

  aposRender() {
    this._ligarLinhas();
    // Selecionar todos (visíveis).
    const selTodos = this.$("#selTodos");
    if (selTodos) {
      const vis = this._visiveis().map((o) => o.linha);
      selTodos.checked = vis.length > 0 && vis.every((l) => this._sel.has(l));
      selTodos.addEventListener("change", () => {
        const visiveis = this._visiveis().map((o) => o.linha);
        if (selTodos.checked) visiveis.forEach((l) => this._sel.add(l));
        else visiveis.forEach((l) => this._sel.delete(l));
        this.emitir("selecao", { linhas: [...this._sel] });
        this.renderizar();
      });
    }
    // Ações em massa customizadas → evento genérico "acao-massa" (a view decide).
    this.$$(".acao-massa").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = this.acoesMassa[Number(btn.dataset.i)];
        const linhas = [...this._sel];
        if (a && linhas.length) this.emitir("acao-massa", { acao: a.nome, linhas });
      });
    });
    // Editar selecionadas em massa — abre o form de edição (a view decide).
    const btnEditar = this.$("#editarMassa");
    if (btnEditar) {
      btnEditar.addEventListener("click", () => {
        const linhas = [...this._sel];
        if (linhas.length) this.emitir("editar-massa", { linhas });
      });
    }
    // Excluir selecionadas em massa.
    const btnExcluir = this.$("#excluirMassa");
    if (btnExcluir) {
      btnExcluir.addEventListener("click", async () => {
        const linhas = [...this._sel];
        if (!linhas.length) return;
        const ok = await confirmar({
          titulo: "Excluir selecionados",
          mensagem: `Excluir ${linhas.length} item(ns) selecionado(s)?`,
          perigo: true,
          rotuloOk: "Excluir",
        });
        if (!ok) return;
        this.__sel = new Set();
        this.emitir("excluir-massa", { linhas });
      });
    }
    // Cabeçalho → dropdown de ordenar/filtrar.
    this.$$(".th-btn").forEach((btn) => {
      btn.addEventListener("click", () => this._abrirMenu(Number(btn.dataset.col), btn));
    });
    // Busca: vai no cabeçalho do card (à esquerda do botão), ligada a esta tabela.
    // (Re)liga em todo render; é idempotente. A <ui-busca> vive no card → preserva foco.
    const busca = injetarBuscaNoCard(this, this);
    if (busca && this._buscaTexto) busca.definir(this._buscaTexto);
  }

  /** Liga eventos das linhas do tbody (ações, clique, seleção). Reusado pela busca. */
  _ligarLinhas() {
    this.$$(".btn-acao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.emitir("acao", { acao: btn.dataset.acao, linha: this.rows[Number(btn.dataset.idx)] });
      });
    });
    if (this.hasAttribute("clicavel")) {
      this.$$("tbody tr").forEach((tr) => {
        tr.addEventListener("click", (e) => {
          if (e.target.closest(".sel, .btn-acao")) return;
          this.emitir("linha", { linha: this.rows[Number(tr.dataset.idx)] });
        });
      });
    }
    this.$$(".rowsel").forEach((cb) => {
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", () => {
        const linha = this.rows[Number(cb.dataset.i)];
        if (cb.checked) this._sel.add(linha);
        else this._sel.delete(linha);
        this.emitir("selecao", { linhas: [...this._sel] });
        this.renderizar();
      });
    });
  }

  /** Re-renderiza SÓ o corpo/rodapé (busca) sem recriar a <ui-busca> nem o cabeçalho. */
  _atualizarCorpo() {
    const table = this.shadowRoot.querySelector("table");
    const tbody = table && table.querySelector("tbody");
    if (!tbody) return;
    tbody.innerHTML = this._corpoHtml();
    const tfootAntigo = table.querySelector("tfoot");
    if (tfootAntigo) tfootAntigo.remove();
    const rodape = this._rodapeHtml();
    if (rodape) table.insertAdjacentHTML("beforeend", rodape);
    const selTodos = this.$("#selTodos");
    if (selTodos) {
      const vis = this._visiveis().map((o) => o.linha);
      selTodos.checked = vis.length > 0 && vis.every((l) => this._sel.has(l));
    }
    this._ligarLinhas();
  }

  _abrirMenu(col, anchorEl) {
    const c = this.columns[col];
    if (!c) return;
    const menu = document.createElement("ui-coluna-menu");
    menu.coluna = c;
    menu.valores = this._distintos(col);
    menu.estado = {
      ordem: this._ordem && this._ordem.col === col ? this._ordem.dir : null,
      selecionados: this._filtros[col] || null,
    };
    menu.ancora = anchorEl.getBoundingClientRect();
    const fechar = () => menu.remove();
    menu.addEventListener("fechar", fechar);
    menu.addEventListener("aplicar", (e) => {
      const { ordem, selecionados } = e.detail;
      this._ordem = ordem ? { col, dir: ordem } : this._ordem && this._ordem.col === col ? null : this._ordem;
      if (selecionados) this._filtros[col] = selecionados;
      else delete this._filtros[col];
      fechar();
      this.renderizar();
    });
    menu.addEventListener("remover", () => {
      if (this._ordem && this._ordem.col === col) this._ordem = null;
      delete this._filtros[col];
      fechar();
      this.renderizar();
    });
    document.body.appendChild(menu);
  }
}

customElements.define("ui-data-table", UiDataTable);
