/**
 * <obra-participantes> — Aba "Participantes da obra" / "Responsáveis".
 *
 * Lista dono + usuários compartilhados + contatos, com o ACERTO DE CONTAS:
 * por participante mostra Pago, Devido e Saldo (a receber / a pagar) e um painel
 * "quem deve a quem". Lê do data-store (cache-first) e assina mudanças.
 *
 * Atributos: obra-id; modo ("participantes" | "responsaveis").
 *  - participantes: mostra todos; adiciona/remove contatos.
 *  - responsaveis: mostra só os marcados; botão p/ definir responsáveis.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { irPara } from "../../core/router.js";
import { moeda } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { acerto, rotuloOrigem, balancos } from "../despesas/despesa-split.js";
import { avatarNomeHtml, avatarHtml, whatsappBtnHtml } from "../shared/avatar.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
import "../../components/ui-lista-gestos.js";

// Escapa texto p/ os cards mobile (nomes vêm do data-store).
const _esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
import "../../components/ui-button.js";
import "../../components/ui-icon.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./participante-form.js";
import "./responsaveis-form.js";

const COR_ORIGEM = {
  dono: "var(--cor-primaria)",
  compartilhado: "var(--cor-info)",
  contato: "var(--cor-aviso)",
};

class ObraParticipantes extends BaseElement {
  get obraId() {
    return this.getAttribute("obra-id");
  }
  get modo() {
    return this.getAttribute("modo") === "responsaveis" ? "responsaveis" : "participantes";
  }

  estilos() {
    return `
      :host { display: block; }
      .grupos { display: flex; flex-direction: column; gap: var(--esp-5); }
      .acertos { display: flex; flex-direction: column; gap: var(--esp-2); }
      .acerto-item { display: flex; align-items: center; gap: var(--esp-2);
        padding: var(--esp-3); border: 1px solid var(--cor-borda); border-radius: var(--raio-sm); }
      .acerto-item .seta { color: var(--cor-texto-fraco); }
      .acerto-item .valor { margin-left: auto; font-weight: var(--peso-semi); color: var(--cor-erro); }
      .ok { color: var(--cor-sucesso); font-size: var(--fs-sm); display: flex;
        align-items: center; gap: var(--esp-2); }
    `;
  }

  template() {
    const resp = this.modo === "responsaveis";
    return `
      <div class="grupos">
        <ui-card mesa title="${resp ? "Responsáveis" : "Participantes"} — acerto de contas">
          <ui-button slot="acoes" id="acao">${resp ? "Definir responsáveis" : "+ Adicionar contato"}</ui-button>
          <div id="lista"></div>
        </ui-card>
        <ui-card mesa title="Quem deve a quem"><div id="acertos"></div></ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#acao").addEventListener("click", () => this.abrirAcao());
    // Responsivo: desktop = tabela; mobile (≤820px) = cards estilo agenda.
    this._mq = window.matchMedia("(max-width: 820px)");
    this._onMq = () => this.pintar();
    this._mq.addEventListener("change", this._onMq);
    this.aoLimpar(() => this._mq.removeEventListener("change", this._onMq));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const lista = this.$("#lista");
    const painel = this.$("#acertos");
    if (!lista) return;

    const todos = dataStore.participantesDaObra(this.obraId);
    const despesas = dataStore.despesas(this.obraId);
    // Saldos do modelo paga ↔ recebe (Pago/Recebido/Saldo a pagar/Saldo a receber).
    const { porChave } = balancos(despesas);
    // Acerto entre participantes — só p/ o painel "quem deve a quem".
    const { acertos } = acerto(despesas, todos);

    const visiveis =
      this.modo === "responsaveis" ? todos.filter((p) => p.eh_responsavel) : todos;

    if (!visiveis.length) {
      lista.innerHTML = `<ui-empty-state icone="usuario"
        titulo="${this.modo === "responsaveis" ? "Nenhum responsável" : "Sem participantes"}"
        texto="${
          this.modo === "responsaveis"
            ? "Use o botão Definir responsáveis para escolher entre os participantes."
            : "Compartilhe a obra com usuários ou adicione contatos."
        }"></ui-empty-state>`;
    } else {
      const rows = visiveis.map((p) => {
        const b = porChave[p.chave] || { pago: 0, recebido: 0, saldoApagar: 0, saldoReceber: 0 };
        // Resolve contato/equipe pela CHAVE ("c:<id>"/"e:<id>") p/ navegação + WhatsApp.
        const ch = String(p.chave || "");
        const cid = ch.indexOf("c:") === 0 ? ch.slice(2) : "";
        const eid = ch.indexOf("e:") === 0 ? ch.slice(2) : "";
        const c = cid ? dataStore.contatos().find((x) => String(x.id) === String(cid)) : null;
        return {
          ...p,
          _pago: b.pago,
          _recebido: b.recebido,
          _saldoApagar: b.saldoApagar,
          _saldoReceber: b.saldoReceber,
          _cid: cid,
          _eid: eid,
          _tel: c ? c.telefone : "",
        };
      });
      // MOBILE (≤820px): cards estilo agenda (avatar + nome + Origem + valores
      // compactos + botão discreto de remover). Reusa o mesmo elemento entre
      // pinturas p/ não recriar no meio de um gesto.
      if (this._mq && this._mq.matches) {
        let lg = lista.querySelector("ui-lista-gestos");
        if (!lg) { lg = this._novaListaParticipantes(); lista.replaceChildren(lg); }
        lg.render = (p) => this._cardParticipante(p);
        lg.itens = rows;
        this._pintarAcertos(painel, acertos);
        return;
      }

      const tabela = document.createElement("ui-data-table");
      tabela.setAttribute("fluido", "");
      tabela.setAttribute("clicavel", "");
      tabela.columns = [
        { chave: "nome", titulo: "Participante", formato: (v) => avatarNomeHtml(v) },
        { chave: "_tel", titulo: "", formato: (v) => whatsappBtnHtml(v), largura: "52px" },
        {
          chave: "origem",
          titulo: "Origem",
          formato: (o) =>
            `<category-badge nome="${rotuloOrigem(o)}" cor="${COR_ORIGEM[o] || "var(--cor-neutro)"}"></category-badge>`,
        },
        { chave: "_pago", titulo: "Pago", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
        { chave: "_recebido", titulo: "Recebido", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
        {
          chave: "_saldoApagar",
          titulo: "Saldo a pagar",
          alinhar: "dir",
          moeda: true,
          formato: (v) =>
            v > 0.01
              ? `<strong style="color:var(--cor-erro)">${moeda(v)}</strong>`
              : `<span style="color:var(--cor-texto-fraco)">—</span>`,
        },
        {
          chave: "_saldoReceber",
          titulo: "Saldo a receber",
          alinhar: "dir",
          moeda: true,
          formato: (v) =>
            v > 0.01
              ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>`
              : `<span style="color:var(--cor-texto-fraco)">—</span>`,
        },
      ];
      tabela.acoes = [
        this.modo === "responsaveis"
          ? { nome: "tirar", rotulo: "Tirar responsável", variant: "perigo" }
          : { nome: "remover", rotulo: "Remover", variant: "perigo" },
      ];
      tabela.rows = rows;
      tabela.addEventListener("acao", (e) => this.acao(e.detail.acao, e.detail.linha));
      // Linha clicável → tela do contato (ou da equipe). Dono/usuários não têm página.
      tabela.addEventListener("linha", (e) => {
        const l = e.detail.linha || {};
        if (l._cid) irPara("/contatos/" + l._cid);
        else if (l._eid) irPara("/equipes/" + l._eid);
      });
      lista.replaceChildren(tabela);
    }

    // Painel "quem deve a quem".
    this._pintarAcertos(painel, acertos);
  }

  /** Painel "quem deve a quem" (comum a desktop e mobile). */
  _pintarAcertos(painel, acertos) {
    if (!painel) return;
    if (!acertos.length) {
      painel.innerHTML = `<div class="ok"><ui-icon name="sucesso" size="16"></ui-icon> Sem pendências — tudo acertado.</div>`;
    } else {
      painel.innerHTML = `<div class="acertos">${acertos
        .map(
          (a) =>
            `<div class="acerto-item"><span>${_esc(a.de_nome)}</span>
               <span class="seta">→</span><span>${_esc(a.para_nome)}</span>
               <span class="valor">${moeda(a.valor)}</span></div>`
        )
        .join("")}</div>`;
    }
  }

  /** Card mobile de um participante: avatar + nome + Origem + valores compactos. */
  _cardParticipante(p) {
    const origem = `<category-badge nome="${rotuloOrigem(p.origem)}" cor="${COR_ORIGEM[p.origem] || "var(--cor-neutro)"}"></category-badge>`;
    const apagar = p._saldoApagar > 0.01 ? `<strong style="color:var(--cor-erro)">${moeda(p._saldoApagar)}</strong>` : "—";
    const areceber = p._saldoReceber > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(p._saldoReceber)}</strong>` : "—";
    const resp = this.modo === "responsaveis";
    const podeRemover = resp || (p.tipo === "contato" && p.id);
    const rotuloRem = resp ? "Tirar dos responsáveis" : "Remover participante";
    const btnRem = podeRemover
      ? `<button type="button" data-acao-linha="remover" aria-label="${rotuloRem}" title="${rotuloRem}"
          style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;
          border:none;background:none;cursor:pointer;color:var(--cor-erro);padding:0"><ui-icon name="excluir" size="20"></ui-icon></button>`
      : "";
    return `<div style="display:flex;gap:14px;width:100%;min-width:0">
      ${avatarHtml(p.nome, 46)}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="font-size:1.05rem;font-weight:var(--peso-semi);color:var(--cor-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(p.nome)}</span>
          <span style="flex:none">${origem}</span>
        </div>
        <div style="font-size:var(--fs-sm);color:var(--cor-texto-suave)">Pago <strong style="color:var(--cor-texto)">${moeda(p._pago)}</strong> · Receb. <strong style="color:var(--cor-texto)">${moeda(p._recebido)}</strong></div>
        <div style="font-size:var(--fs-sm);color:var(--cor-texto-suave)">A pagar ${apagar} · A receber ${areceber}</div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:2px;margin:2px -6px -4px 0">
          ${p._tel ? whatsappBtnHtml(p._tel, 40) : ""}${btnRem}
        </div>
      </div>
    </div>`;
  }

  /** Cria a lista de gestos de participantes (reusada entre pinturas). */
  _novaListaParticipantes() {
    const lg = document.createElement("ui-lista-gestos");
    lg.semSwipeAcao = true; // remover é pelo botão; arraste horizontal troca de aba
    lg.render = (p) => this._cardParticipante(p);
    lg.addEventListener("abrir", (e) => {
      const l = e.detail.item || {};
      if (l._cid) irPara("/contatos/" + l._cid);
      else if (l._eid) irPara("/equipes/" + l._eid);
    });
    lg.addEventListener("acao-linha", (e) => {
      if (e.detail.acao === "remover") this.acao(this.modo === "responsaveis" ? "tirar" : "remover", e.detail.item);
    });
    return lg;
  }

  /* ------------------------------ Ações -------------------------------- */

  abrirAcao() {
    const tag = this.modo === "responsaveis" ? "responsaveis-form" : "participante-form";
    const form = document.createElement(tag);
    form.obraId = this.obraId;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  acao(nome, p) {
    if (nome === "tirar") return this.tirarResponsavel(p);
    return this.removerContato(p);
  }

  async tirarResponsavel(p) {
    try {
      await dataStore.definirResponsavel(this.obraId, p.chave, false);
      toastSucesso("Removido dos responsáveis.");
    } catch (e) {
      notificarErro(e);
    }
  }

  async removerContato(p) {
    if (p.tipo !== "contato" || !p.id) {
      toastSucesso("Dono e usuários compartilhados são participantes automáticos.");
      return;
    }
    if (!(await confirmar({ titulo: "Remover participante", mensagem: `Remover "${p.nome}" dos participantes?`, perigo: true, rotuloOk: "Remover" }))) return;
    try {
      await dataStore.removerParticipante(this.obraId, p.id);
      toastSucesso("Participante removido.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("obra-participantes", ObraParticipantes);
