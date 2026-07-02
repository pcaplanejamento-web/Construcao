/**
 * <email-view> — Página /email (admin): caixa de e-mail da empresa
 * (dattaobra@gmail.com) NATIVA no app, via GmailApp. Filtros (Entrada, Enviados,
 * Estrela, Rascunhos, Lixeira, Marcadores), busca, estrela na linha, leitura,
 * compor/responder/encaminhar e rascunhos. Dados AO VIVO (sem cache do data-store).
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { notificarErro } from "../../core/event-bus.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "./email-leitura.js";
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

const FILTROS = [
  { id: "inbox", rotulo: "Entrada" },
  { id: "enviados", rotulo: "Enviados" },
  { id: "estrela", rotulo: "Com estrela" },
  { id: "rascunhos", rotulo: "Rascunhos" },
  { id: "lixeira", rotulo: "Lixeira" },
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
  }

  get ehRascunhos() { return this._caixa === "rascunhos"; }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
      .acoes { display: flex; align-items: center; gap: var(--esp-2); flex-wrap: wrap; }
      .toggle { display: inline-flex; border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm); overflow: hidden; }
      .tg { height: 34px; padding: 0 var(--esp-3); background: var(--cor-superficie); border: none;
        color: var(--cor-texto-suave); cursor: pointer; font-weight: var(--peso-semi); font-size: var(--fs-sm); }
      .tg.ativo { background: var(--cor-primaria); color: #fff; }
      select.mark { height: 34px; border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-sm);
        background: var(--cor-superficie); color: var(--cor-texto); font-size: var(--fs-sm); padding: 0 var(--esp-2); }
      .busca { height: 34px; min-width: 180px; flex: 1; box-sizing: border-box; font-family: inherit; font-size: var(--fs-sm);
        color: var(--cor-texto); background: var(--cor-superficie); border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-sm); padding: 0 var(--esp-3); }
      @media (max-width: 700px) { .busca { min-width: 0; width: 100%; flex: 1 1 100%; } }

      .lista { display: flex; flex-direction: column; }
      .item { display: grid; grid-template-columns: 28px 170px 1fr auto; gap: var(--esp-2); align-items: center;
        width: 100%; text-align: left; padding: var(--esp-3) var(--esp-2); min-height: 52px;
        border-top: 1px solid var(--cor-divisor); color: var(--cor-texto); font-size: var(--fs-md); }
      .item:hover { background: var(--cor-superficie-2); }
      .item.naolido .de, .item.naolido .assunto { font-weight: var(--peso-semi); }
      .estrela { border: none; background: none; cursor: pointer; font-size: 1.1rem; line-height: 1; color: var(--cor-texto-fraco); padding: 4px; }
      .estrela.on { color: #f5b301; }
      .abre { display: contents; cursor: pointer; }
      .de { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .assunto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
      .assunto .previa { color: var(--cor-texto-fraco); font-weight: var(--peso-normal); }
      .assunto .lbl { font-size: var(--fs-xs); background: var(--cor-primaria-suave); color: var(--cor-primaria-escura);
        border-radius: var(--raio-completo); padding: 1px 8px; margin-right: 6px; font-weight: var(--peso-semi); }
      .data { color: var(--cor-texto-suave); font-size: var(--fs-sm); white-space: nowrap; cursor: pointer; }
      .qtd { color: var(--cor-texto-fraco); font-size: var(--fs-xs); }
      .paginacao { display: flex; align-items: center; justify-content: flex-end; gap: var(--esp-3); margin-top: var(--esp-4); }
      .vazio, .erro { padding: var(--esp-6) var(--esp-2); text-align: center; color: var(--cor-texto-fraco); }
      .erro { color: var(--cor-erro); }
      @media (max-width: 640px) { .item { grid-template-columns: 28px 1fr auto; } .de { grid-column: 2 / -1; } }
    `;
  }

  template() {
    return `
      <div class="area">
        <div>
          <h1>E-mail</h1>
          <p class="sub">Caixa da empresa · contato@dattaobra.com.br</p>
        </div>
        <ui-card>
          <div slot="acoes" class="acoes">
            <div class="toggle">
              ${FILTROS.map((f) => `<button class="tg ${this._caixa === f.id ? "ativo" : ""}" data-caixa="${f.id}" type="button">${f.rotulo}</button>`).join("")}
            </div>
            <select class="mark" id="mark"><option value="">Marcadores…</option></select>
            <input id="busca" class="busca" type="search" placeholder="Buscar... (Enter)" value="${esc(this._q)}">
            <ui-button id="atualizar" variant="secundario" tamanho="sm">Atualizar</ui-button>
            <ui-button id="enderecos" variant="secundario" tamanho="sm">Endereços</ui-button>
            <ui-button id="escrever" tamanho="sm">Escrever</ui-button>
          </div>
          <div id="corpo"></div>
        </ui-card>
      </div>`;
  }

  aoConectar() {
    this.carregar();
    this._carregarLabels();
  }

  aposRender() {
    this.$$(".tg").forEach((b) =>
      b.addEventListener("click", () => {
        this._caixa = b.dataset.caixa; this._q = ""; this._pagina = 0;
        const mk = this.$("#mark"); if (mk) mk.value = "";
        this.carregar();
      })
    );
    const mk = this.$("#mark");
    if (mk) mk.addEventListener("change", () => {
      if (!mk.value) return;
      this._caixa = "label:" + mk.value; this._q = ""; this._pagina = 0; this.carregar();
    });
    const busca = this.$("#busca");
    if (busca) busca.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      this._q = busca.value.trim(); this._pagina = 0; this.carregar();
    });
    const at = this.$("#atualizar"); if (at) at.addEventListener("click", () => this.carregar());
    const ec = this.$("#escrever"); if (ec) ec.addEventListener("click", () => this._abrirCompositor({ modo: "novo" }));
    const en = this.$("#enderecos"); if (en) en.addEventListener("click", () => this._abrirEnderecos());
    this._preencherLabels();
    this._pintar();
  }

  async _carregarLabels() {
    try { const r = await api.call("email.caixa.labels"); this._labels = r.labels || []; this._preencherLabels(); }
    catch (e) { /* sem labels */ }
  }
  _preencherLabels() {
    const mk = this.$("#mark");
    if (!mk) return;
    const sel = this._caixa.indexOf("label:") === 0 ? this._caixa.slice(6) : "";
    mk.innerHTML = `<option value="">Marcadores…</option>` + this._labels.map((n) => `<option value="${esc(n)}" ${n === sel ? "selected" : ""}>${esc(n)}</option>`).join("");
  }

  async carregar() {
    this._estado = "carregando";
    this._pintar();
    try {
      if (this.ehRascunhos) {
        const r = await api.call("email.caixa.rascunhos", { pagina: this._pagina });
        this._dados = {
          pagina: r.pagina, temMais: r.temMais,
          threads: (r.rascunhos || []).map((d) => ({ draftId: d.draftId, de: "Rascunho", assunto: d.assunto, previa: d.previa, data: d.data, lido: true, _draft: d })),
        };
      } else {
        this._dados = await api.call("email.caixa.listar", { caixa: this._caixa, q: this._q || "", pagina: this._pagina });
      }
      this._estado = "pronto";
    } catch (e) {
      this._estado = "erro";
      notificarErro(e);
    }
    this.renderizar();
  }

  _pintar() {
    const corpo = this.$("#corpo");
    if (!corpo) return;
    if (this._estado === "carregando") { corpo.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`; return; }
    if (this._estado === "erro") { corpo.innerHTML = `<p class="erro">Não foi possível carregar. Toque em "Atualizar".</p>`; return; }
    const threads = (this._dados && this._dados.threads) || [];
    if (!threads.length) { corpo.innerHTML = `<p class="vazio">${this._pagina > 0 ? "Nada mais por aqui." : "Vazio."}</p>`; return; }

    const linhas = threads.map((t, i) => {
      const estrelaBtn = this.ehRascunhos ? `<span></span>`
        : `<button class="estrela ${t.estrela ? "on" : ""}" data-i="${i}" title="Favoritar" type="button">${t.estrela ? "★" : "☆"}</button>`;
      const labels = (t.labels || []).filter((n) => ["INBOX", "SENT", "UNREAD", "IMPORTANT"].indexOf(n) < 0)
        .map((n) => `<span class="lbl">${esc(n)}</span>`).join("");
      return `<div class="item ${t.lido ? "" : "naolido"}">
        ${estrelaBtn}
        <span class="de abrealvo" data-i="${i}">${esc(t.de || t.deEmail || "—")}</span>
        <span class="assunto abrealvo" data-i="${i}">${labels}${esc(t.assunto)} ${t.qtdMsgs > 1 ? `<span class="qtd">(${t.qtdMsgs})</span>` : ""}<span class="previa"> — ${esc(t.previa || "")}</span></span>
        <span class="data abrealvo" data-i="${i}">${esc(quando(t.data))}</span>
      </div>`;
    }).join("");
    const temMais = !!(this._dados && this._dados.temMais);
    const paginacao = (this._pagina > 0 || temMais)
      ? `<div class="paginacao">
           <ui-button id="ant" variant="secundario" tamanho="sm" ${this._pagina > 0 ? "" : "disabled"}>‹ Anterior</ui-button>
           <ui-button id="prox" variant="secundario" tamanho="sm" ${temMais ? "" : "disabled"}>Próxima ›</ui-button>
         </div>` : "";
    corpo.innerHTML = `<div class="lista">${linhas}</div>${paginacao}`;

    corpo.querySelectorAll(".abrealvo").forEach((el) =>
      el.addEventListener("click", () => this._clicar(threads[Number(el.dataset.i)]))
    );
    corpo.querySelectorAll(".estrela").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); this._toggleEstrela(threads[Number(b.dataset.i)]); })
    );
    const ant = corpo.querySelector("#ant"); if (ant) ant.addEventListener("click", () => { if (this._pagina > 0) { this._pagina--; this.carregar(); } });
    const prox = corpo.querySelector("#prox"); if (prox) prox.addEventListener("click", () => { if (temMais) { this._pagina++; this.carregar(); } });
  }

  _clicar(t) {
    if (!t) return;
    if (t.draftId) return this._abrirCompositor({ draftId: t.draftId, draft: t._draft });
    this._abrir(t.threadId, t.assunto);
  }

  async _toggleEstrela(t) {
    if (!t || !t.threadId) return;
    try {
      await api.call("email.caixa.marcar", { threadId: t.threadId, acao: t.estrela ? "tirarEstrela" : "estrela" });
      t.estrela = !t.estrela;
      this._pintar();
    } catch (e) { notificarErro(e); }
  }

  _abrir(threadId, assunto) {
    const m = document.createElement("email-leitura");
    m.threadId = threadId;
    m.assunto = assunto;
    m.addEventListener("fechar", () => m.remove());
    m.addEventListener("mudou", () => this.carregar());
    m.addEventListener("compor", (e) => { m.remove(); this._abrirCompositor(e.detail); });
    document.body.appendChild(m);
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
