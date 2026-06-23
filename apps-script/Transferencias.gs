/**
 * Transferencias.gs — TRANSFERÊNCIA: agrupa N pagamentos numa única operação.
 *
 * Uma transferência é gerada automaticamente ao lançar pagamento(s): registra
 * N PAGAMENTOS (1 por despesa) e 1 TRANSFERÊNCIA que os agrupa. Vínculo bidirecional
 * (pagamento.transferencia_id ↔ transferencia.pagamento_ids) e cascata total.
 *
 * Regra de ouro: a transferência só existe quando TODAS as despesas selecionadas têm
 * o MESMO recebedor + a MESMA empresa (+ mesma obra). Caso contrário, ERRO e nada é
 * gravado (toda a validação roda ANTES do comLock → atômico por construção).
 */

/* --------------------------- Leitura/normalização --------------------------- */

function _lerTransferencia(t) {
  if (!t) return t;
  return Object.assign({}, t, {
    valor_total: Number(t.valor_total) || 0,
    pagamento_ids: _parseJsonLista(t.pagamento_ids),
  });
}

function listarTransferenciasUsuario(usuarioId) {
  return repoFiltrar(SCHEMA.TRANSFERENCIAS, function (t) {
    return String(t.usuario_id) === String(usuarioId);
  }).map(_lerTransferencia);
}

/* ------------------------------- Helpers ------------------------------------ */

/**
 * Deriva o recebedor/empresa de uma despesa (fonte única, usada pela transferência e
 * por despesasLancarPagamento): equipe → líder + fornecedor ""; senão contato ofertante
 * + fornecedor da despesa.
 */
function _recebedorDaDespesa(despesa) {
  const equipeId = String((despesa && despesa.ofertante_equipe_id) || "");
  if (equipeId) {
    const equipe =
      repoEncontrar(SCHEMA.EQUIPES, function (x) {
        return String(x.id) === equipeId;
      }) || {};
    return {
      recebedor_contato_id: String(equipe.lider_id || ""),
      recebedor_equipe_id: equipeId,
      fornecedor_id: "",
    };
  }
  return {
    recebedor_contato_id: String((despesa && despesa.ofertante_contato_id) || ""),
    recebedor_equipe_id: "",
    fornecedor_id: String((despesa && despesa.fornecedor_id) || ""),
  };
}

/**
 * Ajusta uma transferência após a remoção isolada de um de seus pagamentos.
 * SEM lock (roda dentro do lock de pagamentosRemover). Se sobrar 0 pagamento, remove
 * a transferência (regra "pagamento não existe sem transferência").
 */
function _ajustarTransferenciaAposRemocao(transferenciaId, pagamentoRemovidoId) {
  const t = repoEncontrar(SCHEMA.TRANSFERENCIAS, function (x) {
    return String(x.id) === String(transferenciaId);
  });
  if (!t) return;
  const restantes = _parseJsonLista(t.pagamento_ids).filter(function (pid) {
    return String(pid) !== String(pagamentoRemovidoId);
  });
  if (!restantes.length) {
    repoRemover(SCHEMA.TRANSFERENCIAS, "id", transferenciaId);
    return;
  }
  let total = 0;
  restantes.forEach(function (pid) {
    const p = repoEncontrar(SCHEMA.PAGAMENTOS, function (x) {
      return String(x.id) === String(pid);
    });
    if (p) total += Number(p.valor) || 0;
  });
  repoAtualizar(SCHEMA.TRANSFERENCIAS, "id", transferenciaId, {
    pagamento_ids: JSON.stringify(restantes),
    valor_total: total,
    atualizado_em: agoraIso(),
  });
}

/* ----------------------------- Transferências ------------------------------- */

/**
 * transferencias.lancar -> { transferencia, pagamentos, despesas, resumo }.
 * Cria 1 transferência + N pagamentos (1 alocação cada). Tudo sob 1 comLock; toda a
 * validação (tipo, acesso, homogeneidade recebedor+empresa+obra, não-estouro) ocorre
 * ANTES do lock, então recebedor divergente ⇒ NADA é gravado.
 */
function transferenciasLancar(data, sessao) {
  const usuarioId = sessao.usuario_id;

  // Tipo é um NOME livre (base ou definido pelo usuário); só não pode ser vazio.
  const tipo = String((data && data.tipo) || "dinheiro").trim() || "dinheiro";

  const pagador = String((data && (data.pagador_chave || data.pagador)) || "");
  if (!pagador) lancar(ERRO.VALIDACAO, "Selecione quem pagou.");

  const alocacoes = (Array.isArray(data && data.alocacoes) ? data.alocacoes : [])
    .map(function (a) {
      return { despesa_id: String((a && a.despesa_id) || ""), valor: Number(a && a.valor) || 0 };
    })
    .filter(function (a) {
      return a.despesa_id && a.valor > 0;
    });
  if (!alocacoes.length) lancar(ERRO.VALIDACAO, "Informe ao menos uma despesa e valor.");

  // Acesso + derivação do recebedor + REGRA DE OURO (mesmo recebedor/empresa/obra).
  const mapaDespesa = {};
  let obraId = String((data && data.obra_id) || "");
  let chaveRef = null;
  alocacoes.forEach(function (a) {
    const d = _despesaAcessivel(a.despesa_id, usuarioId);
    mapaDespesa[a.despesa_id] = d;
    if (!obraId) obraId = String(d.obra_id || "");
    const rec = _recebedorDaDespesa(d);
    const chave = [rec.recebedor_equipe_id || rec.recebedor_contato_id, rec.fornecedor_id, String(d.obra_id || "")].join("|");
    if (chaveRef === null) chaveRef = chave;
    else if (chave !== chaveRef)
      lancar(ERRO.VALIDACAO, "Todos os recebedores e a empresa devem ser os mesmos para uma transferência.");
  });

  const agora = agoraIso();
  const dataTransf = String((data && data.data) || agora.substring(0, 10));
  // Distribuição por integrante só vale p/ transferência de 1 despesa com recebedor-equipe.
  const distribuicao = Array.isArray(data && data.distribuicao) ? data.distribuicao : [];

  const transferenciaId = novoId();
  // Monta (valida) cada pagamento ANTES de gravar — herda transferencia_id + tipo.
  const pagamentos = alocacoes.map(function (a) {
    const rec = _recebedorDaDespesa(mapaDespesa[a.despesa_id]);
    return _pagamentoMontar(
      {
        alocacoes: [{ despesa_id: a.despesa_id, valor: a.valor }],
        pagador_chave: pagador,
        recebedor_contato_id: rec.recebedor_contato_id,
        recebedor_equipe_id: rec.recebedor_equipe_id,
        fornecedor_id: rec.fornecedor_id,
        distribuicao: alocacoes.length === 1 && rec.recebedor_equipe_id ? distribuicao : [],
        obra_id: obraId,
        data: dataTransf,
        tipo: tipo,
        transferencia_id: transferenciaId,
      },
      sessao
    );
  });

  const valorTotal = alocacoes.reduce(function (s, a) {
    return s + a.valor;
  }, 0);
  const rec0 = _recebedorDaDespesa(mapaDespesa[alocacoes[0].despesa_id]);
  const nome = (buscarUsuarioPorId(usuarioId) || {}).nome || "";
  const transferencia = {
    id: transferenciaId,
    usuario_id: usuarioId,
    obra_id: obraId,
    data: dataTransf,
    valor_total: valorTotal,
    tipo: tipo,
    recebedor_contato_id: rec0.recebedor_contato_id,
    recebedor_equipe_id: rec0.recebedor_equipe_id,
    fornecedor_id: rec0.fornecedor_id,
    pagador_chave: pagador,
    pagador_contato_id: _contatoDeChave(pagador),
    pagamento_ids: JSON.stringify(
      pagamentos.map(function (p) {
        return p.id;
      })
    ),
    observacao: String((data && data.observacao) || ""),
    criado_em: agora,
    autor_nome: nome,
    atualizado_em: agora,
    editor_nome: nome,
  };

  return comLock(function () {
    repoInserir(SCHEMA.TRANSFERENCIAS, transferencia);
    let despesas = [];
    const pagamentosLidos = pagamentos.map(function (p) {
      const r = _pagamentoGravar(p);
      despesas = despesas.concat(r.despesas);
      return r.pagamento;
    });
    return {
      transferencia: _lerTransferencia(transferencia),
      pagamentos: pagamentosLidos,
      despesas: despesas,
      resumo: obraId ? _calcularResumo(obraId, usuarioId) : null,
    };
  });
}

/**
 * transferencias.remover -> { id, despesas, resumo }. Cascata: remove TODOS os
 * pagamentos da transferência (cada um já cascateia seus repasses e re-sincroniza a
 * despesa) e depois a própria transferência. Tudo sob 1 comLock.
 */
function transferenciasRemover(data, sessao) {
  const id = String((data && data.id) || "");
  const t = repoEncontrar(SCHEMA.TRANSFERENCIAS, function (x) {
    return String(x.id) === String(id);
  });
  if (!t) lancar(ERRO.NAO_ENCONTRADO, "Transferência não encontrada.");
  if (String(t.usuario_id) !== String(sessao.usuario_id))
    lancar(ERRO.VALIDACAO, "Sem acesso a esta transferência.");
  const obraId = String(t.obra_id || "");
  const pagIds = _parseJsonLista(t.pagamento_ids);

  return comLock(function () {
    let despesas = [];
    pagIds.forEach(function (pid) {
      const r = _pagamentoRemoverInterno(pid);
      despesas = despesas.concat(r.despesas);
    });
    repoRemover(SCHEMA.TRANSFERENCIAS, "id", id);
    return {
      id: id,
      despesas: despesas,
      resumo: obraId ? _calcularResumo(obraId, sessao.usuario_id) : null,
    };
  });
}
