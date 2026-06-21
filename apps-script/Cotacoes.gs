/**
 * Cotacoes.gs — Cotações (necessidades a cotar) + ofertas de contatos.
 *
 * Modelo: uma COTAÇÃO é uma necessidade ("Cimento CP-II, 100 sacos"); cada
 * OFERTA (CotacaoPreco) é o preço de um CONTATO para essa necessidade. A
 * comparação (menor total) é feita no cliente. obra_id é opcional (vazio =
 * cotação geral); ao "registrar como despesa" o cliente reusa despesas.criar.
 */

function _statusCotacaoValido(status) {
  return STATUS_COTACAO.indexOf(status) >= 0 ? status : "aberta";
}

/** Lista as cotações do usuário (mais recentes primeiro). */
function listarCotacoesUsuario(usuarioId) {
  const lista = repoFiltrar(SCHEMA.COTACOES, function (c) {
    return String(c.usuario_id) === String(usuarioId);
  });
  lista.sort(function (a, b) {
    return String(b.criado_em).localeCompare(String(a.criado_em));
  });
  return lista;
}

/** Ofertas de uma cotação (mais recentes primeiro). */
function listarPrecosCotacao(cotacaoId) {
  const lista = repoFiltrar(SCHEMA.COTACAO_PRECOS, function (p) {
    return String(p.cotacao_id) === String(cotacaoId);
  });
  lista.sort(function (a, b) {
    return String(b.criado_em).localeCompare(String(a.criado_em));
  });
  return lista;
}

/** Histórico de preços de uma cotação (mais antigo primeiro = evolução no tempo). */
function listarHistoricoCotacao(cotacaoId) {
  const lista = repoFiltrar(SCHEMA.COTACAO_PRECO_HISTORICO, function (h) {
    return String(h.cotacao_id) === String(cotacaoId);
  });
  lista.sort(function (a, b) {
    return String(a.registrado_em).localeCompare(String(b.registrado_em));
  });
  return lista;
}

/** Registra um ponto no histórico de preços (deve rodar sob comLock). */
function _logPreco(preco) {
  const ponto = {
    id: novoId(),
    cotacao_id: preco.cotacao_id,
    preco_id: preco.id,
    contato_id: preco.contato_id,
    valor_unit: preco.valor_unit,
    registrado_em: agoraIso(),
  };
  repoInserir(SCHEMA.COTACAO_PRECO_HISTORICO, ponto);
  return ponto;
}

/** Garante que a cotação é do usuário; senão lança. */
function _cotacaoDoUsuario(cotacaoId, usuarioId) {
  const c = repoEncontrar(SCHEMA.COTACOES, function (x) {
    return String(x.id) === String(cotacaoId);
  });
  if (!c || String(c.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Cotação não pode ser alterada.");
  }
  return c;
}

/** Localiza uma oferta garantindo que a cotação é do usuário. */
function _precoDoUsuario(precoId, usuarioId) {
  const p = repoEncontrar(SCHEMA.COTACAO_PRECOS, function (x) {
    return String(x.id) === String(precoId);
  });
  if (!p) lancar(ERRO.NAO_ENCONTRADO, "Oferta não encontrada.");
  _cotacaoDoUsuario(p.cotacao_id, usuarioId);
  return p;
}

/* ------------------------------ Cotações ------------------------------ */

/** cotacoes.listar -> { cotacoes: [...] }. */
function cotacoesListar(data, sessao) {
  return { cotacoes: listarCotacoesUsuario(sessao.usuario_id) };
}

/** cotacoes.criar -> { cotacao }. */
function cotacoesCriar(data, sessao) {
  const itemId = String((data && data.item_id) || "");
  if (!itemId) lancar(ERRO.VALIDACAO, "Selecione um item para a cotação.");
  const item = _itemPorId(itemId, sessao.usuario_id); // deriva nome+classificacao

  const obraId = String((data && data.obra_id) || "");
  if (obraId) _obraAcessivel(obraId, sessao.usuario_id);

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const cotacao = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      obra_id: obraId,
      descricao: item.nome, // = nome do item (desnormalizado)
      quantidade: Number((data && data.quantidade) || 0) || 0,
      unidade: String((data && data.unidade) || ""),
      categoria_id: String((data && data.categoria_id) || ""), // subclassificação
      status: _statusCotacaoValido(data && data.status),
      criado_em: agora,
      atualizado_em: agora,
      item_id: itemId,
      classificacao: item.classificacao,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.COTACOES, cotacao);
    return { cotacao: cotacao };
  });
}

/** cotacoes.atualizar -> { cotacao }. */
function cotacoesAtualizar(data, sessao) {
  const id = data && data.id;
  _cotacaoDoUsuario(id, sessao.usuario_id);

  const patch = { atualizado_em: agoraIso() };
  // Item: se vier item_id, re-deriva descricao+classificacao do catálogo.
  if (data.item_id !== undefined && String(data.item_id || "")) {
    const it = _itemPorId(String(data.item_id), sessao.usuario_id);
    patch.item_id = String(data.item_id);
    patch.descricao = it.nome;
    patch.classificacao = it.classificacao;
  } else if (data.descricao !== undefined) {
    const descricao = String(data.descricao).trim();
    if (!descricao) lancar(ERRO.VALIDACAO, "A descrição não pode ficar vazia.");
    patch.descricao = descricao;
  }
  if (data.obra_id !== undefined) {
    const obraId = String(data.obra_id || "");
    if (obraId) _obraAcessivel(obraId, sessao.usuario_id);
    patch.obra_id = obraId;
  }
  if (data.quantidade !== undefined)
    patch.quantidade = Number(data.quantidade) || 0;
  if (data.unidade !== undefined) patch.unidade = String(data.unidade);
  if (data.categoria_id !== undefined)
    patch.categoria_id = String(data.categoria_id);
  if (data.status !== undefined) patch.status = _statusCotacaoValido(data.status);
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const cotacao = repoAtualizar(SCHEMA.COTACOES, "id", id, patch);
    return { cotacao: cotacao };
  });
}

/** cotacoes.remover -> { id } (remove a cotação e suas ofertas). */
function cotacoesRemover(data, sessao) {
  const id = data && data.id;
  _cotacaoDoUsuario(id, sessao.usuario_id);

  return comLock(function () {
    repoFiltrar(SCHEMA.COTACAO_PRECOS, function (p) {
      return String(p.cotacao_id) === String(id);
    }).forEach(function (p) {
      repoRemover(SCHEMA.COTACAO_PRECOS, "id", p.id);
    });
    repoRemover(SCHEMA.COTACOES, "id", id);
    return { id: id };
  });
}

/* ------------------------------- Ofertas ------------------------------ */

/** cotacoes.adicionarPreco -> { preco, historico }. */
function cotacoesAdicionarPreco(data, sessao) {
  const cotacaoId = data && data.cotacao_id;
  _cotacaoDoUsuario(cotacaoId, sessao.usuario_id);

  const contatoId = String((data && data.contato_id) || "");
  if (!contatoId) lancar(ERRO.VALIDACAO, "Selecione o contato da oferta.");
  _contatoDoUsuario(contatoId, sessao.usuario_id);

  const valor = Number(data && data.valor_unit);
  if (!(valor > 0)) lancar(ERRO.VALIDACAO, "Informe um valor maior que zero.");

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const preco = {
      id: novoId(),
      cotacao_id: cotacaoId,
      contato_id: contatoId,
      valor_unit: valor,
      prazo_entrega: String((data && data.prazo_entrega) || ""),
      observacao: String((data && data.observacao) || ""),
      escolhido: false,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.COTACAO_PRECOS, preco);
    const historico = _logPreco(preco); // ponto inicial da evolução
    return { preco: preco, historico: historico };
  });
}

/** cotacoes.atualizarPreco -> { preco, historico } (historico só se o valor mudou). */
function cotacoesAtualizarPreco(data, sessao) {
  const id = data && data.id;
  const atual = _precoDoUsuario(id, sessao.usuario_id);

  const patch = {};
  if (data.contato_id !== undefined) {
    const contatoId = String(data.contato_id || "");
    if (!contatoId) lancar(ERRO.VALIDACAO, "Selecione o contato da oferta.");
    _contatoDoUsuario(contatoId, sessao.usuario_id);
    patch.contato_id = contatoId;
  }
  let valorMudou = false;
  if (data.valor_unit !== undefined) {
    const valor = Number(data.valor_unit);
    if (!(valor > 0)) lancar(ERRO.VALIDACAO, "Valor inválido.");
    patch.valor_unit = valor;
    valorMudou = valor !== Number(atual.valor_unit);
  }
  if (data.prazo_entrega !== undefined)
    patch.prazo_entrega = String(data.prazo_entrega);
  if (data.observacao !== undefined) patch.observacao = String(data.observacao);
  patch.atualizado_em = agoraIso();
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const preco = repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", id, patch);
    // Loga um novo ponto na evolução apenas quando o preço de fato mudou.
    const historico = valorMudou ? _logPreco(preco) : null;
    return { preco: preco, historico: historico };
  });
}

/** cotacoes.removerPreco -> { id, cotacao_id } (mantém o histórico). Bloqueia se registrada. */
function cotacoesRemoverPreco(data, sessao) {
  const id = data && data.id;
  const preco = _precoDoUsuario(id, sessao.usuario_id);
  if (String(preco.despesa_id || "")) {
    lancar(ERRO.VALIDACAO, "Oferta já registrada como despesa; exclua a despesa primeiro.");
  }

  return comLock(function () {
    repoRemover(SCHEMA.COTACAO_PRECOS, "id", id);
    // O histórico de preços é PRESERVADO (acompanhar a evolução no tempo).
    return { id: id, cotacao_id: preco.cotacao_id };
  });
}

/**
 * cotacoes.escolherPreco -> { precos } (lista atualizada da cotação).
 * Marca a oferta como escolhida e desmarca as demais da mesma cotação.
 */
function cotacoesEscolherPreco(data, sessao) {
  const id = data && data.id;
  const preco = _precoDoUsuario(id, sessao.usuario_id);

  return comLock(function () {
    repoFiltrar(SCHEMA.COTACAO_PRECOS, function (p) {
      return String(p.cotacao_id) === String(preco.cotacao_id);
    }).forEach(function (p) {
      const escolhido = String(p.id) === String(id);
      if (_boolDe(p.escolhido) !== escolhido) {
        repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", p.id, { escolhido: escolhido });
      }
    });
    return { precos: listarPrecosCotacao(preco.cotacao_id) };
  });
}

/**
 * cotacoes.registrarDespesa -> { despesa, resumo, precos, cotacao }.
 * Lança a oferta como DESPESA na obra escolhida, MARCA a oferta (despesa_id +
 * escolhido exclusivo) e FECHA a cotação. Reusa _novaDespesa (Despesas.gs).
 */
function cotacoesRegistrarDespesa(data, sessao) {
  const precoId = data && data.preco_id;
  const preco = _precoDoUsuario(precoId, sessao.usuario_id);
  const cotacao = _cotacaoDoUsuario(preco.cotacao_id, sessao.usuario_id);

  const obraId = String((data && data.obra_id) || "");
  if (!obraId) lancar(ERRO.VALIDACAO, "Selecione a obra.");
  _obraAcessivel(obraId, sessao.usuario_id);

  const qtd = Number(cotacao.quantidade) > 0 ? Number(cotacao.quantidade) : 1;
  const valor = (Number(preco.valor_unit) || 0) * qtd;
  if (!(valor > 0)) lancar(ERRO.VALIDACAO, "Valor da oferta inválido.");
  const item = String(cotacao.descricao || "").trim() || "Cotação";
  const contato = repoEncontrar(SCHEMA.CONTATOS, function (x) {
    return String(x.id) === String(preco.contato_id);
  }) || {};
  const categoriaId = String((data && data.categoria_id) || cotacao.categoria_id || "");

  return comLock(function () {
    const despesa = _novaDespesa(obraId, sessao.usuario_id, {
      item_id: String(cotacao.item_id || ""), // herda item+classificação (se houver)
      item: item, // fallback p/ cotações legadas sem item_id
      classificacao: cotacao.classificacao,
      valor: valor,
      categoria_id: categoriaId,
      observacao: "Cotação · " + (contato.nome || ""),
    });
    // Marca esta oferta como registrada/escolhida e desmarca as demais.
    repoFiltrar(SCHEMA.COTACAO_PRECOS, function (p) {
      return String(p.cotacao_id) === String(cotacao.id);
    }).forEach(function (p) {
      const ehEsta = String(p.id) === String(precoId);
      const patch = {};
      if (_boolDe(p.escolhido) !== ehEsta) patch.escolhido = ehEsta;
      if (ehEsta) patch.despesa_id = despesa.id;
      if (Object.keys(patch).length) repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", p.id, patch);
    });
    const cotAtual = repoAtualizar(SCHEMA.COTACOES, "id", cotacao.id, {
      status: "fechada",
      atualizado_em: agoraIso(),
    });
    return {
      despesa: despesa,
      resumo: _calcularResumo(obraId, sessao.usuario_id),
      precos: listarPrecosCotacao(cotacao.id),
      cotacao: cotAtual,
    };
  });
}

/** Normaliza booleano vindo do Sheets (TRUE/true/boolean). */
function _boolDe(v) {
  return v === true || v === "TRUE" || v === "true";
}
