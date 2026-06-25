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
import { baixarTabela } from "../features/shared/exportar-tabela.js";

/**
 * HTML → texto VISÍVEL (com cache). Usado em filtro/ordenação/busca/totais E export,
 * p/ que TODAS as colunas — inclusive as de `category-badge`/`ui-badge` (rótulo no
 * atributo `nome`/`text`) — sejam filtráveis. Ignora elementos decorativos
 * (`aria-hidden`, ex.: iniciais do avatar). Cache por string de saída (determinística).
 */
const _cacheTexto = new Map();
function _htmlParaTexto(v) {
  const s = String(v == null ? "" : v);
  if (s.indexOf("<") < 0) return s.replace(/\s+/g, " ").trim();
  if (_cacheTexto.has(s)) return _cacheTexto.get(s);
  let txt;
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = s;
    tmp.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
    tmp.querySelectorAll("*").forEach((el) => {
      if (!el.textContent.trim()) {
        const rotulo =
          el.getAttribute("nome") ||
          el.getAttribute("text") ||
          el.getAttribute("title") ||
          el.getAttribute("aria-label") ||
          el.getAttribute("alt");
        if (rotulo) el.textContent = rotulo;
      }
    });
    txt = (tmp.textContent || "").replace(/\s+/g, " ").trim();
  } else {
    txt = s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }
  if (_cacheTexto.size > 5000) _cacheTexto.clear();
  _cacheTexto.set(s, txt);
  return txt;
}

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
  // Texto VISÍVEL da célula (resolve badges via atributo nome/text; ignora decorativos)
  // — vale p/ filtro/ordenação/busca/totais/export, então TODAS as colunas filtram.
  _texto(c, linha) {
    return _htmlParaTexto(c.formato ? c.formato(linha[c.chave], linha) : linha[c.chave]);
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
      /* SEM padding-bottom: a linha de TOTAIS (tfoot sticky) cola no fundo da área
         rolável, logo acima da barra de rolagem horizontal — sem fresta nem linha
         "vazando" por baixo dela. */
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
      /* Tópicos (cabeçalho) sticky na cor da MESA — os vãos mostram a mesa, não branco. */
      thead th { position: sticky; top: 0; z-index: 5; background: var(--cor-mesa); }
      /* LINHA-CARD: as células de DADOS formam UM card branco com CONTORNO CONTÍNUO (não
         por célula): borda em cima/embaixo de TODAS + esquerda na 1ª coluna de dados +
         direita na última = um retângulo único arredondado. A coluna de marcação (.sel)
         fica na cor da mesa, SEM borda (separada do card). */
      tbody td { background: var(--cor-superficie);
        border-top: 1px solid var(--cor-borda); border-bottom: 1px solid var(--cor-borda); }
      tbody td.sel { background: var(--cor-mesa); border: none; }
      tbody tr td:first-child:not(.sel),
      tbody tr td.sel + td { border-left: 1px solid var(--cor-borda);
        border-top-left-radius: var(--raio-sm); border-bottom-left-radius: var(--raio-sm); }
      tbody tr td:last-child { border-right: 1px solid var(--cor-borda);
        border-top-right-radius: var(--raio-sm); border-bottom-right-radius: var(--raio-sm); }
      /* ELEVACAO no hover: o componente sobe como UMA peca. Como TR (table-row) nao e
         transformavel, o "subir" vai nas CELULAS DE DADOS (sobem juntas, como um card so)
         e a SOMBRA unica vai no TR — nunca por celula. O contorno continuo realca
         (escurece) no componente inteiro. A marcacao (.sel) NAO sobe (fica na mesa). */
      tbody tr { position: relative; }
      tbody td:not(.sel) { transition: transform var(--transicao), border-color var(--transicao); }
      tbody tr:hover td:not(.sel) { transform: translateY(-4px); border-color: var(--cor-borda-forte); }
      /* SOMBRA do card via pseudo-elemento: cobre SO a regiao de DADOS (do limite da
         coluna de marcacao ate a direita) e fica POR CIMA de tudo (z alto) — passa por
         cima da marcacao e da linha de soma. A marcacao em si NAO tem sombra. Sutil. */
      tbody tr::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; left: 0;
        border-radius: var(--raio-sm); pointer-events: none; z-index: 4;
        transition: box-shadow var(--transicao), transform var(--transicao); }
      /* Quando há coluna de marcação, a sombra começa na borda esquerda do card (36px) e o
         clip-path corta o "vazamento" horizontal da sombra EXATAMENTE nessa borda (left:0),
         deixando a sombra nos demais lados — assim a lateral fica alinhada e a marcação limpa. */
      :host([tem-selecao]) tbody tr::after { left: 2.5rem; clip-path: inset(-24px -24px -24px 0); }
      /* a sombra (pseudo) sobe o MESMO tanto que o contorno (células) — ficam alinhados. */
      tbody tr:hover::after { box-shadow: var(--sombra-realce); transform: translateY(-4px); }
      .dir { text-align: right; }
      td.dir { font-family: var(--fonte-titulo); font-weight: var(--peso-forte); }
      /* Coluna de marcacao (selecao): largura FIXA (2.5rem = 40px) e na cor da MESA.
         NAO e mais sticky — a linha inteira rola como UMA peca (marcacao + card + conteudo
         juntos), entao a sombra/contorno nunca desalinham na rolagem horizontal. */
      .sel { width: 2.5rem; min-width: 2.5rem; max-width: 2.5rem; text-align: center;
        background: var(--cor-mesa); }
      thead th.sel { z-index: 6; background: var(--cor-mesa); }
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
      /* Linha de SOMA (totais): FIXA na base da área rolável (sticky bottom:0), na cor
         da MESA, OPACA — cola logo acima da barra de rolagem horizontal e NÃO se move.
         (Sem transform: o translateY antigo "vazava" a última linha por baixo dela.) */
      tfoot td { position: sticky; bottom: 0; z-index: 6; background: var(--cor-mesa);
        font-family: var(--fonte-titulo); font-weight: var(--peso-forte);
        box-shadow: 0 -1px 0 var(--cor-divisor); }
      tfoot td.sel { z-index: 7; }
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
      /* Barra de exportar (canto inferior ESQUERDO da mesa, logo após o Total). */
      .barra-exportar { display: flex; align-items: center; gap: var(--esp-2); flex-wrap: wrap;
        padding-top: var(--esp-3); }
      .barra-exportar .exp-lbl { font-size: 11px; color: var(--cor-texto-fraco);
        text-transform: uppercase; letter-spacing: .06em; font-weight: var(--peso-semi);
        margin-right: var(--esp-1); }
      .btn-export { border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        color: var(--cor-texto-suave); border-radius: var(--raio-sm); padding: 5px 12px;
        font-size: var(--fs-xs); font-weight: var(--peso-semi); cursor: pointer;
        transition: background var(--transicao), border-color var(--transicao), color var(--transicao); }
      .btn-export:hover { background: var(--cor-superficie-2); border-color: var(--cor-primaria);
        color: var(--cor-primaria); }
      /* MOBILE: alvos de toque grandes (≥44px), ocupando a largura. */
      @media (max-width: 600px) {
        .barra-exportar { padding-top: var(--esp-4); }
        .barra-exportar .exp-lbl { width: 100%; }
        .btn-export { flex: 1; min-width: 64px; min-height: 44px; }
      }
      /* TABLET: esconde colunas secundárias (a tabela ainda rola na horizontal). */
      @media (max-width: 820px) { th.sec, td.sec { display: none; } }
      /* MOBILE (≤600px): cada LINHA vira um CARD EMPILHADO ("Rótulo: valor"). Sem
         rolagem horizontal, sem hover (toque). O cabeçalho some (os rótulos vêm das
         células via data-label) e TODAS as colunas reaparecem (espaço é vertical). */
      @media (max-width: 600px) {
        .wrap { overflow: visible; max-height: none; padding-bottom: 0; }
        table { display: block; border-spacing: 0; }
        thead { display: none; }
        tbody { display: block; }
        tbody tr { display: block; position: relative; background: var(--cor-superficie);
          border: 1px solid var(--cor-borda); border-radius: var(--raio-md);
          box-shadow: var(--sombra-sm); padding: var(--esp-2) var(--esp-4);
          margin-bottom: var(--esp-3); }
        :host([clicavel]) tbody tr:active { background: var(--cor-superficie-2); } /* feedback de toque */
        tbody tr::after { display: none; } /* desliga sombra/hover do desktop */
        /* Card CONCISO: mostra só as colunas principais (as .sec continuam ocultas,
           regra de ≤820px) — o toque na linha abre o detalhe completo. Cada célula é
           "RÓTULO ........ valor" (rótulo via data-label). */
        tbody td { display: flex; align-items: center; justify-content: space-between;
          gap: var(--esp-4); width: auto; background: transparent; border: none !important;
          border-radius: 0 !important; padding: var(--esp-2) 0; white-space: normal;
          transform: none !important; text-align: right; min-width: 0; }
        tbody td + td { border-top: 1px solid var(--cor-divisor) !important; } /* divisória sutil */
        tbody td::before { content: attr(data-label); flex: none; max-width: 42%; text-align: left;
          color: var(--cor-texto-suave); font-weight: var(--peso-semi);
          font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .04em; }
        td.dir { font-family: var(--fonte-titulo); }
        /* SELEÇÃO: PRIMEIRA linha do card (rótulo "Selecionar" + checkbox), EM FLUXO,
           no topo — não sobrepõe nada (antes era absolute e cobria a 1ª célula). */
        tbody td.sel { width: auto; min-width: 0; max-width: none; padding: var(--esp-2) 0;
          background: transparent; }
        tbody td.sel::before { content: "Selecionar"; flex: none; text-align: left;
          color: var(--cor-texto-suave); font-weight: var(--peso-semi);
          font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .04em; }
        /* ações: botões em linha cheia, fáceis de tocar */
        tbody td.acoes-td { padding-top: var(--esp-2); }
        tbody td.acoes-td::before { content: ""; }
        tbody td.acoes-td .acoes { width: 100%; }
        tbody td.acoes-td .btn-acao { flex: 1; padding: 8px 10px; text-align: center; }
        /* totais ENCOSTAM na última linha (sem fresta): última linha-card perde a margem
           e os cantos de baixo; o rodapé vira a "base" do mesmo bloco (cantos de baixo). */
        tbody tr:last-child { margin-bottom: 0; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
        tfoot { display: block; }
        tfoot tr { display: block; background: var(--cor-mesa); padding: var(--esp-2) var(--esp-4);
          border: 1px solid var(--cor-borda); border-top: none;
          border-radius: 0 0 var(--raio-md) var(--raio-md); }
        tfoot td { position: static; transform: none; display: flex; justify-content: space-between;
          background: transparent; padding: var(--esp-1) 0; box-shadow: none; }
        tfoot td.vazia { display: none; }
        tfoot td[data-label]::before { content: attr(data-label); color: var(--cor-texto-suave);
          font-weight: var(--peso-semi); font-size: var(--fs-xs); text-transform: uppercase; }
        /* "nenhum resultado" ocupa o card inteiro, centralizado */
        tr.sem-result td { display: block; text-align: center; }
        tr.sem-result td::before { content: ""; }
      }
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
    // Marca no host se há coluna de marcação (p/ a sombra do card começar após ela).
    this.toggleAttribute("tem-selecao", temSel);
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

    return `${selbar}<div class="wrap"><table><thead><tr>${cabecalho}</tr></thead><tbody>${this._corpoHtml()}</tbody>${this._rodapeHtml()}</table></div>${this._barraExportarHtml()}`;
  }

  /** Barra de exportação (canto inferior esquerdo, após o Total): CSV/XLS/XLSX/PDF. */
  _barraExportarHtml() {
    if (!this.rows.length) return "";
    return (
      `<div class="barra-exportar"><span class="exp-lbl">Baixar</span>` +
      `<button class="btn-export" data-fmt="xls" type="button">XLS</button>` +
      `<button class="btn-export" data-fmt="xlsx" type="button">XLSX</button>` +
      `<button class="btn-export" data-fmt="csv" type="button">CSV</button>` +
      `<button class="btn-export" data-fmt="pdf" type="button">PDF</button></div>`
    );
  }

  /** Colunas exportáveis (só as de dados, com título) — ignora ações/ícones sem rótulo. */
  _colsExport() {
    return this.columns.filter((c) => String(c.titulo || "").trim());
  }

  /** Monta { titulo, colunas, linhas } da MESA atual (linhas VISÍVEIS = filtro/busca/ordem). */
  _dadosExport() {
    const cols = this._colsExport();
    const card = this.closest && this.closest("ui-card");
    const titulo =
      (card && card.getAttribute("title")) || this.getAttribute("titulo") || "Tabela";
    return {
      titulo,
      colunas: cols.map((c) => c.titulo),
      linhas: this._visiveis().map(({ linha }) => cols.map((c) => this._texto(c, linha))),
    };
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
            // data-label = título da coluna → vira o rótulo "Coluna: valor" no card mobile.
            const lbl = String(c.titulo || "").replace(/"/g, "&quot;");
            return `<td class="${classe(c)}"${estilo(c)} data-label="${lbl}">${v == null ? "" : v}</td>`;
          })
          .join("");
        const botoes = temAcoes
          ? `<td class="acoes-td"><div class="acoes">${acoes
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
          const lbl = String(c.titulo || "").replace(/"/g, "&quot;");
          return `<td class="dir" data-label="${lbl}">${moeda(soma)}</td>`;
        }
        const cel = primeira ? `<td class="rotulo">Total</td>` : `<td class="vazia"></td>`;
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
    // Exportar (CSV/XLS/XLSX/PDF) — usa as linhas VISÍVEIS (filtro/busca/ordem aplicados).
    this.$$(".btn-export").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          baixarTabela(btn.dataset.fmt, this._dadosExport());
        } catch (err) {
          console.error("Falha ao exportar a tabela:", err);
        }
      });
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
