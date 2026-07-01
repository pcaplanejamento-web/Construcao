/**
 * <obra-notas obra-id="…"> — Aba "Notas" da obra: anotações COMPARTILHADAS (quem
 * tem acesso à obra vê/edita), em formato de MESA (ui-card mesa + ui-data-table),
 * igual às demais abas. Lê do data-store (cache/snapshot) e reage a
 * dataStore.subscribe. Criar/editar via <nota-form>; excluir com confirmação.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-data-table.js";
import "./nota-form.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function previa(texto) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  return t.length > 90 ? t.slice(0, 90) + "…" : t || "—";
}
function quando(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

class ObraNotas extends BaseElement {
  get obraId() { return this.getAttribute("obra-id"); }

  estilos() { return `:host { display: block; }`; }

  template() {
    return `
      <ui-card mesa title="Mesa com as notas da obra">
        <ui-button slot="acoes" id="nova">+ Nova nota</ui-button>
        <ui-data-table id="tab" fluido
          empty-text="Nenhuma nota ainda. Crie a primeira em '+ Nova nota'."></ui-data-table>
      </ui-card>`;
  }

  aoConectar() {
    const tab = this.$("#tab");
    tab.columns = [
      { chave: "titulo", titulo: "Título", formato: (v) => esc(v || "—") },
      { chave: "texto", titulo: "Nota", formato: (v) => esc(previa(v)) },
      { chave: "autor_nome", titulo: "Autor", formato: (v) => esc(v || "—") },
      { chave: "atualizado_em", titulo: "Atualizado", formato: (v) => quando(v) },
    ];
    tab.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
    ];
    tab.addEventListener("acao", (e) => {
      const { acao, linha } = e.detail;
      if (acao === "editar") this.abrirForm(linha);
      else if (acao === "excluir") this.excluir(linha);
    });
    this.$("#nova").addEventListener("click", () => this.abrirForm());
    this.pintar();
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const tab = this.$("#tab");
    if (tab) tab.rows = dataStore.notasDaObra(this.obraId);
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
