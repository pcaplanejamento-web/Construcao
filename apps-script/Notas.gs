/**
 * Notas.gs — Anotações por obra, COMPARTILHADAS (quem tem acesso à obra vê e
 * edita). CRUD simples com autoria (autor_nome/editor_nome). A aba "Notas"
 * se auto-cria no primeiro acesso (SheetRepo._abaDe) — sem migração.
 */

/** notas.listar — { obra_id } -> { notas:[...] } da obra (mais recentes primeiro). */
function notasListar(data, sessao) {
  const obraId = String((data && data.obra_id) || "");
  if (!obraId) lancar(ERRO.VALIDACAO, "Obra não informada.");
  _obraAcessivel(obraId, sessao.usuario_id);
  const notas = repoFiltrar(SCHEMA.NOTAS, function (n) {
    return String(n.obra_id) === obraId;
  });
  notas.sort(function (a, b) {
    return String(b.atualizado_em).localeCompare(String(a.atualizado_em));
  });
  return { notas: notas };
}

/** Cores permitidas para uma nota (chaves da paleta em src/features/obras/nota-cores.js). */
var CORES_NOTA_VALIDAS = { "": true, amarelo: true, verde: true, azul: true, roxo: true, rosa: true, laranja: true, cinza: true };
function _corNota(v) {
  var c = String(v == null ? "" : v).trim();
  return CORES_NOTA_VALIDAS[c] ? c : "";
}

/** notas.criar — { obra_id, titulo, texto, cor } -> { nota }. */
function notasCriar(data, sessao) {
  const obraId = String((data && data.obra_id) || "");
  if (!obraId) lancar(ERRO.VALIDACAO, "Obra não informada.");
  _obraAcessivel(obraId, sessao.usuario_id);
  const titulo = String((data && data.titulo) || "").trim();
  const texto = String((data && data.texto) || "").trim();
  if (!titulo && !texto) lancar(ERRO.VALIDACAO, "Escreva um título ou um texto para a nota.");

  return comLock(function () {
    const nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const agora = agoraIso();
    const nota = {
      id: novoId(),
      obra_id: obraId,
      usuario_id: sessao.usuario_id,
      titulo: titulo,
      texto: texto,
      criado_em: agora,
      autor_nome: nome,
      atualizado_em: agora,
      editor_nome: "",
      cor: _corNota(data && data.cor),
    };
    repoInserir(SCHEMA.NOTAS, nota);
    return { nota: nota };
  });
}

/** notas.atualizar — { id, titulo, texto } -> { nota }. */
function notasAtualizar(data, sessao) {
  const id = String((data && data.id) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Nota não informada.");
  const atual = repoEncontrar(SCHEMA.NOTAS, function (n) {
    return String(n.id) === id;
  });
  if (!atual) lancar(ERRO.NAO_ENCONTRADO, "Nota não encontrada.");
  _obraAcessivel(atual.obra_id, sessao.usuario_id);
  const titulo = String((data && data.titulo) || "").trim();
  const texto = String((data && data.texto) || "").trim();
  if (!titulo && !texto) lancar(ERRO.VALIDACAO, "Escreva um título ou um texto para a nota.");

  const temCor = data && Object.prototype.hasOwnProperty.call(data, "cor");
  return comLock(function () {
    const nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const patch = {
      titulo: titulo,
      texto: texto,
      atualizado_em: agoraIso(),
      editor_nome: nome,
    };
    if (temCor) patch.cor = _corNota(data.cor); // só mexe na cor se veio no payload
    const nota = repoAtualizar(SCHEMA.NOTAS, "id", id, patch);
    return { nota: nota };
  });
}

/** notas.remover — { id } -> { id }. */
function notasRemover(data, sessao) {
  const id = String((data && data.id) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Nota não informada.");
  const atual = repoEncontrar(SCHEMA.NOTAS, function (n) {
    return String(n.id) === id;
  });
  if (!atual) lancar(ERRO.NAO_ENCONTRADO, "Nota não encontrada.");
  _obraAcessivel(atual.obra_id, sessao.usuario_id);
  return comLock(function () {
    repoRemover(SCHEMA.NOTAS, "id", id);
    return { id: id };
  });
}
