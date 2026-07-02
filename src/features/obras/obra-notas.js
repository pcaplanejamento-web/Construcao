/**
 * <obra-notas obra-id="…"> — Aba "Notas" da obra: anotações COMPARTILHADAS (quem
 * tem acesso à obra vê/edita), agora em **cards coloridos** (estilo Google Keep),
 * numa grade masonry responsiva de <nota-card>. Lê do data-store (cache/snapshot)
 * e reage a dataStore.subscribe. Criar/editar via <nota-form>; excluir com confirmação.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "./nota-card.js";
import "./nota-form.js";

class ObraNotas extends BaseElement {
  get obraId() { return this.getAttribute("obra-id"); }

  estilos() {
    return `
      :host { display: block; }
      /* Masonry por CSS columns: responsivo (1 coluna no celular, mais no desktop). */
      .grade { column-width: 240px; column-gap: var(--esp-4); }
      .grade > nota-card { display: block; break-inside: avoid; margin-bottom: var(--esp-4); }
      .vazio { color: var(--cor-texto-fraco); padding: var(--esp-5) var(--esp-2); text-align: center; }
    `;
  }

  template() {
    return `
      <ui-card mesa title="Mesa com as notas da obra">
        <ui-button slot="acoes" id="nova">+ Nova nota</ui-button>
        <div id="corpo"></div>
      </ui-card>`;
  }

  aoConectar() {
    this.$("#nova").addEventListener("click", () => this.abrirForm());
    this.pintar();
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const corpo = this.$("#corpo");
    if (!corpo) return;
    const notas = dataStore.notasDaObra(this.obraId) || [];
    if (!notas.length) {
      corpo.innerHTML = `<p class="vazio">Nenhuma nota ainda. Crie a primeira em "+ Nova nota".</p>`;
      return;
    }
    const grade = document.createElement("div");
    grade.className = "grade";
    notas.forEach((n) => {
      const card = document.createElement("nota-card");
      card.nota = n;
      card.addEventListener("abrir", (e) => this.abrirForm(e.detail.nota));
      card.addEventListener("editar", (e) => this.abrirForm(e.detail.nota));
      card.addEventListener("excluir", (e) => this.excluir(e.detail.nota));
      grade.appendChild(card);
    });
    corpo.replaceChildren(grade);
  }

  abrirForm(nota) {
    const form = document.createElement("nota-form");
    form.obraId = this.obraId;
    if (nota) form.nota = nota;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }

  async excluir(nota) {
    const ok = await confirmar({
      titulo: "Excluir nota",
      mensagem: `Excluir a nota "${nota.titulo || "sem título"}"?`,
      perigo: true,
      rotuloOk: "Excluir",
    });
    if (!ok) return;
    try {
      await dataStore.removerNota(this.obraId, nota.id);
      toastSucesso("Nota excluída.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("obra-notas", ObraNotas);
