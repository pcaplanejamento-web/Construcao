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
import { acerto, rotuloOrigem, balancos } from "../despesas/despesa-split.js";
import { avatarNomeHtml } from "../shared/avatar.js";
import { confirmar } from "../../components/confirmar.js";
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
        return {
          ...p,
          _pago: b.pago,
          _recebido: b.recebido,
          _saldoApagar: b.saldoApagar,
          _saldoReceber: b.saldoReceber,
        };
      });
      const tabela = document.createElement("ui-data-table");
      tabela.setAttribute("fluido", "");
      tabela.columns = [
        { chave: "nome", titulo: "Participante", formato: (v) => avatarNomeHtml(v) },
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
