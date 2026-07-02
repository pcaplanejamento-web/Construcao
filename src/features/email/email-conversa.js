/**
 * <email-conversa> — Painel de leitura INLINE de uma conversa (não-modal), para
 * o layout de 3 colunas do <email-view>. Sem `.threadId` mostra o estado vazio
 * (convida a escrever). Corpo HTML sempre em <iframe sandbox> (anti-XSS).
 *
 * - **Cache-first** (email-cache): reabrir um e-mail já lido é instantâneo; ao
 *   abrir, mostra o cache e atualiza em 2º plano.
 * - **Ocupa todo o espaço**: a mensagem aberta cresce e o corpo preenche a
 *   altura disponível (sem altura fixa).
 * - **Thread com várias mensagens (estilo Gmail)**: as mensagens ficam
 *   RECOLHIDAS (só cabeçalho + resumo); a última abre por padrão ocupando o
 *   espaço; clicar num cabeçalho recolhido abre aquela (e recolhe a anterior);
 *   clicar no cabeçalho aberto recolhe (volta a escolher). Uma aberta por vez.
 *
 * Emite: "compor {modo}", "mudou" (recarregar a lista), "voltar" (mobile), "novo".
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import { emailCache } from "./email-cache.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function quando(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
/** Texto curto a partir do HTML da mensagem, para o resumo do cabeçalho recolhido. */
function resumo(html) {
  return String(html || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim().slice(0, 140);
}

class EmailConversa extends BaseElement {
  set threadId(v) {
    this._threadId = v || null;
    this._mensagens = null;
    this._aberta = -1; // reabre a última por padrão ao carregar
    if (this._ligado) { this.renderizar(); if (this._threadId) this._carregar(); }
  }
  get threadId() { return this._threadId; }
  set assunto(v) { this._assunto = v || ""; }
  get assunto() { return this._assunto || "E-mail"; }

  estilos() {
    return `
      :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
      .vazio { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: var(--esp-4); color: var(--cor-texto-fraco); padding: var(--esp-6); text-align: center; }
      .vazio ui-icon { opacity: .5; }
      .barra { display: flex; align-items: center; gap: var(--esp-2); padding: var(--esp-3) var(--esp-4);
        border-bottom: 1px solid var(--cor-divisor); flex-wrap: wrap; }
      .voltar { display: none; border: none; background: none; cursor: pointer; color: var(--cor-primaria);
        font-weight: var(--peso-semi); font-size: var(--fs-md); padding: 4px; }
      .assunto { flex: 1; min-width: 120px; font-size: var(--fs-lg); font-weight: var(--peso-semi);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .acoes { display: flex; gap: 2px; }
      .ic { border: 1px solid transparent; background: none; cursor: pointer; color: var(--cor-texto-suave);
        border-radius: var(--raio-sm); min-width: 36px; height: 36px; font-size: 1rem; display: inline-flex;
        align-items: center; justify-content: center; }
      .ic:hover { background: var(--cor-superficie-2); }
      .ic.on { color: #f5b301; }
      .labels { display: flex; flex-wrap: wrap; gap: var(--esp-2); padding: var(--esp-2) var(--esp-4) 0; }
      .labels:empty { display: none; }
      .label { font-size: var(--fs-xs); background: var(--cor-primaria-suave); color: var(--cor-primaria-escura);
        border-radius: var(--raio-completo); padding: 2px 10px; font-weight: var(--peso-semi); }

      /* Lista de mensagens — a aberta cresce e o corpo preenche o espaço. */
      .msgs { flex: 1; min-height: 0; overflow-y: auto; padding: var(--esp-4);
        display: flex; flex-direction: column; gap: var(--esp-3); }
      .msg { border: 1px solid var(--cor-borda); border-radius: var(--raio-md); overflow: hidden;
        display: flex; flex-direction: column; }
      .msg.aberta { flex: 1 1 auto; min-height: 320px; }
      .msg.fechada { flex: none; }
      .msg-cab { padding: var(--esp-3) var(--esp-4); background: var(--cor-superficie-2);
        display: flex; align-items: baseline; gap: var(--esp-3); }
      .msg.aberta > .msg-cab { border-bottom: 1px solid var(--cor-borda); }
      .msgs.varias .msg-cab { cursor: pointer; }
      .msgs.varias .msg.fechada .msg-cab:hover { background: var(--cor-superficie); }
      .cab-info { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
      .de { font-weight: var(--peso-semi); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .de small { color: var(--cor-texto-fraco); font-weight: var(--peso-normal); }
      .msg.fechada .de { flex: none; max-width: 42%; }
      .resumo { flex: 1; min-width: 0; color: var(--cor-texto-fraco); font-size: var(--fs-sm);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .meta { display: flex; justify-content: space-between; gap: var(--esp-3); flex-wrap: wrap;
        font-size: var(--fs-sm); color: var(--cor-texto-suave); margin-top: 2px; }
      .para { font-size: var(--fs-xs); color: var(--cor-texto-fraco); }
      .data-msg { font-size: var(--fs-xs); color: var(--cor-texto-fraco); white-space: nowrap; flex: none; }
      .corpo-wrap { flex: 1 1 auto; min-height: 0; display: flex; }
      iframe { flex: 1 1 auto; width: 100%; min-height: 260px; border: none; background: #fff; display: block; }
      .anexos { display: flex; flex-wrap: wrap; gap: var(--esp-2); padding: var(--esp-3) var(--esp-4);
        border-top: 1px solid var(--cor-divisor); }
      .anexo { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-sm); font-family: inherit;
        color: var(--cor-texto-suave); background: var(--cor-superficie-2); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-completo); padding: 6px 12px; min-height: 34px; cursor: pointer; }
      .anexo:hover { background: var(--cor-superficie); color: var(--cor-primaria); border-color: var(--cor-primaria); }
      .rodape { display: flex; gap: var(--esp-2); padding: var(--esp-3) var(--esp-4); border-top: 1px solid var(--cor-divisor); flex-wrap: wrap; }
      .erro { color: var(--cor-erro); padding: var(--esp-4); }
      @media (max-width: 900px) { .voltar { display: inline-flex; } .msg.aberta { min-height: 55vh; } iframe { min-height: 45vh; } }
    `;
  }

  template() {
    if (!this._threadId) {
      return `<div class="vazio">
        <ui-icon name="email" size="48"></ui-icon>
        <p>Selecione um e-mail para ler.</p>
        <ui-button id="novo">Escrever nova mensagem</ui-button>
      </div>`;
    }
    return `
      <div class="barra">
        <button class="voltar" id="voltar" type="button">‹ Voltar</button>
        <div class="assunto" title="${esc(this.assunto)}">${esc(this.assunto)}</div>
        <div class="acoes">
          <button class="ic" id="estrela" title="Favoritar" type="button">☆</button>
        </div>
      </div>
      <div id="labels" class="labels"></div>
      <div class="msgs" id="corpo"><ui-spinner centro text="Abrindo e-mail..."></ui-spinner></div>
      <div class="rodape">
        <ui-button id="responder" tamanho="sm">Responder</ui-button>
        <ui-button id="respTodos" variant="secundario" tamanho="sm">Resp. todos</ui-button>
        <ui-button id="encaminhar" variant="secundario" tamanho="sm">Encaminhar</ui-button>
        <ui-button id="arquivar" variant="secundario" tamanho="sm">Arquivar</ui-button>
        <ui-button id="lixeira" variant="perigo-contorno" tamanho="sm">Excluir</ui-button>
      </div>`;
  }

  aoConectar() {
    this._ligado = true;
    if (this._threadId) this._carregar();
  }

  aposRender() {
    const novo = this.$("#novo");
    if (novo) novo.addEventListener("click", () => this.emitir("novo"));
    const voltar = this.$("#voltar");
    if (voltar) voltar.addEventListener("click", () => this.emitir("voltar"));
    const compor = (modo) => this.emitir("compor", { modo, threadId: this._threadId, assunto: this.assunto });
    const resp = this.$("#responder"); if (resp) resp.addEventListener("click", () => compor("responder"));
    const rt = this.$("#respTodos"); if (rt) rt.addEventListener("click", () => compor("responderTodos"));
    const enc = this.$("#encaminhar"); if (enc) enc.addEventListener("click", () => compor("encaminhar"));
    const arq = this.$("#arquivar"); if (arq) arq.addEventListener("click", () => this._marcar("arquivar", true));
    const lix = this.$("#lixeira"); if (lix) lix.addEventListener("click", () => this._marcar("lixeira", true));
    const est = this.$("#estrela"); if (est) est.addEventListener("click", () => this._marcar(this._estrela ? "tirarEstrela" : "estrela", false));
  }

  async _carregar() {
    const corpo = this.$("#corpo");
    if (!corpo) return;
    const alvo = this._threadId;
    const cache = emailCache.getConversa(alvo);
    if (cache) this._aplicar(cache); // instantâneo (sem spinner)
    try {
      const r = await api.call("email.caixa.ler", { threadId: alvo });
      if (this._threadId !== alvo) return; // trocou de e-mail durante a busca
      emailCache.setConversa(alvo, r);
      this._aplicar(r);
    } catch (e) {
      if (cache) return; // mantém o cache silenciosamente
      notificarErro(e);
      if (this._threadId === alvo) corpo.innerHTML = `<p class="erro">Não foi possível abrir o e-mail.</p>`;
    }
  }

  /** Aplica os dados de uma conversa (cabeçalho, estrela, labels, mensagens). */
  _aplicar(r) {
    this._assunto = r.assunto || this._assunto;
    const a = this.$(".assunto"); if (a) { a.textContent = this.assunto; a.title = this.assunto; }
    this._estrela = !!r.estrela;
    this._atualizarEstrela();
    const lab = this.$("#labels");
    if (lab) lab.innerHTML = (r.labels || []).map((n) => `<span class="label">${esc(n)}</span>`).join("");
    this._mensagens = r.mensagens || [];
    if (this._aberta < 0 || this._aberta >= this._mensagens.length) this._aberta = this._mensagens.length - 1;
    this._pintarMensagens();
  }

  /** Desenha as mensagens (accordion: só a `_aberta` mostra corpo). */
  _pintarMensagens() {
    const corpo = this.$("#corpo");
    if (!corpo || !this._mensagens) return;
    const varias = this._mensagens.length > 1;
    corpo.classList.toggle("varias", varias);
    corpo.innerHTML = this._mensagens.map((m, i) => this._msg(m, i, varias)).join("");

    if (varias) {
      corpo.querySelectorAll(".msg-cab").forEach((cab) =>
        cab.addEventListener("click", () => {
          const i = Number(cab.parentElement.dataset.i);
          this._aberta = this._aberta === i ? -1 : i; // clicar na aberta recolhe (voltar a escolher)
          this._pintarMensagens();
        })
      );
    }
    corpo.querySelectorAll(".anexo").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); this._baixarAnexo(b.dataset.msg, b.dataset.anexo, b.dataset.nome); })
    );
  }

  _msg(m, idx, varias) {
    const aberta = !varias || this._aberta === idx;
    if (!aberta) {
      return `<div class="msg fechada" data-i="${idx}">
        <div class="msg-cab">
          <span class="de">${esc(m.de || "—")}</span>
          <span class="resumo">${esc(resumo(m.html))}</span>
          <span class="data-msg">${esc(quando(m.data))}</span>
        </div>
      </div>`;
    }
    const anexos = (m.anexos || []).length
      ? `<div class="anexos">${m.anexos.map((a) =>
          `<button class="anexo" type="button" data-msg="${idx}" data-anexo="${a.idx}" data-nome="${esc(a.nome)}" title="Baixar ${esc(a.nome)}"><ui-icon name="recibo" size="14"></ui-icon>${esc(a.nome)}</button>`).join("")}</div>`
      : "";
    return `<div class="msg aberta" data-i="${idx}">
      <div class="msg-cab">
        <div class="cab-info">
          <div class="de">${esc(m.de || "")} ${m.deEmail && m.deEmail !== m.de ? `<small>&lt;${esc(m.deEmail)}&gt;</small>` : ""}</div>
          <div class="meta"><span class="para">para ${esc(m.para || "")}</span></div>
        </div>
        <span class="data-msg">${esc(quando(m.data))}</span>
      </div>
      <div class="corpo-wrap">
        <iframe sandbox="" srcdoc="${esc(m.html || "")}" referrerpolicy="no-referrer"></iframe>
      </div>
      ${anexos}
    </div>`;
  }

  async _marcar(acao, voltar) {
    try {
      await api.call("email.caixa.marcar", { threadId: this._threadId, acao });
      const msgs = { arquivar: "Conversa arquivada.", lixeira: "Movido para a lixeira.", estrela: "Marcada com estrela.", tirarEstrela: "Estrela removida." };
      toastSucesso(msgs[acao] || "Feito.");
      emailCache.invalidarConversa(this._threadId);
      if (acao === "estrela" || acao === "tirarEstrela") { this._estrela = acao === "estrela"; this._atualizarEstrela(); }
      this.emitir("mudou");
      if (voltar) this.emitir("voltar");
    } catch (e) { notificarErro(e); }
  }

  _atualizarEstrela() {
    const b = this.$("#estrela");
    if (b) { b.textContent = this._estrela ? "★" : "☆"; b.classList.toggle("on", !!this._estrela); }
  }

  async _baixarAnexo(msgIdx, anexoIdx, nome) {
    try {
      const r = await api.call("email.caixa.anexo", { threadId: this._threadId, msgIdx: Number(msgIdx), anexoIdx: Number(anexoIdx) });
      const bin = atob(r.base64 || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mimeType || "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url; a.download = r.nome || nome || "anexo";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { notificarErro(e); }
  }
}

customElements.define("email-conversa", EmailConversa);
