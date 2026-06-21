/**
 * vinculos.js — Vínculos de uma entidade + banner de bloqueio de exclusão.
 *
 * Calcula, a partir do data-store, ONDE uma entidade está vinculada (despesas,
 * cotações, contatos, etc.) e abre um banner flutuante (compondo ui-modal +
 * ui-alert + ui-data-table + ui-button — sem componente novo) listando os
 * vínculos. Sem vínculos → executa a exclusão (com confirmação do chamador).
 *
 * Cada "grupo" = { rotulo, colunas, linhas, rota(linha)->hash }.
 */
import { irPara } from "../../core/router.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import "../../components/ui-modal.js";
import "../../components/ui-alert.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";

const nomeItem = (l) => (l.item_id && (dataStore.item(l.item_id) || {}).nome) || l.descricao || l.item || "—";

/** Todas as despesas (de todas as obras) que satisfazem o predicado, com _obra. */
function _despesasComObra(pred) {
  const out = [];
  dataStore.obras().forEach((o) => {
    dataStore.despesas(o.id).forEach((d) => {
      if (pred(d)) out.push(Object.assign({}, d, { _obra: o.nome }));
    });
  });
  return out;
}

const COL_DESPESA = [
  { chave: "_obra", titulo: "Obra", formato: (v) => v || "—" },
  { chave: "item", titulo: "Item", formato: (v, l) => nomeItem(l) },
  { chave: "valor", titulo: "Valor", alinhar: "dir", formato: (v) => moeda(v) },
];
const COL_COTACAO = [
  { chave: "descricao", titulo: "Cotação", formato: (v, l) => nomeItem(l) },
  { chave: "status", titulo: "Situação", formato: (s) => (s === "fechada" ? "Fechada" : "Aberta") },
];

function _grupo(rotulo, colunas, linhas, rota) {
  return { rotulo, colunas, linhas, rota };
}

/* ----------------------------- Cálculos ------------------------------ */

export function vinculosDoItem(id) {
  const despesas = _despesasComObra((d) => String(d.item_id) === String(id));
  const cotacoes = dataStore.cotacoes().filter((c) => String(c.item_id) === String(id));
  return [
    _grupo("Despesas", COL_DESPESA, despesas, (l) => "/obras/" + l.obra_id),
    _grupo("Cotações", COL_COTACAO, cotacoes, (l) => "/cotacoes/" + l.id),
  ];
}

export function vinculosDoFornecedor(id) {
  const contatos = dataStore.contatosAtivos().filter((c) => String(c.fornecedor_id) === String(id));
  return [
    _grupo(
      "Contatos",
      [
        { chave: "nome", titulo: "Contato" },
        { chave: "cargo", titulo: "Cargo", formato: (v) => v || "—" },
      ],
      contatos,
      (l) => "/contatos/" + l.id
    ),
  ];
}

export function vinculosDoContato(id) {
  // Ofertas (em todas as cotações) feitas por este contato.
  const ofertas = [];
  dataStore.cotacoes().forEach((cot) => {
    dataStore.precosDaCotacao(cot.id).forEach((p) => {
      if (String(p.contato_id) === String(id)) {
        ofertas.push({ _cotacaoId: cot.id, _item: nomeItem(cot), valor_unit: p.valor_unit });
      }
    });
  });
  // Participações em obras (chave c:<id>).
  const chave = "c:" + id;
  const participacoes = [];
  dataStore.obras().forEach((o) => {
    if (dataStore.participantesDaObra(o.id).some((p) => p.chave === chave)) {
      participacoes.push({ id: o.id, nome: o.nome });
    }
  });
  // Subordinados (contatos cujo superior é este).
  const subordinados = dataStore.contatosAtivos().filter((c) => String(c.superior_id) === String(id));
  return [
    _grupo(
      "Ofertas (cotações)",
      [
        { chave: "_item", titulo: "Cotação" },
        { chave: "valor_unit", titulo: "Valor unit.", alinhar: "dir", formato: (v) => moeda(v) },
      ],
      ofertas,
      (l) => "/cotacoes/" + l._cotacaoId
    ),
    _grupo("Obras (participante)", [{ chave: "nome", titulo: "Obra" }], participacoes, (l) => "/obras/" + l.id),
    _grupo(
      "Equipe (subordinados)",
      [
        { chave: "nome", titulo: "Contato" },
        { chave: "cargo", titulo: "Cargo", formato: (v) => v || "—" },
      ],
      subordinados,
      (l) => "/contatos/" + l.id
    ),
  ];
}

export function vinculosDaSubclassificacao(id) {
  const despesas = _despesasComObra((d) => String(d.categoria_id) === String(id));
  const cotacoes = dataStore.cotacoes().filter((c) => String(c.categoria_id) === String(id));
  const fornecedores = dataStore.fornecedoresAtivos().filter((f) => String(f.categoria_id) === String(id));
  return [
    _grupo("Despesas", COL_DESPESA, despesas, (l) => "/obras/" + l.obra_id),
    _grupo("Cotações", COL_COTACAO, cotacoes, (l) => "/cotacoes/" + l.id),
    _grupo("Fornecedores", [{ chave: "nome", titulo: "Fornecedor" }], fornecedores, (l) => "/fornecedores/" + l.id),
  ];
}

export function vinculosDoCargo(nome) {
  const contatos = dataStore.contatosAtivos().filter((c) => String(c.cargo) === String(nome));
  return [
    _grupo("Contatos", [{ chave: "nome", titulo: "Contato" }], contatos, (l) => "/contatos/" + l.id),
  ];
}

export function vinculosDaOferta(preco) {
  if (!preco || !String(preco.despesa_id || "")) return [];
  const desp = _despesasComObra((d) => String(d.id) === String(preco.despesa_id));
  return [_grupo("Despesa registrada", COL_DESPESA, desp, (l) => "/obras/" + l.obra_id)];
}

/* ------------------------------ Banner ------------------------------- */

/**
 * Abre o banner de vínculos. Se não houver vínculos, executa `aoExcluir`
 * (que deve conter a confirmação + a chamada ao data-store).
 */
export function abrirBannerVinculos({ titulo, grupos, aoExcluir }) {
  const ativos = (grupos || []).filter((g) => g.linhas && g.linhas.length);
  if (!ativos.length) {
    if (aoExcluir) aoExcluir();
    return;
  }

  const modal = document.createElement("ui-modal");
  modal.setAttribute("open", "");
  modal.setAttribute("title", "Não é possível excluir");

  const corpo = document.createElement("div");
  const alerta = document.createElement("ui-alert");
  alerta.setAttribute("tipo", "aviso");
  alerta.mensagem = `${titulo} está vinculado(a). Remova os vínculos abaixo primeiro.`;
  corpo.appendChild(alerta);

  ativos.forEach((g) => {
    const sec = document.createElement("div");
    sec.style.marginTop = "var(--esp-4)";
    const h = document.createElement("div");
    h.textContent = `${g.rotulo} (${g.linhas.length})`;
    h.style.cssText = "font-weight:var(--peso-semi);margin-bottom:var(--esp-2)";
    sec.appendChild(h);
    const tab = document.createElement("ui-data-table");
    tab.setAttribute("fluido", "");
    if (g.rota) tab.setAttribute("clicavel", "");
    tab.columns = g.colunas;
    tab.rows = g.linhas;
    if (g.rota) {
      tab.addEventListener("linha", (e) => {
        const hash = g.rota(e.detail.linha);
        if (hash) {
          modal.remove();
          irPara(hash);
        }
      });
    }
    sec.appendChild(tab);
    corpo.appendChild(sec);
  });
  modal.appendChild(corpo);

  const rod = document.createElement("div");
  rod.setAttribute("slot", "rodape");
  const btn = document.createElement("ui-button");
  btn.textContent = "Fechar";
  btn.addEventListener("click", () => modal.remove());
  rod.appendChild(btn);
  modal.appendChild(rod);

  modal.addEventListener("fechar", () => modal.remove());
  document.body.appendChild(modal);
}
