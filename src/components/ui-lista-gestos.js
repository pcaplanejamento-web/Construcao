/**
 * <ui-lista-gestos> — Lista MOBILE operada por GESTOS (estilo app nativo).
 *
 * Primitivo reutilizável (sem regra de negócio). O consumidor fornece os itens e
 * uma função que monta o conteúdo de cada linha; a lista cuida dos gestos:
 *   • TOCAR            → evento "abrir" { item }  (ou alterna a seleção no modo seleção)
 *   • SEGURAR (~450ms) → entra em modo SELEÇÃO (círculo de check) → "selecao" { itens }
 *   • ARRASTAR →        → fundo VERDE + ✎  → "editar" { item }
 *   • ARRASTAR ←        → fundo VERMELHO + 🗑 → "excluir" { item }
 * A barra flutuante (no topo) mostra a contagem + `acoesMassa` + Excluir + Cancelar.
 *
 * API:
 *   .itens = [{ id, ... }]
 *   .render = (item) => htmlString        // conteúdo interno da linha
 *   .acoesMassa = [{ nome, rotulo, variant? }]   // ações em massa (seleção)
 *   .letraDe = (item) => "A"              // p/ o índice A–Z (com o atributo `indice`)
 *   attr `indice`                         // liga a barra alfabética à direita
 * Eventos: "abrir", "editar", "excluir", "acao-massa" {acao,itens}, "selecao" {itens}.
 *
 * Gestos só engajam o arraste horizontal ALÉM do limiar (as linhas usam
 * `touch-action: pan-y`, então a rolagem vertical continua nativa). Ao engajar o
 * arraste horizontal, damos stopPropagation → a LINHA vence o swipe de troca de aba.
 */
import { BaseElement } from "./base-element.js";
import "./ui-icon.js";
import { vibrar, feedbackToque, HAPTICO } from "./haptic.js";

const SEGURAR_MS = 500; // long-press
const INICIO_PX = 10; // move mínimo p/ DECIDIR a direção (horizontal × rolagem)
const LIMIAR_FRAC = 0.3; // fração da largura p/ disparar a ação (arraste lento)
const LIMIAR_MAX = 90; // teto do limiar em px
const FLICK_VX = 0.45; // px/ms — um flick rápido dispara mesmo com pouco arraste
const FLICK_MIN = 32; // arraste mínimo (px) p/ contar como flick
const ABRE_MAX = 112; // px de abertura "livre" antes da resistência (rubber-band)
const RESIST = 0.18; // fator de resistência além de ABRE_MAX (puxa, mas segura — não sai tudo)

const SVG_CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

class UiListaGestos extends BaseElement {
  static get observedAttributes() { return ["indice"]; }
  attributeChangedCallback() { if (this.shadowRoot && this.shadowRoot.childElementCount) this._pintar(); }

  set itens(v) { this._itens = Array.isArray(v) ? v : []; if (this.shadowRoot.childElementCount) this._pintar(); }
  get itens() { return this._itens || []; }
  set render(fn) { this._render = typeof fn === "function" ? fn : null; if (this.shadowRoot.childElementCount) this._pintar(); }
  set acoesMassa(v) { this._acoesMassa = Array.isArray(v) ? v : []; if (this._selMode) this._pintarBarra(); }
  get acoesMassa() { return this._acoesMassa || []; }
  set letraDe(fn) { this._letraDe = typeof fn === "function" ? fn : null; if (this.shadowRoot.childElementCount) this._pintar(); }
  // Quando `true`, o ARRASTE horizontal NÃO edita/exclui (o consumidor usa botões
  // por linha via `data-acao-linha`) — e a linha deixa o swipe de aba passar.
  // Tocar (abrir) e segurar (selecionar) continuam funcionando.
  set semSwipeAcao(v) { this._semSwipeAcao = !!v; }
  get semSwipeAcao() { return !!this._semSwipeAcao; }

  _idDe(item) { return String(item && item.id != null ? item.id : ""); }

  estilos() {
    return `
      :host { display: block; position: relative; }
      .barra-sel { position: sticky; top: 0; z-index: 5; display: none;
        align-items: center; gap: var(--esp-2); padding: var(--esp-2) var(--esp-3);
        background: var(--cor-primaria-escura, #0f766e); color: #fff; border-radius: var(--raio-md);
        margin-bottom: var(--esp-2); box-shadow: var(--sombra-md); }
      :host([sel-mode]) .barra-sel { display: flex; }
      .barra-sel .conta { font-weight: var(--peso-semi); flex: 1; min-width: 0; }
      .barra-sel button { flex: none; border: none; cursor: pointer; border-radius: var(--raio-sm);
        background: rgba(255,255,255,.16); color: #fff; font: inherit; font-size: var(--fs-sm);
        font-weight: var(--peso-semi); min-height: 40px; padding: 0 var(--esp-3); }
      .barra-sel button:hover { background: rgba(255,255,255,.26); }
      .barra-sel button.perigo { background: var(--cor-erro); }
      .barra-sel .fechar { width: 40px; padding: 0; font-size: 1.3rem; line-height: 1; }

      .grupo-letra { font-size: var(--fs-xs); font-weight: var(--peso-forte); text-transform: uppercase;
        letter-spacing: .06em; color: var(--cor-texto-fraco); padding: var(--esp-3) var(--esp-2) var(--esp-1); }

      .linha { position: relative; overflow: hidden; border-radius: var(--raio-md);
        margin-bottom: var(--esp-2); touch-action: pan-y; -webkit-user-select: none; user-select: none; }
      .fundo { position: absolute; inset: 0; display: flex; align-items: center; color: #fff;
        opacity: 0; transition: opacity .14s ease; }
      .fundo ui-icon { padding: 0 var(--esp-5); transition: transform .18s cubic-bezier(0.34, 1.56, 0.64, 1); }
      .fundo-editar { background: var(--grad-verde); justify-content: flex-start; }
      .fundo-excluir { background: var(--grad-vermelho); justify-content: flex-end; }
      .linha.arr-dir .fundo-editar, .linha.arr-esq .fundo-excluir { opacity: 1; }
      /* "Armado" (passou do limiar): o ícone cresce p/ sinalizar "solte agora". */
      .linha.armado .fundo-editar ui-icon, .linha.armado .fundo-excluir ui-icon { transform: scale(1.24); }
      .conteudo { position: relative; z-index: 1; display: flex; align-items: center; gap: var(--esp-2);
        background: var(--cor-superficie); border: 1px solid var(--cor-borda);
        padding: var(--esp-3); min-height: 60px; box-sizing: border-box; }
      /* Volta ao normal com mola suave (arrastando = sem transição, acompanha o dedo). */
      .linha:not(.arrastando) .conteudo { transition: transform .34s cubic-bezier(0.22, 1, 0.36, 1); }
      @media (prefers-reduced-motion: reduce) {
        .conteudo, .fundo, .fundo ui-icon, .check { transition: none !important; }
      }

      /* Variante ESTILO="lista" (agenda do telefone): linhas contínuas, coladas,
         com fio de separação — em vez de cartões soltos. Mais simples/intuitivo. */
      :host([estilo="lista"]) .linha { border-radius: 0; margin-bottom: 0; }
      :host([estilo="lista"]) .conteudo { border: none; border-bottom: 1px solid var(--cor-borda);
        background: transparent; min-height: 68px; }
      :host([estilo="lista"]) .linha.ativa .conteudo,
      :host([estilo="lista"]) .linha.sel .conteudo { background: var(--cor-superficie-2); }
      .linha.ativa .conteudo { background: var(--cor-superficie-2); }
      .linha.sel .conteudo { background: var(--cor-primaria-suave); border-color: var(--cor-primaria); }
      .corpo { flex: 1; min-width: 0; }
      /* Botões de ação por linha (editar/excluir): "press" visual ao tocar (iOS). */
      [data-acao-linha] { transition: transform .12s cubic-bezier(0.22, 1, 0.36, 1); }
      [data-acao-linha]:active { transform: scale(0.86); }
      @media (prefers-reduced-motion: reduce) { [data-acao-linha] { transition: none; } }
      /* CARD OCUPADO (atualizando): spinner SÓ neste card + bloqueia interação;
         o conteúdo fica esmaecido atrás. Não afeta os outros cards nem o resto. */
      .linha.ocupada { pointer-events: none; }
      .linha.ocupada .conteudo { opacity: .5; transition: opacity .2s ease; }
      .linha.ocupada::after { content: ""; position: absolute; z-index: 4;
        top: 50%; left: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px;
        border: 2.5px solid var(--cor-borda); border-top-color: var(--cor-primaria);
        border-radius: 50%; animation: lg-spin .7s linear infinite; }
      @keyframes lg-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .linha.ocupada::after { animation-duration: 1.8s; } }
      /* Círculo de seleção (aparece no modo seleção). */
      .check { flex: none; width: 0; height: 24px; border-radius: 50%; overflow: hidden;
        display: inline-flex; align-items: center; justify-content: center;
        border: 2px solid transparent; color: transparent; transition: width .15s ease; box-sizing: border-box; }
      :host([sel-mode]) .check { width: 24px; border-color: var(--cor-borda-forte); }
      .linha.sel .check { background: var(--cor-primaria); border-color: var(--cor-primaria); color: #fff; }

      /* Índice A–Z lateral. */
      :host([indice]) #raiz { padding-right: 22px; }
      .indice { position: absolute; top: 0; right: 0; width: 20px; display: none;
        flex-direction: column; align-items: center; justify-content: center; gap: 1px;
        z-index: 4; padding: var(--esp-2) 0; }
      :host([indice]) .indice { display: flex; }
      .indice button { border: none; background: none; cursor: pointer; padding: 0; width: 20px;
        font-size: 10px; font-weight: var(--peso-semi); color: var(--cor-primaria); line-height: 1.15; }
      .indice button:hover { color: var(--cor-primaria-escura); }
      .vazio { padding: var(--esp-6); text-align: center; color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    return `
      <div class="barra-sel">
        <span class="conta"></span>
        <span id="acoes-massa"></span>
        <button class="perigo" data-x="excluir">Excluir</button>
        <button class="fechar" data-x="cancelar" aria-label="Cancelar seleção">&times;</button>
      </div>
      <div id="raiz"></div>
      <div class="indice" id="indice"></div>
    `;
  }

  aposRender() {
    this._sel = this._sel || new Set();
    this._pintar();
    // Barra de seleção
    this.$(".barra-sel").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-x], button[data-acao]");
      if (!b) return;
      if (b.dataset.x === "cancelar") return this._sairSelecao();
      const itens = this._itensSelecionados();
      if (b.dataset.x === "excluir") { this.emitir("acao-massa", { acao: "excluir", itens }); this._sairSelecao(); return; }
      if (b.dataset.acao) { this.emitir("acao-massa", { acao: b.dataset.acao, itens }); this._sairSelecao(); }
    });
    // Gestos (delegação de ponteiro no container).
    const raiz = this.$("#raiz");
    this._onDown = (e) => this._pDown(e);
    raiz.addEventListener("pointerdown", this._onDown);
    // Botões de ação POR LINHA (ex.: editar/excluir na despesa): `data-acao-linha`.
    // Clique nativo (o gesto ignora <button>) → emite "acao-linha" {acao,item}.
    raiz.addEventListener("click", (e) => {
      const b = e.target.closest("[data-acao-linha]");
      if (!b) return;
      const linha = b.closest(".linha");
      if (!linha) return;
      e.stopPropagation();
      const item = this._itemPorId(linha.dataset.id);
      if (item) { feedbackToque(b, HAPTICO.acao, 0.86); this.emitir("acao-linha", { acao: b.dataset.acaoLinha, item }); }
    });
    // Índice A–Z
    this.$("#indice").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-letra]");
      if (!b) return;
      const alvo = this.$(`.grupo-letra[data-letra="${b.dataset.letra}"]`);
      if (alvo && alvo.scrollIntoView) alvo.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  /* ------------------------------- Render -------------------------------- */
  _pintar() {
    const raiz = this.$("#raiz");
    if (!raiz || !this._render) return;
    // Não reconstrói NO MEIO de um arraste (ex.: refresh em 2º plano) — senão o
    // gesto "some". Adia p/ quando o gesto terminar (ver _encerrar).
    if (this._g && this._g.arrastando) { this._pintarPendente = true; return; }
    const itens = this.itens;
    if (!itens.length) { raiz.innerHTML = `<div class="vazio">Nada por aqui.</div>`; this._pintarIndice([]); return; }
    const usaIndice = this.hasAttribute("indice") && typeof this._letraDe === "function";
    let html = "";
    let letraAtual = null;
    const letras = [];
    itens.forEach((item) => {
      if (usaIndice) {
        const l = String(this._letraDe(item) || "#").toUpperCase();
        if (l !== letraAtual) { letraAtual = l; letras.push(l); html += `<div class="grupo-letra" data-letra="${l}">${l}</div>`; }
      }
      const id = this._idDe(item);
      const sel = this._sel.has(id) ? " sel" : "";
      html += `<div class="linha${sel}" data-id="${id}">
        <div class="fundo fundo-editar"><ui-icon name="editar" size="22"></ui-icon></div>
        <div class="fundo fundo-excluir"><ui-icon name="excluir" size="22"></ui-icon></div>
        <div class="conteudo"><span class="check" aria-hidden="true">${SVG_CHECK}</span><div class="corpo">${this._render(item)}</div></div>
      </div>`;
    });
    raiz.innerHTML = html;
    this._pintarIndice(usaIndice ? letras : []);
    this._aplicarOcupadasLista(); // reaplica o spinner nos cards ainda ocupados
  }

  _pintarIndice(letras) {
    const el = this.$("#indice");
    if (!el) return;
    el.innerHTML = letras.map((l) => `<button type="button" data-letra="${l}">${l}</button>`).join("");
  }

  _linhaPorId(id) { return this.$(`.linha[data-id="${id}"]`); }
  _itemPorId(id) { return this.itens.find((i) => this._idDe(i) === String(id)) || null; }
  _itensSelecionados() { return this.itens.filter((i) => this._sel.has(this._idDe(i))); }

  /* ------------------------------- Gestos -------------------------------- */
  _pDown(e) {
    if (e.button != null && e.button !== 0) return; // só botão principal / toque
    this._encerrar(); // robustez: limpa qualquer gesto anterior preso (toque real é ruidoso)
    const linha = e.target.closest(".linha");
    if (!linha) return;
    // Ignora toque em links/botões internos (ex.: WhatsApp) — deixa o clique nativo.
    if (e.target.closest("a, button, .no-gesto")) { this._g = null; return; }
    // A LINHA vence o swipe de troca de aba: barra o pointerdown ANTES de chegar ao
    // <ui-tabs> (que só troca de aba se registrar o início do gesto no painel).
    // EXCEÇÃO: quando `semSwipeAcao` (a despesa usa botões por linha), NÃO barra →
    // o arraste horizontal no card TROCA DE ABA (mais imersão); tocar/segurar seguem.
    if (!this._semSwipeAcao) e.stopPropagation();
    const cont = linha.querySelector(".conteudo");
    this._g = { linha, cont, id: linha.dataset.id, x0: e.clientX, y0: e.clientY, dx: 0, arrastando: false, consumido: false, largura: linha.getBoundingClientRect().width, vx: 0, xPrev: e.clientX, tPrev: e.timeStamp || 0 };
    // segurar → seleção
    this._g.timer = setTimeout(() => {
      if (!this._g || this._g.arrastando) return;
      this._g.consumido = true;
      this._entrarSelecao(this._g.id);
    }, SEGURAR_MS);
    this._onMove = (ev) => this._pMove(ev);
    this._onUp = (ev) => this._pUp(ev);
    window.addEventListener("pointermove", this._onMove, { passive: false });
    window.addEventListener("pointerup", this._onUp);
    window.addEventListener("pointercancel", this._onUp);
  }

  _pMove(e) {
    const g = this._g;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.arrastando) {
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < INICIO_PX && ady < INICIO_PX) return; // ainda indeciso — espera o dedo definir a direção
      if (adx <= ady) { this._encerrar(); return; }   // vertical (ou diagonal) domina → deixa ROLAR
      // horizontal: se esta lista não usa swipe p/ ação (despesa), ABORTA aqui e
      // deixa o swipe de aba assumir — a ação é pelos botões da linha.
      if (this._semSwipeAcao) { this._encerrar(); return; }
      // horizontal domina → engaja o arraste da LINHA (não aborta mais por tremida vertical depois)
      g.arrastando = true; clearTimeout(g.timer);
      g.linha.classList.add("arrastando");
      try { g.linha.setPointerCapture(e.pointerId); } catch (_) {}
    }
    // Arraste horizontal engajado → a linha "vence" o swipe de aba.
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    // Velocidade instantânea (p/ detectar flick rápido no soltar).
    const t = e.timeStamp || 0;
    if (g.tPrev && t > g.tPrev) g.vx = (e.clientX - g.xPrev) / (t - g.tPrev);
    g.xPrev = e.clientX; g.tPrev = t;
    g.dx = dx; // arraste BRUTO (decide o limiar/flick)
    // Deslocamento VISUAL com rubber-band: acompanha o dedo até ABRE_MAX e, além
    // disso, resiste (RESIST) — puxa um pouco mais, mas NUNCA sai tudo.
    const ax = Math.abs(dx);
    let off = ax <= ABRE_MAX ? ax : ABRE_MAX + (ax - ABRE_MAX) * RESIST;
    if (dx < 0) off = -off;
    g.off = off;
    g.cont.style.transform = `translateX(${off}px)`;
    g.linha.classList.toggle("arr-dir", dx > 0);
    g.linha.classList.toggle("arr-esq", dx < 0);
    const limiar = Math.min(LIMIAR_MAX, g.largura * LIMIAR_FRAC);
    const armado = ax >= limiar;
    // Tique tátil ao CRUZAR o limiar (sensação de que soltar agora vai editar/excluir).
    if (armado && !g.armadoPrev) vibrar(HAPTICO.toque);
    g.armadoPrev = armado;
    g.linha.classList.toggle("armado", armado);
  }

  _pUp(e) {
    const g = this._g;
    if (!g) { this._encerrar(); return; }
    if (g.arrastando) {
      e.stopPropagation();
      const limiar = Math.min(LIMIAR_MAX, g.largura * LIMIAR_FRAC);
      // Dispara por DISTÂNCIA (arraste lento além do limiar) OU por FLICK (deslize rápido, mesmo curto).
      const flick = Math.abs(g.vx || 0) >= FLICK_VX && Math.abs(g.dx) >= FLICK_MIN;
      if (Math.abs(g.dx) >= limiar || flick) {
        const tipo = g.dx > 0 ? "editar" : "excluir";
        this._dispararAcao(g, tipo);
        this._encerrar();
        return;
      }
      this._snapVolta(g); // não atingiu → volta
    } else if (!g.consumido) {
      // Toque simples: no modo seleção alterna; senão abre.
      if (this._selMode) this._alternarSel(g.id);
      else { const item = this._itemPorId(g.id); if (item) this.emitir("abrir", { item }); }
    }
    this._encerrar();
  }

  _dispararAcao(g, tipo) {
    // PUXA e VOLTA ao normal (não fica "arrancando" o card da tela): a ação abre o
    // form / a confirmação, ou a lista se atualiza removendo o item. A mola do CSS
    // (:not(.arrastando)) traz a linha de volta ao 0 de forma suave.
    vibrar(HAPTICO.acao); // confirma o gesto (editar/excluir) com um toque tátil
    const item = this._itemPorId(g.id);
    const linha = g.linha, cont = g.cont;
    linha.classList.remove("arrastando", "armado");
    cont.style.transition = ""; // usa a transição do CSS
    cont.style.transform = "translateX(0)";
    setTimeout(() => { if (item) this.emitir(tipo, { item }); }, 140);
    setTimeout(() => { if (linha && linha.isConnected) linha.classList.remove("arr-dir", "arr-esq"); }, 340);
  }

  _snapVolta(g) {
    const linha = g.linha;
    linha.classList.remove("arrastando", "armado");
    g.cont.style.transition = "";
    g.cont.style.transform = "translateX(0)";
    setTimeout(() => { if (linha && linha.isConnected) linha.classList.remove("arr-dir", "arr-esq"); }, 340);
  }

  _encerrar() {
    const g = this._g;
    if (g) { clearTimeout(g.timer); if (!g.arrastando) { g.linha.classList.remove("arr-dir", "arr-esq"); if (g.cont) g.cont.style.transform = ""; } }
    if (this._onMove) { window.removeEventListener("pointermove", this._onMove, { passive: false }); this._onMove = null; }
    if (this._onUp) { window.removeEventListener("pointerup", this._onUp); window.removeEventListener("pointercancel", this._onUp); this._onUp = null; }
    this._g = null;
    if (this._pintarPendente) { this._pintarPendente = false; this._pintar(); } // aplica o refresh adiado
  }

  /* ------------------------------ Seleção -------------------------------- */
  _entrarSelecao(id) {
    // Confirma "segurar → selecionou": vibra (onde há) + pulso visual na linha (iOS).
    const l0 = this._linhaPorId(id);
    feedbackToque(l0 && l0.querySelector(".conteudo"), HAPTICO.selecionar, 0.98);
    if (!this._selMode) { this._selMode = true; this.setAttribute("sel-mode", ""); }
    this._sel.add(String(id));
    const l = this._linhaPorId(id); if (l) l.classList.add("sel");
    this._pintarBarra();
    this.emitir("selecao", { itens: this._itensSelecionados() });
  }

  _alternarSel(id) {
    const l0 = this._linhaPorId(id);
    feedbackToque(l0 && l0.querySelector(".conteudo"), HAPTICO.toque, 0.98); // clique tátil + pulso visual
    id = String(id);
    if (this._sel.has(id)) this._sel.delete(id); else this._sel.add(id);
    const l = this._linhaPorId(id); if (l) l.classList.toggle("sel", this._sel.has(id));
    if (!this._sel.size) return this._sairSelecao();
    this._pintarBarra();
    this.emitir("selecao", { itens: this._itensSelecionados() });
  }

  _sairSelecao() {
    this._selMode = false; this.removeAttribute("sel-mode");
    this._sel.clear();
    this.$$(".linha.sel").forEach((l) => l.classList.remove("sel"));
    this.emitir("selecao", { itens: [] });
  }

  _pintarBarra() {
    const conta = this.$(".barra-sel .conta");
    if (conta) conta.textContent = `${this._sel.size} selecionada(s)`;
    const box = this.$("#acoes-massa");
    if (box) {
      box.innerHTML = this.acoesMassa
        .map((a) => `<button data-acao="${a.nome}" class="${a.variant || ""}">${a.rotulo}</button>`)
        .join("");
    }
  }

  /** Escuta "linha-ocupada" (data-store) → spinner SÓ no card daquele `id`. */
  aoConectar() {
    if (!this._ocupadas) this._ocupadas = new Set();
    this._onOcupada = (e) => {
      const d = (e && e.detail) || {};
      const sid = String(d.id == null ? "" : d.id);
      if (!sid) return;
      if (d.ocupada) this._ocupadas.add(sid);
      else this._ocupadas.delete(sid);
      this._aplicarOcupadaLista(sid);
    };
    window.addEventListener("linha-ocupada", this._onOcupada);
  }
  aoDesconectar() {
    this._encerrar();
    if (this._onOcupada) window.removeEventListener("linha-ocupada", this._onOcupada);
  }

  /** Aplica/remove a classe .ocupada no card do `id` (toggle direcionado). */
  _aplicarOcupadaLista(sid) {
    const el = this._linhaPorId(sid);
    if (el) el.classList.toggle("ocupada", !!(this._ocupadas && this._ocupadas.has(sid)));
  }
  /** Reaplica os spinners após um re-render (ids ainda ocupados sobrevivem). */
  _aplicarOcupadasLista() {
    if (!this._ocupadas || !this._ocupadas.size) return;
    this._ocupadas.forEach((sid) => {
      const el = this._linhaPorId(sid);
      if (el) el.classList.add("ocupada");
    });
  }
}

customElements.define("ui-lista-gestos", UiListaGestos);
