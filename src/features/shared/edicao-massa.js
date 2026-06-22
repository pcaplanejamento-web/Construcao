/**
 * edicao-massa — Edição em massa "modo planilha", REUSANDO o mesmo componente de
 * edição de uma linha. Abre o form já preenchido com a 1ª selecionada; ao salvar,
 * calcula os campos que VOCÊ ALTEROU e aplica SÓ ELES às demais selecionadas
 * (os outros campos de cada item ficam intactos).
 *
 * @param {Object[]} linhas  selecionadas (objetos de linha)
 * @param {Object} cfg
 *   criarForm(ref) => HTMLElement    — cria o form de edição já com a entidade `ref`
 *                                      (NÃO precisa ligar salvo/fechar — isto faz aqui)
 *   reler(ref) => Object|undefined   — relê a entidade salva (por id) no data-store
 *   aplicar(linha, diff) => Promise  — aplica os campos alterados a UMA das demais
 *   ignorar?: string[]               — campos extras a NÃO propagar
 */
import { notificarErro, toastSucesso } from "../../core/event-bus.js";

const CAMPOS_FIXOS = [
  "id",
  "criado_em",
  "atualizado_em",
  "autor_nome",
  "autor_id",
  "editor_nome",
  "editor_id",
];

/**
 * Mudança SEMÂNTICA (ignora ruído de normalização do form: 1↔"1", undefined↔"").
 * Só assim o diff não sobrescreve valores distintos das outras linhas.
 */
function mudou(a, b) {
  if (a === b) return false;
  const prim = (v) => v == null || typeof v !== "object";
  if (prim(a) && prim(b)) {
    const sa = a == null ? "" : String(a);
    const sb = b == null ? "" : String(b);
    if (sa === sb) return false;
    if (sa !== "" && sb !== "" && !isNaN(Number(sa)) && !isNaN(Number(sb)) && Number(sa) === Number(sb)) return false;
    return true;
  }
  return JSON.stringify(a == null ? null : a) !== JSON.stringify(b == null ? null : b);
}

export function editarEmMassa(linhas, { criarForm, reler, aplicar, ignorar = [] }) {
  if (!linhas || !linhas.length) return;
  const ref = linhas[0];
  const antes = JSON.parse(JSON.stringify(ref));
  const skip = new Set(CAMPOS_FIXOS.concat(ignorar));

  const form = criarForm(ref);
  if (!form) return;
  const fechar = () => form.remove();
  form.addEventListener("fechar", fechar);
  form.addEventListener("salvo", async () => {
    fechar();
    const outras = linhas.slice(1);
    if (!outras.length) return; // só 1 selecionada → edição normal, nada a propagar
    const depois = reler(ref) || ref;
    const diff = {};
    Object.keys(depois).forEach((k) => {
      if (skip.has(k)) return;
      if (mudou(antes[k], depois[k])) diff[k] = depois[k];
    });
    if (!Object.keys(diff).length) return; // nada mudou nos campos editáveis
    let ok = 0;
    for (const l of outras) {
      try {
        await aplicar(l, diff);
        ok++;
      } catch (e) {
        notificarErro(e);
      }
    }
    if (ok) toastSucesso(`Alteração aplicada a ${ok + 1} itens (${Object.keys(diff).join(", ")}).`);
  });
  document.body.appendChild(form);
}
