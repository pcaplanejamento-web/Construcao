/**
 * orcamento-util.js — Helpers do módulo Orçamentos (sem componente novo).
 *
 * Um orçamento agrupa ofertas (CotacaoPrecos com `orcamento_id`) de um mesmo
 * ofertante. Total = soma dos totais das ofertas (cada uma na sua cotação).
 */
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { colunasLog } from "../../core/audit-columns.js";
import { totalOferta } from "../cotacoes/cotacao-util.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
export const COR_CLASSIFICACAO = { Material: "#2563eb", "Serviço": "#7c3aed" };

/** Rótulo do orçamento: título (se houver) ou "Tipo · fornecedor/contato". */
export function rotuloOrcamento(orc) {
  if (!orc) return "—";
  if (orc.titulo) return orc.titulo;
  const alvo =
    orc.tipo === "Material"
      ? (dataStore.fornecedores().find((f) => String(f.id) === String(orc.fornecedor_id)) || {}).nome
      : (dataStore.contatos().find((c) => String(c.id) === String(orc.contato_id)) || {}).nome;
  return `${orc.tipo || "Orçamento"}${alvo ? " · " + alvo : ""}`;
}

/** Total do orçamento = soma dos totais das suas ofertas. */
export function totalOrcamento(orcId) {
  return dataStore.ofertasDoOrcamento(orcId).reduce((s, of) => {
    return s + totalOferta(of, dataStore.cotacao(of.cotacao_id));
  }, 0);
}

/** Colunas da tabela de orçamentos (abas de fornecedor/contato/obra). */
export function colunasOrcamento() {
  const fornNome = (id) =>
    (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "—";
  const contatoNome = (id) =>
    (dataStore.contatos().find((c) => String(c.id) === String(id)) || {}).nome || "—";
  const obraNome = (id) => (dataStore.obra(id) || {}).nome || "—";
  return [
    { chave: "id", titulo: "Orçamento", formato: (id, l) => rotuloOrcamento(l) },
    {
      chave: "tipo",
      titulo: "Tipo",
      formato: (v) =>
        v
          ? `<category-badge nome="${v}" cor="${COR_CLASSIFICACAO[v] || "var(--cor-neutro)"}"></category-badge>`
          : `<span style="color:var(--cor-texto-fraco)">—</span>`,
    },
    { chave: "fornecedor_id", titulo: "Fornecedor", formato: (id) => (id ? fornNome(id) : "—") },
    { chave: "contato_id", titulo: "Ofertante", formato: (id) => contatoNome(id) },
    { chave: "obra_id", titulo: "Obra", formato: (id) => (id ? obraNome(id) : "—") },
    { chave: "id", titulo: "Ofertas", alinhar: "dir", formato: (id) => String(dataStore.ofertasDoOrcamento(id).length) },
    { chave: "id", titulo: "Total", alinhar: "dir", formato: (id) => moeda(totalOrcamento(id)) },
    ...colunasLog(),
  ];
}
