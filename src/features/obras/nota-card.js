/**
 * <nota-card> — Cartão de uma nota (estilo Google Keep), com fundo colorido
 * conforme `nota.cor` (paleta em nota-cores.js). Espelha o padrão de eventos do
 * <obra-card>: clique no card → "abrir"; botões → "editar"/"excluir".
 *
 * Propriedade: .nota = { id, titulo, texto, autor_nome, atualizado_em, cor }
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { fundoNota, tintaNota, bordaNota } from "./nota-cores.js";
import "../../components/ui-icon.js";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function quando(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

class NotaCard extends BaseElement {
  set nota(v) { this._nota = v || {}; if (this.shadowRoot.childElementCount) this.renderizar(); }
  get nota() { return this._nota || {}; }

  estilos() {
    return `
      :host { display: block; }
      .card {
        background: var(--nc-fundo); color: var(--nc-tinta);
        border: 1px solid var(--nc-borda); border-radius: var(--raio-lg);
        box-shadow: var(--sombra-sm); padding: var(--esp-4); cursor: pointer;
        transition: box-shadow var(--transicao), transform var(--transicao);
        display: flex; flex-direction: column; gap: var(--esp-2); min-height: 96px;
      }
      .card:hover { box-shadow: var(--sombra-md); transform: translateY(-2px); }
      h3 { font-size: var(--fs-md); font-weight: var(--peso-semi); line-height: 1.3;
        display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
        line-clamp: 2; overflow: hidden; word-break: break-word; }
      .texto { font-size: var(--fs-sm); line-height: 1.5; opacity: .92; white-space: pre-wrap;
        display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 8;
        line-clamp: 8; overflow: hidden; word-break: break-word; }
      .rodape { display: flex; align-items: center; gap: var(--esp-2); margin-top: auto;
        padding-top: var(--esp-2); font-size: var(--fs-xs); opacity: .75; }
      .rodape .quem { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        display: flex; align-items: center; gap: 4px; }
      .acoes { display: flex; gap: 2px; }
      .ic { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
        border: none; background: transparent; color: inherit; opacity: .7; cursor: pointer;
        border-radius: var(--raio-completo); }
      .ic:hover { opacity: 1; background: rgba(0,0,0,.08); }
      /* Alvo de toque confortável no celular. */
      @media (max-width: 700px) { .ic { width: 40px; height: 40px; } }
    `;
  }

  template() {
    const n = this.nota;
    const titulo = (n.titulo || "").trim();
    const texto = (n.texto || "").trim();
    const quem = n.editor_nome || n.autor_nome || "";
    const data = quando(n.atualizado_em || n.criado_em);
    return `
      <div class="card" id="card"
        style="--nc-fundo:${fundoNota(n.cor)};--nc-tinta:${tintaNota(n.cor)};--nc-borda:${bordaNota(n.cor)}">
        ${titulo ? `<h3>${esc(titulo)}</h3>` : ""}
        ${texto ? `<div class="texto">${esc(texto)}</div>` : (titulo ? "" : `<div class="texto" style="opacity:.5">(sem conteúdo)</div>`)}
        <div class="rodape">
          <span class="quem">${quem ? `<ui-icon name="usuario" size="12"></ui-icon> ${esc(quem)}` : ""}</span>
          ${data ? `<span>${esc(data)}</span>` : ""}
          ${dataStore.somenteLeitura() ? "" : `<span class="acoes">
            <button class="ic" id="editar" title="Editar" aria-label="Editar"><ui-icon name="editar" size="16"></ui-icon></button>
            <button class="ic" id="excluir" title="Excluir" aria-label="Excluir"><ui-icon name="excluir" size="16"></ui-icon></button>
          </span>`}
        </div>
      </div>`;
  }

  aposRender() {
    this.$("#card").addEventListener("click", (e) => {
      if (e.target.closest(".acoes")) return; // botões não abrem o card
      this.emitir("abrir", { nota: this.nota });
    });
    // Somente-leitura (link público): sem botões de editar/excluir (não renderizados).
    const btnEditar = this.$("#editar");
    if (btnEditar) btnEditar.addEventListener("click", () => this.emitir("editar", { nota: this.nota }));
    const btnExcluir = this.$("#excluir");
    if (btnExcluir) btnExcluir.addEventListener("click", () => this.emitir("excluir", { nota: this.nota }));
  }
}

customElements.define("nota-card", NotaCard);
