/**
 * <email-view> — Página /email (admin): cliente de e-mail em 3 colunas
 * (Pastas | Lista | Leitura), estilo webmail, sobre a caixa da empresa via
 * GmailApp. Reusa email-conversa (leitura inline), email-compositor e
 * email-enderecos. Responsivo: no mobile a leitura ocupa a tela (com "Voltar").
 * Dados AO VIVO (sem cache do data-store).
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { notificarErro } from "../../core/event-bus.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "./email-conversa.js";
import "./email-compositor.js";
import "./email-enderecos.js";

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
  const a = (p[0] || "?")[0] || "?";
  const b = p.length > 1 ? (p[p.length - 1][0] || "") : "";
  return (a + b).toUpperCase();
}
function corAvatar(s) {
  let h = 0;
  const str = String(s || "");
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
  }

  get ehRascunhos() { return this._caixa === "rascunhos"; }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; height: calc(100dvh - 2 * var(--esp-tela)); min-height: 480px; box-sizing: border-box; }

      .painel { flex: 1; min-height: 0; display: grid; grid-template-columns: 190px minmax(300px, 380px) 1fr; grid-template-rows: auto 1fr;
        gap: 0; border: 1px solid var(--cor-borda); border-radius: var(--raio-lg); overflow: hidden; background: var(--cor-superficie); }
      /* Barra do topo do componente: busca (esquerda) + ações (canto direito). */
      .barra-topo { grid-column: 1 / -1; display: flex; align-items: center; gap: var(--esp-3);
        padding: var(--esp-3); border-bottom: 1px solid var(--cor-divisor); flex-wrap: wrap; }
      .barra-topo .acoes { display: flex; gap: var(--esp-2); flex: none; margin-left: auto; }

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
      .busca { flex: 1 1 200px; height: 38px; box-sizing: border-box; font-family: inherit; font-size: var(--fs-sm);
        color: var(--cor-texto); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda); border-radius: var(--raio-completo); padding: 0 var(--esp-4); }
      .lista { flex: 1; min-height: 0; overflow-y: auto; }
      .item { display: grid; grid-template-columns: 40px 1fr; gap: var(--esp-3); width: 100%; text-align: left;
        background: none; border: none; cursor: pointer; padding: var(--esp-3); border-bottom: 1px solid var(--cor-divisor); }
      .item:hover { background: var(--cor-superficie-2); }
      .item.sel { background: var(--cor-primaria-suave); }
      .item.naolido .rem, .item.naolido .assunto { font-weight: var(--peso-forte); color: var(--cor-texto); }
      .avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
        color: #fff; font-weight: var(--peso-semi); font-size: var(--fs-sm); flex: none; }
      .corpo-item { min-width: 0; }
      .linha1 { display: flex; justify-content: space-between; gap: var(--esp-2); align-items: baseline; }
      .rem { font-size: var(--fs-md); color: var(--cor-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .data { font-size: var(--fs-xs); color: var(--cor-texto-fraco); white-space: nowrap; flex: none; }
      .assunto { font-size: var(--fs-sm); color: var(--cor-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .previa { font-size: var(--fs-sm); color: var(--cor-texto-fraco); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .linha2 { display: flex; align-items: center; gap: 6px; }
      .estrela { border: none; background: none; cursor: pointer; font-size: 1rem; line-height: 1; color: var(--cor-texto-fraco); flex: none; padding: 0; }
      .estrela.on { color: #f5b301; }
      .lbl { font-size: var(--fs-xs); background: var(--cor-primaria-suave); color: var(--cor-primaria-escura); border-radius: var(--raio-completo); padding: 0 8px; }
      .paginacao { display: flex; justify-content: space-between; gap: var(--esp-2); padding: var(--esp-2) var(--esp-3); border-top: 1px solid var(--cor-divisor); }
      .vazio, .erro { padding: var(--esp-6) var(--esp-3); text-align: center; color: var(--cor-texto-fraco); }
      .erro { color: var(--cor-erro); }

      /* Leitura */
      .leitura-col { min-height: 0; display: flex; flex-direction: column; }
      email-conversa { flex: 1; min-height: 0; }

      /* Tablet: esconde a coluna de pastas (vira barra de filtros em cima da lista) */
      @media (max-width: 1100px) {
        .painel { grid-template-columns: minmax(280px, 340px) 1fr; }
        .pastas { display: none; }
      }
      /* Mobile: 1 coluna; ao abrir um e-mail, a leitura ocupa tudo. */
      @media (max-width: 820px) {
        .area { height: auto; min-height: 0; }
        .painel { grid-template-columns: 1fr; height: 70dvh; }
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
          <div class="barra-topo">
            <input id="busca" class="busca" type="search" placeholder="Buscar por remetente ou assunto..." value="${esc(this._q)}">
            <div class="acoes">
              <ui-button id="escrever" tamanho="sm">Escrever</ui-button>
              <ui-button id="configurar" variant="secundario" tamanho="sm">Configurar</ui-button>
              <ui-button id="atualizar" variant="secundario" tamanho="sm">Atualizar</ui-button>
            </div>
          </div>
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
    this.$("#escrever").addEventListener("click", () => this._abrirCompositor({ modo: "novo" }));
    this.$("#configurar").addEventListener("click", () => this._abrirEnderecos());
    this.$("#atualizar").addEventListener("click", () => this.carregar());
    const busca = this.$("#busca");
    busca.addEventListener("keydown", (e) => { if (e.key === "Enter") { this._q = busca.value.trim(); this._pagina = 0; this.carregar(); } });

    const conversa = this.$("#conversa");
    conversa.addEventListener("mudou", () => this.carregar());
    conversa.addEventListener("voltar", () => this._voltar());
    conversa.addEventListener("novo", () => this._abrirCompositor({ modo: "novo" }));
    conversa.addEventListener("compor", (e) => this._abrirCompositor(e.detail));

    this._pintarPastas();
    this._pintarLista();
  }

  _pintarPastas() {
    const box = this.$("#pastas");
    if (!box) return;
    const btn = (p) => `<button class="pasta ${this._caixa === p.id ? "ativo" : ""}" data-caixa="${p.id}" type="button"><ui-icon name="${p.icone}" size="16"></ui-icon>${p.rotulo}</button>`;
    const labelsHtml = this._labels.length
      ? `<div class="sep"></div><div class="tit">Marcadores</div>` +
        this._labels.map((n) => `<button class="pasta ${this._caixa === "label:" + n ? "ativo" : ""}" data-caixa="label:${esc(n)}" type="button"><ui-icon name="tag" size="16"></ui-icon>${esc(n)}</button>`).join("")
      : "";
    box.innerHTML = PASTAS.map(btn).join("") + labelsHtml;
    box.querySelectorAll(".pasta").forEach((b) => b.addEventListener("click", () => this._irPasta(b.dataset.caixa)));
  }

  _irPasta(caixa) {
    this._caixa = caixa;
    this._q = "";
    this._pagina = 0;
    this._selecionar(null);
    const bu = this.$("#busca"); if (bu) bu.value = "";
    this._pintarPastas();
    this.carregar();
  }

  async _carregarLabels() {
    try { const r = await api.call("email.caixa.labels"); this._labels = r.labels || []; this._pintarPastas(); }
    catch (e) { /* sem labels */ }
  }

  async carregar() {
    this._estado = "carregando";
    this._pintarLista();
    try {
      if (this.ehRascunhos) {
        const r = await api.call("email.caixa.rascunhos", { pagina: this._pagina });
        this._dados = { pagina: r.pagina, temMais: r.temMais, threads: (r.rascunhos || []).map((d) => ({ draftId: d.draftId, de: "Rascunho", assunto: d.assunto, previa: d.previa, data: d.data, lido: true, _draft: d })) };
      } else {
        this._dados = await api.call("email.caixa.listar", { caixa: this._caixa, q: this._q || "", pagina: this._pagina });
      }
      this._estado = "pronto";
    } catch (e) {
      this._estado = "erro";
      notificarErro(e);
    }
    this._pintarLista();
  }

  _pintarLista() {
    const lista = this.$("#lista");
    if (!lista) return;
    if (this._estado === "carregando") { lista.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`; return; }
    if (this._estado === "erro") { lista.innerHTML = `<p class="erro">Não foi possível carregar. Toque em "Atualizar".</p>`; return; }
    const threads = (this._dados && this._dados.threads) || [];
    if (!threads.length) { lista.innerHTML = `<p class="vazio">${this._pagina > 0 ? "Nada mais por aqui." : "Vazio."}</p>`; return; }

    const linhas = threads.map((t, i) => {
      const nome = t.de || t.deEmail || "—";
      const estrela = this.ehRascunhos ? "" : `<button class="estrela ${t.estrela ? "on" : ""}" data-i="${i}" type="button" title="Favoritar">${t.estrela ? "★" : "☆"}</button>`;
      const labels = (t.labels || []).filter((n) => ["INBOX", "SENT", "UNREAD", "IMPORTANT", "STARRED"].indexOf(n) < 0)
        .map((n) => `<span class="lbl">${esc(n)}</span>`).join("");
      return `<button class="item ${t.lido ? "" : "naolido"} ${this._selecionado === (t.threadId || t.draftId) ? "sel" : ""}" data-i="${i}" type="button">
        <span class="avatar" style="background:${corAvatar(nome)}">${esc(iniciais(nome))}</span>
        <span class="corpo-item">
          <span class="linha1"><span class="rem">${esc(nome)}</span><span class="data">${esc(quando(t.data))}</span></span>
          <span class="assunto">${labels}${esc(t.assunto)}${t.qtdMsgs > 1 ? ` (${t.qtdMsgs})` : ""}</span>
          <span class="linha2">${estrela}<span class="previa">${esc(t.previa || "")}</span></span>
        </span>
      </button>`;
    }).join("");
    const temMais = !!(this._dados && this._dados.temMais);
    const paginacao = (this._pagina > 0 || temMais)
      ? `<div class="paginacao"><ui-button id="ant" variant="secundario" tamanho="sm" ${this._pagina > 0 ? "" : "disabled"}>‹ Anterior</ui-button><ui-button id="prox" variant="secundario" tamanho="sm" ${temMais ? "" : "disabled"}>Próxima ›</ui-button></div>`
      : "";
    lista.innerHTML = `${linhas}${paginacao}`;

    lista.querySelectorAll(".item").forEach((b) =>
      b.addEventListener("click", (e) => { if (e.target.closest(".estrela")) return; this._clicar(threads[Number(b.dataset.i)]); })
    );
    lista.querySelectorAll(".estrela").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); this._toggleEstrela(threads[Number(b.dataset.i)]); })
    );
    const ant = lista.querySelector("#ant"); if (ant) ant.addEventListener("click", () => { if (this._pagina > 0) { this._pagina--; this.carregar(); } });
    const prox = lista.querySelector("#prox"); if (prox) prox.addEventListener("click", () => { if (temMais) { this._pagina++; this.carregar(); } });
  }

  _clicar(t) {
    if (!t) return;
    if (t.draftId) { this._abrirCompositor({ draftId: t.draftId, draft: t._draft }); return; }
    this._selecionar(t.threadId);
    const conversa = this.$("#conversa");
    conversa.assunto = t.assunto;
    conversa.threadId = t.threadId;
  }

  _selecionar(threadId) {
    this._selecionado = threadId;
    // Realce na lista (sem re-render completo).
    const lista = this.$("#lista");
    if (lista) {
      const threads = (this._dados && this._dados.threads) || [];
      lista.querySelectorAll(".item").forEach((b) => {
        const t = threads[Number(b.dataset.i)];
        b.classList.toggle("sel", !!t && (t.threadId || t.draftId) === threadId);
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

  async _toggleEstrela(t) {
    if (!t || !t.threadId) return;
    try {
      await api.call("email.caixa.marcar", { threadId: t.threadId, acao: t.estrela ? "tirarEstrela" : "estrela" });
      t.estrela = !t.estrela;
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
    c.addEventListener("enviado", () => this.carregar());
    document.body.appendChild(c);
  }

  _abrirEnderecos() {
    const e = document.createElement("email-enderecos");
    e.addEventListener("fechar", () => e.remove());
    document.body.appendChild(e);
  }
}

customElements.define("email-view", EmailView);
