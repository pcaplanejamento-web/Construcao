/**
 * drop-crud.js — Editar/Excluir INLINE de uma entidade a partir dos ícones do
 * `<ui-select>` (eventos `editar`/`excluir`). Centraliza, por tipo, o form de
 * edição e o fluxo de exclusão — este REUSA `abrirBannerVinculos` + `vinculosDo*`
 * (bloqueia se houver vínculos: ofertas, despesas, obras, contatos, etc.) e só
 * remove via data-store se estiver livre. Registros PRIMÁRIOS (cargo fixo,
 * classificação GLOBAL) não recebem ações (ver `ehPrimario`).
 *
 * Não importa os forms (evita ciclos): cria-os por tag (já registrados pelos
 * componentes/telas que usam este helper).
 */
import { dataStore } from "../../core/data-store.js";
import { confirmar } from "../../components/confirmar.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import {
  abrirBannerVinculos,
  vinculosDoItem,
  vinculosDoFornecedor,
  vinculosDoContato,
  vinculosDaSubclassificacao,
  vinculosDoCargo,
} from "./vinculos.js";

const DESCRITORES = {
  item: {
    achar: (v) => dataStore.itensAtivos().find((r) => String(r.id) === String(v)) || null,
    primario: () => false,
    tag: "item-form", prop: "item",
    tituloVinc: (r) => `O item "${r.nome}"`,
    vinculos: (r) => vinculosDoItem(r.id),
    remover: (r) => dataStore.removerItem(r.id),
    tituloExcluir: "Excluir item", msgExcluir: (r) => `Excluir o item "${r.nome}"?`,
  },
  contato: {
    achar: (v) => dataStore.contatosAtivos().find((r) => String(r.id) === String(v)) || null,
    primario: () => false,
    tag: "contato-form", prop: "contato",
    tituloVinc: (r) => `O contato "${r.nome}"`,
    vinculos: (r) => vinculosDoContato(r.id),
    remover: (r) => dataStore.removerContato(r.id),
    tituloExcluir: "Excluir contato", msgExcluir: (r) => `Excluir o contato "${r.nome}"?`,
  },
  fornecedor: {
    achar: (v) => dataStore.fornecedoresAtivos().find((r) => String(r.id) === String(v)) || null,
    primario: () => false,
    tag: "fornecedor-form", prop: "fornecedor",
    tituloVinc: (r) => `A empresa "${r.nome}"`,
    vinculos: (r) => vinculosDoFornecedor(r.id),
    remover: (r) => dataStore.removerFornecedor(r.id),
    tituloExcluir: "Excluir empresa", msgExcluir: (r) => `Excluir a empresa "${r.nome}"?`,
  },
  cargo: {
    // O <ui-select> de cargo usa o NOME como value.
    achar: (v) => dataStore.cargos().find((r) => String(r.nome) === String(v)) || null,
    primario: (r) => !!r.fixo,
    tag: "cargo-form", prop: "cargo",
    tituloVinc: (r) => `O cargo "${r.nome}"`,
    vinculos: (r) => vinculosDoCargo(r.nome),
    remover: (r) => dataStore.removerCargo(r.id),
    tituloExcluir: "Excluir cargo", msgExcluir: (r) => `Excluir o cargo "${r.nome}"?`,
  },
  classificacaoFornecedor: {
    achar: (v) => dataStore.categoriasFornecedor().find((r) => String(r.id) === String(v)) || null,
    primario: (r) => String(r.usuario_id) === "GLOBAL",
    tag: "categoria-form", prop: "categoria", tipoProp: "fornecedor",
    tituloVinc: (r) => `A classificação "${r.nome}"`,
    vinculos: (r) => vinculosDaSubclassificacao(r.id),
    remover: (r) => dataStore.removerCategoria(r.id),
    tituloExcluir: "Excluir classificação", msgExcluir: (r) => `Excluir a classificação "${r.nome}"?`,
  },
  classificacaoItem: {
    achar: (v) => dataStore.categoriasItem().find((r) => String(r.id) === String(v)) || null,
    primario: (r) => String(r.usuario_id) === "GLOBAL",
    tag: "categoria-form", prop: "categoria", tipoProp: "item",
    tituloVinc: (r) => `A subclassificação "${r.nome}"`,
    vinculos: (r) => vinculosDaSubclassificacao(r.id),
    remover: (r) => dataStore.removerCategoria(r.id),
    tituloExcluir: "Excluir subclassificação", msgExcluir: (r) => `Excluir a subclassificação "${r.nome}"?`,
  },
};

/** Registro é PRIMÁRIO (não editável/removível)? Usado p/ montar os flags das options. */
export function ehPrimario(tipo, record) {
  const d = DESCRITORES[tipo];
  return d ? !!d.primario(record) : false;
}

function _abrirForm(d, record, onSalvo) {
  const form = document.createElement(d.tag);
  if (record) form[d.prop] = record;
  if (d.tipoProp) form.tipo = d.tipoProp;
  form.addEventListener("fechar", () => form.remove());
  form.addEventListener("salvo", () => { if (onSalvo) onSalvo(); });
  document.body.appendChild(form);
}

/** Abre o form de edição da entidade (por value do dropdown). */
export function editarEntidade(tipo, valor, onSalvo) {
  const d = DESCRITORES[tipo];
  if (!d) return;
  const rec = d.achar(valor);
  if (rec) _abrirForm(d, rec, onSalvo);
}

/**
 * Fluxo de exclusão: abre o banner de vínculos (bloqueia se vinculado); se livre,
 * confirma e remove via data-store (o backend também trava, autoritativo).
 */
export function excluirEntidade(tipo, valor, onFeito) {
  const d = DESCRITORES[tipo];
  if (!d) return;
  const rec = d.achar(valor);
  if (!rec) return;
  abrirBannerVinculos({
    titulo: d.tituloVinc(rec),
    grupos: d.vinculos(rec),
    aoExcluir: async () => {
      if (!(await confirmar({ titulo: d.tituloExcluir, mensagem: d.msgExcluir(rec), perigo: true, rotuloOk: "Excluir" }))) return;
      try {
        await d.remover(rec);
        toastSucesso("Excluído.");
        if (onFeito) onFeito();
      } catch (e) {
        notificarErro(e);
      }
    },
  });
}
