/**
 * Orcamentos.gs — Orçamentos: container de ofertas de um mesmo ofertante.
 *
 * Um orçamento agrupa ofertas (CotacaoPrecos) de VÁRIAS cotações, todas do mesmo
 * contato (vendedor). É Material (vinculado a um fornecedor + um vendedor desse
 * fornecedor) ou Serviço (qualquer contato, sem fornecedor); pode ter obra.
 * A oferta é a MESMA linha de CotacaoPrecos (com `orcamento_id`) — aparece também
 * na cotação. Espelha o padrão de Cotacoes.gs.
 */

/** Verdadeiro se o orçamento está ativo (aceita boolean ou texto). */
function _orcamentoAtivo(o) {
  return o.ativo === true || o.ativo === "TRUE" || o.ativo === "true";
}

/** Normaliza o tipo (Material|Serviço). */
function _tipoOrcamentoValido(t) {
  return CLASSIFICACOES_ITEM.indexOf(t) >= 0 ? t : CLASSIFICACOES_ITEM[0];
}

/** Lista os orçamentos ativos do usuário (mais recentes primeiro). */
function listarOrcamentosUsuario(usuarioId) {
  const lista = repoFiltrar(SCHEMA.ORCAMENTOS, function (o) {
    return _orcamentoAtivo(o) && String(o.usuario_id) === String(usuarioId);
  });
  lista.sort(function (a, b) {
    return String(b.criado_em).localeCompare(String(a.criado_em));
  });
  return lista;
}

/** Garante que o orçamento é do usuário; senão lança. Retorna a linha. */
function _orcamentoDoUsuario(id, usuarioId) {
  const o = repoEncontrar(SCHEMA.ORCAMENTOS, function (x) {
    return String(x.id) === String(id);
  });
  if (!o || String(o.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Orçamento não encontrado.");
  }
  return o;
}

/**
 * Valida os vínculos do orçamento e devolve o contato. Material exige fornecedor
 * + contato vendedor DESSE fornecedor; Serviço exige só um contato (qualquer).
 */
function _validarVinculosOrcamento(tipo, fornecedorId, contatoId, usuarioId) {
  if (!contatoId) lancar(ERRO.VALIDACAO, "Selecione o contato (ofertante).");
  const contato = _contatoDoUsuario(contatoId, usuarioId);
  if (tipo === "Material") {
    if (!fornecedorId) lancar(ERRO.VALIDACAO, "Selecione o fornecedor.");
    _fornecedorDoUsuario(fornecedorId, usuarioId);
    if (String(contato.fornecedor_id) !== String(fornecedorId)) {
      lancar(ERRO.VALIDACAO, "O contato deve ser um vendedor do fornecedor selecionado.");
    }
  }
  return contato;
}

/** orcamentos.listar -> { orcamentos: [...] }. */
function orcamentosListar(data, sessao) {
  return { orcamentos: listarOrcamentosUsuario(sessao.usuario_id) };
}

/** orcamentos.criar -> { orcamento }. */
function orcamentosCriar(data, sessao) {
  const tipo = _tipoOrcamentoValido(data && data.tipo);
  const obraId = String((data && data.obra_id) || "");
  if (obraId) _obraAcessivel(obraId, sessao.usuario_id);
  const fornecedorId = tipo === "Material" ? String((data && data.fornecedor_id) || "") : "";
  const contatoId = String((data && data.contato_id) || "");
  _validarVinculosOrcamento(tipo, fornecedorId, contatoId, sessao.usuario_id);

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const orc = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      obra_id: obraId,
      tipo: tipo,
      fornecedor_id: fornecedorId,
      contato_id: contatoId,
      titulo: String((data && data.titulo) || "").trim(),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.ORCAMENTOS, orc);
    return { orcamento: orc };
  });
}

/** orcamentos.atualizar -> { orcamento }. Propaga o contato às ofertas se mudar. */
function orcamentosAtualizar(data, sessao) {
  const id = data && data.id;
  const atual = _orcamentoDoUsuario(id, sessao.usuario_id);

  const tipo = data.tipo !== undefined ? _tipoOrcamentoValido(data.tipo) : atual.tipo;
  const fornecedorId =
    tipo === "Material"
      ? String((data.fornecedor_id !== undefined ? data.fornecedor_id : atual.fornecedor_id) || "")
      : "";
  const contatoId = String((data.contato_id !== undefined ? data.contato_id : atual.contato_id) || "");
  _validarVinculosOrcamento(tipo, fornecedorId, contatoId, sessao.usuario_id);

  const patch = { atualizado_em: agoraIso(), tipo: tipo, fornecedor_id: fornecedorId, contato_id: contatoId };
  if (data.titulo !== undefined) patch.titulo = String(data.titulo).trim();
  if (data.obra_id !== undefined) {
    const obraId = String(data.obra_id || "");
    if (obraId) _obraAcessivel(obraId, sessao.usuario_id);
    patch.obra_id = obraId;
  }
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  const contatoMudou = String(atual.contato_id) !== String(contatoId);

  return comLock(function () {
    const orc = repoAtualizar(SCHEMA.ORCAMENTOS, "id", id, patch);
    if (contatoMudou) {
      const agora = agoraIso();
      repoFiltrar(SCHEMA.COTACAO_PRECOS, function (p) {
        return String(p.orcamento_id) === String(id);
      }).forEach(function (p) {
        repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", p.id, { contato_id: contatoId, atualizado_em: agora });
      });
    }
    return { orcamento: orc };
  });
}

/** orcamentos.remover -> { id }. Bloqueia se há oferta registrada; senão cascade. */
function orcamentosRemover(data, sessao) {
  const id = data && data.id;
  _orcamentoDoUsuario(id, sessao.usuario_id);
  const ofertas = repoFiltrar(SCHEMA.COTACAO_PRECOS, function (p) {
    return String(p.orcamento_id) === String(id);
  });
  const registrada = ofertas.some(function (p) {
    return !!String(p.despesa_id || "");
  });
  if (registrada) {
    lancar(ERRO.VALIDACAO, "Orçamento com oferta registrada como despesa; exclua a despesa primeiro.");
  }

  return comLock(function () {
    ofertas.forEach(function (p) {
      repoRemover(SCHEMA.COTACAO_PRECOS, "id", p.id);
    });
    repoRemover(SCHEMA.ORCAMENTOS, "id", id);
    return { id: id };
  });
}
