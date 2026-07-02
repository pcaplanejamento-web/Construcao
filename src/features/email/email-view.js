/**
 * <email-view> — Página /email (admin): cliente de e-mail em 3 colunas
 * (Pastas | Lista | Leitura), estilo webmail, sobre a caixa da empresa via
 * GmailApp. Ocupa toda a altura (o app-shell coloca a rota em modo "cheio").
 * Cache-first (email-cache): abre instantâneo e atualiza em 2º plano. Seleção
 * múltipla p/ arquivar/excluir/marcar em lote. Reusa email-conversa (leitura
 * inline), email-compositor e email-enderecos.
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { notificarErro, toastSucesso } from "../../core/event-bus.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "./email-conversa.js";
import "./email-compositor.js";
import "./email-enderecos.js";
import { emailCache } from "./email-cache.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function quando(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mesmoAno = d.getFullYear() === hoje.getFullYear();
  return d.toLocaleDateString("pt-BR", mesmoAno ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/).filter(Boolean);
  return (((p[0] || "?")[0] || "?") + (p.length > 1 ? (p[p.length - 1][0] || "") : "")).toUpperCase();
}
function corAvatar(s) {
  let h = 0; const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return `hsl(${h}, 45%, 55%)`;
}

const PASTAS = [
  { id: "inbox", rotulo: "Entrada", icone: "email" },
  { id: "enviados", rotulo: "Enviados", icone: "seta-direita" },
  { id: "estrela", rotulo: "Com estrela", icone: "tendencia" },
  { id: "rascunhos", rotulo: "Rascunhos", icone: "editar" },
  { id: "lixeira", rotulo: "Lixeira", icone: "excluir" },
];

/** Normaliza um rascunho do backend no mesmo formato de thread da lista. */
function mapRascunho(d) {
  return { draftId: d.draftId, de: "Rascunho", assunto: d.assunto, previa: d.previa, data: d.data, lido: true, _draft: d };
}

class EmailView extends BaseElement {
  constructor() {
    super();
    this._caixa = "inbox";
    this._pagina = 0;
    this._q = "";
    this._labels = [];
    this._estado = "carregando";
    this._dados = null;
    this._selecionado = null;
    this._sel = new Set();
  }

  get ehRascunhos() { return this._caixa === "rascunhos"; }
  get usaCache() { return !this._q && this._pagina === 0; }

  estilos() {
    return `
      :host { display: block; height: 100%; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; height: 100%; min-height: 0; box-sizing: border-box; }

      .painel { flex: 1; min-height: 0; display: grid; grid-template-columns: 190px minmax(300px, 380px) 1fr; grid-template-rows: auto 1fr;
        gap: 0; border: 1px solid var(--cor-borda); border-radius: var(--raio-lg); overflow: hidden; background: var(--cor-superficie); }
      /* Altura CONSTANTE: nunca quebra em linha (rola na horizontal se faltar espaço),
         então trocar busca↔seleção NÃO muda a altura do componente. */
      .barra-topo { grid-column: 1 / -1; display: flex; align-items: center; gap: var(--esp-3);
        padding: 0 var(--esp-3); border-bottom: 1px solid var(--cor-divisor); flex-wrap: nowrap; overflow-x: auto;
        height: 60px; min-height: 60px; scrollbar-width: none; }
      .barra-topo::-webkit-scrollbar { display: none; }
      /* Seletor de pastas (aparece quando a coluna de pastas some — tablet/mobile). */
      .pasta-sel { display: none; height: 34px; flex: none; box-sizing: border-box; font-family: inherit; font-size: var(--fs-sm);
        color: var(--cor-texto); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm); padding: 0 var(--esp-2); max-width: 40vw; }
      @media (max-width: 1100px) { .pasta-sel { display: inline-block; } }
      .barra-topo .busca { flex: 1 1 120px; min-width: 80px; height: 38px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-sm);
        color: var(--cor-texto); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 0 var(--esp-4); }
      .barra-topo .acoes { display: flex; gap: var(--esp-2); flex: none; margin-left: auto; }
      /* Barra de seleção (quando há itens marcados) — mesma altura/fonte da busca. */
      .sel-info { font-weight: var(--peso-semi); font-size: var(--fs-sm); color: var(--cor-primaria-escura); white-space: nowrap; flex: none; }
      .sel-bar { display: flex; align-items: center; gap: var(--esp-2); flex-wrap: nowrap; width: 100%; }
      .sel-bar .dir { display: flex; gap: var(--esp-2); flex: none; margin-left: auto; flex-wrap: nowrap; }

      /* Pastas */
      .pastas { display: flex; flex-direction: column; gap: 2px; padding: var(--esp-3); border-right: 1px solid var(--cor-divisor); overflow-y: auto; }
      .pasta { display: flex; align-items: center; gap: var(--esp-2); min-height: 42px; padding: 0 var(--esp-3);
        border: none; background: none; cursor: pointer; border-radius: var(--raio-md); color: var(--cor-texto-suave);
        font-weight: var(--peso-medio); font-size: var(--fs-sm); text-align: left; }
      .pasta:hover { background: var(--cor-superficie-2); }
      .pasta.ativo { background: var(--cor-primaria-suave); color: var(--cor-primaria-escura); font-weight: var(--peso-semi); }
      .pastas .sep { height: 1px; background: var(--cor-divisor); margin: var(--esp-2) var(--esp-1); }
      .pastas .tit { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--cor-texto-fraco); padding: var(--esp-2) var(--esp-3) 4px; }

      /* Lista */
      .lista-col { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--cor-divisor); }
      .lista { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
      .lista-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: var(--esp-3);
        padding: var(--esp-2) var(--esp-3); min-height: 40px; background: var(--cor-superficie); border-bottom: 1px solid var(--cor-divisor);
        font-size: var(--fs-sm); color: var(--cor-texto-suave); cursor: pointer; }
      .lista-head input { width: 18px; height: 18px; cursor: pointer; }
      .item { display: grid; grid-template-columns: 26px 40px 1fr; gap: var(--esp-2); align-items: center; width: 100%; text-align: left;
        cursor: pointer; padding: var(--esp-3); border-bottom: 1px solid var(--cor-divisor); }
      .item:hover { background: var(--cor-superficie-2); }
      .item.sel { background: var(--cor-primaria-suave); }
      .item.naolido .rem, .item.naolido .assunto { font-weight: var(--peso-forte); color: var(--cor-texto); }
      .check { width: 18px; height: 18px; margin: 0; cursor: pointer; opacity: 0; transition: opacity .12s; }
      .item:hover .check, .item.marcado .check { opacity: 1; }
      @media (hover: none) { .check { opacity: 1; } }
      .avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: var(--peso-semi); font-size: var(--fs-sm); flex: none; }
      .corpo-item { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
      .linha1 { display: flex; justify-content: space-between; gap: var(--esp-2); align-items: baseline; min-width: 0; }
      .rem { font-size: var(--fs-md); color: var(--cor-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
      .data { font-size: var(--fs-xs); color: var(--cor-texto-fraco); white-space: nowrap; flex: none; }
      .assunto { display: block; font-size: var(--fs-sm); color: var(--cor-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .previa { font-size: var(--fs-sm); color: var(--cor-texto-fraco); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
      .linha2 { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .estrela { border: none; background: none; cursor: pointer; font-size: 1rem; line-height: 1; color: var(--cor-texto-fraco); flex: none; padding: 0; }
      .estrela.on { color: #f5b301; }
      .lbl { font-size: var(--fs-xs); background: var(--cor-primaria-suave); color: var(--cor-primaria-escura); border-radius: var(--raio-completo); padding: 0 8px; }
      .paginacao { display: flex; justify-content: space-between; gap: var(--esp-2); padding: var(--esp-2) var(--esp-3); border-top: 1px solid var(--cor-divisor); }
      .vazio, .erro { padding: var(--esp-6) var(--esp-3); text-align: center; color: var(--cor-texto-fraco); }
      .erro { color: var(--cor-erro); }

      /* Leitura */
      .leitura-col { min-height: 0; display: flex; flex-direction: column; }
      email-conversa { flex: 1; min-height: 0; }

      @media (max-width: 1100px) { .painel { grid-template-columns: minmax(280px, 340px) 1fr; } .pastas { display: none; } }
      @media (max-width: 820px) {
        .painel { grid-template-columns: 1fr; }
        .lista-col { border-right: none; }
        .leitura-col { display: none; }
        .painel.lendo .lista-col { display: none; }
        .painel.lendo .leitura-col { display: flex; }
        .painel.lendo .barra-topo { display: none; }
      }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="painel">
          <div class="barra-topo" id="barraTopo"></div>
          <aside class="pastas" id="pastas"></aside>
          <section class="lista-col">
            <div class="lista" id="lista"></div>
          </section>
          <section class="leitura-col">
            <email-conversa id="conversa"></email-conversa>
          </section>
        </div>
      </div>`;
  }

  aoConectar() {
    this.carregar();
    this._carregarLabels();
  }

  aposRender() {
    const conversa = this.$("#conversa");
    conversa.addEventListener("mudou", () => { emailCache.invalidar(this._caixa); this.carregar(); });
    conversa.addEventListener("voltar", () => this._voltar());
    conversa.addEventListener("novo", () => this._abrirCompositor({ modo: "novo" }));
    conversa.addEventListener("compor", (e) => this._abrirCompositor(e.detail));
    this._pintarBarra();
    this._pintarPastas();
    this._pintarLista();
  }

  /* --------------------------- Barra do topo --------------------------- */
  _pintarBarra() {
    const b = this.$("#barraTopo");
    if (!b) return;
    if (this._sel.size > 0) {
      b.innerHTML = `
        <div class="sel-bar">
          <span class="sel-info">${this._sel.size} selecionado(s)</span>
          <div class="dir">
            <ui-button id="loteArquivar" variant="secundario" tamanho="sm">Arquivar</ui-button>
            <ui-button id="loteExcluir" variant="perigo-contorno" tamanho="sm">Excluir</ui-button>
            <ui-button id="loteLida" variant="secundario" tamanho="sm">Marcar lida</ui-button>
            <ui-button id="loteNaoLida" variant="secundario" tamanho="sm">Não lida</ui-button>
            <ui-button id="loteLimpar" variant="secundario" tamanho="sm">Limpar</ui-button>
          </div>
        </div>`;
      this.$("#loteArquivar").addEventListener("click", () => this._acaoLote("arquivar"));
      this.$("#loteExcluir").addEventListener("click", () => this._acaoLote("lixeira"));
      this.$("#loteLida").addEventListener("click", () => this._acaoLote("lida"));
      this.$("#loteNaoLida").addEventListener("click", () => this._acaoLote("naoLida"));
      this.$("#loteLimpar").addEventListener("click", () => { this._sel.clear(); this._pintarBarra(); this._pintarLista(); });
      return;
    }
    const opts = [...PASTAS.map((p) => ({ v: p.id, t: p.rotulo })), ...this._labels.map((n) => ({ v: "label:" + n, t: n }))];
    b.innerHTML = `
      <select class="pasta-sel" id="pastaSel" title="Pasta">${opts.map((o) => `<option value="${esc(o.v)}" ${this._caixa === o.v ? "selected" : ""}>${esc(o.t)}</option>`).join("")}</select>
      <input id="busca" class="busca" type="search" placeholder="Buscar por remetente ou assunto..." value="${esc(this._q)}">
      <div class="acoes">
        <ui-button id="escrever" tamanho="sm">Escrever</ui-button>
        <ui-button id="configurar" variant="secundario" tamanho="sm">Configurar</ui-button>
        <ui-button id="atualizar" variant="secundario" tamanho="sm">Atualizar</ui-button>
      </div>`;
    const ps = this.$("#pastaSel"); if (ps) ps.addEventListener("change", () => this._irPasta(ps.value));
    this.$("#escrever").addEventListener("click", () => this._abrirCompositor({ modo: "novo" }));
    this.$("#configurar").addEventListener("click", () => this._abrirEnderecos());
    this.$("#atualizar").addEventListener("click", () => { emailCache.invalidar(this._caixa); this.carregar(); });
    this.$("#busca").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      this._q = e.target.value.trim(); this._pagina = 0; this.carregar();
    });
  }

  /* ------------------------------ Pastas ------------------------------ */
  _pintarPastas() {
    const box = this.$("#pastas");
    if (!box) return;
    const btn = (p) => `<button class="pasta ${this._caixa === p.id ? "ativo" : ""}" data-caixa="${p.id}" type="button"><ui-icon name="${p.icone}" size="16"></ui-icon>${p.rotulo}</button>`;
    const labelsHtml = this._labels.length
      ? `<div class="sep"></div><div class="tit">Marcadores</div>` +
        this._labels.map((n) => `<button class="pasta ${this._caixa === "label:" + n ? "ativo" : ""}" data-caixa="label:${esc(n)}" type="button"><ui-icon name="tag" size="16"></ui-icon>${esc(n)}</button>`).join("")
      : "";
    box.innerHTML = PASTAS.map(btn).join("") + labelsHtml;
    box.querySelectorAll(".pasta").forEach((el) => el.addEventListener("click", () => this._irPasta(el.dataset.caixa)));
  }

  _irPasta(caixa) {
    this._caixa = caixa; this._q = ""; this._pagina = 0;
    this._sel.clear(); this._selecionar(null);
    this._pintarBarra(); this._pintarPastas();
    this.carregar();
  }

  async _carregarLabels() {
    try {
      const r = await api.call("email.caixa.labels");
      this._labels = r.labels || [];
      this._pintarPastas();
      if (this._sel.size === 0) this._pintarBarra(); // atualiza o seletor de pastas (mobile) com os marcadores
    } catch (e) { /* sem labels */ }
  }

  /* ---------------------------- Carregar ------------------------------ */
  async carregar() {
    const cache = this.usaCache ? emailCache.getLista(this._caixa) : null;
    if (cache) { this._dados = { threads: cache, pagina: 0, temMais: cache.length >= 25 }; this._estado = "pronto"; }
    else { this._estado = "carregando"; }
    this._pintarLista();
    try {
      const dados = await this._buscar(this._caixa, this._q, this._pagina);
      if (this.usaCache) emailCache.setLista(this._caixa, dados.threads);
      this._dados = dados; this._estado = "pronto";
    } catch (e) {
      if (cache) { this._prefetchOutras(); return; } // mantém o cache em falha de refresh
      this._estado = "erro"; notificarErro(e);
    }
    this._pintarLista();
    this._prefetchOutras();
  }

  /** Busca uma pasta (trata rascunhos) e devolve {threads,pagina,temMais}. */
  async _buscar(caixa, q, pagina) {
    if (caixa === "rascunhos") {
      const r = await api.call("email.caixa.rascunhos", { pagina: pagina || 0 });
      return { pagina: r.pagina, temMais: r.temMais, threads: (r.rascunhos || []).map(mapRascunho) };
    }
    return api.call("email.caixa.listar", { caixa: caixa, q: q || "", pagina: pagina || 0 });
  }

  /**
   * Prefetch em 2º plano das demais pastas ainda SEM cache — assim entrar em
   * Enviados/Estrela/Rascunhos/Lixeira já vem carregado (sem espera). Roda uma
   * vez por vez (não sobrepõe) e é silencioso; pastas já em cache são puladas.
   */
  async _prefetchOutras() {
    if (this._prefetching) return;
    this._prefetching = true;
    try {
      const alvos = PASTAS.map((p) => p.id).filter((id) => id !== this._caixa && !emailCache.getLista(id));
      for (const id of alvos) {
        try { emailCache.setLista(id, (await this._buscar(id, "", 0)).threads); }
        catch (e) { /* silencioso — tenta na próxima */ }
      }
    } finally { this._prefetching = false; }
  }

  /* ------------------------------ Lista ------------------------------- */
  _pintarLista() {
    const lista = this.$("#lista");
    if (!lista) return;
    if (this._estado === "carregando") { lista.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`; return; }
    if (this._estado === "erro") { lista.innerHTML = `<p class="erro">Não foi possível carregar. Toque em "Atualizar".</p>`; return; }
    const threads = (this._dados && this._dados.threads) || [];
    if (!threads.length) { lista.innerHTML = `<p class="vazio">${this._pagina > 0 ? "Nada mais por aqui." : "Vazio."}</p>`; return; }

    const linhas = threads.map((t, i) => {
      const nome = t.de || t.deEmail || "—";
      const id = t.threadId || t.draftId;
      const marcado = this._sel.has(t.threadId);
      const check = this.ehRascunhos ? `<span></span>`
        : `<input class="check" type="checkbox" data-i="${i}" ${marcado ? "checked" : ""} title="Selecionar">`;
      const estrela = this.ehRascunhos ? "" : `<button class="estrela ${t.estrela ? "on" : ""}" data-i="${i}" type="button" title="Favoritar">${t.estrela ? "★" : "☆"}</button>`;
      const labels = (t.labels || []).filter((n) => ["INBOX", "SENT", "UNREAD", "IMPORTANT", "STARRED"].indexOf(n) < 0).map((n) => `<span class="lbl">${esc(n)}</span>`).join("");
      return `<div class="item ${t.lido ? "" : "naolido"} ${marcado ? "marcado" : ""} ${this._selecionado === id ? "sel" : ""}" data-i="${i}" role="button" tabindex="0">
        ${check}
        <span class="avatar" style="background:${corAvatar(nome)}">${esc(iniciais(nome))}</span>
        <span class="corpo-item">
          <span class="linha1"><span class="rem">${esc(nome)}</span><span class="data">${esc(quando(t.data))}</span></span>
          <span class="assunto">${labels}${esc(t.assunto)}${t.qtdMsgs > 1 ? ` (${t.qtdMsgs})` : ""}</span>
          <span class="linha2">${estrela}<span class="previa">${esc(t.previa || "")}</span></span>
        </span>
      </div>`;
    }).join("");
    const temMais = !!(this._dados && this._dados.temMais);
    const paginacao = (this._pagina > 0 || temMais)
      ? `<div class="paginacao"><ui-button id="ant" variant="secundario" tamanho="sm" ${this._pagina > 0 ? "" : "disabled"}>‹ Anterior</ui-button><ui-button id="prox" variant="secundario" tamanho="sm" ${temMais ? "" : "disabled"}>Próxima ›</ui-button></div>`
      : "";
    const idsSel = threads.filter((t) => t.threadId).map((t) => t.threadId);
    const nSel = idsSel.filter((id) => this._sel.has(id)).length;
    const cabecalho = this.ehRascunhos ? "" :
      `<label class="lista-head"><input type="checkbox" id="selTodos"> <span>${nSel ? nSel + " selecionado(s)" : "Selecionar todos"}</span></label>`;
    lista.innerHTML = `${cabecalho}${linhas}${paginacao}`;

    const st = lista.querySelector("#selTodos");
    if (st) {
      st.checked = nSel > 0 && nSel === idsSel.length;
      st.indeterminate = nSel > 0 && nSel < idsSel.length;
      st.addEventListener("change", () => {
        if (st.checked) idsSel.forEach((id) => this._sel.add(id));
        else idsSel.forEach((id) => this._sel.delete(id));
        this._pintarBarra();
        this._pintarLista();
      });
    }

    lista.querySelectorAll(".item").forEach((el) =>
      el.addEventListener("click", (e) => {
        if (e.target.closest(".estrela") || e.target.closest(".check")) return;
        this._clicar(threads[Number(el.dataset.i)]);
      })
    );
    lista.querySelectorAll(".estrela").forEach((el) =>
      el.addEventListener("click", (e) => { e.stopPropagation(); this._toggleEstrela(threads[Number(el.dataset.i)]); })
    );
    lista.querySelectorAll(".check").forEach((el) =>
      el.addEventListener("change", (e) => { e.stopPropagation(); this._toggleSel(threads[Number(el.dataset.i)]); })
    );
    const ant = lista.querySelector("#ant"); if (ant) ant.addEventListener("click", () => { if (this._pagina > 0) { this._pagina--; this.carregar(); } });
    const prox = lista.querySelector("#prox"); if (prox) prox.addEventListener("click", () => { if (temMais) { this._pagina++; this.carregar(); } });
  }

  _clicar(t) {
    if (!t) return;
    if (t.draftId) { this._abrirCompositor({ draftId: t.draftId, draft: t._draft }); return; }
    this._selecionar(t.threadId);
    const conversa = this.$("#conversa");
    conversa.assunto = t.assunto; conversa.threadId = t.threadId;
  }

  _selecionar(threadId) {
    this._selecionado = threadId;
    const lista = this.$("#lista");
    if (lista) {
      const threads = (this._dados && this._dados.threads) || [];
      lista.querySelectorAll(".item").forEach((el) => {
        const t = threads[Number(el.dataset.i)];
        el.classList.toggle("sel", !!t && (t.threadId || t.draftId) === threadId);
      });
    }
    const painel = this.$(".painel");
    if (painel) painel.classList.toggle("lendo", !!threadId);
  }

  _voltar() {
    this._selecionar(null);
    const conversa = this.$("#conversa");
    if (conversa) conversa.threadId = null;
  }

  /* --------------------------- Seleção lote --------------------------- */
  _toggleSel(t) {
    if (!t || !t.threadId) return;
    if (this._sel.has(t.threadId)) this._sel.delete(t.threadId);
    else this._sel.add(t.threadId);
    this._pintarBarra();
    this._pintarLista();
  }

  async _acaoLote(acao) {
    const ids = [...this._sel];
    if (!ids.length) return;
    try {
      await api.call("email.caixa.marcarVarios", { threadIds: ids, acao });
      const msgs = { arquivar: "Arquivadas.", lixeira: "Movidas para a lixeira.", lida: "Marcadas como lidas.", naoLida: "Marcadas como não lidas." };
      toastSucesso(msgs[acao] || "Feito.");
      this._sel.clear();
      if (this._selecionado && ids.indexOf(this._selecionado) >= 0) this._voltar();
      ids.forEach((id) => emailCache.invalidarConversa(id));
      emailCache.invalidar(this._caixa);
      this._pintarBarra();
      this.carregar();
    } catch (e) { notificarErro(e); }
  }

  async _toggleEstrela(t) {
    if (!t || !t.threadId) return;
    try {
      await api.call("email.caixa.marcar", { threadId: t.threadId, acao: t.estrela ? "tirarEstrela" : "estrela" });
      t.estrela = !t.estrela;
      if (this.usaCache && this._dados) emailCache.setLista(this._caixa, this._dados.threads);
      this._pintarLista();
    } catch (e) { notificarErro(e); }
  }

  _abrirCompositor(opts) {
    opts = opts || {};
    const c = document.createElement("email-compositor");
    if (opts.modo) c.modo = opts.modo;
    if (opts.threadId) c.threadId = opts.threadId;
    if (opts.assunto && opts.modo === "encaminhar") c.assunto = "Fwd: " + opts.assunto;
    if (opts.draftId) {
      c.draftId = opts.draftId;
      const d = opts.draft || {};
      c.para = d.para || ""; c.cc = d.cc || ""; c.assunto = d.assunto || ""; c.corpoHtml = d.html || "";
    }
    c.addEventListener("fechar", () => c.remove());
    c.addEventListener("enviado", () => { emailCache.invalidar(this._caixa); this.carregar(); });
    document.body.appendChild(c);
  }

  _abrirEnderecos() {
    const e = document.createElement("email-enderecos");
    e.addEventListener("fechar", () => e.remove());
    document.body.appendChild(e);
  }
}

customElements.define("email-view", EmailView);
