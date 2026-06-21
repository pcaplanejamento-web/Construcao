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
import { moeda } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { acerto, rotuloOrigem } from "../despesas/despesa-split.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
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
        <ui-card title="${resp ? "Responsáveis" : "Participantes"} — acerto de contas">
          <ui-button slot="acoes" id="acao">${resp ? "Definir responsáveis" : "+ Adicionar contato"}</ui-button>
          <div id="lista"></div>
        </ui-card>
        <ui-card title="Quem deve a quem"><div id="acertos"></div></ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#acao").addEventListener("click", () => this.abrirAcao());
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const lista = this.$("#lista");
    const painel = this.$("#acertos");
    if (!lista) return;

    const todos = dataStore.participantesDaObra(this.obraId);
    const despesas = dataStore.despesas(this.obraId);
    const { saldos, acertos } = acerto(despesas, todos);
    const mapaSaldo = {};
    saldos.forEach((s) => (mapaSaldo[s.chave] = s));

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
        const s = mapaSaldo[p.chave] || { pago: 0, devido: 0, saldo: 0 };
        return { ...p, _pago: s.pago, _devido: s.devido, _saldo: s.saldo };
      });
      const tabela = document.createElement("ui-data-table");
      tabela.setAttribute("fluido", "");
      tabela.columns = [
        { chave: "nome", titulo: "Participante" },
        {
          chave: "origem",
          titulo: "Origem",
          formato: (o) =>
            `<category-badge nome="${rotuloOrigem(o)}" cor="${COR_ORIGEM[o] || "var(--cor-neutro)"}"></category-badge>`,
        },
        { chave: "_pago", titulo: "Pago", alinhar: "dir", formato: (v) => moeda(v) },
        { chave: "_devido", titulo: "Devido", alinhar: "dir", formato: (v) => moeda(v) },
        {
          chave: "_saldo",
          titulo: "Saldo",
          alinhar: "dir",
          formato: (v) => this._saldoCelula(v),
        },
      ];
      tabela.acoes = [
        this.modo === "responsaveis"
          ? { nome: "tirar", rotulo: "Tirar responsável", variant: "perigo" }
          : { nome: "remover", rotulo: "Remover", variant: "perigo" },
      ];
      tabela.rows = rows;
      tabela.addEventListener("acao", (e) => this.acao(e.detail.acao, e.detail.linha));
      lista.replaceChildren(tabela);
    }

    // Painel "quem deve a quem".
    if (!acertos.length) {
      painel.innerHTML = `<div class="ok"><ui-icon name="sucesso" size="16"></ui-icon> Sem pendências — tudo acertado.</div>`;
    } else {
      painel.innerHTML = `<div class="acertos">${acertos
        .map(
          (a) =>
            `<div class="acerto-item"><span>${a.de_nome}</span>
               <span class="seta">→</span><span>${a.para_nome}</span>
               <span class="valor">${moeda(a.valor)}</span></div>`
        )
        .join("")}</div>`;
    }
  }

  _saldoCelula(v) {
    if (Math.abs(v) < 0.01) return `<span style="color:var(--cor-texto-fraco)">—</span>`;
    const cor = v > 0 ? "var(--cor-sucesso)" : "var(--cor-erro)";
    const rot = v > 0 ? "a receber" : "a pagar";
    return `<strong style="color:${cor}">${moeda(Math.abs(v))}</strong>
      <small style="color:var(--cor-texto-fraco)"> ${rot}</small>`;
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
    if (!confirm(`Remover "${p.nome}" dos participantes?`)) return;
    try {
      await dataStore.removerParticipante(this.obraId, p.id);
      toastSucesso("Participante removido.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("obra-participantes", ObraParticipantes);
