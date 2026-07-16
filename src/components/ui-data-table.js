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
import { vibrar, pulso, HAPTICO } from "./haptic.js";
import "./ui-coluna-menu.js";
import "./ui-filtro-data.js";
import "./ui-empty-state.js";
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
    return ["empty-text", "empty-titulo", "empty-texto", "empty-icone", "fluido", "clicavel", "editar-massa", "excluir-massa"];
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
    this.__idxData = undefined; // recalcula a coluna de data padrão
    this._talvezRenderizar();
  }
  get columns() {
    return this._columns || [];
  }
  set rows(v) {
    this._rows = v || [];
    this.__idxData = undefined;
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
  /** Chave de ORDENAÇÃO da célula: número (moeda/`valorNum`), `valorOrd(linha)` explícito,
   * ou o TEXTO exibido — com datas "DD/MM/AAAA" viradas em "AAAAMMDD" p/ ordem CRONOLÓGICA
   * (senão o localeCompare numérico ordena pelo DIA, ex.: 29/04 > 23/06). */
  _ordVal(c, linha) {
    if (c.moeda || c.valorNum) return this._num(c, linha);
    if (c.valorOrd) return c.valorOrd(linha);
    const t = String(this._texto(c, linha)).trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
    return m ? m[3] + m[2] + m[1] : t;
  }
  /** Comparador ÚNICO de 2 linhas por uma coluna (usado nos visíveis E no dropdown):
   * numérico quando ambos são números; senão texto (localeCompare pt, numeric). */
  _cmp(c, la, lb) {
    const va = this._ordVal(c, la);
    const vb = this._ordVal(c, lb);
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb), "pt", { numeric: true });
  }

  /** Data ISO ("AAAA-MM-DD") de uma linha nesta coluna (via `valorOrd` ISO ou o texto
   * "DD/MM/AAAA"). "" quando não há data. Base do filtro por intervalo e da detecção. */
  _isoDaLinha(c, linha) {
    if (c.valorOrd) {
      const v = String(c.valorOrd(linha) || "");
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    }
    const t = String(this._texto(c, linha)).trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  }

  /** Coluna de DATA? (todos os textos distintos no padrão "DD/MM/AAAA"). */
  _ehColunaData(col) {
    const vals = this._distintos(col);
    return vals.length > 0 && vals.every((v) => /^\d{2}\/\d{2}\/\d{4}$/.test(String(v)));
  }

  /** Datas ISO PRESENTES na coluna (p/ os chips adaptativos do `ui-filtro-data`). */
  _datasDaColuna(col) {
    const c = this.columns[col];
    if (!c) return [];
    const out = [];
    this.rows.forEach((l) => {
      const iso = this._isoDaLinha(c, l);
      if (iso) out.push(iso);
    });
    return out;
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
    out.sort((a, b) => this._cmp(c, a, b));
    return out.map((l) => this._texto(c, l));
  }

  /** Linhas visíveis (filtro + ordenação) como [{ linha, i }] (i = índice original). */
  _visiveis() {
    let arr = this.rows.map((linha, i) => ({ linha, i }));
    Object.keys(this._filtros).forEach((idx) => {
      const c = this.columns[idx];
      if (!c) return;
      const f = this._filtros[idx];
      if (f instanceof Set) {
        arr = arr.filter((o) => f.has(this._texto(c, o.linha)));
      } else if (f && (f.de || f.ate)) {
        // Filtro por INTERVALO de data (ui-filtro-data): linha visível ⇔ data no [de, ate].
        arr = arr.filter((o) => {
          const iso = this._isoDaLinha(c, o.linha);
          if (!iso) return false;
          if (f.de && iso < f.de) return false;
          if (f.ate && iso > f.ate) return false;
          return true;
        });
      }
    });
    // Busca global (qualquer coluna) — campo da <ui-busca> no cabeçalho.
    const q = this._buscaTexto || "";
    if (q) arr = arr.filter((o) => this.columns.some((c) => this._texto(c, o.linha).toLowerCase().includes(q)));
    if (this._ordem && this.columns[this._ordem.col]) {
      const c = this.columns[this._ordem.col];
      const dir = this._ordem.dir === "desc" ? -1 : 1;
      arr.sort((a, b) => this._cmp(c, a.linha, b.linha) * dir);
    } else {
      // PADRÃO (sem ordenação do usuário): ordem DECRESCENTE de data — se a mesa tem
      // uma coluna de data, as linhas mais recentes ficam no topo.
      const idx = this._colunaDataPadrao();
      if (idx >= 0) {
        const c = this.columns[idx];
        arr.sort((a, b) => this._cmp(c, a.linha, b.linha) * -1);
      }
    }
    return arr;
  }

  /** Índice da 1ª coluna de DATA (todas as células não-vazias de uma amostra são datas)
   * — a ordenação-padrão decrescente usa ela. Cacheado; invalidado ao trocar rows/cols. */
  _colunaDataPadrao() {
    if (this.__idxData !== undefined) return this.__idxData;
    this.__idxData = -1;
    const amostra = this.rows.slice(0, 30);
    if (amostra.length) {
      for (let i = 0; i < this.columns.length; i++) {
        const c = this.columns[i];
        let comValor = 0;
        let comData = 0;
        amostra.forEach((l) => {
          if (String(this._texto(c, l)).trim()) {
            comValor++;
            if (this._isoDaLinha(c, l)) comData++;
          }
        });
        if (comValor > 0 && comData === comValor) {
          this.__idxData = i;
          break;
        }
      }
    }
    return this.__idxData;
  }

  /** Há filtro de coluna OU busca global ativa? */
  _temFiltro() {
    return Object.keys(this._filtros).length > 0 || !!this._buscaTexto;
  }

  /** Banner "filtro ativo" (só quando há filtro/busca): mostra quantos itens estão
   * OCULTOS — evita a confusão de "adicionei um item e ele sumiu" — + Limpar filtros. */
  _filtroAvisoHtml() {
    if (!this._temFiltro()) return "";
    const total = this.rows.length;
    const vis = this._visiveis().length;
    const ocultos = total - vis;
    const txt =
      ocultos > 0
        ? `Filtro ativo — <span class="oculto-forte">${ocultos} ${ocultos > 1 ? "itens ocultos" : "item oculto"}</span> (mostrando ${vis} de ${total}).`
        : `Filtro ativo — mostrando ${vis} de ${total}.`;
    return `<div class="filtro-aviso"><span>${txt}</span><button type="button" class="limpar-filtros">Limpar filtros</button></div>`;
  }

  /** Zera filtros de coluna + busca global e re-renderiza (mostra tudo de novo). */
  _limparFiltros() {
    this.__filtros = {};
    this._buscaTexto = "";
    this.renderizar();
    const busca = injetarBuscaNoCard(this, this); // idempotente: pega a <ui-busca> do card
    if (busca && busca.definir) busca.definir("");
  }

  estilos() {
    return `
      :host { display: block; }
      /* Aviso de FILTRO ATIVO: deixa claro que há linhas ocultas (ex.: item recém
         adicionado que não casa com o filtro) + botão p/ limpar num toque. */
      .filtro-aviso { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; margin-bottom: var(--esp-2);
        padding: var(--esp-2) var(--esp-3); background: var(--cor-primaria-suave);
        border: 1px solid var(--cor-primaria); border-radius: var(--raio-sm);
        font-size: var(--fs-sm); color: var(--cor-texto); }
      .filtro-aviso .oculto-forte { font-weight: var(--peso-semi); }
      .limpar-filtros { flex: none; border: 1px solid var(--cor-primaria);
        background: var(--cor-superficie); color: var(--cor-primaria); border-radius: var(--raio-sm);
        padding: 4px 12px; font: inherit; font-size: var(--fs-sm); font-weight: var(--peso-medio);
        cursor: pointer; min-height: 32px; }
      .limpar-filtros:hover { background: var(--cor-primaria); color: #fff; }
      @media (hover: none), (max-width: 820px) { .limpar-filtros { min-height: 40px; } }
      /* Área rolável com altura limitada: cabeçalho e totais ficam fixos (sticky)
         e a barra de rolagem horizontal fica sempre na base da tabela. */
      /* padding-bottom = ao border-spacing: junto com o translateY do tfoot (abaixo),
         a linha de TOTAIS cola na base da rolagem TANTO no meio QUANTO no FIM do scroll
         (o Chrome ignora margem negativa p/ a área rolável; este par resolve o "gap de 8px"
         que sobrava no fim sem cortar o total no meio). */
      .wrap { overflow: auto; max-height: 70vh; -webkit-overflow-scrolling: touch; padding-bottom: var(--esp-2); }
      .sem-result td { text-align: center; color: var(--cor-texto-fraco); padding: var(--esp-5); }
      /* Tabela = MESA: cada LINHA do corpo é um card branco; leve espaçamento entre elas.
         margin-bottom negativo (= border-spacing) + padding-bottom da .wrap + translateY do
         tfoot formam o TRIO que cola o total na base no meio E no fim do scroll. */
      table { width: 100%; border-collapse: separate; border-spacing: 0 var(--esp-2);
        font-size: var(--fs-sm); margin-bottom: calc(-1 * var(--esp-2)); }
      th, td { padding: var(--esp-3) var(--esp-3); text-align: left; white-space: nowrap; vertical-align: middle; }
      :host([fluido]) table { table-layout: auto; }
      :host([fluido]) td { white-space: normal; }
      /* Números/moeda (.dir) NUNCA quebram — "R$ 1.234,50" fica numa linha só. */
      :host([fluido]) td.dir { white-space: nowrap; }
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
      /* LINHA OCUPADA (a linha está sendo ATUALIZADA): spinner interno SÓ nesta linha
         + bloqueia a interação nela; as células ficam esmaecidas atrás. Não re-renderiza
         a tabela nem afeta as outras linhas/o resto da página. */
      tbody tr.ocupada { pointer-events: none; }
      tbody tr.ocupada td:not(.sel) { opacity: .45; transition: opacity var(--transicao); }
      tbody tr.ocupada::before { content: ""; position: absolute; z-index: 6;
        top: 50%; left: 50%; width: 20px; height: 20px; margin: -10px 0 0 -10px;
        border: 2.5px solid var(--cor-borda); border-top-color: var(--cor-primaria);
        border-radius: 50%; animation: ui-dt-spin .7s linear infinite; }
      @keyframes ui-dt-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { tbody tr.ocupada::before { animation-duration: 1.8s; } }
      .dir { text-align: right; }
      td.dir { font-family: var(--fonte-titulo); font-weight: var(--peso-forte); }
      /* Coluna de marcacao (selecao): largura FIXA (2.5rem = 40px) e na cor da MESA.
         NAO e mais sticky — a linha inteira rola como UMA peca (marcacao + card + conteudo
         juntos), entao a sombra/contorno nunca desalinham na rolagem horizontal. */
      .sel { width: 2.5rem; min-width: 2.5rem; max-width: 2.5rem; text-align: center;
        background: var(--cor-mesa); }
      thead th.sel { z-index: 6; background: var(--cor-mesa); }
      input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--cor-primaria); cursor: pointer; }
      /* Alvo de toque confortável sem aumentar o visual do checkbox. */
      .selbox { display: inline-flex; align-items: center; justify-content: center;
        min-width: 34px; min-height: 34px; margin: 0 auto; cursor: pointer; }
      /* Em telas de TOQUE (sem mouse) OU estreitas (tablet/celular, inclui híbridos
         toque+trackpad) sobe p/ 44px (recomendação WCAG). */
      @media (hover: none), (max-width: 820px) { .selbox { min-width: 44px; min-height: 44px; } }
      .th-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
        font: inherit; color: inherit; text-transform: inherit; letter-spacing: inherit;
        cursor: pointer; padding: 0; }
      .th-btn:hover { color: var(--cor-primaria); }
      .th-btn .seta { display: inline-flex; align-items: center; opacity: .55; color: currentColor;
        transition: transform .15s ease; }
      .th-btn .seta svg { display: block; }
      .th-btn.ativo { color: var(--cor-primaria); }
      .th-btn.ativo .seta { opacity: 1; }
      /* Coluna ordenada: o próprio chevron indica a direção (baixo = decrescente,
         cima = crescente) — dispensa o antigo marcador de bolinha. */
      .th-btn.asc .seta { transform: rotate(180deg); }
      .acoes { display: flex; gap: var(--esp-2); justify-content: flex-end; }
      .btn-acao { border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        border-radius: var(--raio-sm); padding: 4px 10px; font-size: var(--fs-xs); color: var(--cor-texto-suave); }
      .btn-acao:hover { background: var(--cor-superficie-2); }
      .btn-acao.perigo { color: var(--cor-erro); border-color: var(--cor-erro-suave); }
      /* Linha de SOMA (totais): FIXA na base da área rolável (sticky bottom:0), na cor
         da MESA, OPACA — cola logo acima da barra de rolagem horizontal e NÃO se move.
         O translateY(+esp-2) ocupa o padding-bottom da .wrap, colando o total na base
         no MEIO e no FIM do scroll (sem o gap de 8px do border-spacing). É p/ BAIXO
         (o antigo era p/ cima, que "vazava" a última linha por baixo do total). */
      tfoot td { position: sticky; bottom: 0; z-index: 6; background: var(--cor-mesa);
        font-family: var(--fonte-titulo); font-weight: var(--peso-forte);
        box-shadow: 0 -1px 0 var(--cor-divisor); transform: translateY(var(--esp-2)); }
      tfoot td.sel { z-index: 7; }
      tfoot .rotulo { font-family: var(--fonte-base); font-weight: var(--peso-semi);
        color: var(--cor-texto-suave); text-transform: uppercase; font-size: 11px; letter-spacing: .06em; }
      /* Barra de seleção (análise dos selecionados): FLUTUA na base da mesa (sticky
         bottom), ACIMA da linha de totais e POR CIMA das linhas — como o totais. Fora
         do fluxo (não empurra a mesa), então selecionar NÃO dá "pulo" p/ cima/baixo.
         O bottom é ajustado por JS p/ ficar logo acima do tfoot (totais) quando existe. */
      .selbar { position: sticky; bottom: 0; z-index: 8; display: flex; align-items: center;
        gap: var(--esp-3); flex-wrap: wrap; padding: var(--esp-2) var(--esp-3);
        margin: var(--esp-2) 0 0; background: var(--vidro-fundo-forte, var(--cor-primaria-suave));
        -webkit-backdrop-filter: var(--vidro-blur); backdrop-filter: var(--vidro-blur);
        border: 1px solid var(--cor-primaria); border-radius: var(--raio-md);
        box-shadow: var(--sombra-md); font-size: var(--fs-sm); }
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
        table { display: block; border-spacing: 0; margin-bottom: 0; }
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
        td.dir { font-family: var(--fonte-titulo); white-space: nowrap; }
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

    // Poda + REMAPEIA a seleção para os objetos-linha ATUAIS, casando por `id`
    // (com fallback à referência p/ linhas sem id). Assim a seleção SOBREVIVE a um
    // refresh em 2º plano (app.js) que substitui os objetos do store — senão ela
    // some no meio da ação e "Excluir selecionados" não faz nada.
    const _selKey = (l) => (l && l.id != null ? "id:" + l.id : l);
    const selMarcados = new Set([...this._sel].map(_selKey));
    this.__sel = new Set(this.rows.filter((l) => selMarcados.has(_selKey(l))));

    if (!this.rows.length) {
      // Estado vazio RICO (ícone + explicação) quando há empty-titulo; senão, o
      // texto simples de sempre (retrocompatível com empty-text).
      const et = this.getAttribute("empty-titulo");
      if (et) {
        const esc = (v) => String(v == null ? "" : v).replace(/"/g, "&quot;");
        return `<div class="vazio"><ui-empty-state icone="${esc(this.getAttribute("empty-icone") || "vazio")}" titulo="${esc(et)}" texto="${esc(this.getAttribute("empty-texto") || "")}"></ui-empty-state></div>`;
      }
      const txt = this.getAttribute("empty-text") || "Nenhum registro.";
      return `<div class="vazio">${txt}</div>`;
    }

    const estilo = (c) => (c.largura ? ` style="min-width:${c.largura}"` : "");
    const classe = (c) => [c.alinhar === "dir" ? "dir" : "", c.secundaria ? "sec" : ""].filter(Boolean).join(" ");
    const ativa = (i) => (this._ordem && this._ordem.col === i) || this._filtros[i];
    // Direção da ordenação da coluna (p/ girar o chevron: cima=asc, baixo=desc).
    const ord = (i) => (this._ordem && this._ordem.col === i && this._ordem.dir) || "";

    const temSel = this._temSelecao();
    // Marca no host se há coluna de marcação (p/ a sombra do card começar após ela).
    this.toggleAttribute("tem-selecao", temSel);
    const cabecalho =
      (temSel ? `<th class="sel"><label class="selbox"><input type="checkbox" id="selTodos" aria-label="Selecionar todos"></label></th>` : "") +
      cols
        .map(
          (c, i) =>
            `<th class="${classe(c)}"${estilo(c)}><button class="th-btn ${ativa(i) ? "ativo" : ""} ${ord(i)}" data-col="${i}">${c.titulo} <span class="seta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span></button></th>`
        )
        .join("") +
      (temAcoes ? "<th></th>" : "");

    const selbar = this._sel.size ? this._selbarHtml() : "";

    // A selbar vai DENTRO do `.wrap` (sticky bottom, acima dos totais) — flutua sobre
    // as linhas como a linha de totais e NÃO empurra a mesa (selecionar não dá "pulo").
    return `${this._filtroAvisoHtml()}<div class="wrap"><table><thead><tr>${cabecalho}</tr></thead><tbody>${this._corpoHtml()}</tbody>${this._rodapeHtml()}</table>${selbar}</div>${this._barraExportarHtml()}`;
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
          ? `<td class="sel"><label class="selbox"><input type="checkbox" class="rowsel" data-i="${i}" aria-label="Selecionar linha" ${marcada ? "checked" : ""}></label></td>`
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
        const idRow = String(linha && linha.id != null ? linha.id : "").replace(/"/g, "&quot;");
        return `<tr data-idx="${i}" data-id="${idRow}">${sel}${celulas}${botoes}</tr>`;
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

  /** Escuta o evento GLOBAL "linha-ocupada" (disparado pelo data-store durante uma
   * atualização) e marca/desmarca o spinner SÓ na linha com aquele `id`. */
  aoConectar() {
    if (!this._ocupadas) this._ocupadas = new Set();
    this._onOcupada = (e) => {
      const d = (e && e.detail) || {};
      const sid = String(d.id == null ? "" : d.id);
      if (!sid) return;
      if (d.ocupada) this._ocupadas.add(sid);
      else this._ocupadas.delete(sid);
      this._aplicarOcupada(sid);
    };
    window.addEventListener("linha-ocupada", this._onOcupada);
  }
  aoDesconectar() {
    if (this._onOcupada) window.removeEventListener("linha-ocupada", this._onOcupada);
  }

  /** Aplica/remove a classe .ocupada na linha do `id` dado (toggle direcionado). */
  _aplicarOcupada(sid) {
    const on = this._ocupadas && this._ocupadas.has(sid);
    this.$$("tbody tr").forEach((tr) => {
      if (String(tr.dataset.id || "") === sid) tr.classList.toggle("ocupada", on);
    });
  }
  /** Reaplica os spinners após um re-render (ids ainda ocupados sobrevivem). */
  _aplicarOcupadas() {
    if (!this._ocupadas || !this._ocupadas.size) return;
    this.$$("tbody tr").forEach((tr) => {
      if (this._ocupadas.has(String(tr.dataset.id || ""))) tr.classList.add("ocupada");
    });
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
        // Reflete nos checkboxes das linhas VISÍVEIS + atualiza a barra — SEM
        // re-render (senão o scroll da mesa volta ao topo).
        this.$$(".rowsel").forEach((cb) => {
          cb.checked = this._sel.has(this.rows[Number(cb.dataset.i)]);
        });
        this.emitir("selecao", { linhas: [...this._sel] });
        this._atualizarSelbar();
      });
    }
    this._ligarSelbar();
    this._posicionarSelbar();
    // Cabeçalho → dropdown de ordenar/filtrar.
    this.$$(".th-btn").forEach((btn) => {
      btn.addEventListener("click", () => this._abrirMenu(Number(btn.dataset.col), btn));
    });
    // "Limpar filtros" do banner de filtro ativo.
    const btnLimpar = this.$(".limpar-filtros");
    if (btnLimpar) btnLimpar.addEventListener("click", () => this._limparFiltros());
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

  /** Liga os botões da barra de seleção (Editar/Excluir/ações em massa). Reusado
   * pelo render E pela atualização direcionada (`_atualizarSelbar`). */
  _ligarSelbar() {
    this.$$(".acao-massa").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = this.acoesMassa[Number(btn.dataset.i)];
        const linhas = [...this._sel];
        if (a && linhas.length) this.emitir("acao-massa", { acao: a.nome, linhas });
      });
    });
    const btnEditar = this.$("#editarMassa");
    if (btnEditar) {
      btnEditar.addEventListener("click", () => {
        const linhas = [...this._sel];
        if (linhas.length) this.emitir("editar-massa", { linhas });
      });
    }
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
  }

  /** Atualiza SÓ a barra de seleção + o "Selecionar todos" ao (des)marcar uma linha,
   * SEM re-renderizar a tabela — preserva o scroll do `.wrap` (senão a mesa voltava
   * ao topo a cada seleção). A barra é irmã do `.wrap`, então mexer nela não rola. */
  _atualizarSelbar() {
    const root = this.shadowRoot;
    const wrap = root.querySelector(".wrap");
    const atual = root.querySelector(".selbar");
    if (this._sel.size > 0) {
      const html = this._selbarHtml();
      if (atual) {
        atual.insertAdjacentHTML("beforebegin", html);
        atual.remove();
      } else if (wrap) {
        wrap.insertAdjacentHTML("beforeend", html); // DENTRO do .wrap, após a tabela (sticky bottom)
      }
      this._ligarSelbar();
      this._posicionarSelbar();
    } else if (atual) {
      atual.remove();
    }
    const selTodos = this.$("#selTodos");
    if (selTodos) {
      const vis = this._visiveis().map((o) => o.linha);
      const todos = vis.length > 0 && vis.every((l) => this._sel.has(l));
      selTodos.checked = todos;
      selTodos.indeterminate = !todos && vis.some((l) => this._sel.has(l));
    }
  }

  /** Encosta a selbar logo ACIMA da linha de totais (tfoot sticky), se houver. */
  _posicionarSelbar() {
    const selbar = this.shadowRoot.querySelector(".selbar");
    if (!selbar) return;
    const tfoot = this.shadowRoot.querySelector("tfoot");
    const h = tfoot ? Math.round(tfoot.getBoundingClientRect().height) : 0;
    selbar.style.bottom = h + "px";
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
        vibrar(HAPTICO.toque); pulso(cb, 0.8); // clique tátil + pulso visual
        this.emitir("selecao", { linhas: [...this._sel] });
        this._atualizarSelbar(); // direcionado (sem re-render → NÃO volta ao topo)
      });
    });
    this._aplicarOcupadas(); // reaplica o spinner nas linhas ainda ocupadas após re-render
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
    // Coluna de DATA → filtro por INTERVALO (ui-filtro-data), no lugar do checklist.
    if (this._ehColunaData(col)) return this._abrirFiltroData(col, anchorEl);
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

  /** Abre o filtro EXCLUSIVO de data (ui-filtro-data) — intervalo De/Até + atalhos +
   * chips de Ano/Mês adaptados aos dados. Guarda o filtro como `{de, ate}` (≠ Set). */
  _abrirFiltroData(col, anchorEl) {
    const c = this.columns[col];
    const f = this._filtros[col];
    const range = f && !(f instanceof Set) ? f : {};
    const menu = document.createElement("ui-filtro-data");
    menu.coluna = c;
    menu.datas = this._datasDaColuna(col);
    menu.estado = {
      ordem: this._ordem && this._ordem.col === col ? this._ordem.dir : null,
      de: range.de || "",
      ate: range.ate || "",
    };
    menu.ancora = anchorEl.getBoundingClientRect();
    const fechar = () => menu.remove();
    menu.addEventListener("fechar", fechar);
    menu.addEventListener("aplicar", (e) => {
      const { ordem, de, ate } = e.detail || {};
      this._ordem = ordem ? { col, dir: ordem } : this._ordem && this._ordem.col === col ? null : this._ordem;
      if (de || ate) this._filtros[col] = { de: de || "", ate: ate || "" };
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
