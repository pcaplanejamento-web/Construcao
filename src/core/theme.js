/**
 * theme.js — Gerencia o tema claro/escuro.
 *
 * Modos: "sistema" (segue prefers-color-scheme), "claro", "escuro".
 * A escolha é persistida em localStorage e aplicada via data-tema no <html>.
 * O index.html aplica o valor salvo antes do CSS (anti-FOUC); aqui mantemos a
 * lógica e avisamos a UI por EVENTOS.TEMA.
 */
import { bus, EVENTOS } from "./event-bus.js";

const CHAVE = "obras.tema";
const root = document.documentElement;
const mql = window.matchMedia("(prefers-color-scheme: dark)");

function aplicar(modo) {
  if (modo === "claro" || modo === "escuro") root.dataset.tema = modo;
  else delete root.dataset.tema; // "sistema"
  _corDoNavegador();
}

/** Tinge o chrome do navegador (status/endereço — incl. "liquid glass" do Safari
 * iOS 26) com a cor de FUNDO efetiva → no modo escuro o navegador fica escuro.
 * Lê o --cor-fundo já resolvido (cobre também o modo "sistema"). */
function _corDoNavegador() {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  const cor = getComputedStyle(root).getPropertyValue("--cor-fundo").trim();
  if (cor) meta.setAttribute("content", cor);
}

export const tema = {
  /** Modo escolhido: "sistema" | "claro" | "escuro". */
  atual() {
    return localStorage.getItem(CHAVE) || "sistema";
  },

  /** Tema realmente aplicado: "claro" | "escuro". */
  efetivo() {
    const m = this.atual();
    if (m !== "sistema") return m;
    return mql.matches ? "escuro" : "claro";
  },

  /** Define o modo, persiste e aplica. */
  definir(modo) {
    if (modo === "sistema") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, modo);
    aplicar(modo);
    bus.emit(EVENTOS.TEMA, { modo, efetivo: this.efetivo() });
  },

  /** Alterna entre claro e escuro (a partir do efetivo). */
  alternar() {
    this.definir(this.efetivo() === "escuro" ? "claro" : "escuro");
  },

  /** Inicializa: aplica o salvo e reage a mudanças do SO no modo "sistema". */
  init() {
    aplicar(this.atual());
    mql.addEventListener("change", () => {
      if (this.atual() === "sistema") {
        _corDoNavegador();
        bus.emit(EVENTOS.TEMA, { modo: "sistema", efetivo: this.efetivo() });
      }
    });
  },
};
