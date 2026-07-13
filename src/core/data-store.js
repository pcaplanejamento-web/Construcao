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
import { fecharCompartilhado } from "../features/shared/compartilhamento-closure.js";
import { pagamentosSemTransferencia } from "../features/pagamentos/transferencia-regra.js";
import { api } from "./api-client.js";
import { auth } from "./auth-store.js";
import { bus, EVENTOS, toastAviso, toastInfo } from "./event-bus.js";
import { obraIdDaOferta } from "../features/shared/rastreabilidade.js";
import {
  consolidarObra as _consolidarObraEstoque,
  emEstoqueDaObra as _emEstoqueDaObra,
  consumidosDaObra as _consumidosDaObra,
  saldoItem as _saldoItemEstoque,
  origensDoItem as _origensDoItemEstoque,
} from "../features/estoque/estoque.js";

const CACHE_VERSAO = 7; // bump: coleção notas (anotações por obra)

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
  notas: {}, // obraId -> [nota] (anotações compartilhadas da obra)
  fornecedores: [], // módulo Compras (empresas/lojas do usuário)
  contatos: [], // módulo Compras (pessoas do usuário)
  cargos: [], // cargos de contatos (fixos + extras do usuário)
  tiposTransferencia: [], // tipos de transferência (base fixos + extras do usuário)
  itens: [], // catálogo de itens (cada um Material ou Serviço)
  cotacoes: [], // módulo Compras (necessidades a cotar)
  ofertas: [], // módulo Compras — LISTA PLANA de ofertas (oferta independente da cotação)
  historicoPorCotacao: {}, // cotacaoId -> [ponto de histórico de preço]
  orcamentos: [], // módulo Compras (containers de ofertas)
  equipes: [], // grupos (líder + membros + obras)
  transferencias: [], // transferências (agrupam N pagamentos de 1 recebedor/empresa)
  pagamentos: [], // pagamentos (entidade própria; 1 pagamento → várias despesas)
  repasses: [], // repasses de um pagamento a outros contatos
  estoque: [], // livro-razão de movimentos de estoque (consolidação derivada por obra+item)
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
      notas: s.notas,
      fornecedores: s.fornecedores,
      contatos: s.contatos,
      cargos: s.cargos,
      tiposTransferencia: s.tiposTransferencia,
      itens: s.itens,
      cotacoes: s.cotacoes,
      ofertas: s.ofertas,
      historicoPorCotacao: s.historicoPorCotacao,
      orcamentos: s.orcamentos,
      equipes: s.equipes,
      transferencias: s.transferencias,
      pagamentos: s.pagamentos,
      repasses: s.repasses,
      estoque: s.estoque,
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
    notas: d.notasPorObra || {},
    fornecedores: d.fornecedores || [],
    contatos: d.contatos || [],
    cargos: d.cargos || [],
    tiposTransferencia: d.tiposTransferencia || [],
    itens: d.itens || [],
    cotacoes: d.cotacoes || [],
    ofertas: d.ofertas || [],
    historicoPorCotacao: d.historicoPorCotacao || {},
    orcamentos: d.orcamentos || [],
    equipes: d.equipes || [],
    transferencias: d.transferencias || [],
    pagamentos: d.pagamentos || [],
    repasses: d.repasses || [],
    estoque: d.estoque || [],
    usuarios: d.usuarios || [],
  });
  persistir();
}

/** Carrega tudo (carregamento inicial). */
async function inicializar() {
  const d = await api.call("dados.snapshot");
  _aplicarSnapshot(d);
}

/**
 * Atualiza o cache silenciosamente (refresh em 2º plano). Se o refresh FALHA
 * (sem rede), avisa UMA vez que os dados exibidos podem estar desatualizados; ao
 * voltar, avisa que a conexão foi restabelecida. Só notifica nas TRANSIÇÕES
 * (não a cada tentativa) — o app segue usável com o cache.
 */
let _semConexao = false;
async function atualizarEmSegundoPlano() {
  try {
    const d = await api.call("dados.snapshot");
    _aplicarSnapshot(d);
    if (_semConexao) { _semConexao = false; toastInfo("Conexão restabelecida."); }
  } catch (e) {
    if (!_semConexao) { _semConexao = true; toastAviso("Sem conexão — mostrando os dados salvos."); }
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
/** Categorias de ITEM (tipo != fornecedor; inclui legado sem tipo). */
const categoriasItem = () => store.get().categorias.filter((c) => String(c.tipo || "") !== "fornecedor");
/** Classificações de FORNECEDOR (tipo == fornecedor). */
const categoriasFornecedor = () => store.get().categorias.filter((c) => String(c.tipo || "") === "fornecedor");
const participantesDaObra = (obraId) => store.get().participantesPorObra[obraId] || [];
/** Nome de um usuário por id — via participantes das obras (nome desnormalizado)
 *  ou `usuarios()` (admin). Resolve o pagador/dono `"u:<id>"` de QUALQUER usuário
 *  (antes só o logado), inclusive p/ o convidado ver o nome do dono. */
const usuarioNome = (id) => {
  const sid = String(id || "");
  if (!sid) return "";
  const pp = store.get().participantesPorObra || {};
  for (const k of Object.keys(pp)) {
    const p = (pp[k] || []).find((x) => String(x.chave || "") === "u:" + sid);
    if (p && p.nome) return p.nome;
  }
  const u = (store.get().usuarios || []).find((x) => String(x.id) === sid);
  return (u && u.nome) || "";
};
/** Notas (anotações compartilhadas) da obra, mais recentes primeiro. */
const notasDaObra = (obraId) =>
  [...((store.get().notas || {})[obraId] || [])].sort((a, b) =>
    String(b.atualizado_em).localeCompare(String(a.atualizado_em))
  );
// Módulo Compras
const fornecedores = () => store.get().fornecedores;
const fornecedoresAtivos = () => store.get().fornecedores.filter((f) => f.ativo !== false);
const contatos = () => store.get().contatos;
const contatosAtivos = () => store.get().contatos.filter((c) => c.ativo !== false);
const cargos = () => store.get().cargos;
/** Tipos de transferência (base + extras); nomes p/ os selects. */
const tiposTransferencia = () => {
  const lista = store.get().tiposTransferencia || [];
  return lista.length ? lista : ["dinheiro", "crédito", "débito", "boleto"].map((n) => ({ id: "builtin:" + n, nome: n, fixo: true }));
};
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
/** Itens (ativos) de uma categoria (categoria tipo item). */
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

// --- Compartilhamento -------------------------------------------------------
// O snapshot inclui as entidades REFERENCIADAS por obras compartilhadas (para
// resolver nomes/valores nas telas da obra). Cada linha traz `usuario_id`, então
// aqui separamos o que é MEU do que veio de uma obra compartilhada. As telas da
// obra e os dropdowns seguem usando os getters completos (resolvem por id); só as
// LISTAS pessoais (aba "Compartilhados") usam estes.
const _meuId = () => String((store.get().usuario || {}).id || "");
const _ehMeu = (x) => !x || !x.usuario_id || String(x.usuario_id) === _meuId();
const _ehCompart = (x) => !!(x && x.usuario_id && String(x.usuario_id) !== _meuId());
const meusContatosAtivos = () => contatosAtivos().filter(_ehMeu);
const contatosCompartilhados = () => contatos().filter(_ehCompart);
const meusFornecedoresAtivos = () => fornecedoresAtivos().filter(_ehMeu);
const fornecedoresCompartilhados = () => fornecedores().filter(_ehCompart);
const meusItensAtivos = () => itensAtivos().filter(_ehMeu);
const itensCompartilhados = () => itens().filter(_ehCompart);

/** Obras COMPARTILHADAS comigo (não sou o dono). */
const obrasCompartilhadas = () => obras().filter((o) => o.ehDono === false);
/**
 * Dados COMPARTILHADOS referenciados por UMA obra, por tipo — para a aba
 * "Compartilhados" organizada por obra (o usuário analisa cada compartilhamento).
 * Só entidades que NÃO são minhas (usuario_id ≠ eu) e que a obra referencia.
 */
const compartilhadoDaObra = (obraId) => {
  const meu = _meuId();
  const share = (x) => !!(x && x.usuario_id && String(x.usuario_id) !== meu && String(x.usuario_id) !== "GLOBAL");
  const oid = String(obraId);
  const desp = despesas(obraId);
  const parts = participantesDaObra(obraId);
  const transf = transferencias().filter((t) => String(t.obra_id) === oid);
  const pags = pagamentos().filter((p) => String(p.obra_id) === oid);
  const orcs = orcamentos().filter((o) => String(o.obra_id) === oid);
  const orcIds = new Set(orcs.map((o) => String(o.id)));
  const precoIds = new Set(desp.map((d) => String(d.preco_id || "")).filter(Boolean));
  const ofertasObra = todasOfertas().filter(
    (p) => String(p.obra_id) === oid || precoIds.has(String(p.id)) || orcIds.has(String(p.orcamento_id || ""))
  );
  const cotIds = new Set(ofertasObra.map((p) => String(p.cotacao_id || "")).filter(Boolean));
  const cots = cotacoes().filter((c) => String(c.obra_id) === oid || cotIds.has(String(c.id)));

  // SEMENTES (refs diretas, incluindo os campos antes ignorados: equipe/categoria).
  const cSeed = new Set(), fSeed = new Set(), iSeed = new Set(), eSeed = new Set(), catSeed = new Set();
  const addCh = (ch) => {
    const s = String(ch || "");
    if (s.indexOf("c:") === 0) cSeed.add(s.slice(2));
    else if (s.indexOf("e:") === 0) eSeed.add(s.slice(2));
  };
  parts.forEach((p) => addCh(p.chave));
  desp.forEach((d) => {
    if (d.item_id) iSeed.add(String(d.item_id));
    if (d.fornecedor_id) fSeed.add(String(d.fornecedor_id));
    if (d.ofertante_contato_id) cSeed.add(String(d.ofertante_contato_id));
    if (d.ofertante_equipe_id) eSeed.add(String(d.ofertante_equipe_id));
    if (d.categoria_id) catSeed.add(String(d.categoria_id));
    (d.responsaveis || []).forEach((r) => addCh(r.chave));
    (d.pagamentos || []).forEach((p) => addCh(p.chave));
    (d.pagamentos_realizados || []).forEach((lv) => {
      if (lv.contato_id) cSeed.add(String(lv.contato_id));
      if (lv.fornecedor_id) fSeed.add(String(lv.fornecedor_id));
      addCh(lv.pagador);
      (lv.distribuicao || []).forEach((x) => addCh(x.chave));
    });
  });
  transf.concat(pags).forEach((t) => {
    if (t.fornecedor_id) fSeed.add(String(t.fornecedor_id));
    if (t.recebedor_contato_id) cSeed.add(String(t.recebedor_contato_id));
    if (t.recebedor_equipe_id) eSeed.add(String(t.recebedor_equipe_id));
    addCh(t.pagador_chave);
  });
  repasses().filter((r) => String(r.obra_id) === oid).forEach((r) => {
    if (r.recebedor_contato_id) cSeed.add(String(r.recebedor_contato_id));
    (r.contatos_repassados || []).forEach((cid) => cSeed.add(String(cid)));
  });
  ofertasObra.forEach((p) => {
    if (p.item_id) iSeed.add(String(p.item_id));
    if (p.fornecedor_id) fSeed.add(String(p.fornecedor_id));
    if (p.contato_id) cSeed.add(String(p.contato_id));
    if (p.equipe_id) eSeed.add(String(p.equipe_id));
  });
  orcs.forEach((o) => {
    if (o.fornecedor_id) fSeed.add(String(o.fornecedor_id));
    if (o.contato_id) cSeed.add(String(o.contato_id));
    if (o.equipe_id) eSeed.add(String(o.equipe_id));
  });
  cots.forEach((c) => {
    if (c.item_id) iSeed.add(String(c.item_id));
    if (c.categoria_id) catSeed.add(String(c.categoria_id));
  });

  // FECHAMENTO TRANSITIVO (mapas p/ lookup O(1)).
  const mapC = new Map(contatos().map((x) => [String(x.id), x]));
  const mapF = new Map(fornecedores().map((x) => [String(x.id), x]));
  const mapI = new Map(itens().map((x) => [String(x.id), x]));
  const mapE = new Map(equipes().map((x) => [String(x.id), x]));
  const fechado = fecharCompartilhado(
    { c: cSeed, f: fSeed, i: iSeed, e: eSeed, cat: catSeed },
    { contato: (id) => mapC.get(String(id)) || null, fornecedor: (id) => mapF.get(String(id)) || null,
      item: (id) => mapI.get(String(id)) || null, equipe: (id) => mapE.get(String(id)) || null }
  );

  const cats = categorias().filter((c) => fechado.categorias.has(String(c.id)) && share(c));
  return {
    contatos: contatos().filter((c) => fechado.contatos.has(String(c.id)) && share(c)),
    fornecedores: fornecedores().filter((f) => fechado.fornecedores.has(String(f.id)) && share(f)),
    itens: itens().filter((i) => fechado.itens.has(String(i.id)) && share(i)),
    equipes: equipes().filter((e) => fechado.equipes.has(String(e.id)) && share(e)),
    cargos: cargos().filter((cg) => cg && cg.nome && fechado.cargos.has(String(cg.nome).trim().toLowerCase()) && share(cg)),
    categoriasItem: cats.filter((c) => String(c.tipo || "") !== "fornecedor"),
    categoriasFornecedor: cats.filter((c) => String(c.tipo || "") === "fornecedor"),
    ofertas: ofertasObra.filter(share),
    orcamentos: orcs.filter(share),
    cotacoes: cots.filter(share),
  };
};

/**
 * Dados DA OBRA (ofertas/cotações/orçamentos com `obra_id` = obraId), de TODOS os
 * criadores (dono + colaboradores). A obra "vive sozinha": esses itens pertencem
 * à obra, não ao usuário — usados na aba "Das obras" com "Salvar nos meus dados".
 * Diferente de `compartilhadoDaObra` (que filtra por `usuario_id !== me`).
 */
const dadosDaObra = (obraId) => {
  const oid = String(obraId);
  const desp = despesas(obraId);
  const precoIds = new Set(desp.map((d) => String(d.preco_id || "")).filter(Boolean));
  const ofertas = todasOfertas().filter((o) => String(o.obra_id || "") === oid || precoIds.has(String(o.id)));
  const cots = cotacoes().filter((c) => String(c.obra_id || "") === oid);
  const orcs = orcamentos().filter((o) => String(o.obra_id || "") === oid);
  return { ofertas, cotacoes: cots, orcamentos: orcs };
};

/** Há ≥1 item de `chave` ("ofertas"|"cotacoes"|"orcamentos") em alguma obra acessível? */
const temDadosDeObraDeTipo = (chave) =>
  obras().some((o) => ((dadosDaObra(o.id) || {})[chave] || []).length > 0);

/**
 * O usuário JÁ tem uma cópia PESSOAL equivalente deste item de CATÁLOGO
 * compartilhado? (usado para desativar o botão "Incorporar" → "Incorporado", para
 * não incorporar 2×). Casa por NOME (case-insensitive) + discriminador do tipo
 * (telefone/classificação/tipo). Espelha o dedupe do backend.
 */
const jaIncorporado = (tipo, x) => {
  if (!x) return false;
  const meu = _meuId();
  const nrm = (s) => String(s == null ? "" : s).trim().toLowerCase();
  const nomeIgual = (a, b) => nrm(a) !== "" && nrm(a) === nrm(b);
  const meus = (arr) => arr.filter((y) => y && String(y.usuario_id || "") === meu);
  const minhasCats = () =>
    categorias().filter((c) => String(c.usuario_id || "") === meu || String(c.usuario_id || "") === "GLOBAL");
  switch (tipo) {
    case "contato":
      return meus(contatosAtivos()).some((c) => nomeIgual(c.nome, x.nome) && nrm(c.telefone) === nrm(x.telefone));
    case "fornecedor":
      return meus(fornecedoresAtivos()).some((f) => nomeIgual(f.nome, x.nome));
    case "item":
      return meus(itensAtivos()).some((i) => nomeIgual(i.nome, x.nome) && nrm(i.classificacao) === nrm(x.classificacao));
    case "equipe":
      return meus(equipes()).some((e) => nomeIgual(e.nome, x.nome));
    case "cargo":
      return cargos().filter((cg) => cg.fixo || String(cg.usuario_id || "") === meu).some((cg) => nomeIgual(cg.nome, x.nome));
    case "categoria-item":
      return minhasCats().some((c) => nomeIgual(c.nome, x.nome) && nrm(c.tipo) !== "fornecedor");
    case "categoria-fornecedor":
      return minhasCats().some((c) => nomeIgual(c.nome, x.nome) && nrm(c.tipo) === "fornecedor");
    default:
      return false; // oferta/cotação/orçamento (escopo=obra) não bloqueiam (dedupe no backend)
  }
};

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
  // Só sintetiza transferência p/ pagamento SEM transferência real (dedup nos dois
  // sentidos: p.transferencia_id E o reverso t.pagamento_ids) — senão a transferência
  // ficava "replicada com o pagamento" (bug). `pagamentosSemTransferencia` é pura/testada.
  const sint = pagamentosSemTransferencia(reais, pagamentos()).map(_transferenciaDePagamento);
  return reais.concat(sint);
};
/* -------------------------- Estoque (getters) ------------------------- */
// Livro-razão de movimentos; a "lista do estoque" e os "consumidos" são derivados.
const movimentosEstoque = () => store.get().estoque || [];
const estoqueConsolidadoDaObra = (obraId) => _consolidarObraEstoque(movimentosEstoque(), obraId);
const estoqueDaObra = (obraId) => _emEstoqueDaObra(movimentosEstoque(), obraId);
const estoqueConsumidoDaObra = (obraId) => _consumidosDaObra(movimentosEstoque(), obraId);
const saldoEstoqueItem = (obraId, itemId) => _saldoItemEstoque(movimentosEstoque(), obraId, itemId);
const origensDoEstoque = (obraId, itemId) => _origensDoItemEstoque(movimentosEstoque(), obraId, itemId);
const movimentosDoItemEstoque = (obraId, itemId) =>
  movimentosEstoque().filter(
    (m) => String(m.obra_id) === String(obraId) && String(m.item_id) === String(itemId)
  );

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

/* -------------------------- Notas da obra ---------------------------- */

function _setNotas(obraId, lista) {
  const s = store.get();
  store.set({ notas: { ...(s.notas || {}), [obraId]: lista } });
}

async function adicionarNota(obraId, dados) {
  const r = await api.call("notas.criar", {
    obra_id: obraId, titulo: dados.titulo, texto: dados.texto, cor: dados.cor || "",
  });
  _setNotas(obraId, [r.nota, ...notasDaObra(obraId)]);
  persistir();
  bus.emit(EVENTOS.NOTAS, { tipo: "criada", obra_id: obraId });
  return r.nota;
}

async function atualizarNota(obraId, id, dados) {
  const r = await api.call("notas.atualizar", {
    id, titulo: dados.titulo, texto: dados.texto, cor: dados.cor || "",
  });
  _setNotas(
    obraId,
    notasDaObra(obraId).map((n) => (String(n.id) === String(id) ? r.nota : n))
  );
  persistir();
  bus.emit(EVENTOS.NOTAS, { tipo: "atualizada", obra_id: obraId });
  return r.nota;
}

async function removerNota(obraId, id) {
  await api.call("notas.remover", { id });
  _setNotas(obraId, notasDaObra(obraId).filter((n) => String(n.id) !== String(id)));
  persistir();
  bus.emit(EVENTOS.NOTAS, { tipo: "removida", obra_id: obraId });
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

/** Anexa/substitui o comprovante de uma transferência (Drive); atualiza-a no store. */
async function anexarComprovanteTransferencia(id, comprovante) {
  const r = await api.call("transferencias.anexarComprovante", { id, comprovante });
  _substituirTransferencia(r.transferencia);
  return r.transferencia;
}

/** Remove o comprovante de uma transferência (e o arquivo no Drive). */
async function removerComprovanteTransferencia(id) {
  const r = await api.call("transferencias.removerComprovante", { id });
  _substituirTransferencia(r.transferencia);
  return r.transferencia;
}

/** Substitui a transferência (por id) no store + persiste + emite. */
function _substituirTransferencia(t) {
  if (!t) return;
  const s = store.get();
  store.set({
    transferencias: (s.transferencias || []).map((x) => (String(x.id) === String(t.id) ? t : x)),
  });
  persistir();
  bus.emit(EVENTOS.DESPESAS, { tipo: "atualizada" });
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

/* ---------------------------- Estoque (mutações) ---------------------------- */

/** Aplica os movimentos novos devolvidos pelo backend ao livro-razão local. */
function _aplicarMovimentosEstoque(movimentos) {
  const novos = (movimentos || []).filter(Boolean);
  if (!novos.length) return;
  store.set({ estoque: [...novos, ...(store.get().estoque || [])] });
  persistir();
  bus.emit(EVENTOS.ESTOQUE, { tipo: "movimento" });
}

/** REDUZIR (consumir) um item do estoque → vai para Consumidos. */
async function consumirEstoque(dados) {
  const r = await api.call("estoque.criarMovimento", { ...dados, acao: "consumir" });
  _aplicarMovimentosEstoque(r.movimentos);
  return r;
}

/** AUMENTAR (devolver) → volta dos Consumidos para o estoque. */
async function devolverEstoque(dados) {
  const r = await api.call("estoque.criarMovimento", { ...dados, acao: "devolver" });
  _aplicarMovimentosEstoque(r.movimentos);
  return r;
}

/** Adiciona estoque MANUAL (sem despesa) — escolhe um item cadastrado (item 15). */
async function adicionarEstoqueManual(dados) {
  const r = await api.call("estoque.criarMovimento", { ...dados, acao: "manual" });
  _aplicarMovimentosEstoque(r.movimentos);
  return r;
}

/** TRANSFERE estoque para outra obra (item 14): saída na origem + entrada no destino. */
async function transferirEstoque(dados) {
  const r = await api.call("estoque.criarMovimento", { ...dados, acao: "transferir" });
  _aplicarMovimentosEstoque(r.movimentos);
  return r;
}

/** Remove um movimento (manual/transferência); o backend bloqueia o que não pode. */
async function removerMovimentoEstoque(id) {
  const r = await api.call("estoque.remover", { id });
  const remover = new Set((r.removidos || []).map((x) => String(x)));
  store.set({ estoque: (store.get().estoque || []).filter((m) => !remover.has(String(m.id))) });
  persistir();
  bus.emit(EVENTOS.ESTOQUE, { tipo: "removido" });
  return r;
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

/** Desfaz a exclusão (soft-delete): reativa a classificação e a recoloca no store. */
async function reativarCategoria(id) {
  const r = await api.call("categorias.atualizar", { id, ativo: true });
  const nova = r.categoria;
  const repor = (lista) => {
    const arr = lista || [];
    return arr.some((c) => String(c.id) === String(id))
      ? arr.map((c) => (String(c.id) === String(id) ? nova : c))
      : [...arr, nova];
  };
  const s = store.get();
  store.set({ categorias: repor(s.categorias) });
  _refletirCategoriasProprias(repor);
  persistir();
  bus.emit(EVENTOS.CATEGORIAS, { tipo: "reativada" });
  return nova;
}

/* -------------------- Mutações: fornecedores ------------------------- */

async function criarFornecedor(dados) {
  const r = await api.call("fornecedores.criar", dados);
  const s = store.get();
  store.set({ fornecedores: [...s.fornecedores, r.fornecedor] });
  persistir();
  bus.emit(EVENTOS.FORNECEDORES, { tipo: "criado" });
  _autoEnviarGoogle("fornecedor", r.fornecedor.id);
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
  _autoEnviarGoogle("fornecedor", id);
  return r.fornecedor;
}

async function removerFornecedor(id) {
  await api.call("fornecedores.remover", { id });
  const s = store.get();
  store.set({ fornecedores: s.fornecedores.filter((f) => String(f.id) !== String(id)) });
  persistir();
  bus.emit(EVENTOS.FORNECEDORES, { tipo: "removido" });
}

/** Desfaz a exclusão (soft-delete): reativa a empresa e a recoloca no store. */
async function reativarFornecedor(id) {
  const r = await api.call("fornecedores.atualizar", { id, ativo: true });
  const s = store.get();
  const tem = s.fornecedores.some((f) => String(f.id) === String(id));
  store.set({
    fornecedores: tem
      ? s.fornecedores.map((f) => (String(f.id) === String(id) ? r.fornecedor : f))
      : [...s.fornecedores, r.fornecedor],
  });
  persistir();
  bus.emit(EVENTOS.FORNECEDORES, { tipo: "reativado" });
  return r.fornecedor;
}

/* ----------------------- Mutações: contatos -------------------------- */

async function criarContato(dados) {
  const r = await api.call("contatos.criar", dados);
  const s = store.get();
  store.set({ contatos: [...s.contatos, r.contato] });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "criado" });
  _autoEnviarGoogle("contato", r.contato.id);
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
  _autoEnviarGoogle("contato", id);
  return r.contato;
}

async function removerContato(id) {
  await api.call("contatos.remover", { id });
  const s = store.get();
  store.set({ contatos: s.contatos.filter((c) => String(c.id) !== String(id)) });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "removido" });
}

/** Desfaz a exclusão (soft-delete): reativa o contato e o recoloca no store. */
async function reativarContato(id) {
  const r = await api.call("contatos.atualizar", { id, ativo: true });
  const s = store.get();
  const tem = s.contatos.some((c) => String(c.id) === String(id));
  store.set({
    contatos: tem
      ? s.contatos.map((c) => (String(c.id) === String(id) ? r.contato : c))
      : [...s.contatos, r.contato],
  });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "reativado" });
  return r.contato;
}

/* ------------------------- Mutações: cargos -------------------------- */

async function criarCargo(dados) {
  const r = await api.call("cargos.criar", dados);
  const s = store.get();
  store.set({ cargos: [...s.cargos, { ...r.cargo, fixo: false }] });
  persistir();
  bus.emit(EVENTOS.CONTATOS, { tipo: "cargo-criado" });
  if (_syncContatosLigado()) {
    sincronizarCargoGoogle(r.cargo.nome).catch(() => toastAviso("Não foi possível criar a classificação no Google."));
  }
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

/* ---------------- Google Contacts (People API) ----------------------- */
/**
 * Sincronização de contatos/empresas com o Google Contacts. O espelhamento
 * automático (ao criar/editar) só roda com o interruptor `sync_contatos` ligado
 * (Perfil) e é SEMPRE best-effort — uma falha no Google nunca desfaz a escrita
 * do app. As ações manuais (importar/vincular) funcionam com ou sem o toggle.
 */
function _syncContatosLigado() {
  // auth.config() reflete a preferência NA HORA (o config() do snapshot só
  // atualiza no próximo refresh) — importante p/ o toggle valer imediatamente.
  const v = (auth.config() || {}).sync_contatos;
  return v === true || v === "TRUE" || v === "true";
}

/** Atualiza o vínculo (google_resource_id) de um registro no store local. */
function _setResourceId(tipo, id, rn) {
  const s = store.get();
  if (tipo === "fornecedor") {
    store.set({ fornecedores: s.fornecedores.map((f) => (String(f.id) === String(id) ? { ...f, google_resource_id: rn } : f)) });
    bus.emit(EVENTOS.FORNECEDORES, { tipo: "atualizado" });
  } else {
    store.set({ contatos: s.contatos.map((c) => (String(c.id) === String(id) ? { ...c, google_resource_id: rn } : c)) });
    bus.emit(EVENTOS.CONTATOS, { tipo: "atualizado" });
  }
  persistir();
}

/** Lista os contatos do Google (fonte do picker de importar/vincular). */
async function listarContatosGoogle(q) {
  const r = await api.call("google.contatos.listar", { q: q || "" });
  return r.contatos || [];
}

/** Envia (cria/atualiza) um registro ao Google e grava o vínculo. */
async function enviarGoogle(tipo, id) {
  const r = await api.call("google.contatos.enviar", { tipo, id });
  _setResourceId(tipo, id, r.google_resource_id || "");
  return r;
}

/** Vincula um registro a um contato existente do Google (sem alterar dados). */
async function vincularGoogle(tipo, id, resourceName) {
  const r = await api.call("google.contatos.vincular", { tipo, id, resourceName });
  _setResourceId(tipo, id, r.google_resource_id || "");
  return r;
}

/** Desfaz o vínculo com o Google. */
async function desvincularGoogle(tipo, id) {
  await api.call("google.contatos.desvincular", { tipo, id });
  _setResourceId(tipo, id, "");
}

/** Importa um contato do Google criando um contato/empresa no app (vinculado). */
async function importarGoogle(tipo, resourceName, extras) {
  const r = await api.call("google.contatos.importar", { tipo, resourceName, ...(extras || {}) });
  const s = store.get();
  if (tipo === "fornecedor" && r.fornecedor) {
    store.set({ fornecedores: [...s.fornecedores, r.fornecedor] });
    bus.emit(EVENTOS.FORNECEDORES, { tipo: "criado" });
  } else if (r.contato) {
    store.set({ contatos: [...s.contatos, r.contato] });
    bus.emit(EVENTOS.CONTATOS, { tipo: "criado" });
  }
  persistir();
  return r;
}

/** Garante o grupo (classificação) do cargo no Google. */
async function sincronizarCargoGoogle(nome) {
  return api.call("google.cargos.sincronizar", { nome });
}

/** Espelha um registro no Google, fire-and-forget, só se o toggle estiver ligado. */
function _autoEnviarGoogle(tipo, id) {
  if (!_syncContatosLigado()) return;
  enviarGoogle(tipo, id).catch(() => toastAviso("Não foi possível sincronizar com o Google Contacts."));
}

/* ----------------- Mutações: tipos de transferência ------------------ */

async function criarTipoTransferencia(dados) {
  const r = await api.call("tiposTransferencia.criar", dados);
  const s = store.get();
  store.set({ tiposTransferencia: [...s.tiposTransferencia, { ...r.tipo, fixo: false }] });
  persistir();
  return r.tipo;
}

async function atualizarTipoTransferencia(id, dados) {
  const r = await api.call("tiposTransferencia.atualizar", { id, ...dados });
  const s = store.get();
  store.set({
    tiposTransferencia: s.tiposTransferencia.map((t) => (String(t.id) === String(id) ? { ...r.tipo, fixo: false } : t)),
  });
  persistir();
  return r.tipo;
}

async function removerTipoTransferencia(id) {
  await api.call("tiposTransferencia.remover", { id });
  const s = store.get();
  store.set({ tiposTransferencia: s.tiposTransferencia.filter((t) => String(t.id) !== String(id)) });
  persistir();
}

/* ---------------------- Mutação: incorporar (compartilhado → meu) ---------- */
// Copia uma entidade que veio de obra compartilhada para o ACERVO PESSOAL do
// usuário (vira dele; sobrevive ao descompartilhamento). O backend cria uma nova
// linha com usuario_id = eu, remapeando/limpando FKs do dono.
async function incorporar(tipo, id) {
  const cfg = {
    contato: { acao: "contatos.incorporar", chave: "contatos", resp: "contato", ev: EVENTOS.CONTATOS },
    fornecedor: { acao: "fornecedores.incorporar", chave: "fornecedores", resp: "fornecedor", ev: EVENTOS.FORNECEDORES },
    item: { acao: "itens.incorporar", chave: "itens", resp: "item", ev: EVENTOS.ITENS },
    oferta: { acao: "ofertas.incorporar", chave: "ofertas", resp: "oferta", ev: EVENTOS.COTACOES },
    cotacao: { acao: "cotacoes.incorporar", chave: "cotacoes", resp: "cotacao", ev: EVENTOS.COTACOES },
    orcamento: { acao: "orcamentos.incorporar", chave: "orcamentos", resp: "orcamento", ev: EVENTOS.ORCAMENTOS },
    equipe: { acao: "equipes.incorporar", chave: "equipes", resp: "equipe", ev: EVENTOS.EQUIPES },
    cargo: { acao: "cargos.incorporar", chave: "cargos", resp: "cargo", ev: EVENTOS.CONTATOS },
    "categoria-item": { acao: "categorias.incorporar", chave: "categorias", resp: "categoria", ev: EVENTOS.CATEGORIAS },
    "categoria-fornecedor": { acao: "categorias.incorporar", chave: "categorias", resp: "categoria", ev: EVENTOS.CATEGORIAS },
  }[tipo];
  if (!cfg) throw new Error("Tipo inválido para incorporar: " + tipo);
  const r = await api.call(cfg.acao, { id });
  const ent = r[cfg.resp];
  if (ent) {
    const s = store.get();
    store.set({ [cfg.chave]: [...s[cfg.chave], ent] });
    // Incorporar equipe também cria cópias pessoais de líder/membros (contatos):
    // mescla-os no store para os nomes resolverem sem esperar novo snapshot.
    if (Array.isArray(r.contatos) && r.contatos.length) {
      const cur = store.get().contatos || [];
      const vistos = new Set(cur.map((c) => String(c.id)));
      const novos = r.contatos.filter((c) => c && !vistos.has(String(c.id)));
      if (novos.length) {
        store.set({ contatos: [...cur, ...novos] });
        bus.emit(EVENTOS.CONTATOS, { tipo: "incorporado" });
      }
    }
    // Incorporar cotação também traz cópias pessoais das ofertas dela.
    if (Array.isArray(r.ofertas) && r.ofertas.length) {
      const cur = store.get().ofertas || [];
      const vistos = new Set(cur.map((o) => String(o.id)));
      const novas = r.ofertas.filter((o) => o && !vistos.has(String(o.id)));
      if (novas.length) {
        store.set({ ofertas: [...cur, ...novas] });
        bus.emit(EVENTOS.COTACOES, { tipo: "incorporado" });
      }
    }
    persistir();
    bus.emit(cfg.ev, { tipo: "incorporado" });
  }
  return ent;
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

/** Desfaz a exclusão (soft-delete): reativa o item e o recoloca no store. */
async function reativarItem(id) {
  const r = await api.call("itens.atualizar", { id, ativo: true });
  const s = store.get();
  const tem = s.itens.some((i) => String(i.id) === String(id));
  store.set({
    itens: tem
      ? s.itens.map((i) => (String(i.id) === String(id) ? r.item : i))
      : [...s.itens, r.item],
  });
  persistir();
  bus.emit(EVENTOS.ITENS, { tipo: "reativado" });
  return r.item;
}

/* ----------------------- Mutações: cotações -------------------------- */

async function criarCotacao(dados) {
  const r = await api.call("cotacoes.criar", dados);
  const s = store.get();
  // 1 cotação por categoria: o backend pode devolver uma JÁ existente —
  // substitui no cache (não duplica).
  const existe = s.cotacoes.some((c) => String(c.id) === String(r.cotacao.id));
  store.set({
    cotacoes: existe
      ? s.cotacoes.map((c) => (String(c.id) === String(r.cotacao.id) ? r.cotacao : c))
      : [r.cotacao, ...s.cotacoes],
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
 * categoria vem do item (servidor) e a mesma responsabilidade é aplicada
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
  usuario, config, categorias, categoriasItem, categoriasFornecedor, usuarios, usuarioNome, obras, obra, despesas, todasDespesas, resumo, categoriasDaObra,
  participantesDaObra,
  notasDaObra,
  fornecedores, fornecedoresAtivos, contatos, contatosAtivos, cargos, tiposTransferencia, itens, itensAtivos, item,
  meusContatosAtivos, contatosCompartilhados, meusFornecedoresAtivos, fornecedoresCompartilhados, meusItensAtivos, itensCompartilhados,
  obrasCompartilhadas, compartilhadoDaObra, dadosDaObra, temDadosDeObraDeTipo, jaIncorporado,
  cotacoes, cotacao, precosDaCotacao, todasOfertas,
  historicoDaCotacao, itensDaSubclasse, precosDaCotacaoPorItem,
  orcamentos, orcamento, ofertasDoOrcamento,
  equipes, equipe, equipesDoContato, equipesDaObra,
  ofertasDoContato, ofertasDoFornecedor, ofertasDoItem, ofertasDaObra,
  despesasDoContato, despesasDoFornecedor, despesasDoItem, despesasDaEquipe,
  pagamentos, repasses, pagamentosDaDespesa, pagamentosDoContato, pagamentosDaObra,
  repassesDoPagamento, repassesDoContato, despesaTemPagamento,
  transferencias, transferencia, transferenciasDaObra, transferenciaDoPagamento, pagamentosDaTransferencia,
  movimentosEstoque, estoqueConsolidadoDaObra, estoqueDaObra, estoqueConsumidoDaObra, saldoEstoqueItem, origensDoEstoque, movimentosDoItemEstoque,
  // mutações
  criarObra, atualizarObra, removerObra,
  adicionarParticipante, removerParticipante, definirResponsavel,
  adicionarNota, atualizarNota, removerNota,
  gerarLinkPublico, removerLinkPublico,
  adicionarDespesa, atualizarDespesa, removerDespesa, lancarPagamento, removerPagamento,
  lancarPagamentoMulti, removerPagamentoV2, excluirPagamento, lancarRepasse, removerRepasse,
  lancarTransferencia, removerTransferencia, excluirTransferencia,
  anexarComprovanteTransferencia, removerComprovanteTransferencia,
  consumirEstoque, devolverEstoque, adicionarEstoqueManual, transferirEstoque, removerMovimentoEstoque,
  criarCategoria, atualizarCategoria, removerCategoria, reativarCategoria,
  criarFornecedor, atualizarFornecedor, removerFornecedor, reativarFornecedor,
  criarContato, atualizarContato, removerContato, reativarContato,
  incorporar,
  criarCargo, atualizarCargo, removerCargo,
  listarContatosGoogle, enviarGoogle, vincularGoogle, desvincularGoogle, importarGoogle, sincronizarCargoGoogle,
  criarTipoTransferencia, atualizarTipoTransferencia, removerTipoTransferencia,
  criarItem, atualizarItem, removerItem, reativarItem,
  criarCotacao, atualizarCotacao, removerCotacao,
  criarOferta, atualizarOferta, removerPreco, escolherPreco, registrarDespesaOferta,
  registrarOrcamentoCompleto,
  criarOrcamento, atualizarOrcamento, removerOrcamento,
  criarEquipe, atualizarEquipe, removerEquipe,
  adminCriarUsuario, adminAtualizarUsuario,
};
