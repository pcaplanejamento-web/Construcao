/**
 * <ui-data-table> — Tabela genérica orientada a dados (primitivo).
 *
 * Propriedades:
 *   .columns = [{ chave, titulo, formato?(valor,linha)=>string, alinhar? }]
 *   .rows    = [ objeto, ... ]
 *   .acoes   = [{ nome, rotulo, variant? }]  // botões por linha (opcional)
 * Atributo: empty-text (texto quando não há linhas)
 * Evento: "acao" ({ acao, linha }) ao clicar num botão de ação.
 *
 * Não conhece o domínio: quem usa fornece colunas e formatadores.
 */
import { BaseElement } from "./base-element.js";

class UiDataTable extends BaseElement {
  static get observedAttributes() {
    return ["empty-text"];
  }

  set columns(v) {
    this._columns = v || [];
    this._talvezRenderizar();
  }
  get columns() {
    return this._columns || [];
  }
  set rows(v) {
    this._rows = v || [];
    this._talvezRenderizar();
  }
  get rows() {
    return this._rows || [];
  }
  set acoes(v) {
    this._acoes = v || [];
    this._talvezRenderizar();
  }
  get acoes() {
    return this._acoes || [];
  }

  _talvezRenderizar() {
    if (this.shadowRoot.childElementCount) this.renderizar();
  }

  estilos() {
    return `
      :host { display: block; }
      /* Rola horizontalmente quando as colunas não cabem (sem espremer textos). */
      .wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
      th, td { padding: var(--esp-3) var(--esp-3); text-align: left;
        border-bottom: 1px solid var(--cor-borda); white-space: nowrap;
        vertical-align: middle; }
      th { color: var(--cor-texto-suave); font-weight: var(--peso-semi);
        font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .03em; }
      tr:last-child td { border-bottom: none; }
      tbody tr:hover { background: var(--cor-superficie-2); }
      .dir { text-align: right; }
      .acoes { display: flex; gap: var(--esp-2); justify-content: flex-end; }
      .btn-acao {
        border: 1px solid var(--cor-borda-forte); background: var(--cor-superficie);
        border-radius: var(--raio-sm); padding: 4px 10px; font-size: var(--fs-xs);
        color: var(--cor-texto-suave);
      }
      .btn-acao:hover { background: var(--cor-superficie-2); }
      .btn-acao.perigo { color: var(--cor-erro); border-color: var(--cor-erro-suave); }
      .vazio { padding: var(--esp-6); text-align: center; color: var(--cor-texto-fraco); }
    `;
  }

  template() {
    const cols = this.columns;
    const linhas = this.rows;
    const acoes = this.acoes;
    const temAcoes = acoes.length > 0;

    if (!linhas.length) {
      const txt = this.getAttribute("empty-text") || "Nenhum registro.";
      return `<div class="vazio">${txt}</div>`;
    }

    const cabecalho =
      cols
        .map(
          (c) =>
            `<th class="${c.alinhar === "dir" ? "dir" : ""}">${c.titulo}</th>`
        )
        .join("") + (temAcoes ? "<th></th>" : "");

    const corpo = linhas
      .map((linha, idx) => {
        const celulas = cols
          .map((c) => {
            const bruto = linha[c.chave];
            const valor = c.formato ? c.formato(bruto, linha) : bruto;
            return `<td class="${c.alinhar === "dir" ? "dir" : ""}">${
              valor == null ? "" : valor
            }</td>`;
          })
          .join("");
        const botoes = temAcoes
          ? `<td><div class="acoes">${acoes
              .map(
                (a) =>
                  `<button class="btn-acao ${
                    a.variant || ""
                  }" data-acao="${a.nome}" data-idx="${idx}">${a.rotulo}</button>`
              )
              .join("")}</div></td>`
          : "";
        return `<tr>${celulas}${botoes}</tr>`;
      })
      .join("");

    return `<div class="wrap"><table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table></div>`;
  }

  aposRender() {
    this.$$(".btn-acao").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        this.emitir("acao", { acao: btn.dataset.acao, linha: this.rows[idx] });
      });
    });
  }
}

customElements.define("ui-data-table", UiDataTable);
