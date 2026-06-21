/**
 * <obra-participantes> — Aba "Participantes da obra" (dentro do detalhe da obra).
 *
 * Lista dono + usuários compartilhados + contatos adicionados. Permite adicionar
 * contatos (participante-form) e remover os contatos adicionados. Lê do
 * data-store (cache-first) e assina mudanças. (Saldos/acerto entram na Fase 2.)
 *
 * Atributo: obra-id
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { rotuloOrigem } from "../despesas/despesa-split.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-empty-state.js";
import "../despesas/category-badge.js";
import "./participante-form.js";

const COR_ORIGEM = {
  dono: "var(--cor-primaria)",
  compartilhado: "var(--cor-info)",
  contato: "var(--cor-aviso)",
};

class ObraParticipantes extends BaseElement {
  get obraId() {
    return this.getAttribute("obra-id");
  }

  estilos() {
    return `
      :host { display: block; }
      .barra { display: flex; justify-content: flex-end; margin-bottom: var(--esp-4); }
    `;
  }

  template() {
    return `
      <div class="barra"><ui-button id="add">+ Adicionar contato</ui-button></div>
      <ui-card title="Participantes da obra"><div id="lista"></div></ui-card>
    `;
  }

  aoConectar() {
    this.$("#add").addEventListener("click", () => this.abrirForm());
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const el = this.$("#lista");
    if (!el) return;
    const participantes = dataStore.participantesDaObra(this.obraId);
    if (!participantes.length) {
      el.innerHTML = `<ui-empty-state icone="usuario" titulo="Sem participantes"
        texto="Compartilhe a obra com usuários ou adicione contatos."></ui-empty-state>`;
      return;
    }
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
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
    ];
    // Remover só vale para contatos adicionados (têm linha/id).
    tabela.acoes = [{ nome: "remover", rotulo: "Remover", variant: "perigo" }];
    tabela.rows = participantes;
    tabela.addEventListener("acao", (e) => {
      const p = e.detail.linha;
      if (p.tipo !== "contato" || !p.id) {
        toastSucesso("Dono e usuários compartilhados são participantes automáticos.");
        return;
      }
      this.remover(p);
    });
    el.replaceChildren(tabela);
  }

  abrirForm() {
    const form = document.createElement("participante-form");
    form.obraId = this.obraId;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  async remover(p) {
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
