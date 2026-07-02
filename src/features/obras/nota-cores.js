/**
 * nota-cores.js — Paleta pastel das notas (estilo Google Keep), compartilhada
 * pelo <nota-card> (fundo do card) e pelo <nota-form> (seletor de cor). As chaves
 * espelham a allowlist do backend (Notas.gs `CORES_NOTA_VALIDAS`).
 *
 * Cada entrada traz `fundo`/`tinta`/`borda`: os tons coloridos usam HEX fixos com
 * tinta escura (legíveis em tema claro E escuro); "sem cor" ("") usa os tokens do
 * tema (acompanha claro/escuro).
 */
export const PALETA_NOTA = [
  { chave: "",        rotulo: "Padrão",  fundo: "var(--cor-superficie)", tinta: "var(--cor-texto)", borda: "var(--cor-borda)" },
  { chave: "amarelo", rotulo: "Amarelo", fundo: "#fff3c4", tinta: "#3a2f00", borda: "rgba(0,0,0,.10)" },
  { chave: "verde",   rotulo: "Verde",   fundo: "#d7f2da", tinta: "#0f3d1f", borda: "rgba(0,0,0,.10)" },
  { chave: "azul",    rotulo: "Azul",    fundo: "#d6ebff", tinta: "#0a2f4d", borda: "rgba(0,0,0,.10)" },
  { chave: "roxo",    rotulo: "Roxo",    fundo: "#e7ddff", tinta: "#2e1d54", borda: "rgba(0,0,0,.10)" },
  { chave: "rosa",    rotulo: "Rosa",    fundo: "#ffdce8", tinta: "#4d1030", borda: "rgba(0,0,0,.10)" },
  { chave: "laranja", rotulo: "Laranja", fundo: "#ffe1c4", tinta: "#4d2600", borda: "rgba(0,0,0,.10)" },
  { chave: "cinza",   rotulo: "Cinza",   fundo: "#e5e8ec", tinta: "#26292e", borda: "rgba(0,0,0,.10)" },
];

const _mapa = {};
PALETA_NOTA.forEach((c) => (_mapa[c.chave] = c));

/** Resolve uma chave para a entrada da paleta (fallback = "Padrão"). */
export function corNota(chave) {
  return _mapa[String(chave == null ? "" : chave).trim()] || _mapa[""];
}
export function fundoNota(chave) { return corNota(chave).fundo; }
export function tintaNota(chave) { return corNota(chave).tinta; }
export function bordaNota(chave) { return corNota(chave).borda; }
