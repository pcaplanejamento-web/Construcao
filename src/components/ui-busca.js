/**
 * <ui-busca> — Botão de pesquisa que expande um campo da DIREITA p/ a ESQUERDA,
 * sobreposto (overlay) ao conteúdo à sua esquerda, sem deslocar nada.
 *
 * Componente ÚNICO e reusável (usado de forma padrão pelo <ui-data-table> em todas
 * as tabelas, mas genérico o bastante p/ qualquer cabeçalho). Não conhece o domínio.
 *
 * Atributos: placeholder (default "Pesquisar...").
 * Evento: "buscar" ({ texto }) a cada digitação (e "" ao fechar/limpar).
 */
import { BaseElement } from "./base-element.js";
import "./ui-icon.js";

class UiBusca extends BaseElement {
  get placeholder() {
    return this.getAttribute("placeholder") || "Pesquisar...";
  }

  estilos() {
    return `
      :host { display: inline-flex; }
      /* O campo é absoluto e ancorado à DIREITA (cresce p/ a esquerda), sobreposto. */
      .caixa { position: relative; display: inline-flex; align-items: center;
        justify-content: flex-end; height: 34px; width: 34px; }
      .campo { position: absolute; right: 0; top: 0; height: 34px; width: 0; opacity: 0;
        padding: 0; border: 1px solid transparent; border-radius: var(--raio-md);
        background: var(--cor-superficie); color: var(--cor-texto);
        font-family: inherit; font-size: var(--fs-sm);
        box-shadow: var(--sombra-md); transition: width .22s ease, opacity .16s ease, padding .22s ease; }
      .caixa.aberta .campo { width: 260px; max-width: 64vw; opacity: 1; padding: 0 40px 0 14px;
        border-color: var(--cor-primaria); }
      .campo:focus { outline: none; box-shadow: 0 0 0 3px var(--cor-primaria-suave), var(--sombra-md); }
      .botao { position: relative; z-index: 1; width: 34px; height: 34px; flex: none;
        display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
        border: none; background: var(--cor-superficie); color: var(--cor-texto-suave);
        border-radius: var(--raio-md); }
      .botao:hover { color: var(--cor-primaria); background: var(--cor-superficie-2); }
      .caixa.aberta .botao { color: var(--cor-primaria); background: transparent; }
    `;
  }

  template() {
    return `
      <div class="caixa" id="caixa">
        <input id="campo" class="campo" type="search" placeholder="${this.placeholder}" />
        <button class="botao" id="alternar" type="button" aria-label="Pesquisar" title="Pesquisar">
          <ui-icon name="busca" size="18"></ui-icon>
        </button>
      </div>`;
  }

  aposRender() {
    const caixa = this.$("#caixa");
    const campo = this.$("#campo");
    this.$("#alternar").addEventListener("click", () => {
      const aberta = caixa.classList.toggle("aberta");
      if (aberta) {
        campo.focus();
      } else if (campo.value) {
        campo.value = "";
        this.emitir("buscar", { texto: "" });
      }
    });
    campo.addEventListener("input", () => this.emitir("buscar", { texto: campo.value.trim() }));
    campo.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        campo.value = "";
        caixa.classList.remove("aberta");
        this.emitir("buscar", { texto: "" });
      }
    });
    // Fecha (sem texto) ao perder o foco, p/ não cobrir o cabeçalho à toa.
    campo.addEventListener("blur", () => {
      if (!campo.value) caixa.classList.remove("aberta");
    });
  }

  /** Define o texto e o estado aberto SEM emitir (usado p/ restaurar após re-render do pai). */
  definir(texto) {
    const campo = this.$("#campo");
    const caixa = this.$("#caixa");
    if (!campo || !caixa) return;
    campo.value = texto || "";
    caixa.classList.toggle("aberta", !!texto);
  }
}

customElements.define("ui-busca", UiBusca);
