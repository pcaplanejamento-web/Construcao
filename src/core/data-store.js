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
  const r = await api.call("despesas.atualizar", { id, ...dados });
  const lista = despesas(obraId).map((d) => (String(d.id) === String(id) ? r.despesa : d));
  _setDespesasObra(obraId, lista, r.resumo);
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada", obra_id: obraId });
  return r.despesa;
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
  // mutações
  criarObra, atualizarObra, removerObra,
  gerarLinkPublico, removerLinkPublico,
  adicionarDespesa, atualizarDespesa, removerDespesa,
  criarCategoria, atualizarCategoria, removerCategoria,
  adminCriarUsuario, adminAtualizarUsuario,
};
