/**
 * avatar.js — Avatar padrão (iniciais) de contato/fornecedor.
 *
 * Fonte ÚNICA do avatar circular usado ao lado do nome de contatos e
 * fornecedores em todo o sistema (tabelas, etc.). Retorna HTML (string) para
 * usar no `formato` do <ui-data-table> — sem componente novo, mesmo padrão dos
 * helpers compartilhados (vinculos.js, orcamento-util.js).
 *
 * A cor é derivada do nome (hash → paleta), então o mesmo nome tem sempre a
 * mesma cor. Iniciais: 1 palavra → 2 letras; 2+ palavras → inicial da 1ª e última.
 */
const PALETA = ["#0d9488", "#6366f1", "#f59e0b", "#8b5cf6", "#e11d48", "#0ea5e9"];

export function iniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/).filter(Boolean);
  return ((p.length === 1 ? (p[0] || "?").slice(0, 2) : p[0][0] + p[p.length - 1][0]) || "?").toUpperCase();
}

/** Cor estável a partir do nome (mesma entrada → mesma cor). */
export function corAvatar(nome) {
  const s = String(nome || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

/** Só o disco do avatar (iniciais). `tam` em px (padrão 34). */
export function avatarHtml(nome, tam = 34) {
  return `<span style="width:${tam}px;height:${tam}px;flex:none;border-radius:50%;background:${corAvatar(
    nome
  )};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fonte-titulo);font-weight:700;font-size:12px">${iniciais(nome)}</span>`;
}

/** Avatar + nome em linha (padrão da 1ª coluna das tabelas de contato/fornecedor). */
export function avatarNomeHtml(nome) {
  return `<span style="display:inline-flex;align-items:center;gap:10px">${avatarHtml(nome)}<span style="font-weight:600">${
    nome || "—"
  }</span></span>`;
}
