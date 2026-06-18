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
        bus.emit(EVENTOS.TEMA, { modo: "sistema", efetivo: this.efetivo() });
      }
    });
  },
};
