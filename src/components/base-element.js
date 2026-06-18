/**
 * base-element.js — Classe-base de TODOS os Web Components.
 *
 * Princípio nº 3: componentes são independentes e autocontidos — cada um
 * encapsula estilo em Shadow DOM e funciona dado seus atributos/propriedades.
 * Princípio nº 4: dados descem (props/attrs), eventos sobem (emitir()).
 *
 * Custom properties definidas em :root (tokens.css) são herdadas pelo Shadow
 * DOM, então os componentes usam var(--token) normalmente.
 */

const RESET = `
  *,*::before,*::after { box-sizing: border-box; }
  :host { font-family: var(--fonte-base); }
  [hidden] { display: none !important; }
`;

export class BaseElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._inscricoes = [];
  }

  connectedCallback() {
    this.renderizar();
    this.aoConectar();
  }

  disconnectedCallback() {
    this._inscricoes.forEach((u) => typeof u === "function" && u());
    this._inscricoes = [];
    this.aoDesconectar();
  }

  /* Métodos para sobrescrever nas subclasses. */
  estilos() {
    return "";
  }
  template() {
    return "";
  }
  aoConectar() {}
  aoDesconectar() {}
  aposRender() {}

  /** Re-renderiza o Shadow DOM a partir de estilos()+template(). */
  renderizar() {
    this.shadowRoot.innerHTML = `<style>${RESET}${this.estilos()}</style>${this.template()}`;
    this.aposRender();
  }

  /* Atalhos de consulta no Shadow DOM. */
  $(sel) {
    return this.shadowRoot.querySelector(sel);
  }
  $$(sel) {
    return Array.from(this.shadowRoot.querySelectorAll(sel));
  }

  /** Emite um CustomEvent que atravessa o Shadow DOM (composed) e borbulha. */
  emitir(nome, detail) {
    this.dispatchEvent(
      new CustomEvent(nome, { detail, bubbles: true, composed: true })
    );
  }

  /** Registra um unsubscribe para ser chamado no disconnect. */
  aoLimpar(unsub) {
    if (unsub) this._inscricoes.push(unsub);
  }
}
