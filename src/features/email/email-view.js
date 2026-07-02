/**
 * <email-view> — Página /email (admin): caixa de e-mail da empresa
 * (dattaobra@gmail.com) NATIVA no app, via GmailApp no backend. Lista as threads
 * (Caixa de entrada / Enviados), abre a leitura (<email-leitura>) e compõe/responde
 * (<email-compositor>, Fase 3). Dados AO VIVO (não usa o cache do data-store).
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

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function quando(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mesmoAno = d.getFullYear() === hoje.getFullYear();
  return d.toLocaleDateString("pt-BR", mesmoAno ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "2-digit", year: "2-digit" });
}

class EmailView extends BaseElement {
  constructor() {
    super();
    this._caixa = "inbox";
    this._pagina = 0;
    this._estado = "carregando";
    this._dados = null;
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
      .acoes { display: flex; align-items: center; gap: var(--esp-3); flex-wrap: wrap; }
      .toggle { display: inline-flex; border: 1px solid var(--cor-borda-forte);
        border-radius: var(--raio-sm); overflow: hidden; }
      .tg { height: 36px; padding: 0 var(--esp-4); background: var(--cor-superficie);
        border: none; color: var(--cor-texto-suave); cursor: pointer; font-weight: var(--peso-semi); font-size: var(--fs-sm); }
      .tg.ativo { background: var(--cor-primaria); color: #fff; }

      .lista { display: flex; flex-direction: column; }
      .item { display: grid; grid-template-columns: 180px 1fr auto; gap: var(--esp-3); align-items: center;
        width: 100%; text-align: left; background: none; border: none; cursor: pointer;
        padding: var(--esp-3) var(--esp-2); min-height: 52px; border-top: 1px solid var(--cor-divisor);
        color: var(--cor-texto); font-size: var(--fs-md); }
      .item:hover { background: var(--cor-superficie-2); }
      .item.naolido { font-weight: var(--peso-semi); }
      .item.naolido .de::before { content: ""; display: inline-block; width: 8px; height: 8px;
        border-radius: 50%; background: var(--cor-primaria); margin-right: 6px; vertical-align: middle; }
      .de { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .assunto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .assunto .previa { color: var(--cor-texto-fraco); font-weight: var(--peso-normal); }
      .data { color: var(--cor-texto-suave); font-size: var(--fs-sm); white-space: nowrap; }
      .qtd { color: var(--cor-texto-fraco); font-size: var(--fs-xs); }

      .paginacao { display: flex; align-items: center; justify-content: flex-end; gap: var(--esp-3);
        margin-top: var(--esp-4); }
      .vazio, .erro { padding: var(--esp-6) var(--esp-2); text-align: center; color: var(--cor-texto-fraco); }
      .erro { color: var(--cor-erro); }

      @media (max-width: 640px) {
        .item { grid-template-columns: 1fr auto; }
        .de { grid-column: 1 / -1; }
      }
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
              <button class="tg ${this._caixa === "inbox" ? "ativo" : ""}" data-caixa="inbox" type="button">Caixa de entrada</button>
              <button class="tg ${this._caixa === "enviados" ? "ativo" : ""}" data-caixa="enviados" type="button">Enviados</button>
            </div>
            <ui-button id="atualizar" variant="secundario" tamanho="sm">Atualizar</ui-button>
            <ui-button id="escrever" tamanho="sm">Escrever</ui-button>
          </div>
          <div id="corpo"></div>
        </ui-card>
      </div>`;
  }

  aoConectar() {
    this.carregar();
  }

  aposRender() {
    this.$$(".tg").forEach((b) =>
      b.addEventListener("click", () => {
        if (this._caixa === b.dataset.caixa) return;
        this._caixa = b.dataset.caixa;
        this._pagina = 0;
        this.carregar();
      })
    );
    const at = this.$("#atualizar");
    if (at) at.addEventListener("click", () => this.carregar());
    const esc = this.$("#escrever");
    if (esc) esc.addEventListener("click", () => this._compor());
    this._pintar();
  }

  async carregar() {
    this._estado = "carregando";
    this._pintar();
    try {
      this._dados = await api.call("email.caixa.listar", { caixa: this._caixa, pagina: this._pagina });
      this._estado = "pronto";
    } catch (e) {
      this._estado = "erro";
      notificarErro(e);
    }
    // Re-renderiza para refletir a aba ativa/estado e re-liga os eventos.
    this.renderizar();
  }

  _pintar() {
    const corpo = this.$("#corpo");
    if (!corpo) return;
    if (this._estado === "carregando") {
      corpo.innerHTML = `<ui-spinner centro text="Carregando e-mails..."></ui-spinner>`;
      return;
    }
    if (this._estado === "erro") {
      corpo.innerHTML = `<p class="erro">Não foi possível carregar a caixa. Toque em "Atualizar".</p>`;
      return;
    }
    const threads = (this._dados && this._dados.threads) || [];
    if (!threads.length) {
      corpo.innerHTML = `<p class="vazio">${this._pagina > 0 ? "Nada mais por aqui." : "Nenhum e-mail nesta caixa."}</p>`;
      return;
    }
    const linhas = threads
      .map(
        (t) => `<button class="item ${t.lido ? "" : "naolido"}" data-id="${esc(t.threadId)}" data-assunto="${esc(t.assunto)}">
          <span class="de">${esc(t.de || t.deEmail || "—")}</span>
          <span class="assunto">${esc(t.assunto)} ${t.qtdMsgs > 1 ? `<span class="qtd">(${t.qtdMsgs})</span>` : ""}<span class="previa"> — ${esc(t.previa || "")}</span></span>
          <span class="data">${esc(quando(t.data))}</span>
        </button>`
      )
      .join("");
    const temMais = !!(this._dados && this._dados.temMais);
    const paginacao =
      this._pagina > 0 || temMais
        ? `<div class="paginacao">
             <ui-button id="ant" variant="secundario" tamanho="sm" ${this._pagina > 0 ? "" : "disabled"}>‹ Anterior</ui-button>
             <ui-button id="prox" variant="secundario" tamanho="sm" ${temMais ? "" : "disabled"}>Próxima ›</ui-button>
           </div>`
        : "";
    corpo.innerHTML = `<div class="lista">${linhas}</div>${paginacao}`;

    corpo.querySelectorAll(".item").forEach((b) =>
      b.addEventListener("click", () => this._abrir(b.dataset.id, b.dataset.assunto))
    );
    const ant = corpo.querySelector("#ant");
    if (ant) ant.addEventListener("click", () => { if (this._pagina > 0) { this._pagina--; this.carregar(); } });
    const prox = corpo.querySelector("#prox");
    if (prox) prox.addEventListener("click", () => { if (temMais) { this._pagina++; this.carregar(); } });
  }

  _abrir(threadId, assunto) {
    const m = document.createElement("email-leitura");
    m.threadId = threadId;
    m.assunto = assunto;
    m.addEventListener("fechar", () => m.remove());
    m.addEventListener("responder", (e) => {
      m.remove();
      this._responder(e.detail.threadId, e.detail.assunto);
    });
    document.body.appendChild(m);
  }

  /** Abre o compositor para escrever um e-mail novo. */
  _compor() {
    const c = document.createElement("email-compositor");
    c.addEventListener("fechar", () => c.remove());
    c.addEventListener("enviado", () => { if (this._caixa === "enviados") this.carregar(); });
    document.body.appendChild(c);
  }

  /** Abre o compositor em modo resposta a uma conversa. */
  _responder(threadId, assunto) {
    const c = document.createElement("email-compositor");
    c.threadId = threadId;
    c.assunto = assunto;
    c.addEventListener("fechar", () => c.remove());
    c.addEventListener("enviado", () => this.carregar());
    document.body.appendChild(c);
  }
}

customElements.define("email-view", EmailView);
