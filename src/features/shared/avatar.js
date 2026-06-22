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

/**
 * Botão de WhatsApp do contato/fornecedor — acompanha o nome em todo o sistema.
 * Sem telefone → cinza opaco e inativo. Retorna HTML (link/`<a>`), sem componente
 * novo. `onclick` para no clique (não dispara o clique da linha em tabelas).
 */
export function whatsappBtnHtml(telefone, tam = 38) {
  const base = `width:${tam}px;height:${tam}px;flex:none;border-radius:var(--raio-md);display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box`;
  const icone = `<ui-icon name="whatsapp" size="18"></ui-icon>`;
  const num = String(telefone || "").replace(/\D/g, "");
  if (!num) {
    return `<span title="Sem telefone cadastrado" onclick="event.stopPropagation()" style="${base};background:var(--cor-superficie-2);border:1px solid var(--cor-borda);color:var(--cor-texto-fraco);opacity:.5;cursor:not-allowed">${icone}</span>`;
  }
  const tel = num.length <= 11 ? "55" + num : num; // assume Brasil quando sem DDI
  return `<a href="https://wa.me/${tel}" target="_blank" rel="noopener" title="Abrir no WhatsApp" onclick="event.stopPropagation()" style="${base};background:rgba(37,211,102,.14);border:1px solid rgba(37,211,102,.4);color:#1fa855;text-decoration:none">${icone}</a>`;
}
