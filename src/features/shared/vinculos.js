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
import { saldoPorDespesa } from "../despesas/despesa-split.js";
import "../despesas/despesa-detail.js";
import {
  rastrearContato,
  rastrearFornecedor,
  rastrearItem,
  rastrearSubclassificacao,
  rastrearEquipe,
  rastrearObra,
  rastrearOferta,
} from "./rastreabilidade.js";
import "../../components/ui-modal.js";
import "../../components/ui-alert.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";

const nomeItem = (l) => (l.item_id && (dataStore.item(l.item_id) || {}).nome) || l.descricao || l.item || "—";

/** Monta o ctx (coleções) consumido pela camada pura de rastreabilidade. */
function _ctx() {
  const obras = dataStore.obras();
  const participantes = [];
  obras.forEach((o) =>
    dataStore.participantesDaObra(o.id).forEach((p) =>
      participantes.push({ obra_id: o.id, chave: p.chave, eh_responsavel: p.eh_responsavel })
    )
  );
  return {
    obras,
    despesas: dataStore.todasDespesas(),
    ofertas: dataStore.todasOfertas(),
    cotacoes: dataStore.cotacoes(),
    orcamentos: dataStore.orcamentos(),
    contatos: dataStore.contatosAtivos(),
    fornecedores: dataStore.fornecedoresAtivos(),
    itens: dataStore.itensAtivos(),
    equipes: dataStore.equipes(),
    pagamentos: dataStore.pagamentos(),
    repasses: dataStore.repasses(),
    participantes,
  };
}

/** Decora despesas (cruas) com o nome da obra p/ exibição. */
const _comObra = (despesas) =>
  (despesas || []).map((d) => Object.assign({}, d, { _obra: (dataStore.obra(d.obra_id) || {}).nome || "—" }));

const COL_DESPESA = [
  { chave: "_obra", titulo: "Obra", formato: (v) => v || "—" },
  { chave: "item", titulo: "Item", formato: (v, l) => nomeItem(l) },
  { chave: "valor", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
];
const COL_COTACAO = [
  { chave: "descricao", titulo: "Cotação", formato: (v, l) => nomeItem(l) },
  { chave: "status", titulo: "Situação", formato: (s) => (s === "fechada" ? "Fechada" : "Aberta") },
];
const COL_OFERTA = [
  { chave: "item_id", titulo: "Oferta", formato: (v, l) => nomeItem(l) },
  { chave: "valor_unit", titulo: "Valor unit.", alinhar: "dir", formato: (v) => moeda(v) },
];
const COL_OBRA = [{ chave: "nome", titulo: "Obra" }];
const COL_CONTATO = [
  { chave: "nome", titulo: "Contato" },
  { chave: "cargo", titulo: "Cargo", formato: (v) => v || "—" },
];
const COL_FORNECEDOR = [{ chave: "nome", titulo: "Empresa" }];
const COL_EQUIPE = [{ chave: "nome", titulo: "Equipe" }];
const COL_ORCAMENTO = [{ chave: "titulo", titulo: "Orçamento", formato: (v, l) => v || l.tipo || "—" }];
const COL_PAGAMENTO = [
  { chave: "data", titulo: "Data", formato: (v) => v || "—" },
  { chave: "valor", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
];
const COL_REPASSE = COL_PAGAMENTO;

const rotaOferta = (l) => (l.cotacao_id ? "/cotacoes/" + l.cotacao_id : "/ofertas");

function _grupo(rotulo, colunas, linhas, rota) {
  return { rotulo, colunas, linhas, rota };
}

/* ----------------------------- Cálculos ------------------------------ */

export function vinculosDoItem(id) {
  const r = rastrearItem(id, _ctx());
  return [
    _grupo("Despesas", COL_DESPESA, _comObra(r.despesas), (l) => "/obras/" + l.obra_id),
    _grupo("Cotações", COL_COTACAO, r.cotacoes, (l) => "/cotacoes/" + l.id),
    _grupo("Ofertas", COL_OFERTA, r.ofertas, rotaOferta),
    _grupo("Obras", COL_OBRA, r.obras, (l) => "/obras/" + l.id),
  ];
}

export function vinculosDoFornecedor(id) {
  const r = rastrearFornecedor(id, _ctx());
  return [
    _grupo("Contatos", COL_CONTATO, r.contatos, (l) => "/contatos/" + l.id),
    _grupo("Ofertas", COL_OFERTA, r.ofertas, rotaOferta),
    _grupo("Despesas", COL_DESPESA, _comObra(r.despesas), (l) => "/obras/" + l.obra_id),
    _grupo("Obras", COL_OBRA, r.obras, (l) => "/obras/" + l.id),
    _grupo("Pagamentos", COL_PAGAMENTO, r.pagamentos, null),
  ];
}

export function vinculosDoContato(id) {
  const r = rastrearContato(id, _ctx());
  return [
    _grupo("Ofertas", COL_OFERTA, r.ofertas, rotaOferta),
    _grupo("Despesas", COL_DESPESA, _comObra(r.despesas), (l) => "/obras/" + l.obra_id),
    _grupo("Equipes", COL_EQUIPE, r.equipes, (l) => "/equipes/" + l.id),
    _grupo("Obras", COL_OBRA, r.obras, (l) => "/obras/" + l.id),
    _grupo("Pagamentos", COL_PAGAMENTO, r.pagamentos, null),
    _grupo("Repasses", COL_REPASSE, r.repasses, null),
  ];
}

export function vinculosDaSubclassificacao(id) {
  const r = rastrearSubclassificacao(id, _ctx());
  return [
    _grupo("Itens", [{ chave: "nome", titulo: "Item" }], r.itens, (l) => "/itens/" + l.id),
    _grupo("Despesas", COL_DESPESA, _comObra(r.despesas), (l) => "/obras/" + l.obra_id),
    _grupo("Cotações", COL_COTACAO, r.cotacoes, (l) => "/cotacoes/" + l.id),
    _grupo("Empresas", COL_FORNECEDOR, r.fornecedores, (l) => "/fornecedores/" + l.id),
  ];
}

export function vinculosDaEquipe(id) {
  const r = rastrearEquipe(id, _ctx());
  return [
    _grupo("Ofertas", COL_OFERTA, r.ofertas, rotaOferta),
    _grupo("Despesas", COL_DESPESA, _comObra(r.despesas), (l) => "/obras/" + l.obra_id),
    _grupo("Orçamentos", COL_ORCAMENTO, r.orcamentos, (l) => "/orcamentos/" + l.id),
    _grupo("Obras", COL_OBRA, r.obras, (l) => "/obras/" + l.id),
    _grupo("Pagamentos", COL_PAGAMENTO, r.pagamentos, null),
  ];
}

export function vinculosDaObra(id) {
  const r = rastrearObra(id, _ctx());
  return [
    _grupo("Despesas", COL_DESPESA, _comObra(r.despesas), (l) => "/obras/" + l.obra_id),
    _grupo("Cotações", COL_COTACAO, r.cotacoes, (l) => "/cotacoes/" + l.id),
    _grupo("Ofertas", COL_OFERTA, r.ofertas, rotaOferta),
    _grupo("Orçamentos", COL_ORCAMENTO, r.orcamentos, (l) => "/orcamentos/" + l.id),
    _grupo("Equipes", COL_EQUIPE, r.equipes, (l) => "/equipes/" + l.id),
    _grupo("Pagamentos", COL_PAGAMENTO, r.pagamentos, null),
    _grupo("Repasses", COL_REPASSE, r.repasses, null),
  ];
}

export function vinculosDoCargo(nome) {
  const contatos = dataStore.contatosAtivos().filter((c) => String(c.cargo) === String(nome));
  return [_grupo("Contatos", COL_CONTATO, contatos, (l) => "/contatos/" + l.id)];
}

export function vinculosDaOferta(preco) {
  const r = rastrearOferta(preco, _ctx());
  return [_grupo("Despesa registrada", COL_DESPESA, _comObra(r.despesas), (l) => "/obras/" + l.obra_id)];
}

/* ------------------------------ Banner ------------------------------- */

/* --------------------------- Origem do estoque ----------------------------- */

const ROTULO_ORIGEM_ESTOQUE = {
  entrada_despesa: "Despesa paga",
  entrada_manual: "Adição manual",
  entrada_transferencia: "Transferência recebida",
};

/**
 * Banner de ORIGEM de um item do estoque (item 17): lista as ENTRADAS — de quais
 * despesas veio, se foi manual ou recebido por transferência (com a obra de origem).
 * Read-only; compõe ui-modal + ui-data-table (sem componente novo).
 *  origens = [{ tipo, quantidade, unidade, despesa_id, obra_origem_id, data }]
 *  obraId  = obra atual (p/ abrir a despesa de origem na própria obra).
 */
export function abrirOrigemEstoque({ tituloItem, origens, obraId }) {
  const linhas = (origens || []).map((o) => {
    const obraOrigem = o.obra_origem_id ? (dataStore.obra(o.obra_origem_id) || {}).nome || "—" : "";
    let de = ROTULO_ORIGEM_ESTOQUE[o.tipo] || "Entrada";
    if (o.tipo === "entrada_transferencia" && obraOrigem) de += " · " + obraOrigem;
    return {
      _de: de,
      _qtd: (Number(o.quantidade) || 0) + (o.unidade ? " " + o.unidade : ""),
      _data: o.data || "—",
      _rota: o.tipo === "entrada_transferencia" && o.obra_origem_id ? "/obras/" + o.obra_origem_id : "/obras/" + (obraId || ""),
    };
  });

  const modal = document.createElement("ui-modal");
  modal.setAttribute("open", "");
  modal.setAttribute("title", "Origem · " + (tituloItem || "item"));

  const corpo = document.createElement("div");
  const alerta = document.createElement("ui-alert");
  alerta.setAttribute("tipo", "info");
  alerta.mensagem = "De onde este item do estoque veio (entradas consolidadas).";
  corpo.appendChild(alerta);

  const tab = document.createElement("ui-data-table");
  tab.setAttribute("fluido", "");
  tab.setAttribute("clicavel", "");
  tab.setAttribute("empty-text", "Sem entradas registradas.");
  tab.style.marginTop = "var(--esp-3)";
  tab.columns = [
    { chave: "_de", titulo: "Origem" },
    { chave: "_qtd", titulo: "Quantidade", alinhar: "dir" },
    { chave: "_data", titulo: "Data" },
  ];
  tab.rows = linhas;
  tab.addEventListener("linha", (e) => {
    const hash = (e.detail.linha || {})._rota;
    if (hash) {
      modal.remove();
      irPara(hash);
    }
  });
  corpo.appendChild(tab);
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

/**
 * Banner "Origem do acerto" — ao clicar numa linha do "quem deve a quem", mostra
 * DE ONDE os números vêm: as despesas que geram o saldo do DEVEDOR e do CREDOR
 * (responsabilidade × o que cada um pagou). Cada linha abre a despesa (despesa-detail).
 * `acerto` = { de, de_nome, para, para_nome, valor }.
 */
export function abrirOrigemAcerto({ acerto, despesas, obraId }) {
  const a = acerto || {};
  const mapa = {};
  (despesas || []).forEach((d) => (mapa[String(d.id)] = d));
  const nomeVivo = (id, fallback) => {
    const d = mapa[String(id)];
    return (d && d.item_id && (dataStore.item(d.item_id) || {}).nome) || fallback || "—";
  };

  const modal = document.createElement("ui-modal");
  modal.setAttribute("open", "");
  modal.setAttribute("title", "Origem · " + (a.de_nome || "") + " → " + (a.para_nome || ""));

  const corpo = document.createElement("div");
  const alerta = document.createElement("ui-alert");
  alerta.setAttribute("tipo", "info");
  alerta.mensagem = `${a.de_nome || "—"} deve ${moeda(a.valor || 0)} a ${a.para_nome || "—"}. Estas são as despesas que geram o acerto (o que cada um deve pela responsabilidade × o que já pagou).`;
  corpo.appendChild(alerta);

  const abrirDespesa = (despesaId) => {
    const d = mapa[String(despesaId)];
    if (!d) return;
    modal.remove();
    document.querySelectorAll("despesa-detail").forEach((b) => b.remove());
    const banner = document.createElement("despesa-detail");
    banner.despesa = d;
    banner.categorias = dataStore.categoriasDaObra(obraId).filter((c) => String(c.tipo || "") !== "fornecedor");
    banner.addEventListener("fechar", () => banner.remove());
    document.body.appendChild(banner);
  };

  const secao = (titulo, chave, colunas) => {
    const linhas = saldoPorDespesa(despesas, chave).map((e) => ({
      _id: e.despesa_id,
      _item: nomeVivo(e.despesa_id, e.item),
      _valor: moeda(e.valor),
      _parte: moeda(e.devido),
      _pagou: moeda(e.pago),
    }));
    const wrap = document.createElement("div");
    const h = document.createElement("div");
    h.textContent = titulo;
    h.style.cssText = "font-weight:var(--peso-semi);margin:var(--esp-4) 0 var(--esp-2);color:var(--cor-texto)";
    wrap.appendChild(h);
    const tab = document.createElement("ui-data-table");
    tab.setAttribute("fluido", "");
    tab.setAttribute("clicavel", "");
    tab.setAttribute("empty-text", "Nenhuma despesa.");
    tab.columns = colunas;
    tab.rows = linhas;
    tab.addEventListener("linha", (e) => abrirDespesa((e.detail.linha || {})._id));
    wrap.appendChild(tab);
    return wrap;
  };

  corpo.appendChild(
    secao(`${a.de_nome || "—"} — deve por estas despesas`, a.de, [
      { chave: "_item", titulo: "Despesa" },
      { chave: "_valor", titulo: "Valor", alinhar: "dir" },
      { chave: "_parte", titulo: "Parte dele(a)", alinhar: "dir" },
      { chave: "_pagou", titulo: "Já pagou", alinhar: "dir" },
    ])
  );
  corpo.appendChild(
    secao(`${a.para_nome || "—"} — tem a receber por estas despesas`, a.para, [
      { chave: "_item", titulo: "Despesa" },
      { chave: "_valor", titulo: "Valor", alinhar: "dir" },
      { chave: "_pagou", titulo: "Pagou", alinhar: "dir" },
      { chave: "_parte", titulo: "Parte dele(a)", alinhar: "dir" },
    ])
  );
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

/**
 * Banner de ORIGEM de um dado de gráfico (item 4): ao clicar numa fatia/barra,
 * mostra as linhas que compõem aquele número. Neutro e reutilizável — compõe
 * ui-modal + ui-alert(info) + ui-data-table (sem componente novo). `aoAbrir`
 * (opcional) recebe `(linha, modal)` no clique de uma linha — no compartilhamento
 * (somente leitura) é omitido → tabela apenas exibe.
 */
export function abrirOrigemGrafico({ titulo, descricao, colunas, linhas, aoAbrir }) {
  const modal = document.createElement("ui-modal");
  modal.setAttribute("open", "");
  modal.setAttribute("title", "Origem · " + (titulo || ""));

  const corpo = document.createElement("div");
  if (descricao) {
    const alerta = document.createElement("ui-alert");
    alerta.setAttribute("tipo", "info");
    alerta.mensagem = descricao;
    corpo.appendChild(alerta);
  }
  const tab = document.createElement("ui-data-table");
  tab.setAttribute("fluido", "");
  tab.setAttribute("empty-text", "Sem registros.");
  tab.style.marginTop = "var(--esp-3)";
  if (aoAbrir) tab.setAttribute("clicavel", "");
  tab.columns = colunas || [];
  tab.rows = linhas || [];
  if (aoAbrir) tab.addEventListener("linha", (e) => aoAbrir(e.detail.linha, modal));
  corpo.appendChild(tab);
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
  return modal;
}

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
