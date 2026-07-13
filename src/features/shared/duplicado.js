/**
 * duplicado.js — Aviso reutilizável "já existe um X com esse nome" ANTES de
 * cadastrar. Mostra um banner (confirmar()) onde o usuário escolhe continuar ou
 * não. Retorna Promise<boolean> — true = pode prosseguir com o cadastro.
 */
import { confirmar } from "../../components/confirmar.js";

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TEXTO = {
  contato: { artigo: "um contato", part: "chamado", titulo: "Esse contato já existe" },
  empresa: { artigo: "uma empresa", part: "chamada", titulo: "Essa empresa já existe" },
  item: { artigo: "um item", part: "chamado", titulo: "Esse item já existe" },
  categoria: { artigo: "uma categoria", part: "chamada", titulo: "Essa categoria já existe" },
};

/**
 * Se `existentes` já contém um registro com o mesmo `nome` (case-insensitive),
 * mostra o aviso e devolve a escolha do usuário; sem duplicado → true direto.
 * @param {"contato"|"empresa"|"item"|"categoria"} tipo  para a mensagem.
 * @param {string} nome  nome digitado.
 * @param {Array<{nome:string}>} existentes  registros ativos a comparar.
 * @returns {Promise<boolean>} true = prosseguir com o cadastro.
 */
export async function avisarDuplicado(tipo, nome, existentes) {
  const alvo = String(nome || "").trim().toLowerCase();
  if (!alvo) return true;
  const existe = (existentes || []).some((x) => String(x.nome || "").trim().toLowerCase() === alvo);
  if (!existe) return true;
  const t = TEXTO[tipo] || TEXTO.contato;
  return confirmar({
    titulo: t.titulo,
    mensagem: `Já existe ${t.artigo} ${t.part} <strong>${esc(nome)}</strong>. Deseja cadastrar assim mesmo?`,
    rotuloOk: "Cadastrar assim mesmo",
    rotuloCancelar: "Cancelar",
  });
}
