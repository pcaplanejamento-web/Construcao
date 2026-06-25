/**
 * Pagamentos.gs — Pagamentos e Repasses como ENTIDADES próprias e rastreáveis.
 *
 * Um pagamento pode cobrir VÁRIAS despesas (campo `alocacoes` = [{despesa_id,valor}]).
 * Tem pagador (contato/participante), recebedor (contato OU equipe/grupo), obra e
 * fornecedor. Os campos embutidos da despesa (`pagamentos_realizados`/`pagamentos`/
 * `pago`) viram ESPELHOS reconstruídos por `_sincronizarMirrorDespesa` — assim todo
 * o front legado (despesa-split + 8 telas) continua funcionando sem mudança.
 *
 * Repasse: o recebedor de um pagamento repassa parte a outros contatos.
 */

/* --------------------------- Leitura/normalização --------------------------- */

function _lerPagamento(p) {
  if (!p) return p;
  return Object.assign({}, p, {
    valor: Number(p.valor) || 0,
    alocacoes: _parseJsonLista(p.alocacoes),
    distribuicao: _parseJsonLista(p.distribuicao),
  });
}

function _lerRepasse(r) {
  if (!r) return r;
  return Object.assign({}, r, {
    valor: Number(r.valor) || 0,
    contatos_repassados: _parseJsonLista(r.contatos_repassados),
  });
}

function listarPagamentosUsuario(usuarioId) {
  return repoFiltrar(SCHEMA.PAGAMENTOS, function (p) {
    return String(p.usuario_id) === String(usuarioId);
  }).map(_lerPagamento);
}

function listarRepassesUsuario(usuarioId) {
  return repoFiltrar(SCHEMA.REPASSES, function (r) {
    return String(r.usuario_id) === String(usuarioId);
  }).map(_lerRepasse);
}

/* ------------------------------- Helpers ------------------------------------ */

/** "c:<id>" → id (id do contato pagador); senão "". */
function _contatoDeChave(chave) {
  const s = String(chave || "");
  return s.indexOf("c:") === 0 ? s.substring(2) : "";
}

/** Total já alocado numa despesa por TODOS os pagamentos (exceto opcional). */
function _totalAlocadoNaDespesa(despesaId, exceto) {
  let total = 0;
  repoListar(SCHEMA.PAGAMENTOS).forEach(function (p) {
    if (exceto && String(p.id) === String(exceto)) return;
    _parseJsonLista(p.alocacoes).forEach(function (a) {
      if (String(a.despesa_id) === String(despesaId)) total += Number(a.valor) || 0;
    });
  });
  return total;
}

/**
 * Reconstrói os campos embutidos (espelho) de UMA despesa a partir dos Pagamentos
 * que a alocam. Mantém o front legado coerente. Cada leva = alocação de 1 pagamento.
 */
function _sincronizarMirrorDespesa(despesaId) {
  const desp = repoEncontrar(SCHEMA.DESPESAS, function (x) {
    return String(x.id) === String(despesaId);
  });
  if (!desp) return null;
  const levas = [];
  repoListar(SCHEMA.PAGAMENTOS).forEach(function (p) {
    const alocs = _parseJsonLista(p.alocacoes);
    const aloc = alocs.find(function (a) {
      return String(a.despesa_id) === String(despesaId);
    });
    if (!aloc) return;
    levas.push({
      id: p.id,
      data: p.data,
      valor: Number(aloc.valor) || 0,
      pagador: p.pagador_chave,
      contato_id: p.recebedor_contato_id,
      fornecedor_id: p.fornecedor_id,
      // Distribuição por integrante só faz sentido p/ pagamento de despesa única.
      distribuicao: alocs.length === 1 ? _parseJsonLista(p.distribuicao) : [],
      autor_nome: p.autor_nome,
      criado_em: p.criado_em,
    });
  });
  levas.sort(function (a, b) {
    return String(a.criado_em).localeCompare(String(b.criado_em));
  });
  const somaTotal = levas.reduce(function (s, l) {
    return s + (Number(l.valor) || 0);
  }, 0);
  const pago = somaTotal - (Number(desp.valor) || 0) >= -0.01;
  const atualizada = repoAtualizar(SCHEMA.DESPESAS, "id", despesaId, {
    pagamentos_realizados: JSON.stringify(levas),
    pagamentos: JSON.stringify(_pagamentosDeLevas(levas)),
    pago: pago,
  });
  // ESTOQUE: ao QUITAR uma despesa Material, sua quantidade vira entrada de estoque
  // (idempotente). Ao despagar, tenta remover a entrada. NUNCA lança (não pode
  // quebrar o fluxo de pagamento). Roda sob o comLock do chamador.
  try {
    _sincronizarEstoqueDaDespesa(atualizada || desp, pago);
  } catch (e) {}
  return atualizada;
}

/* ------------------------------ Pagamentos ---------------------------------- */

/**
 * Monta (valida + objeto) um pagamento SEM gravar e SEM lock — reusável dentro do
 * lock de uma TRANSFERÊNCIA. Faz TODA a validação (alocações, pagador, não-estouro,
 * distribuição) antes de qualquer escrita. Aceita `transferencia_id` e `tipo`.
 */
function _pagamentoMontar(data, sessao) {
  const usuarioId = sessao.usuario_id;
  const alocacoes = (Array.isArray(data && data.alocacoes) ? data.alocacoes : [])
    .map(function (a) {
      return { despesa_id: String((a && a.despesa_id) || ""), valor: Number(a && a.valor) || 0 };
    })
    .filter(function (a) {
      return a.despesa_id && a.valor > 0;
    });
  if (!alocacoes.length) lancar(ERRO.VALIDACAO, "Informe ao menos uma despesa e valor.");

  const pagador = String((data && (data.pagador_chave || data.pagador)) || "");
  if (!pagador) lancar(ERRO.VALIDACAO, "Selecione quem pagou.");
  const valor = alocacoes.reduce(function (s, a) {
    return s + a.valor;
  }, 0);

  // Valida cada despesa: acessível + não estoura o valor (Σ alocado + esta).
  let obraId = String((data && data.obra_id) || "");
  alocacoes.forEach(function (a) {
    const d = _despesaAcessivel(a.despesa_id, usuarioId);
    if (!obraId) obraId = String(d.obra_id || "");
    const jaAlocado = _totalAlocadoNaDespesa(a.despesa_id, null);
    if (jaAlocado + a.valor - (Number(d.valor) || 0) > 0.01)
      lancar(ERRO.VALIDACAO, "O pagamento excede o valor da despesa.");
  });

  // Recebedor (explícito) + distribuição (equipe).
  const recebedorContatoId = String((data && data.recebedor_contato_id) || "");
  const recebedorEquipeId = String((data && data.recebedor_equipe_id) || "");
  const fornecedorId = String((data && data.fornecedor_id) || "");
  const distribuicao = (Array.isArray(data && data.distribuicao) ? data.distribuicao : []).map(
    function (d) {
      return { chave: String((d && d.chave) || ""), valor: Number(d && d.valor) || 0 };
    }
  );
  if (recebedorEquipeId) {
    const somaDist = distribuicao.reduce(function (s, d) {
      return s + (Number(d.valor) || 0);
    }, 0);
    if (somaDist - valor > 0.01)
      lancar(ERRO.VALIDACAO, "A soma da distribuição não pode passar do valor do pagamento.");
  }

  const agora = agoraIso();
  const nome = (buscarUsuarioPorId(usuarioId) || {}).nome || "";
  return {
    id: novoId(),
    usuario_id: usuarioId,
    obra_id: obraId,
    data: String((data && data.data) || agora.substring(0, 10)),
    valor: valor,
    pagador_chave: pagador,
    pagador_contato_id: String((data && data.pagador_contato_id) || _contatoDeChave(pagador)),
    recebedor_contato_id: recebedorContatoId,
    recebedor_equipe_id: recebedorEquipeId,
    fornecedor_id: fornecedorId,
    alocacoes: JSON.stringify(alocacoes),
    distribuicao: JSON.stringify(distribuicao),
    observacao: String((data && data.observacao) || ""),
    criado_em: agora,
    autor_nome: nome,
    atualizado_em: agora,
    editor_nome: nome,
    origem_leva_id: String((data && data.origem_leva_id) || ""),
    transferencia_id: String((data && data.transferencia_id) || ""),
    tipo: String((data && data.tipo) || ""),
  };
}

/** Grava um pagamento (já montado/validado) e re-sincroniza os espelhos. SEM lock. */
function _pagamentoGravar(pagamento) {
  repoInserir(SCHEMA.PAGAMENTOS, pagamento);
  const despesas = _parseJsonLista(pagamento.alocacoes).map(function (a) {
    return _lerDespesa(_sincronizarMirrorDespesa(a.despesa_id));
  });
  return { pagamento: _lerPagamento(pagamento), despesas: despesas };
}

/** Remove 1 pagamento (cascata repasses + re-sync despesas). SEM lock. Devolve transferencia_id. */
function _pagamentoRemoverInterno(id) {
  const pag = repoEncontrar(SCHEMA.PAGAMENTOS, function (x) {
    return String(x.id) === String(id);
  });
  if (!pag) return { despesas: [], transferencia_id: "" };
  const alocs = _parseJsonLista(pag.alocacoes);
  // Cascata: repasses que apontam p/ este pagamento.
  repoFiltrar(SCHEMA.REPASSES, function (r) {
    return String(r.pagamento_id) === String(id);
  }).forEach(function (r) {
    repoRemover(SCHEMA.REPASSES, "id", r.id);
  });
  repoRemover(SCHEMA.PAGAMENTOS, "id", id);
  const despesas = alocs.map(function (a) {
    return _lerDespesa(_sincronizarMirrorDespesa(a.despesa_id));
  });
  return { despesas: despesas, transferencia_id: String(pag.transferencia_id || "") };
}

/**
 * pagamentos.lancar -> { pagamento, despesas, resumo }. Mantido por retrocompat
 * (o front novo usa transferencias.lancar). Cria 1 pagamento (sem transferência própria).
 */
function pagamentosLancar(data, sessao) {
  const pagamento = _pagamentoMontar(data, sessao);
  const obraId = String(pagamento.obra_id || "");
  return comLock(function () {
    const r = _pagamentoGravar(pagamento);
    return {
      pagamento: r.pagamento,
      despesas: r.despesas,
      resumo: obraId ? _calcularResumo(obraId, sessao.usuario_id) : null,
    };
  });
}

/**
 * pagamentos.remover -> { id, despesas, resumo }. Cascata: repasses do pagamento.
 * Se o pagamento pertencer a uma transferência, ajusta-a (ou remove se ficar vazia).
 */
function pagamentosRemover(data, sessao) {
  const id = String((data && data.id) || "");
  const pag = repoEncontrar(SCHEMA.PAGAMENTOS, function (x) {
    return String(x.id) === String(id);
  });
  if (!pag) lancar(ERRO.NAO_ENCONTRADO, "Pagamento não encontrado.");
  if (String(pag.usuario_id) !== String(sessao.usuario_id))
    lancar(ERRO.VALIDACAO, "Sem acesso a este pagamento.");
  const obraId = String(pag.obra_id || "");
  const transferenciaId = String(pag.transferencia_id || "");

  // Trava: pagamento isolado só pode ser excluído se a transferência tiver 1 pagamento.
  // Com vários, exclua a transferência inteira (transferenciasRemover).
  if (transferenciaId) {
    const t = repoEncontrar(SCHEMA.TRANSFERENCIAS, function (x) {
      return String(x.id) === String(transferenciaId);
    });
    if (t && _parseJsonLista(t.pagamento_ids).length > 1)
      lancar(
        ERRO.VALIDACAO,
        "Este pagamento faz parte de uma transferência com vários pagamentos. Exclua a transferência inteira."
      );
  }

  return comLock(function () {
    const r = _pagamentoRemoverInterno(id);
    if (transferenciaId) _ajustarTransferenciaAposRemocao(transferenciaId, id);
    return {
      id: id,
      despesas: r.despesas,
      resumo: obraId ? _calcularResumo(obraId, sessao.usuario_id) : null,
    };
  });
}

/* -------------------------------- Repasses ---------------------------------- */

/** repasses.lancar -> { repasse }. */
function repassesLancar(data, sessao) {
  const usuarioId = sessao.usuario_id;
  const pagamentoId = String((data && data.pagamento_id) || "");
  const pag = repoEncontrar(SCHEMA.PAGAMENTOS, function (x) {
    return String(x.id) === String(pagamentoId);
  });
  if (!pag) lancar(ERRO.NAO_ENCONTRADO, "Pagamento não encontrado.");
  if (String(pag.usuario_id) !== String(usuarioId))
    lancar(ERRO.VALIDACAO, "Sem acesso a este pagamento.");

  const recebedorContatoId = String((data && data.recebedor_contato_id) || "");
  if (recebedorContatoId) _contatoDoUsuario(recebedorContatoId, usuarioId);
  const repassados = (Array.isArray(data && data.contatos_repassados) ? data.contatos_repassados : [])
    .map(function (c) {
      return String(c || "");
    })
    .filter(Boolean);
  repassados.forEach(function (cid) {
    _contatoDoUsuario(cid, usuarioId);
  });
  const valor = Number(data && data.valor) || 0;

  const agora = agoraIso();
  const nome = (buscarUsuarioPorId(usuarioId) || {}).nome || "";
  const repasse = {
    id: novoId(),
    usuario_id: usuarioId,
    pagamento_id: pagamentoId,
    recebedor_contato_id: recebedorContatoId,
    obra_id: String((data && data.obra_id) || pag.obra_id || ""),
    contatos_repassados: JSON.stringify(repassados),
    valor: valor,
    data: String((data && data.data) || agora.substring(0, 10)),
    observacao: String((data && data.observacao) || ""),
    criado_em: agora,
    autor_nome: nome,
    atualizado_em: agora,
    editor_nome: nome,
  };
  return comLock(function () {
    repoInserir(SCHEMA.REPASSES, repasse);
    return { repasse: _lerRepasse(repasse) };
  });
}

/** repasses.remover -> { id }. */
function repassesRemover(data, sessao) {
  const id = String((data && data.id) || "");
  const r = repoEncontrar(SCHEMA.REPASSES, function (x) {
    return String(x.id) === String(id);
  });
  if (!r) lancar(ERRO.NAO_ENCONTRADO, "Repasse não encontrado.");
  if (String(r.usuario_id) !== String(sessao.usuario_id))
    lancar(ERRO.VALIDACAO, "Sem acesso a este repasse.");
  return comLock(function () {
    repoRemover(SCHEMA.REPASSES, "id", id);
    return { id: id };
  });
}
