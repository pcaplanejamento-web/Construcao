/**
 * <ui-data-table> — Tabela genérica orientada a dados (primitivo).
 *
 * Propriedades:
 *   .columns = [{ chave, titulo, formato?(valor,linha)=>string, alinhar?, largura?, secundaria? }]
 *     largura: CSS length opcional → min-width da coluna (ex.: "200px"); só onde definida.
 *     secundaria: true → coluna some no mobile (≤820px); use p/ tabelas largas.
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
    return ["empty-text", "fluido", "clicavel"];
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
      /* fluido: só as CÉLULAS quebram/preenchem; os títulos de coluna nunca quebram. */
      :host([fluido]) table { table-layout: auto; }
      :host([fluido]) td { white-space: normal; }
      /* clicavel: linha clicável (abre detalhe) */
      :host([clicavel]) tbody tr { cursor: pointer; }
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
      /* Colunas marcadas secundárias somem no mobile (essenciais permanecem). */
      @media (max-width: 820px) { th.sec, td.sec { display: none; } }
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

    // Largura opcional (min-width) + classe da coluna (alinhamento/secundária).
    const estiloCol = (c) => (c.largura ? ` style="min-width:${c.largura}"` : "");
    const classeCol = (c) => [c.alinhar === "dir" ? "dir" : "", c.secundaria ? "sec" : ""].filter(Boolean).join(" ");

    const cabecalho =
      cols
        .map(
          (c) =>
            `<th class="${classeCol(c)}"${estiloCol(c)}>${c.titulo}</th>`
        )
        .join("") + (temAcoes ? "<th></th>" : "");

    const corpo = linhas
      .map((linha, idx) => {
        const celulas = cols
          .map((c) => {
            const bruto = linha[c.chave];
            const valor = c.formato ? c.formato(bruto, linha) : bruto;
            return `<td class="${classeCol(c)}"${estiloCol(c)}>${
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
        return `<tr data-idx="${idx}">${celulas}${botoes}</tr>`;
      })
      .join("");

    return `<div class="wrap"><table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table></div>`;
  }

  aposRender() {
    this.$$(".btn-acao").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // não dispara o clique da linha
        const idx = Number(btn.dataset.idx);
        this.emitir("acao", { acao: btn.dataset.acao, linha: this.rows[idx] });
      });
    });
    if (this.hasAttribute("clicavel")) {
      this.$$("tbody tr").forEach((tr) => {
        tr.addEventListener("click", () => {
          const idx = Number(tr.dataset.idx);
          this.emitir("linha", { linha: this.rows[idx] });
        });
      });
    }
  }
}

customElements.define("ui-data-table", UiDataTable);
