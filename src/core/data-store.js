/**
 * data-store.js — Estado central + cache da aplicação (cache-first).
 *
 * Todo o estado do usuário é carregado UMA vez (dados.snapshot), guardado aqui
 * e persistido em localStorage (por usuário). As views LEEM deste store
 * (instantâneo, sem recarregar). As mutações fazem write-through: chamam a API,
 * atualizam o store e persistem o cache. Um refresh em 2º plano (app.js)
 * mantém os dados frescos. Servidor continua sendo a fonte de verdade.
 *
 * Construído sobre criarStore() (store.js) + api-client + event-bus.
 */
import { criarStore } from "./store.js";
import { api } from "./api-client.js";
import { auth } from "./auth-store.js";
import { bus, EVENTOS } from "./event-bus.js";
import { obraIdDaOferta } from "../features/shared/rastreabilidade.js";

const CACHE_VERSAO = 4; // bump: coleção transferencias (agrupa pagamentos)

const ESTADO_VAZIO = {
  carregado: false,
  usuario: null,
  config: {},
  categorias: [],
  obras: [],
  despesas: {}, // obraId -> [despesa]
  resumos: {}, // obraId -> resumo
  categoriasPorObra: {}, // obraId -> [categoria do dono]
  participantesPorObra: {}, // obraId -> [participante] (dono + compartilhados + contatos)
  fornecedores: [], // módulo Compras (empresas/lojas do usuário)
  contatos: [], // módulo Compras (pessoas do usuário)
  cargos: [], // cargos de contatos (fixos + extras do usuário)
  itens: [], // catálogo de itens (cada um Material ou Serviço)
  cotacoes: [], // módulo Compras (necessidades a cotar)
  ofertas: [], // módulo Compras — LISTA PLANA de ofertas (oferta independente da cotação)
  historicoPorCotacao: {}, // cotacaoId -> [ponto de histórico de preço]
  orcamentos: [], // módulo Compras (containers de ofertas)
  equipes: [], // grupos (líder + membros + obras)
  transferencias: [], // transferências (agrupam N pagamentos de 1 recebedor/empresa)
  pagamentos: [], // pagamentos (entidade própria; 1 pagamento → várias despesas)
  repasses: [], // repasses de um pagamento a outros contatos
  usuarios: [], // admin
};

const store = criarStore({ ...ESTADO_VAZIO });

/* --------------------------- Cache local ----------------------------- */

function _chave() {
  const u = auth.usuario();
  return u ? "obras.cache." + u.id : null;
}

function persistir() {
  const chave = _chave();
  if (!chave) return;
  try {
    const s = store.get();
    const dados = {
      usuario: s.usuario,
      config: s.config,
      categorias: s.categorias,
      obras: s.obras,
      despesas: s.despesas,
      resumos: s.resumos,
      categoriasPorObra: s.categoriasPorObra,
      participantesPorObra: s.participantesPorObra,
      fornecedores: s.fornecedores,
      contatos: s.contatos,
      cargos: s.cargos,
      itens: s.itens,
      cotacoes: s.cotacoes,
      ofertas: s.ofertas,
      historicoPorCotacao: s.historicoPorCotacao,
      orcamentos: s.orcamentos,
      equipes: s.equipes,
      transferencias: s.transferencias,
      pagamentos: s.pagamentos,
      repasses: s.repasses,
      usuarios: s.usuarios,
    };
    localStorage.setItem(chave, JSON.stringify({ versao: CACHE_VERSAO, dados }));
  } catch (e) {
    /* cota/indisponível: segue só em memória */
  }
}

/** Carrega do cache local (render instantâneo). Retorna true se havia cache. */
function restaurarCache() {
  const chave = _chave();
  if (!chave) return false;
  try {
    const bruto = localStorage.getItem(chave);
    if (!bruto) return false;
    const obj = JSON.parse(bruto);
    if (!obj || obj.versao !== CACHE_VERSAO || !obj.dados) return false;
    store.set({ ...obj.dados, carregado: true });
    return true;
  } catch (e) {
    return false;
  }
}

function limparCache() {
  const chave = _chave();
  try {
    if (chave) localStorage.removeItem(chave);
  } catch (e) {
    /* ignora */
  }
  store.set({ ...ESTADO_VAZIO });
}

/* ----------------------- Carga via snapshot -------------------------- */

function _aplicarSnapshot(d) {
  store.set({
    carregado: true,
    usuario: d.usuario,
    config: d.config || {},
    categorias: d.categorias || [],
    obras: d.obras || [],
    despesas: d.despesas || {},
    resumos: d.resumos || {},
    categoriasPorObra: d.categoriasPorObra || {},
    participantesPorObra: d.participantesPorObra || {},
    fornecedores: d.fornecedores || [],
    contatos: d.contatos || [],
    cargos: d.cargos || [],
    itens: d.itens || [],
    cotacoes: d.cotacoes || [],
    ofertas: d.ofertas || [],
    historicoPorCotacao: d.historicoPorCotacao || {},
    orcamentos: d.orcamentos || [],
    equipes: d.equipes || [],
    transferencias: d.transferencias || [],
    pagamentos: d.pagamentos || [],
    repasses: d.repasses || [],
    usuarios: d.usuarios || [],
  });
  persistir();
}

/** Carrega tudo (carregamento inicial). */
async function inicializar() {
  const d = await api.call("dados.snapshot");
  _aplicarSnapshot(d);
}

/** Atualiza o cache silenciosamente (refresh em 2º plano). */
async function atualizarEmSegundoPlano() {
  try {
    const d = await api.call("dados.snapshot");
    _aplicarSnapshot(d);
  } catch (e) {
    /* silencioso */
  }
}

/* ------------------------------ Getters ------------------------------ */

const get = () => store.get();
const carregado = () => store.get().carregado;
const usuario = () => store.get().usuario;
const config = () => store.get().config;
const categorias = () => store.get().categorias;
const usuarios = () => store.get().usuarios;
const obras = () => store.get().obras;
const obra = (id) => store.get().obras.find((o) => String(o.id) === String(id)) || null;
const despesas = (obraId) => store.get().despesas[obraId] || [];
/** Todas as despesas (de todas as obras carregadas) — p/ visões cross-obra. */
const todasDespesas = () => obras().flatMap((o) => despesas(o.id));
const resumo = (obraId) => store.get().resumos[obraId] || { total: 0, qtd: 0, orcamento: 0, saldo: 0, por_categoria: [] };
const categoriasDaObra = (obraId) => store.get().categoriasPorObra[obraId] || store.get().categorias;
/** Subclassificações de ITEM (tipo != fornecedor; inclui legado sem tipo). */
const categoriasItem = () => store.get().categorias.filter((c) => String(c.tipo || "") !== "fornecedor");
/** Classificações de FORNECEDOR (tipo == fornecedor). */
const categoriasFornecedor = () => store.get().categorias.filter((c) => String(c.tipo || "") === "fornecedor");
const participantesDaObra = (obraId) => store.get().participantesPorObra[obraId] || [];
// Módulo Compras
const fornecedores = () => store.get().fornecedores;
const fornecedoresAtivos = () => store.get().fornecedores.filter((f) => f.ativo !== false);
const contatos = () => store.get().contatos;
const contatosAtivos = () => store.get().contatos.filter((c) => c.ativo !== false);
const cargos = () => store.get().cargos;
const itens = () => store.get().itens;
const itensAtivos = () => store.get().itens.filter((i) => i.ativo !== false);
const item = (id) => store.get().itens.find((i) => String(i.id) === String(id)) || null;
const cotacoes = () => store.get().cotacoes;
const cotacao = (id) => store.get().cotacoes.find((c) => String(c.id) === String(id)) || null;
/** TODAS as ofertas do usuário (lista plana — oferta independente da cotação). */
const todasOfertas = () => store.get().ofertas;
/** Ofertas de uma cotação (filtra a lista plana; mantém a ordenação por criado_em). */
const precosDaCotacao = (cotacaoId) =>
  store.get().ofertas.filter((p) => String(p.cotacao_id) === String(cotacaoId));
const historicoDaCotacao = (cotacaoId) => store.get().historicoPorCotacao[cotacaoId] || [];
/** Itens (ativos) de uma subclassificação (categoria tipo item). */
const itensDaSubclasse = (categoriaId) =>
  store.get().itens.filter((i) => i.ativo !== false && String(i.categoria_id) === String(categoriaId));
/** Ofertas de uma cotação agrupadas por item: [{ itemId, ofertas:[...] }] (ordem de surgimento). */
const precosDaCotacaoPorItem = (cotacaoId) => {
  const grupos = {};
  const ordem = [];
  precosDaCotacao(cotacaoId).forEach((p) => {
    const k = String(p.item_id || "");
    if (!grupos[k]) {
      grupos[k] = [];
      ordem.push(k);
    }
    grupos[k].push(p);
  });
  return ordem.map((k) => ({ itemId: k, ofertas: grupos[k] }));
};
const orcamentos = () => store.get().orcamentos;
const orcamento = (id) => store.get().orcamentos.find((o) => String(o.id) === String(id)) || null;
const equipes = () => store.get().equipes;
const equipe = (id) => store.get().equipes.find((e) => String(e.id) === String(id)) || null;
/** Equipes onde o contato é líder OU membro. */
const equipesDoContato = (contatoId) =>
  store.get().equipes.filter(
    (e) =>
      String(e.lider_id) === String(contatoId) ||
      (e.membros || []).some((m) => String(m) === String(contatoId))
  );
/** Equipes vinculadas a uma obra. */
const equipesDaObra = (obraId) =>
  store.get().equipes.filter((e) => (e.obras || []).some((o) => String(o) === String(obraId)));
/** Ofertas de um orçamento: filtra a lista plana por orcamento_id. */
const ofertasDoOrcamento = (orcId) =>
  store.get().ofertas.filter((p) => String(p.orcamento_id) === String(orcId));

/* Rastreabilidade (derivada) — atalhos p/ as direções reversas mais usadas. */
const ofertasDoContato = (id) => store.get().ofertas.filter((o) => String(o.contato_id) === String(id));
const ofertasDoFornecedor = (id) => store.get().ofertas.filter((o) => String(o.fornecedor_id) === String(id));
const ofertasDoItem = (id) => store.get().ofertas.filter((o) => String(o.item_id) === String(id));
const ofertasDaObra = (id) => {
  const ctx = { cotacoes: store.get().cotacoes, orcamentos: store.get().orcamentos };
  return store.get().ofertas.filter((o) => String(obraIdDaOferta(o, ctx)) === String(id));
};
const despesasDoContato = (id) => todasDespesas().filter((d) => String(d.ofertante_contato_id) === String(id));
const despesasDoFornecedor = (id) => todasDespesas().filter((d) => String(d.fornecedor_id) === String(id));
const despesasDoItem = (id) => todasDespesas().filter((d) => String(d.item_id) === String(id));
const despesasDaEquipe = (id) => todasDespesas().filter((d) => String(d.ofertante_equipe_id) === String(id));

// Pagamentos / Repasses — entidades próprias + (fallback) SINTETIZADOS das levas
// embutidas (pagamentos antigos seguem a MESMA lógica em todas as telas, mesmo antes
// do deploy do backend novo). Recebedor/empresa do sintetizado vêm da despesa.
const _pagadorContatoId = (chave) => (String(chave || "").indexOf("c:") === 0 ? String(chave).slice(2) : "");
function _pagamentoDeLeva(lv, d) {
  return {
    id: "leva:" + lv.id,
    _sintetico: true,
    _despesaId: d.id,
    _levaId: lv.id,
    usuario_id: d.usuario_id,
    obra_id: d.obra_id,
    data: lv.data,
    valor: Number(lv.valor) || 0,
    pagador_chave: lv.pagador || "",
    pagador_contato_id: _pagadorContatoId(lv.pagador),
    recebedor_contato_id: lv.contato_id || d.ofertante_contato_id || "",
    recebedor_equipe_id: d.ofertante_equipe_id || "",
    fornecedor_id: lv.fornecedor_id || d.fornecedor_id || "",
    alocacoes: [{ despesa_id: d.id, valor: Number(lv.valor) || 0 }],
    distribuicao: Array.isArray(lv.distribuicao) ? lv.distribuicao : [],
  };
}
const pagamentos = () => {
  const ents = store.get().pagamentos || [];
  const cobertas = new Set();
  ents.forEach((p) => {
    if (p.origem_leva_id) cobertas.add(String(p.origem_leva_id)); // leva legada migrada
    cobertas.add(String(p.id)); // a leva-espelho de uma entidade tem id = id da entidade
  });
  const sint = [];
  todasDespesas().forEach((d) => {
    (Array.isArray(d.pagamentos_realizados) ? d.pagamentos_realizados : []).forEach((lv) => {
      if (lv && lv.id && !cobertas.has(String(lv.id))) sint.push(_pagamentoDeLeva(lv, d));
    });
  });
  return ents.concat(sint);
};
const repasses = () => store.get().repasses;
const pagamentosDaDespesa = (id) =>
  pagamentos().filter((p) => (p.alocacoes || []).some((a) => String(a.despesa_id) === String(id)));
const pagamentosDoContato = (id) =>
  pagamentos().filter((p) => String(p.pagador_contato_id) === String(id) || String(p.recebedor_contato_id) === String(id));
const pagamentosDaObra = (id) => pagamentos().filter((p) => String(p.obra_id) === String(id));
const repassesDoPagamento = (id) => repasses().filter((r) => String(r.pagamento_id) === String(id));
const repassesDoContato = (id) =>
  repasses().filter(
    (r) => String(r.recebedor_contato_id) === String(id) || (r.contatos_repassados || []).some((c) => String(c) === String(id))
  );
/** "Esta despesa já tem pagamento?" (entidade OU leva embutida). */
const despesaTemPagamento = (d) => pagamentosDaDespesa((d || {}).id).length > 0;

// Transferências — entidades próprias + (fallback) SINTETIZADAS 1:1 de pagamentos sem
// transferência real (levas embutidas e pagamentos pré-migração). Assim toda tela vê
// "1 pagamento = 1 transferência" mesmo antes do deploy/migração do backend.
function _transferenciaDePagamento(p) {
  return {
    id: "t:" + p.id,
    _sintetico: true,
    _pagamentoId: p.id,
    usuario_id: p.usuario_id,
    obra_id: p.obra_id,
    data: p.data,
    valor_total: Number(p.valor) || 0,
    tipo: p.tipo || "dinheiro",
    recebedor_contato_id: p.recebedor_contato_id || "",
    recebedor_equipe_id: p.recebedor_equipe_id || "",
    fornecedor_id: p.fornecedor_id || "",
    pagador_chave: p.pagador_chave || "",
    pagador_contato_id: p.pagador_contato_id || "",
    pagamento_ids: [p.id],
  };
}
const transferencias = () => {
  const reais = store.get().transferencias || [];
  const idsReais = new Set(reais.map((t) => String(t.id)));
  const sint = [];
  pagamentos().forEach((p) => {
    const tid = String(p.transferencia_id || "");
    if (tid && idsReais.has(tid)) return; // coberto por transferência real
    sint.push(_transferenciaDePagamento(p));
  });
  return reais.concat(sint);
};
const transferencia = (id) => transferencias().find((t) => String(t.id) === String(id)) || null;
const transferenciasDaObra = (id) => transferencias().filter((t) => String(t.obra_id) === String(id));
const transferenciaDoPagamento = (pagId) =>
  transferencias().find((t) => (t.pagamento_ids || []).some((pid) => String(pid) === String(pagId))) || null;
const pagamentosDaTransferencia = (tId) => {
  const t = transferencia(tId);
  if (!t) return [];
  const ids = new Set((t.pagamento_ids || []).map((x) => String(x)));
  return pagamentos().filter((p) => ids.has(String(p.id)) || String(p.transferencia_id || "") === String(tId));
};

/* --------------------- Recalcular resumo local ----------------------- */

function _resumoLocal(obraId) {
  const s = store.get();
  const o = s.obras.find((x) => String(x.id) === String(obraId)) || {};
  const cats = s.categoriasPorObra[obraId] || s.categorias || [];
  const mapa = {};
  cats.forEach((c) => (mapa[c.id] = c));
  const lista = s.despesas[obraId] || [];
  const acc = {};
  let total = 0;
  lista.forEach((d) => {
    const v = Number(d.valor) || 0;
    total += v;
    acc[d.categoria_id] = (acc[d.categoria_id] || 0) + v;
  });
  const por = Object.keys(acc)
    .map((id) => {
      const c = mapa[id] || { nome: "Sem categoria", cor: "#94a3b8" };
      return { categoria_id: id, nome: c.nome, cor: c.cor, total: acc[id] };
    })
    .sort((a, b) => b.total - a.total);
  const orcamento = Number(o.orcamento) || 0;
  return { obra_id: obraId, total, qtd: lista.length, orcamento, saldo: orcamento - total, por_categoria: por };
}

/** Substitui imutavelmente as despesas/resumo de uma obra e o total da obra. */
function _setDespesasObra(obraId, lista, resumoServidor) {
  const s = store.get();
  const novoResumo = resumoServidor || _resumoLocal(obraId);
  const obrasNovas = s.obras.map((o) =>
    String(o.id) === String(obraId) ? { ...o, total_gasto: novoResumo.total } : o
  );
  store.set({
    despesas: { ...s.despesas, [obraId]: lista },
    resumos: { ...s.resumos, [obraId]: novoResumo },
    obras: obrasNovas,
  });
}

/* ----------------------- Mutações: obras ----------------------------- */

async function criarObra(dados) {
  const r = await api.call("obras.criar", dados);
  const u = usuario() || {};
  const nova = {
    ...r.obra,
    total_gasto: 0,
    ehDono: true,
    dono_nome: u.nome || "",
    dono_email: u.email || "",
  };
  const s = store.get();
  store.set({
    obras: [...s.obras, nova],
    despesas: { ...s.despesas, [nova.id]: [] },
    resumos: {
      ...s.resumos,
      [nova.id]: { obra_id: nova.id, total: 0, qtd: 0, orcamento: Number(nova.orcamento) || 0, saldo: Number(nova.orcamento) || 0, por_categoria: [] },
    },
    categoriasPorObra: { ...s.categoriasPorObra, [nova.id]: s.categorias },
  });
  persistir();
  bus.emit(EVENTOS.OBRAS, { tipo: "criada" });
  return nova;
}

async function atualizarObra(id, dados) {
  const r = await api.call("obras.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    obras: s.obras.map((o) => (String(o.id) === String(id) ? { ...o, ...r.obra } : o)),
  });
  persistir();
  bus.emit(EVENTOS.OBRAS, { tipo: "atualizada" });
  return r.obra;
}

async function removerObra(id) {
  await api.call("obras.remover", { id });
  const s = store.get();
  const despesasNovas = { ...s.despesas };
  const resumosNovos = { ...s.resumos };
  const catsNovas = { ...s.categoriasPorObra };
  delete despesasNovas[id];
  delete resumosNovos[id];
  delete catsNovas[id];
  store.set({
    obras: s.obras.filter((o) => String(o.id) !== String(id)),
    despesas: despesasNovas,
    resumos: resumosNovos,
    categoriasPorObra: catsNovas,
  });
  persistir();
  bus.emit(EVENTOS.OBRAS, { tipo: "removida" });
}

/* -------------------- Mutações: participantes ------------------------ */

function _setParticipantes(obraId, lista) {
  const s = store.get();
  store.set({ participantesPorObra: { ...s.participantesPorObra, [obraId]: lista } });
  persistir();
  bus.emit(EVENTOS.OBRAS, { tipo: "participantes", obra_id: obraId });
}

async function adicionarParticipante(obraId, contatoId) {
  const r = await api.call("participantes.adicionarContato", { obra_id: obraId, contato_id: contatoId });
  const p = r.participante || {};
  const item = {
    id: p.id,
    chave: "c:" + p.ref_id,
    tipo: "contato",
    ref_id: p.ref_id,
    nome: p.nome || "",
    email: "",
    origem: "contato",
    eh_responsavel: false,
  };
  const atual = participantesDaObra(obraId);
  if (!atual.some((x) => String(x.chave) === String(item.chave))) {
    _setParticipantes(obraId, [...atual, item]);
  }
  return item;
}

async function removerParticipante(obraId, id) {
  await api.call("participantes.remover", { id });
  _setParticipantes(
    obraId,
    participantesDaObra(obraId).filter((x) => String(x.id) !== String(id))
  );
}

async function definirResponsavel(obraId, chave, ehResponsavel) {
  const r = await api.call("participantes.definirResponsavel", {
    obra_id: obraId,
    chave,
    eh_responsavel: ehResponsavel === true,
  });
  _setParticipantes(obraId, r.participantes || participantesDaObra(obraId));
  return r.participantes;
}

/** Atualiza o link_token de uma obra no store (write-through). */
function _setLinkObra(id, token) {
  const s = store.get();
  store.set({
    obras: s.obras.map((o) =>
      String(o.id) === String(id) ? { ...o, link_token: token } : o
    ),
  });
  persistir();
}

async function gerarLinkPublico(obraId) {
  const r = await api.call("obras.gerarLink", { obra_id: obraId });
  _setLinkObra(obraId, r.link_token);
  return r.link_token;
}

async function removerLinkPublico(obraId) {
  await api.call("obras.removerLink", { obra_id: obraId });
  _setLinkObra(obraId, "");
}

/* ---------------------- Mutações: despesas --------------------------- */

async function adicionarDespesa(obraId, dados) {
  // 1) Otimista (preenche autor/datas com o usuário atual; o servidor confirma)
  const u = usuario() || {};
  const agora = new Date().toISOString();
  const temp = Object.assign(
    {
      id: "temp-" + Date.now() + "-" + Math.round(Math.random() * 1e6),
      obra_id: obraId,
      usuario_id: u.id,
      autor_nome: u.nome || "",
      editor_nome: u.nome || "",
      criado_em: agora,
      atualizado_em: agora,
      _otimista: true,
    },
    dados
  );
  _setDespesasObra(obraId, [temp, ...despesas(obraId)]);
  // 2) Confirmação
  try {
    const r = await api.call("despesas.criar", { obra_id: obraId, ...dados });
    const lista = despesas(obraId).map((d) => (d.id === temp.id ? r.despesa : d));
    _setDespesasObra(obraId, lista, r.resumo);
    persistir();
    bus.emit(EVENTOS.DESPESAS, { tipo: "criada", obra_id: obraId });
    return r.despesa;
  } catch (e) {
    _setDespesasObra(obraId, despesas(obraId).filter((d) => d.id !== temp.id));
    throw e;
  }
}

async function atualizarDespesa(obraId, id, dados) {
  const u = usuario() || {};
  const agora = new Date().toISOString();
  const backup = despesas(obraId);
  // 1) Otimista: reflete na hora (inclui editor e data de edição).
  const otim = backup.map((d) =>
    String(d.id) === String(id)
      ? { ...d, ...dados, editor_nome: u.nome || d.editor_nome, atualizado_em: agora }
      : d
  );
  _setDespesasObra(obraId, otim);
  // 2) Confirmação com o servidor (fonte de verdade).
  try {
    const r = await api.call("despesas.atualizar", { id, ...dados });
    const lista = despesas(obraId).map((d) => (String(d.id) === String(id) ? r.despesa : d));
    _setDespesasObra(obraId, lista, r.resumo);
    persistir();
    bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada", obra_id: obraId });
    return r.despesa;
  } catch (e) {
    _setDespesasObra(obraId, backup); // rollback
    throw e;
  }
}

async function removerDespesa(obraId, id) {
  const backup = despesas(obraId);
  _setDespesasObra(obraId, backup.filter((d) => String(d.id) !== String(id)));
  try {
    const r = await api.call("despesas.remover", { id });
    _setDespesasObra(obraId, despesas(obraId), r.resumo);
    // Reverte o registro: oferta desvinculada + cotação reaberta (se houver).
    if (r.preco) _mesclarOferta(r.preco);
    if (r.cotacao) {
      const s = store.get();
      store.set({
        cotacoes: s.cotacoes.map((c) => (String(c.id) === String(r.cotacao.id) ? r.cotacao : c)),
      });
    }
    persistir();
    bus.emit(EVENTOS.DESPESAS, { tipo: "removida", obra_id: obraId });
    if (r.preco) bus.emit(EVENTOS.COTACOES, { tipo: "desvinculada" });
  } catch (e) {
    _setDespesasObra(obraId, backup);
    throw e;
  }
}

/** Lança um pagamento parcial (leva) na despesa. dados: { valor, data?, distribuicao? }. */
async function lancarPagamento(obraId, despesaId, dados) {
  const r = await api.call("despesas.lancarPagamento", { despesa_id: despesaId, ...dados });
  const lista = despesas(obraId).map((d) => (String(d.id) === String(despesaId) ? r.despesa : d));
  _setDespesasObra(obraId, lista, r.resumo);
  if (r.pagamento) store.set({ pagamentos: [r.pagamento, ...store.get().pagamentos] });
  if (r.transferencia) store.set({ transferencias: [r.transferencia, ...store.get().transferencias] });
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada", obra_id: obraId });
  return r.despesa;
}

/* ---- Pagamentos / Repasses (entidades próprias) ---- */

/** Aplica as despesas atualizadas (de várias obras) retornadas por um pagamento. */
function _aplicarDespesasAtualizadas(lista, resumo, obraResumo) {
  (lista || []).forEach((d) => {
    const oid = d.obra_id;
    const novas = despesas(oid).map((x) => (String(x.id) === String(d.id) ? d : x));
    _setDespesasObra(oid, novas, String(oid) === String(obraResumo) ? resumo : null);
  });
}

/** Lança um pagamento que pode cobrir VÁRIAS despesas (entidade Pagamentos). */
async function lancarPagamentoMulti(dados) {
  const r = await api.call("pagamentos.lancar", dados);
  store.set({ pagamentos: [r.pagamento, ...store.get().pagamentos] });
  _aplicarDespesasAtualizadas(r.despesas, r.resumo, r.pagamento.obra_id);
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada" });
  return r.pagamento;
}

/**
 * Lança uma TRANSFERÊNCIA: 1 transferência + N pagamentos (1 por despesa). O backend
 * valida que todas as despesas têm o mesmo recebedor/empresa (senão erro, nada gravado).
 * dados: { obra_id, data, tipo, pagador, alocacoes:[{despesa_id,valor}], distribuicao? }.
 */
async function lancarTransferencia(dados) {
  const r = await api.call("transferencias.lancar", dados);
  const s = store.get();
  store.set({
    transferencias: [r.transferencia, ...s.transferencias],
    pagamentos: [...(r.pagamentos || []), ...s.pagamentos],
  });
  _aplicarDespesasAtualizadas(r.despesas, r.resumo, r.transferencia.obra_id);
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada" });
  return r.transferencia;
}

/** Remove uma TRANSFERÊNCIA e, em cascata, TODOS os seus pagamentos (+ repasses). */
async function removerTransferencia(id) {
  const r = await api.call("transferencias.remover", { id });
  const s = store.get();
  const pagIds = new Set(
    (s.pagamentos || []).filter((p) => String(p.transferencia_id) === String(id)).map((p) => String(p.id))
  );
  store.set({
    transferencias: s.transferencias.filter((t) => String(t.id) !== String(id)),
    pagamentos: s.pagamentos.filter((p) => String(p.transferencia_id) !== String(id)),
    repasses: s.repasses.filter((rp) => !pagIds.has(String(rp.pagamento_id))), // cascata
  });
  _aplicarDespesasAtualizadas(r.despesas, r.resumo, (r.despesas && r.despesas[0] && r.despesas[0].obra_id) || "");
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada" });
  return r;
}

/** Exclui uma transferência — entidade (cascata no backend) OU sintetizada 1:1 (= excluir o pagamento). */
async function excluirTransferencia(t) {
  if (t && t._sintetico) {
    const p = pagamentos().find((x) => String(x.id) === String(t._pagamentoId));
    return excluirPagamento(p || t._pagamentoId);
  }
  return removerTransferencia((t && t.id) || t);
}

/** Remove um pagamento (entidade) e re-sincroniza as despesas alocadas + a transferência. */
async function removerPagamentoV2(id) {
  const s0 = store.get();
  const pag = (s0.pagamentos || []).find((p) => String(p.id) === String(id));
  const transferenciaId = pag ? String(pag.transferencia_id || "") : "";
  const r = await api.call("pagamentos.remover", { id });
  const s = store.get();
  const pagamentosRest = s.pagamentos.filter((p) => String(p.id) !== String(id));
  let transferencias = s.transferencias || [];
  if (transferenciaId) {
    const aindaTem = pagamentosRest.some((p) => String(p.transferencia_id) === String(transferenciaId));
    if (!aindaTem) {
      transferencias = transferencias.filter((t) => String(t.id) !== String(transferenciaId));
    } else {
      transferencias = transferencias.map((t) => {
        if (String(t.id) !== String(transferenciaId)) return t;
        const ids = (t.pagamento_ids || []).filter((pid) => String(pid) !== String(id));
        const total = pagamentosRest
          .filter((p) => String(p.transferencia_id) === String(transferenciaId))
          .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
        return { ...t, pagamento_ids: ids, valor_total: total };
      });
    }
  }
  store.set({
    pagamentos: pagamentosRest,
    repasses: s.repasses.filter((rp) => String(rp.pagamento_id) !== String(id)), // cascata
    transferencias,
  });
  _aplicarDespesasAtualizadas(r.despesas, r.resumo, (r.despesas && r.despesas[0] && r.despesas[0].obra_id) || "");
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada" });
  return r;
}

/** Exclui um pagamento — entidade (removerPagamentoV2) OU leva embutida (removerPagamento). */
async function excluirPagamento(p) {
  if (p && p._sintetico) return removerPagamento(p.obra_id, p._despesaId, p._levaId);
  return removerPagamentoV2((p && p.id) || p);
}

/** Registra um repasse de um pagamento a outros contatos. */
async function lancarRepasse(dados) {
  const r = await api.call("repasses.lancar", dados);
  store.set({ repasses: [r.repasse, ...store.get().repasses] });
  persistir();
  return r.repasse;
}

/** Remove um repasse. */
async function removerRepasse(id) {
  await api.call("repasses.remover", { id });
  store.set({ repasses: store.get().repasses.filter((r) => String(r.id) !== String(id)) });
  persistir();
}

/** Remove um pagamento parcial (leva) lançado da despesa. */
async function removerPagamento(obraId, despesaId, lancamentoId) {
  const r = await api.call("despesas.removerPagamento", {
    despesa_id: despesaId,
    lancamento_id: lancamentoId,
  });
  const lista = despesas(obraId).map((d) => (String(d.id) === String(despesaId) ? r.despesa : d));
  _setDespesasObra(obraId, lista, r.resumo);
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada", obra_id: obraId });
  return r.despesa;
}

/* --------------------- Mutações: categorias -------------------------- */

/** Atualiza categoriasPorObra das obras das quais o usuário é dono. */
function _refletirCategoriasProprias(transform) {
  const s = store.get();
  const meuId = (s.usuario || {}).id;
  const cats = { ...s.categoriasPorObra };
  s.obras.forEach((o) => {
    if (String(o.usuario_id) === String(meuId)) {
      cats[o.id] = transform(cats[o.id] || s.categorias);
    }
  });
  store.set({ categoriasPorObra: cats });
}

async function criarCategoria(dados) {
  const r = await api.call("categorias.criar", dados);
  const s = store.get();
  store.set({ categorias: [...s.categorias, r.categoria] });
  _refletirCategoriasProprias((lista) => [...lista, r.categoria]);
  persistir();
  bus.emit(EVENTOS.CATEGORIAS, { tipo: "criada" });
  return r.categoria;
}

async function atualizarCategoria(id, dados) {
  const r = await api.call("categorias.atualizar", { id, ...dados });
  const s = store.get();
  const troca = (c) => (String(c.id) === String(id) ? r.categoria : c);
  store.set({ categorias: s.categorias.map(troca) });
  _refletirCategoriasProprias((lista) => lista.map(troca));
  persistir();
  bus.emit(EVENTOS.CATEGORIAS, { tipo: "atualizada" });
  return r.categoria;
}

async function removerCategoria(id) {
  await api.call("categorias.remover", { id });
  const s = store.get();
  const fora = (c) => String(c.id) !== String(id);
  store.set({ categorias: s.categorias.filter(fora) });
  _refletirCategoriasProprias((lista) => lista.filter(fora));
  persistir();
  bus.emit(EVENTOS.CATEGORIAS, { tipo: "removida" });
}

/* -------------------- Mutações: fornecedores ------------------------- */

async function criarFornecedor(dados) {
  const r = await api.call("fornecedores.criar", dados);
  const s = store.get();
  store.set({ fornecedores: [...s.fornecedores, r.fornecedor] });
  persistir();
  bus.emit(EVENTOS.FORNECEDORES, { tipo: "criado" });
  return r.fornecedor;
}

async function atualizarFornecedor(id, dados) {
  const r = await api.call("fornecedores.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    fornecedores: s.fornecedores.map((f) => (String(f.id) === String(id) ? r.fornecedor : f)),
  });
  persistir();
  bus.emit(EVENTOS.FORNECEDORES, { tipo: "atualizado" });
  return r.fornecedor;
}

async function removerFornecedor(id) {
  await api.call("fornecedores.remover", { id });
  const s = store.get();
  store.set({ fornecedores: s.fornecedores.filter((f) => String(f.id) !== String(id)) });
  persistir();
  bus.emit(EVENTOS.FORNECEDORES, { tipo: "removido" });
}

/* ----------------------- Mutações: contatos -------------------------- */

async function criarContato(dados) {
  const r = await api.call("contatos.criar", dados);
  const s = store.get();
  store.set({ contatos: [...s.contatos, r.contato] });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "criado" });
  return r.contato;
}

async function atualizarContato(id, dados) {
  const r = await api.call("contatos.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    contatos: s.contatos.map((c) => (String(c.id) === String(id) ? r.contato : c)),
  });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "atualizado" });
  return r.contato;
}

async function removerContato(id) {
  await api.call("contatos.remover", { id });
  const s = store.get();
  store.set({ contatos: s.contatos.filter((c) => String(c.id) !== String(id)) });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "removido" });
}

/* ------------------------- Mutações: cargos -------------------------- */

async function criarCargo(dados) {
  const r = await api.call("cargos.criar", dados);
  const s = store.get();
  store.set({ cargos: [...s.cargos, { ...r.cargo, fixo: false }] });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "cargo-criado" });
  return r.cargo;
}

async function atualizarCargo(id, dados) {
  const r = await api.call("cargos.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    cargos: s.cargos.map((c) => (String(c.id) === String(id) ? { ...r.cargo, fixo: false } : c)),
  });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "cargo-atualizado" });
  return r.cargo;
}

async function removerCargo(id) {
  await api.call("cargos.remover", { id });
  const s = store.get();
  store.set({ cargos: s.cargos.filter((c) => String(c.id) !== String(id)) });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "cargo-removido" });
}

/* -------------------------- Mutações: itens -------------------------- */

async function criarItem(dados) {
  const r = await api.call("itens.criar", dados);
  const s = store.get();
  store.set({ itens: [...s.itens, r.item] });
  persistir();
  bus.emit(EVENTOS.ITENS, { tipo: "criado" });
  return r.item;
}

async function atualizarItem(id, dados) {
  const r = await api.call("itens.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    itens: s.itens.map((i) => (String(i.id) === String(id) ? r.item : i)),
  });
  persistir();
  bus.emit(EVENTOS.ITENS, { tipo: "atualizado" });
  return r.item;
}

async function removerItem(id) {
  await api.call("itens.remover", { id });
  const s = store.get();
  store.set({ itens: s.itens.filter((i) => String(i.id) !== String(id)) });
  persistir();
  bus.emit(EVENTOS.ITENS, { tipo: "removido" });
}

/* ----------------------- Mutações: cotações -------------------------- */

async function criarCotacao(dados) {
  const r = await api.call("cotacoes.criar", dados);
  const s = store.get();
  store.set({
    cotacoes: [r.cotacao, ...s.cotacoes],
  });
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "criada" });
  return r.cotacao;
}

async function atualizarCotacao(id, dados) {
  const r = await api.call("cotacoes.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    cotacoes: s.cotacoes.map((c) => (String(c.id) === String(id) ? r.cotacao : c)),
  });
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "atualizada" });
  return r.cotacao;
}

async function removerCotacao(id) {
  await api.call("cotacoes.remover", { id });
  const s = store.get();
  const historico = { ...s.historicoPorCotacao };
  delete historico[id];
  store.set({
    cotacoes: s.cotacoes.filter((c) => String(c.id) !== String(id)),
    ofertas: s.ofertas.filter((p) => String(p.cotacao_id) !== String(id)),
    historicoPorCotacao: historico,
  });
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "removida" });
}

/* ----------------------- Mutações: orçamentos ------------------------ */

async function criarOrcamento(dados) {
  const r = await api.call("orcamentos.criar", dados);
  const s = store.get();
  store.set({ orcamentos: [r.orcamento, ...s.orcamentos] });
  persistir();
  bus.emit(EVENTOS.ORCAMENTOS, { tipo: "criado" });
  return r.orcamento;
}

async function atualizarOrcamento(id, dados) {
  const r = await api.call("orcamentos.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    orcamentos: s.orcamentos.map((o) => (String(o.id) === String(id) ? r.orcamento : o)),
  });
  // O contato pode ter sido propagado às ofertas no servidor → refresh em 2º plano.
  atualizarEmSegundoPlano();
  persistir();
  bus.emit(EVENTOS.ORCAMENTOS, { tipo: "atualizado" });
  return r.orcamento;
}

async function removerOrcamento(id) {
  await api.call("orcamentos.remover", { id });
  const s = store.get();
  // Remove o orçamento e desvincula suas ofertas do cache local.
  store.set({
    orcamentos: s.orcamentos.filter((o) => String(o.id) !== String(id)),
    ofertas: s.ofertas.filter((p) => String(p.orcamento_id) !== String(id)),
  });
  persistir();
  bus.emit(EVENTOS.ORCAMENTOS, { tipo: "removido" });
}

/* ----------------------- Mutações: equipes --------------------------- */

async function criarEquipe(dados) {
  const r = await api.call("equipes.criar", dados);
  const s = store.get();
  store.set({ equipes: [r.equipe, ...s.equipes] });
  persistir();
  bus.emit(EVENTOS.EQUIPES, { tipo: "criada" });
  return r.equipe;
}

async function atualizarEquipe(id, dados) {
  const r = await api.call("equipes.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    equipes: s.equipes.map((e) => (String(e.id) === String(id) ? r.equipe : e)),
  });
  persistir();
  bus.emit(EVENTOS.EQUIPES, { tipo: "atualizada" });
  return r.equipe;
}

async function removerEquipe(id) {
  await api.call("equipes.remover", { id });
  const s = store.get();
  store.set({ equipes: s.equipes.filter((e) => String(e.id) !== String(id)) });
  persistir();
  bus.emit(EVENTOS.EQUIPES, { tipo: "removida" });
}

/** Acrescenta um ponto ao histórico de uma cotação (write-through local). */
function _appendHistorico(cotacaoId, ponto) {
  if (!ponto) return;
  const s = store.get();
  store.set({
    historicoPorCotacao: {
      ...s.historicoPorCotacao,
      [cotacaoId]: [...(s.historicoPorCotacao[cotacaoId] || []), ponto],
    },
  });
}

/* ------------------- Mutações: ofertas (lista plana) ----------------- */

/** Substitui (por id) ou adiciona uma oferta na lista plana. */
function _mesclarOferta(preco) {
  if (!preco) return;
  const s = store.get();
  const existe = s.ofertas.some((p) => String(p.id) === String(preco.id));
  store.set({
    ofertas: existe
      ? s.ofertas.map((p) => (String(p.id) === String(preco.id) ? preco : p))
      : [preco, ...s.ofertas],
  });
}

/** Mescla uma lista de ofertas (resposta do servidor) por id. */
function _mesclarOfertas(lista) {
  if (!Array.isArray(lista) || !lista.length) return;
  const s = store.get();
  const porId = {};
  lista.forEach((p) => (porId[String(p.id)] = p));
  const atual = s.ofertas.map((p) => porId[String(p.id)] || p);
  lista.forEach((p) => {
    if (!s.ofertas.some((x) => String(x.id) === String(p.id))) atual.unshift(p);
  });
  store.set({ ofertas: atual });
}

/** Criar oferta (universal): `dados` traz item_id (+ cotacao_id?/orcamento_id?/...). */
async function criarOferta(dados) {
  const r = await api.call("cotacoes.adicionarPreco", { ...dados });
  _mesclarOferta(r.preco);
  const cotId = String((r.preco || {}).cotacao_id || "");
  if (cotId) _appendHistorico(cotId, r.historico);
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "preco-adicionado", cotacao_id: cotId });
  return r.preco;
}

/** Atualizar uma oferta. */
async function atualizarOferta(id, dados) {
  const r = await api.call("cotacoes.atualizarPreco", { id, ...dados });
  _mesclarOferta(r.preco);
  const cotId = String((r.preco || {}).cotacao_id || "");
  if (cotId) _appendHistorico(cotId, r.historico); // ponto novo só se o valor mudou
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "preco-atualizado", cotacao_id: cotId });
  return r.preco;
}

async function removerPreco(cotacaoId, id) {
  await api.call("cotacoes.removerPreco", { id });
  const s = store.get();
  store.set({ ofertas: s.ofertas.filter((p) => String(p.id) !== String(id)) });
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "preco-removido", cotacao_id: cotacaoId || "" });
}

async function escolherPreco(cotacaoId, id) {
  const r = await api.call("cotacoes.escolherPreco", { id });
  _mesclarOfertas(r.precos);
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "preco-escolhido", cotacao_id: cotacaoId });
  return r.precos;
}

/**
 * Lança a oferta como despesa na obra E marca a oferta (despesa_id) + fecha a
 * cotação (se houver) — tudo no servidor (atômico). Atualiza despesas/resumo,
 * a(s) oferta(s) e a cotação no store.
 */
async function registrarDespesaOferta(cotacaoId, precoId, obraId, categoriaId, responsaveis) {
  const r = await api.call("cotacoes.registrarDespesa", {
    preco_id: precoId,
    cotacao_id: cotacaoId,
    obra_id: obraId,
    categoria_id: categoriaId,
    responsaveis: Array.isArray(responsaveis) ? responsaveis : [],
  });
  _setDespesasObra(obraId, [r.despesa, ...despesas(obraId)], r.resumo);
  _mesclarOfertas(r.precos);
  _mesclarOferta(r.preco);
  if (r.cotacao) {
    const s = store.get();
    store.set({
      cotacoes: s.cotacoes.map((c) => (String(c.id) === String(r.cotacao.id) ? r.cotacao : c)),
    });
  }
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "criada", obra_id: obraId });
  bus.emit(EVENTOS.COTACOES, { tipo: "registrada", cotacao_id: cotacaoId || "" });
  return r;
}

/**
 * Registra o ORÇAMENTO COMPLETO: todas as ofertas ainda não registradas viram
 * despesas na obra (reusa registrarDespesaOferta por oferta — sequencial). A
 * subclassificação vem do item (servidor) e a mesma responsabilidade é aplicada
 * a todas. Retorna { total, despesas }.
 */
async function registrarOrcamentoCompleto(orcId, obraId, responsaveis) {
  const ofertas = ofertasDoOrcamento(orcId).filter((p) => !String(p.despesa_id || ""));
  const despesasCriadas = [];
  for (const oferta of ofertas) {
    const r = await registrarDespesaOferta(oferta.cotacao_id || "", oferta.id, obraId, "", responsaveis);
    despesasCriadas.push(r.despesa);
  }
  return { total: despesasCriadas.length, despesas: despesasCriadas };
}

/* ----------------------- Mutações: admin ----------------------------- */

async function adminCriarUsuario(dados) {
  const r = await api.call("admin.usuarios.criar", dados);
  const s = store.get();
  store.set({ usuarios: [...s.usuarios, r.usuario] });
  persistir();
  return r.usuario;
}

async function adminAtualizarUsuario(dados) {
  const r = await api.call("admin.usuarios.atualizar", dados);
  const s = store.get();
  store.set({
    usuarios: s.usuarios.map((u) => (String(u.id) === String(r.usuario.id) ? r.usuario : u)),
  });
  persistir();
  return r.usuario;
}

/* ------------------------------ Export ------------------------------- */

export const dataStore = {
  subscribe: store.subscribe,
  get,
  carregado,
  restaurarCache,
  inicializar,
  atualizarEmSegundoPlano,
  limparCache,
  // getters
  usuario, config, categorias, categoriasItem, categoriasFornecedor, usuarios, obras, obra, despesas, todasDespesas, resumo, categoriasDaObra,
  participantesDaObra,
  fornecedores, fornecedoresAtivos, contatos, contatosAtivos, cargos, itens, itensAtivos, item,
  cotacoes, cotacao, precosDaCotacao, todasOfertas,
  historicoDaCotacao, itensDaSubclasse, precosDaCotacaoPorItem,
  orcamentos, orcamento, ofertasDoOrcamento,
  equipes, equipe, equipesDoContato, equipesDaObra,
  ofertasDoContato, ofertasDoFornecedor, ofertasDoItem, ofertasDaObra,
  despesasDoContato, despesasDoFornecedor, despesasDoItem, despesasDaEquipe,
  pagamentos, repasses, pagamentosDaDespesa, pagamentosDoContato, pagamentosDaObra,
  repassesDoPagamento, repassesDoContato, despesaTemPagamento,
  transferencias, transferencia, transferenciasDaObra, transferenciaDoPagamento, pagamentosDaTransferencia,
  // mutações
  criarObra, atualizarObra, removerObra,
  adicionarParticipante, removerParticipante, definirResponsavel,
  gerarLinkPublico, removerLinkPublico,
  adicionarDespesa, atualizarDespesa, removerDespesa, lancarPagamento, removerPagamento,
  lancarPagamentoMulti, removerPagamentoV2, excluirPagamento, lancarRepasse, removerRepasse,
  lancarTransferencia, removerTransferencia, excluirTransferencia,
  criarCategoria, atualizarCategoria, removerCategoria,
  criarFornecedor, atualizarFornecedor, removerFornecedor,
  criarContato, atualizarContato, removerContato,
  criarCargo, atualizarCargo, removerCargo,
  criarItem, atualizarItem, removerItem,
  criarCotacao, atualizarCotacao, removerCotacao,
  criarOferta, atualizarOferta, removerPreco, escolherPreco, registrarDespesaOferta,
  registrarOrcamentoCompleto,
  criarOrcamento, atualizarOrcamento, removerOrcamento,
  criarEquipe, atualizarEquipe, removerEquipe,
  adminCriarUsuario, adminAtualizarUsuario,
};
