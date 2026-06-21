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

const CACHE_VERSAO = 1;

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
  precosPorCotacao: {}, // cotacaoId -> [oferta]
  historicoPorCotacao: {}, // cotacaoId -> [ponto de histórico de preço]
  orcamentos: [], // módulo Compras (containers de ofertas)
  equipes: [], // grupos (líder + membros + obras)
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
      precosPorCotacao: s.precosPorCotacao,
      historicoPorCotacao: s.historicoPorCotacao,
      orcamentos: s.orcamentos,
      equipes: s.equipes,
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
    precosPorCotacao: d.precosPorCotacao || {},
    historicoPorCotacao: d.historicoPorCotacao || {},
    orcamentos: d.orcamentos || [],
    equipes: d.equipes || [],
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
const resumo = (obraId) => store.get().resumos[obraId] || { total: 0, qtd: 0, orcamento: 0, saldo: 0, por_categoria: [] };
const categoriasDaObra = (obraId) => store.get().categoriasPorObra[obraId] || store.get().categorias;
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
const precosDaCotacao = (cotacaoId) => store.get().precosPorCotacao[cotacaoId] || [];
const historicoDaCotacao = (cotacaoId) => store.get().historicoPorCotacao[cotacaoId] || [];
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
/** Ofertas de um orçamento: achata precosPorCotacao e filtra orcamento_id. */
const ofertasDoOrcamento = (orcId) => {
  const mapa = store.get().precosPorCotacao;
  const out = [];
  Object.keys(mapa).forEach((cotId) => {
    (mapa[cotId] || []).forEach((p) => {
      if (String(p.orcamento_id) === String(orcId)) out.push(p);
    });
  });
  return out;
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
    persistir();
    bus.emit(EVENTOS.DESPESAS, { tipo: "removida", obra_id: obraId });
  } catch (e) {
    _setDespesasObra(obraId, backup);
    throw e;
  }
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
    precosPorCotacao: { ...s.precosPorCotacao, [r.cotacao.id]: [] },
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
  const precos = { ...s.precosPorCotacao };
  delete precos[id];
  const historico = { ...s.historicoPorCotacao };
  delete historico[id];
  store.set({
    cotacoes: s.cotacoes.filter((c) => String(c.id) !== String(id)),
    precosPorCotacao: precos,
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
  // Remove o orçamento e desvincula/remove suas ofertas do cache local.
  const precos = {};
  Object.keys(s.precosPorCotacao).forEach((cotId) => {
    precos[cotId] = (s.precosPorCotacao[cotId] || []).filter((p) => String(p.orcamento_id) !== String(id));
  });
  store.set({
    orcamentos: s.orcamentos.filter((o) => String(o.id) !== String(id)),
    precosPorCotacao: precos,
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

/* ------------------- Mutações: ofertas (preços) ---------------------- */

async function adicionarPreco(cotacaoId, dados) {
  const r = await api.call("cotacoes.adicionarPreco", { cotacao_id: cotacaoId, ...dados });
  const s = store.get();
  store.set({
    precosPorCotacao: {
      ...s.precosPorCotacao,
      [cotacaoId]: [r.preco, ...(s.precosPorCotacao[cotacaoId] || [])],
    },
  });
  _appendHistorico(cotacaoId, r.historico);
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "preco-adicionado", cotacao_id: cotacaoId });
  return r.preco;
}

async function atualizarPreco(cotacaoId, id, dados) {
  const r = await api.call("cotacoes.atualizarPreco", { id, ...dados });
  const s = store.get();
  store.set({
    precosPorCotacao: {
      ...s.precosPorCotacao,
      [cotacaoId]: (s.precosPorCotacao[cotacaoId] || []).map((p) =>
        String(p.id) === String(id) ? r.preco : p
      ),
    },
  });
  _appendHistorico(cotacaoId, r.historico); // ponto novo só se o valor mudou
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "preco-atualizado", cotacao_id: cotacaoId });
  return r.preco;
}

async function removerPreco(cotacaoId, id) {
  await api.call("cotacoes.removerPreco", { id });
  const s = store.get();
  store.set({
    precosPorCotacao: {
      ...s.precosPorCotacao,
      [cotacaoId]: (s.precosPorCotacao[cotacaoId] || []).filter((p) => String(p.id) !== String(id)),
    },
  });
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "preco-removido", cotacao_id: cotacaoId });
}

async function escolherPreco(cotacaoId, id) {
  const r = await api.call("cotacoes.escolherPreco", { id });
  const s = store.get();
  store.set({
    precosPorCotacao: { ...s.precosPorCotacao, [cotacaoId]: r.precos },
  });
  persistir();
  bus.emit(EVENTOS.COTACOES, { tipo: "preco-escolhido", cotacao_id: cotacaoId });
  return r.precos;
}

/**
 * Lança a oferta como despesa na obra E marca a oferta (despesa_id) + fecha a
 * cotação — tudo no servidor (atômico). Atualiza despesas/resumo, ofertas e a
 * cotação no store.
 */
async function registrarDespesaOferta(cotacaoId, precoId, obraId, categoriaId) {
  const r = await api.call("cotacoes.registrarDespesa", {
    preco_id: precoId,
    cotacao_id: cotacaoId,
    obra_id: obraId,
    categoria_id: categoriaId,
  });
  // Despesa criada na obra (com resumo recalculado pelo servidor).
  _setDespesasObra(obraId, [r.despesa, ...despesas(obraId)], r.resumo);
  // Ofertas (escolhido + despesa_id) e cotação (status fechada) atualizadas.
  const s = store.get();
  store.set({
    precosPorCotacao: { ...s.precosPorCotacao, [cotacaoId]: r.precos },
    cotacoes: s.cotacoes.map((c) => (String(c.id) === String(cotacaoId) ? r.cotacao : c)),
  });
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "criada", obra_id: obraId });
  bus.emit(EVENTOS.COTACOES, { tipo: "registrada", cotacao_id: cotacaoId });
  return r;
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
  usuario, config, categorias, usuarios, obras, obra, despesas, resumo, categoriasDaObra,
  participantesDaObra,
  fornecedores, fornecedoresAtivos, contatos, contatosAtivos, cargos, itens, itensAtivos, item,
  cotacoes, cotacao, precosDaCotacao,
  historicoDaCotacao,
  orcamentos, orcamento, ofertasDoOrcamento,
  equipes, equipe, equipesDoContato, equipesDaObra,
  // mutações
  criarObra, atualizarObra, removerObra,
  adicionarParticipante, removerParticipante, definirResponsavel,
  gerarLinkPublico, removerLinkPublico,
  adicionarDespesa, atualizarDespesa, removerDespesa,
  criarCategoria, atualizarCategoria, removerCategoria,
  criarFornecedor, atualizarFornecedor, removerFornecedor,
  criarContato, atualizarContato, removerContato,
  criarCargo, atualizarCargo, removerCargo,
  criarItem, atualizarItem, removerItem,
  criarCotacao, atualizarCotacao, removerCotacao,
  adicionarPreco, atualizarPreco, removerPreco, escolherPreco, registrarDespesaOferta,
  criarOrcamento, atualizarOrcamento, removerOrcamento,
  criarEquipe, atualizarEquipe, removerEquipe,
  adminCriarUsuario, adminAtualizarUsuario,
};
