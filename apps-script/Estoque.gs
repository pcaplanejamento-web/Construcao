/**
 * Estoque.gs — Controle de estoque por obra, como LIVRO-RAZÃO de movimentos
 * (tabela SCHEMA.ESTOQUE, append-only). A "lista do estoque" e os "consumidos" são
 * sempre DERIVADOS por (obra_id, item_id) — nunca um contador mutável (mesmo
 * princípio do resumo financeiro), o que evita divergência.
 *
 * tipo do movimento:
 *  - entrada_despesa        (+ adquirido) — automático ao QUITAR despesa Material
 *  - entrada_manual         (+ adquirido) — item 15
 *  - entrada_transferencia  (+ adquirido) — chega de outra obra (obra_origem_id)
 *  - saida_transferencia    (− adquirido) — sai p/ outra obra (obra_destino_id)
 *  - consumo                (+ consumido) — reduzir o estoque (item 5/6)
 *  - retorno                (− consumido) — aumentar de volta (item 7)
 *
 * em_estoque = adquirido − consumido. (Fase 1: leitura + gatilho automático;
 * as rotas de operação/transferência entram nas fases seguintes.)
 */

/** Normaliza um movimento (quantidade numérica). */
function _lerMovimento(m) {
  if (!m) return m;
  return Object.assign({}, m, { quantidade: Number(m.quantidade) || 0 });
}

/** Movimentos das obras acessíveis (mapa { obraId: true }) — usado no snapshot. */
function listarMovimentosDeObras(idsObra) {
  return repoFiltrar(SCHEMA.ESTOQUE, function (m) {
    return idsObra && idsObra[String(m.obra_id)];
  }).map(_lerMovimento);
}

/** Movimentos cujo usuario_id = dono (fallback simples). */
function listarEstoqueUsuario(usuarioId) {
  return repoFiltrar(SCHEMA.ESTOQUE, function (m) {
    return String(m.usuario_id) === String(usuarioId);
  }).map(_lerMovimento);
}

/** Saldo consolidado (adquirido/consumido/em_estoque) de UM (obra, item). */
function _saldoEstoque(obraId, itemId) {
  let adquirido = 0;
  let consumido = 0;
  repoListar(SCHEMA.ESTOQUE).forEach(function (m) {
    if (String(m.obra_id) !== String(obraId) || String(m.item_id) !== String(itemId)) return;
    const q = Number(m.quantidade) || 0;
    const t = String(m.tipo || "");
    if (t === "entrada_despesa" || t === "entrada_manual" || t === "entrada_transferencia") adquirido += q;
    else if (t === "saida_transferencia") adquirido -= q;
    else if (t === "consumo") consumido += q;
    else if (t === "retorno") consumido -= q;
  });
  return { adquirido: adquirido, consumido: consumido, em_estoque: adquirido - consumido };
}

/** Entrada de estoque (entrada_despesa) de uma despesa Material já quitada. */
function _entradaDespesaExistente(despesaId) {
  const did = String(despesaId || "");
  if (!did) return null;
  return repoEncontrar(SCHEMA.ESTOQUE, function (m) {
    return String(m.tipo) === "entrada_despesa" && String(m.despesa_id) === did;
  });
}

/**
 * Gatilho automático (itens 2/11): ao QUITAR (pago=true) uma despesa Material com
 * quantidade > 0, cria a entrada_despesa (idempotente — 1 por despesa_id). Ao
 * DESPAGAR (pago=false), remove a entrada SÓ se ainda couber no estoque (em_estoque
 * ≥ quantidade); senão mantém (a remoção segura ocorre ao devolver o consumido, ou
 * é bloqueada na exclusão da despesa — Fase 5). NUNCA lança (roda no fluxo de
 * pagamento, sob o comLock do chamador).
 */
function _sincronizarEstoqueDaDespesa(desp, pago) {
  if (!desp) return;
  if (String(desp.classificacao || "") !== "Material") return;
  const despesaId = String(desp.id || "");
  const existente = _entradaDespesaExistente(despesaId);
  if (pago) {
    const qtd = Number(desp.quantidade) || 0;
    if (qtd <= 0 || existente) return; // sem quantitativo ou já criada
    const agora = agoraIso();
    repoInserir(SCHEMA.ESTOQUE, {
      id: novoId(),
      usuario_id: desp.usuario_id,
      obra_id: desp.obra_id,
      item_id: desp.item_id,
      classificacao: desp.classificacao,
      categoria_id: desp.categoria_id || "",
      unidade: desp.unidade || "",
      tipo: "entrada_despesa",
      quantidade: qtd,
      despesa_id: despesaId,
      obra_origem_id: "",
      obra_destino_id: "",
      par_id: "",
      data: String(desp.data || agora.substring(0, 10)),
      observacao: "",
      criado_em: agora,
      autor_nome: desp.autor_nome || "",
      atualizado_em: agora,
      editor_nome: "",
    });
  } else if (existente) {
    const saldo = _saldoEstoque(desp.obra_id, desp.item_id);
    if (saldo.em_estoque >= (Number(existente.quantidade) || 0)) {
      repoRemover(SCHEMA.ESTOQUE, "id", existente.id);
    }
  }
}

/* ----------------------------- Operações ----------------------------- */

/** Unidade "atual" de um (obra,item): a do 1º movimento que a tiver (p/ consistência). */
function _unidadeAtual(obraId, itemId) {
  const m = repoEncontrar(SCHEMA.ESTOQUE, function (x) {
    return String(x.obra_id) === String(obraId) && String(x.item_id) === String(itemId) && String(x.unidade || "");
  });
  return m ? String(m.unidade || "") : "";
}

/** Insere um movimento (preenche defaults/auditoria) e devolve o objeto inserido. */
function _inserirMovimento(usuarioId, campos) {
  const nome = (buscarUsuarioPorId(usuarioId) || {}).nome || "";
  const agora = agoraIso();
  const mov = {
    id: novoId(),
    usuario_id: campos.usuario_id || usuarioId,
    obra_id: String(campos.obra_id || ""),
    item_id: String(campos.item_id || ""),
    classificacao: String(campos.classificacao || ""),
    categoria_id: String(campos.categoria_id || ""),
    unidade: String(campos.unidade || ""),
    tipo: String(campos.tipo || ""),
    quantidade: Number(campos.quantidade) || 0,
    despesa_id: String(campos.despesa_id || ""),
    obra_origem_id: String(campos.obra_origem_id || ""),
    obra_destino_id: String(campos.obra_destino_id || ""),
    par_id: String(campos.par_id || ""),
    data: String(campos.data || agora.substring(0, 10)),
    observacao: String(campos.observacao || ""),
    criado_em: agora,
    autor_nome: nome,
    atualizado_em: agora,
    editor_nome: "",
  };
  repoInserir(SCHEMA.ESTOQUE, mov);
  return _lerMovimento(mov);
}

/** estoque.listar -> { movimentos } de uma obra acessível. */
function estoqueListar(data, sessao) {
  const obraId = String((data && data.obra_id) || "");
  _obraAcessivel(obraId, sessao.usuario_id);
  return {
    movimentos: repoFiltrar(SCHEMA.ESTOQUE, function (m) {
      return String(m.obra_id) === obraId;
    }).map(_lerMovimento),
  };
}

/**
 * estoque.criarMovimento -> { movimentos: [...] }. Despacha por `acao`:
 *  - consumir  (item 5/6): reduz o estoque; quantidade ≤ em_estoque (item 10)
 *  - devolver  (item 7):   volta do consumido; quantidade ≤ consumido (item 10)
 *  - manual    (item 15):  entrada sem despesa; herda classificação/subclasse do item (item 16)
 *  - transferir(item 14):  move o saldo p/ outra obra (registra a origem no destino)
 * Toda validação ANTES do comLock (espelha Transferencias.gs).
 */
function estoqueCriarMovimento(data, sessao) {
  const usuarioId = sessao.usuario_id;
  const acao = String((data && data.acao) || "");
  const obraId = String((data && data.obra_id) || "");
  const itemId = String((data && data.item_id) || "");
  const qtd = Number(data && data.quantidade) || 0;
  _obraAcessivel(obraId, usuarioId);
  if (!itemId) lancar(ERRO.VALIDACAO, "Selecione o item.");
  if (!(qtd > 0)) lancar(ERRO.VALIDACAO, "Informe uma quantidade maior que zero.");

  if (acao === "consumir") {
    const saldo = _saldoEstoque(obraId, itemId);
    if (qtd - saldo.em_estoque > 0.0001)
      lancar(ERRO.VALIDACAO, "Não há esse tanto em estoque (disponível: " + saldo.em_estoque + ").");
    return comLock(function () {
      return {
        movimentos: [
          _inserirMovimento(usuarioId, {
            obra_id: obraId, item_id: itemId, tipo: "consumo", quantidade: qtd,
            classificacao: data.classificacao || "", categoria_id: data.categoria_id || "",
            unidade: _unidadeAtual(obraId, itemId), observacao: data.observacao || "",
          }),
        ],
      };
    });
  }

  if (acao === "devolver") {
    const saldo = _saldoEstoque(obraId, itemId);
    if (qtd - saldo.consumido > 0.0001)
      lancar(ERRO.VALIDACAO, "Não dá p/ devolver mais do que foi consumido (consumido: " + saldo.consumido + ").");
    return comLock(function () {
      return {
        movimentos: [
          _inserirMovimento(usuarioId, {
            obra_id: obraId, item_id: itemId, tipo: "retorno", quantidade: qtd,
            classificacao: data.classificacao || "", categoria_id: data.categoria_id || "",
            unidade: _unidadeAtual(obraId, itemId), observacao: data.observacao || "",
          }),
        ],
      };
    });
  }

  if (acao === "manual") {
    const item = _itemPorId(itemId, usuarioId); // valida + herda classificação/subclasse (item 16)
    const unidade = String((data && data.unidade) || _unidadeAtual(obraId, itemId) || "");
    return comLock(function () {
      return {
        movimentos: [
          _inserirMovimento(usuarioId, {
            obra_id: obraId, item_id: itemId, tipo: "entrada_manual", quantidade: qtd,
            classificacao: item.classificacao || "", categoria_id: item.categoria_id || "",
            unidade: unidade, observacao: data.observacao || "",
          }),
        ],
      };
    });
  }

  if (acao === "transferir") {
    const destinoId = String((data && data.obra_destino_id) || "");
    if (!destinoId || destinoId === obraId)
      lancar(ERRO.VALIDACAO, "Selecione uma obra de destino diferente.");
    _obraAcessivel(destinoId, usuarioId);
    const saldo = _saldoEstoque(obraId, itemId);
    if (qtd - saldo.em_estoque > 0.0001)
      lancar(ERRO.VALIDACAO, "Não há esse tanto em estoque p/ transferir (disponível: " + saldo.em_estoque + ").");
    const item = _itemPorId(itemId, usuarioId);
    const unidade = _unidadeAtual(obraId, itemId) || "";
    const destino = repoEncontrar(SCHEMA.OBRAS, function (o) {
      return String(o.id) === destinoId;
    }) || {};
    return comLock(function () {
      const par = novoId();
      const saida = _inserirMovimento(usuarioId, {
        obra_id: obraId, item_id: itemId, tipo: "saida_transferencia", quantidade: qtd,
        classificacao: item.classificacao || "", categoria_id: item.categoria_id || "",
        unidade: unidade, obra_destino_id: destinoId, par_id: par, observacao: data.observacao || "",
      });
      const entrada = _inserirMovimento(usuarioId, {
        usuario_id: destino.usuario_id || usuarioId, // some no snapshot do dono da obra destino
        obra_id: destinoId, item_id: itemId, tipo: "entrada_transferencia", quantidade: qtd,
        classificacao: item.classificacao || "", categoria_id: item.categoria_id || "",
        unidade: unidade, obra_origem_id: obraId, par_id: par, observacao: data.observacao || "",
      });
      return { movimentos: [saida, entrada] };
    });
  }

  lancar(ERRO.VALIDACAO, "Ação de estoque desconhecida.");
}

/**
 * estoque.remover -> { removidos: [ids] }. Remove movimento MANUAL ou de TRANSFERÊNCIA
 * (estorna os 2 lados via par_id). Bloqueia `entrada_despesa` (gerida pela despesa) e
 * bloqueia se a remoção deixaria o estoque negativo (já consumido) — item 18/20.
 */
function estoqueRemover(data, sessao) {
  const id = String((data && data.id) || "");
  const mov = repoEncontrar(SCHEMA.ESTOQUE, function (m) {
    return String(m.id) === id;
  });
  if (!mov) lancar(ERRO.NAO_ENCONTRADO, "Movimento de estoque não encontrado.");
  _obraAcessivel(mov.obra_id, sessao.usuario_id);
  const tipo = String(mov.tipo || "");
  if (tipo === "entrada_despesa")
    lancar(ERRO.VALIDACAO, "Esta entrada vem de uma despesa paga — gerencie pela despesa.");
  if (tipo === "consumo" || tipo === "retorno")
    lancar(ERRO.VALIDACAO, "Use Aumentar/Reduzir para ajustar consumo.");

  return comLock(function () {
    const removidos = [];
    // Transferência: estorna os 2 lados (par_id); bloqueia se o destino já consumiu.
    if (tipo === "entrada_transferencia" || tipo === "saida_transferencia") {
      const par = String(mov.par_id || "");
      const lados = par
        ? repoFiltrar(SCHEMA.ESTOQUE, function (m) {
            return String(m.par_id) === par;
          })
        : [mov];
      const entrada = lados.find(function (m) {
        return String(m.tipo) === "entrada_transferencia";
      });
      if (entrada) {
        const saldoDest = _saldoEstoque(entrada.obra_id, entrada.item_id);
        if ((Number(entrada.quantidade) || 0) - saldoDest.em_estoque > 0.0001)
          lancar(
            ERRO.VALIDACAO,
            "A obra de destino já consumiu parte deste item — devolva ao estoque (aba Estoque › Consumidos) antes de estornar a transferência."
          );
      }
      lados.forEach(function (m) {
        repoRemover(SCHEMA.ESTOQUE, "id", m.id);
        removidos.push(m.id);
      });
      return { removidos: removidos };
    }
    // Manual: bloqueia se não couber (já consumido) — item 18/19.
    if (tipo === "entrada_manual") {
      const saldo = _saldoEstoque(mov.obra_id, mov.item_id);
      if ((Number(mov.quantidade) || 0) - saldo.em_estoque > 0.0001)
        lancar(
          ERRO.VALIDACAO,
          "Parte deste item já foi consumida — devolva ao estoque (aba Estoque › Consumidos) antes de remover esta entrada."
        );
      repoRemover(SCHEMA.ESTOQUE, "id", mov.id);
      removidos.push(mov.id);
      return { removidos: removidos };
    }
    lancar(ERRO.VALIDACAO, "Não é possível remover este movimento.");
  });
}
