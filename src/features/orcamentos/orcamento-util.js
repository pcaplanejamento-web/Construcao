/**
 * orcamento-util.js — Helpers do módulo Orçamentos (sem componente novo).
 *
 * Um orçamento agrupa ofertas (CotacaoPrecos com `orcamento_id`) de um mesmo
 * ofertante. Total = soma dos totais das ofertas (cada uma na sua cotação).
 */
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { colunasLog } from "../../core/audit-columns.js";
import { totalOferta, totalOfertaCheio, qtdOferta } from "../cotacoes/cotacao-util.js";
import { statusPagamento } from "../despesas/despesa-split.js";
import "../../components/ui-data-table.js";
import "../../components/ui-empty-state.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
export const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };

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
const _verde = (t) => `<span style="color:var(--cor-sucesso);font-weight:var(--peso-semi)">${t}</span>`;

/** Item de uma oferta: próprio (item_id) ou herdado da cotação (legado). */
function _itemDaOferta(of) {
  if (of && of.item_id) return dataStore.item(of.item_id);
  const c = of && of.cotacao_id ? dataStore.cotacao(of.cotacao_id) : null;
  return c && c.item_id ? dataStore.item(c.item_id) : null;
}
function _nomeItemOferta(of) {
  const it = _itemDaOferta(of);
  if (it && it.nome) return it.nome;
  const c = of && of.cotacao_id ? dataStore.cotacao(of.cotacao_id) : null;
  return (c && c.descricao) || "—";
}
function _classeOferta(of) {
  const it = _itemDaOferta(of);
  if (it && it.classificacao) return it.classificacao;
  const c = of && of.cotacao_id ? dataStore.cotacao(of.cotacao_id) : null;
  return (c && c.classificacao) || "";
}
function _subclasseOferta(of) {
  const it = _itemDaOferta(of);
  const catId = it && it.categoria_id;
  if (!catId) return "";
  return (dataStore.categorias().find((c) => String(c.id) === String(catId)) || {}).nome || "";
}
/** Fornecedor da oferta: próprio (fornecedor_id) ou do contato ofertante. */
function _fornecedorOferta(of) {
  let fid = of && of.fornecedor_id;
  if (!fid && of && of.contato_id) {
    const ct = dataStore.contatos().find((x) => String(x.id) === String(of.contato_id));
    fid = ct && ct.fornecedor_id;
  }
  if (!fid) return "";
  return (dataStore.fornecedores().find((f) => String(f.id) === String(fid)) || {}).nome || "";
}

/** Despesa gerada por esta oferta (por despesa_id; fallback por preco_id). */
function _despesaDaOferta(of) {
  if (!of) return null;
  const did = of.despesa_id;
  if (!did && !of.id) return null;
  return (
    dataStore
      .todasDespesas()
      .find(
        (d) =>
          (did && String(d.id) === String(did)) ||
          (of.id && String(d.preco_id) === String(of.id))
      ) || null
  );
}
/** ID curto p/ exibição (últimos 6 chars), id completo no title. */
function _idCurto(id) {
  if (!id) return _fraco("—");
  const s = String(id);
  return `<code title="${s}" style="font-size:var(--fs-xs)">${s.length > 6 ? "…" + s.slice(-6) : s}</code>`;
}
const COR_STATUS = { "A pagar": "#d97706", "Em pagamento": "var(--cor-info)", Pago: "var(--cor-sucesso)" };

/**
 * Colunas PADRÃO da tabela de OFERTAS (componente único reusado em todo lugar:
 * cotação, orçamento, fornecedor, contato e a aba Ofertas). Linhas = ofertas
 * cruas (precos). Item/classe/subclasse derivam do item próprio (fallback à
 * cotação). Valores com desconto em verde.
 */
export function colunasOferta() {
  return [
    { chave: "item_id", titulo: "Item", formato: (id, l) => _nomeItemOferta(l) },
    {
      chave: "item_id",
      titulo: "Classificação",
      secundaria: true,
      formato: (id, l) => {
        const c = _classeOferta(l);
        return c
          ? `<category-badge nome="${c}" cor="${COR_CLASSIFICACAO[c] || "var(--cor-neutro)"}"></category-badge>`
          : _fraco("—");
      },
    },
    { chave: "item_id", titulo: "Subclassificação", secundaria: true, formato: (id, l) => _subclasseOferta(l) || _fraco("—") },
    { chave: "contato_id", titulo: "Ofertante", formato: (id, l) => ofertanteNome(l.contato_id, l.equipe_id) },
    { chave: "fornecedor_id", titulo: "Fornecedor", formato: (id, l) => _fornecedorOferta(l) || _fraco("—") },
    {
      chave: "quantidade",
      titulo: "Qtd",
      alinhar: "dir",
      formato: (v, linha) => String(qtdOferta(linha, dataStore.cotacao(linha.cotacao_id))),
    },
    { chave: "valor_unit", titulo: "Valor unit.", alinhar: "dir", formato: (v) => moeda(v) },
    {
      chave: "valor_unit_desconto",
      titulo: "Unit. c/ desc.",
      alinhar: "dir",
      secundaria: true,
      formato: (v) => (Number(v) > 0 ? _verde(moeda(v)) : _fraco("—")),
    },
    {
      chave: "valor_unit",
      titulo: "Total",
      alinhar: "dir",
      secundaria: true,
      formato: (v, linha) => moeda(totalOfertaCheio(linha, dataStore.cotacao(linha.cotacao_id))),
    },
    {
      chave: "valor_unit",
      titulo: "Total c/ desc.",
      alinhar: "dir",
      formato: (v, linha) => _verde(moeda(totalOferta(linha, dataStore.cotacao(linha.cotacao_id)))),
    },
    { chave: "prazo_entrega", titulo: "Prazo", formato: (v) => v || "—" },
    {
      chave: "cotacao_id",
      titulo: "Cotação",
      secundaria: true,
      formato: (id) => (id ? `<a href="/cotacoes/${id}">${_nomeItemOferta({ cotacao_id: id })}</a>` : _fraco("—")),
    },
    {
      chave: "orcamento_id",
      titulo: "Orçamento",
      secundaria: true,
      formato: (id) => {
        const o = id ? dataStore.orcamento(id) : null;
        return o ? `<a href="/orcamentos/${o.id}">${rotuloOrcamento(o)}</a>` : _fraco("—");
      },
    },
    ...colunasLog(),
    {
      chave: "despesa_id",
      titulo: "Obra",
      secundaria: true,
      formato: (id, linha) => {
        const d = _despesaDaOferta(linha);
        return d ? (dataStore.obra(d.obra_id) || {}).nome || _fraco("—") : _fraco("—");
      },
    },
    { chave: "despesa_id", titulo: "Despesa", secundaria: true, formato: (id) => _idCurto(id) },
    {
      chave: "escolhido",
      titulo: "Status",
      formato: (v, linha) => {
        const d = _despesaDaOferta(linha);
        if (d) {
          const st = statusPagamento(d);
          return `<category-badge nome="${st}" cor="${COR_STATUS[st] || "var(--cor-neutro)"}"></category-badge>`;
        }
        return v === true || v === "TRUE" || v === "true"
          ? `<category-badge nome="Escolhida" cor="var(--cor-sucesso)"></category-badge>`
          : _fraco("—");
      },
    },
  ];
}

/**
 * Monta a TABELA PADRÃO de ofertas (reuso único). `opcoes`: { acoes?, onAcao?,
 * onLinha?, clicavel?, vazio? }. Não cria componente novo — usa `ui-data-table`.
 */
export function montarTabelaOfertas(el, ofertas, opcoes = {}) {
  if (!el) return;
  const lista = Array.isArray(ofertas) ? ofertas : [];
  if (!lista.length) {
    el.innerHTML = `<ui-empty-state icone="cotacao" titulo="Nenhuma oferta"
      texto="${opcoes.vazio || "Nenhuma oferta ainda."}"></ui-empty-state>`;
    return;
  }
  const tabela = document.createElement("ui-data-table");
  tabela.setAttribute("fluido", "");
  if (opcoes.clicavel) tabela.setAttribute("clicavel", "");
  tabela.columns = colunasOferta();
  // Ação PADRÃO "Registrar" (abre o banner único Registrar Despesa) + ações da view.
  tabela.acoes = [{ nome: "registrar", rotulo: "Registrar" }, ...(opcoes.acoes || [])];
  tabela.rows = lista;
  if (opcoes.onLinha) tabela.addEventListener("linha", (e) => opcoes.onLinha(e.detail.linha));
  tabela.addEventListener("acao", (e) => {
    const { acao, linha } = e.detail;
    if (acao === "registrar") {
      import("../cotacoes/cotacao-despesa-form.js").then((m) => m.abrirRegistrarDespesa(linha));
      return;
    }
    if (opcoes.onAcao) opcoes.onAcao(acao, linha);
  });
  el.replaceChildren(tabela);
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
