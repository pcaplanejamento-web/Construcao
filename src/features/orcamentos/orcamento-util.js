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

/** Nome do ofertante: equipe (se houver) ou contato. Usado em orçamento e oferta. */
export function ofertanteNome(contatoId, equipeId) {
  if (equipeId) {
    const e = dataStore.equipe(equipeId);
    return e ? e.nome : "—";
  }
  const c = dataStore.contatos().find((x) => String(x.id) === String(contatoId));
  return c ? c.nome : "—";
}

/** Rótulo do orçamento: título (se houver) ou "Tipo · fornecedor/ofertante". */
export function rotuloOrcamento(orc) {
  if (!orc) return "—";
  if (orc.titulo) return orc.titulo;
  const alvo =
    orc.tipo === "Material"
      ? (dataStore.fornecedores().find((f) => String(f.id) === String(orc.fornecedor_id)) || {}).nome
      : ofertanteNome(orc.contato_id, orc.equipe_id);
  return `${orc.tipo || "Orçamento"}${alvo && alvo !== "—" ? " · " + alvo : ""}`;
}

/** Total do orçamento = soma dos totais das suas ofertas. */
export function totalOrcamento(orcId) {
  return dataStore.ofertasDoOrcamento(orcId).reduce((s, of) => {
    return s + totalOferta(of, dataStore.cotacao(of.cotacao_id));
  }, 0);
}

const _fraco = (t) => `<span style="color:var(--cor-texto-fraco)">${t}</span>`;
const _nomeItemCot = (c) => (c && c.item_id && (dataStore.item(c.item_id) || {}).nome) || (c || {}).descricao || "—";

/**
 * Colunas da tabela de OFERTAS (mesmo formato da tabela de ofertas das cotações),
 * para reuso nas abas Ofertas de fornecedor/contato. Inclui a coluna "Cotação"
 * (as ofertas aqui vêm de cotações diferentes). Linhas = ofertas cruas (precos).
 */
export function colunasOferta() {
  const empresaNome = (id) => {
    const c = dataStore.contatos().find((x) => String(x.id) === String(id));
    if (!c || !c.fornecedor_id) return "";
    return (dataStore.fornecedores().find((f) => String(f.id) === String(c.fornecedor_id)) || {}).nome || "";
  };
  return [
    {
      chave: "cotacao_id",
      titulo: "Cotação",
      formato: (id) => (id ? `<a href="/cotacoes/${id}">${_nomeItemCot(dataStore.cotacao(id))}</a>` : _fraco("—")),
    },
    { chave: "contato_id", titulo: "Ofertante", formato: (id, l) => ofertanteNome(l.contato_id, l.equipe_id) },
    { chave: "contato_id", titulo: "Empresa", formato: (id, l) => (l.equipe_id ? _fraco("—") : empresaNome(id) || _fraco("—")) },
    { chave: "valor_unit", titulo: "Valor unit.", alinhar: "dir", formato: (v) => moeda(v) },
    {
      chave: "valor_unit",
      titulo: "Total",
      alinhar: "dir",
      formato: (v, linha) => moeda(totalOferta(linha, dataStore.cotacao(linha.cotacao_id))),
    },
    { chave: "prazo_entrega", titulo: "Prazo", formato: (v) => v || "—" },
    { chave: "observacao", titulo: "Obs.", formato: (v) => v || "—" },
    {
      chave: "orcamento_id",
      titulo: "Orçamento",
      formato: (id) => {
        const o = id ? dataStore.orcamento(id) : null;
        return o ? `<a href="/orcamentos/${o.id}">${rotuloOrcamento(o)}</a>` : _fraco("—");
      },
    },
    ...colunasLog(),
    {
      chave: "escolhido",
      titulo: "Status",
      formato: (v, linha) =>
        linha.despesa_id
          ? `<category-badge nome="Registrada" cor="var(--cor-info)"></category-badge>`
          : v === true || v === "TRUE" || v === "true"
          ? `<category-badge nome="Escolhida" cor="var(--cor-sucesso)"></category-badge>`
          : _fraco("—"),
    },
  ];
}

/** Colunas da tabela de orçamentos (abas de fornecedor/contato/obra). */
export function colunasOrcamento() {
  const fornNome = (id) =>
    (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "—";
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
    { chave: "contato_id", titulo: "Ofertante", formato: (id, l) => ofertanteNome(l.contato_id, l.equipe_id) },
    { chave: "obra_id", titulo: "Obra", formato: (id) => (id ? obraNome(id) : "—") },
    { chave: "id", titulo: "Ofertas", alinhar: "dir", formato: (id) => String(dataStore.ofertasDoOrcamento(id).length) },
    { chave: "id", titulo: "Total", alinhar: "dir", formato: (id) => moeda(totalOrcamento(id)) },
    ...colunasLog(),
  ];
}
