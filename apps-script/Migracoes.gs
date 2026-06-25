/**
 * Migracoes.gs — Reparos de dados que rodam UMA vez (guardados por flag em
 * ScriptProperties), disparados no próximo `dados.snapshot`. Idempotentes.
 */

/**
 * Reverte OFERTAS ÓRFÃS: `despesa_id` aponta para uma despesa que não existe mais
 * (despesas excluídas antes da regra de reversão). Limpa `despesa_id`/`escolhido`
 * e reabre a cotação vinculada — deixando a oferta disponível para novo registro.
 * Retorna o nº de ofertas reparadas.
 */
function _repararOfertasOrfas() {
  const idsDespesa = {};
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    idsDespesa[String(d.id)] = true;
  });
  let reparadas = 0;
  repoListar(SCHEMA.COTACAO_PRECOS).forEach(function (p) {
    const did = String(p.despesa_id || "");
    if (did && !idsDespesa[did]) {
      repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", p.id, { despesa_id: "", escolhido: false });
      reparadas++;
      if (String(p.cotacao_id || "")) {
        const c = repoEncontrar(SCHEMA.COTACOES, function (x) {
          return String(x.id) === String(p.cotacao_id);
        });
        if (c) {
          repoAtualizar(SCHEMA.COTACOES, "id", p.cotacao_id, {
            status: "aberta",
            atualizado_em: agoraIso(),
          });
        }
      }
    }
  });
  return reparadas;
}

/**
 * Extrai os pagamentos EMBUTIDOS (despesa.pagamentos_realizados) p/ a aba PAGAMENTOS,
 * como entidades próprias (1 leva → 1 pagamento, 1 alocação). Idempotente via
 * `origem_leva_id`. NÃO apaga os embutidos (continuam como espelho). Retorna nº criados.
 */
function _migrarPagamentosEmbutidos_v1() {
  const jaTem = {};
  repoListar(SCHEMA.PAGAMENTOS).forEach(function (p) {
    const lid = String(p.origem_leva_id || "");
    if (lid) jaTem[lid] = true;
  });
  let criados = 0;
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    const levas = _parseJsonLista(d.pagamentos_realizados);
    levas.forEach(function (lv) {
      const lid = String((lv && lv.id) || "");
      if (!lid || jaTem[lid]) return;
      const valor = Number(lv.valor) || 0;
      repoInserir(SCHEMA.PAGAMENTOS, {
        id: novoId(),
        usuario_id: d.usuario_id,
        obra_id: d.obra_id,
        data: lv.data || "",
        valor: valor,
        pagador_chave: String(lv.pagador || ""),
        pagador_contato_id: _contatoDeChave(lv.pagador),
        recebedor_contato_id: String(lv.contato_id || ""),
        recebedor_equipe_id: String(d.ofertante_equipe_id || ""),
        fornecedor_id: String(lv.fornecedor_id || ""),
        alocacoes: JSON.stringify([{ despesa_id: d.id, valor: valor }]),
        distribuicao: JSON.stringify(_parseJsonLista(lv.distribuicao)),
        observacao: "",
        criado_em: lv.criado_em || agoraIso(),
        autor_nome: lv.autor_nome || "",
        atualizado_em: lv.criado_em || agoraIso(),
        editor_nome: "",
        origem_leva_id: lid,
      });
      jaTem[lid] = true;
      criados++;
    });
  });
  return criados;
}

/**
 * Cria 1 TRANSFERÊNCIA (1:1) para cada PAGAMENTO ainda sem `transferencia_id`,
 * copiando recebedor/pagador/empresa/data; tipo default "dinheiro". Vincula os dois
 * lados (pagamento.transferencia_id ↔ transferencia.pagamento_ids). Idempotente
 * (flag + filtro `transferencia_id === ""`). Retorna nº de transferências criadas.
 */
function _migrarTransferencias_v1() {
  let criadas = 0;
  repoListar(SCHEMA.PAGAMENTOS).forEach(function (p) {
    if (String(p.transferencia_id || "")) return; // já vinculado
    const agora = agoraIso();
    const tipo = String(p.tipo || "") || "dinheiro";
    const tId = novoId();
    repoInserir(SCHEMA.TRANSFERENCIAS, {
      id: tId,
      usuario_id: p.usuario_id,
      obra_id: p.obra_id,
      data: p.data || "",
      valor_total: Number(p.valor) || 0,
      tipo: tipo,
      recebedor_contato_id: String(p.recebedor_contato_id || ""),
      recebedor_equipe_id: String(p.recebedor_equipe_id || ""),
      fornecedor_id: String(p.fornecedor_id || ""),
      pagador_chave: String(p.pagador_chave || ""),
      pagador_contato_id: String(p.pagador_contato_id || ""),
      pagamento_ids: JSON.stringify([p.id]),
      observacao: "",
      criado_em: p.criado_em || agora,
      autor_nome: p.autor_nome || "",
      atualizado_em: agora,
      editor_nome: "",
    });
    repoAtualizar(SCHEMA.PAGAMENTOS, "id", p.id, {
      transferencia_id: tId,
      tipo: tipo,
      atualizado_em: agora,
    });
    criadas++;
  });
  return criadas;
}

/**
 * Unifica as cotações no modo ÚNICO "subclasse" (elimina o antigo "por item"):
 * cada cotação passa a ser por subclassificação e as ofertas agrupam por item.
 * Para cada cotação com modo != "subclasse":
 *  - define `categoria_id` (se vazio) a partir da subclassificação do item da cotação;
 *  - marca `modo = "subclasse"`;
 *  - ofertas sem `item_id` próprio HERDAM o `item_id` da cotação (p/ agruparem por item).
 * Idempotente (filtro `modo !== "subclasse"`). Retorna o nº de cotações migradas.
 */
function _migrarCotacoesSubclasse_v1() {
  const itensPorId = {};
  repoListar(SCHEMA.ITENS).forEach(function (i) {
    itensPorId[String(i.id)] = i;
  });
  const ofertasPorCotacao = {};
  repoListar(SCHEMA.COTACAO_PRECOS).forEach(function (p) {
    const cid = String(p.cotacao_id || "");
    if (!cid) return;
    (ofertasPorCotacao[cid] = ofertasPorCotacao[cid] || []).push(p);
  });
  let migradas = 0;
  repoListar(SCHEMA.COTACOES).forEach(function (c) {
    if (String(c.modo || "") === "subclasse") return; // já no modo único
    const itemId = String(c.item_id || "");
    const item = itensPorId[itemId];
    const catId = String(c.categoria_id || "") || (item ? String(item.categoria_id || "") : "");
    repoAtualizar(SCHEMA.COTACOES, "id", c.id, {
      modo: "subclasse",
      categoria_id: catId,
      atualizado_em: agoraIso(),
    });
    // Ofertas sem item próprio herdam o item da cotação (para agruparem por item).
    if (itemId) {
      (ofertasPorCotacao[String(c.id)] || []).forEach(function (p) {
        if (!String(p.item_id || "")) {
          repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", p.id, { item_id: itemId });
        }
      });
    }
    migradas++;
  });
  return migradas;
}

/**
 * Garante 1 ÚNICA cotação por subclassificação (usuário + categoria_id): mantém a
 * cotação mais ANTIGA como canônica, REATRIBUI as ofertas (e o histórico de preços)
 * das duplicatas para ela e REMOVE as duplicatas. Cotações sem categoria_id não são
 * agrupadas. Idempotente (depois de rodar não há duplicatas). Roda DEPOIS de
 * `mig_cotacoes_subclasse_v1` (que define categoria_id). Retorna nº de duplicatas removidas.
 */
function _migrarCotacoesUnicas_v1() {
  const todas = repoListar(SCHEMA.COTACOES);
  const canon = {}; // "usuario|categoria" -> cotação canônica (mais antiga)
  todas.forEach(function (c) {
    const cat = String(c.categoria_id || "");
    if (!cat) return;
    const k = String(c.usuario_id || "") + "|" + cat;
    const atual = canon[k];
    if (!atual || String(c.criado_em || "") < String(atual.criado_em || "")) canon[k] = c;
  });
  const idCanonDe = {}; // cotacaoId duplicada -> id da canônica
  todas.forEach(function (c) {
    const cat = String(c.categoria_id || "");
    if (!cat) return;
    const can = canon[String(c.usuario_id || "") + "|" + cat];
    if (can && String(can.id) !== String(c.id)) idCanonDe[String(c.id)] = String(can.id);
  });
  if (!Object.keys(idCanonDe).length) return 0;
  // Ofertas das duplicatas → canônica.
  repoListar(SCHEMA.COTACAO_PRECOS).forEach(function (p) {
    const novo = idCanonDe[String(p.cotacao_id || "")];
    if (novo) repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", p.id, { cotacao_id: novo });
  });
  // Histórico de preços acompanha.
  repoListar(SCHEMA.COTACAO_PRECO_HISTORICO).forEach(function (h) {
    const novo = idCanonDe[String(h.cotacao_id || "")];
    if (novo) repoAtualizar(SCHEMA.COTACAO_PRECO_HISTORICO, "id", h.id, { cotacao_id: novo });
  });
  // Remove as cotações duplicadas (já esvaziadas).
  let removidas = 0;
  Object.keys(idCanonDe).forEach(function (dupId) {
    repoRemover(SCHEMA.COTACOES, "id", dupId);
    removidas++;
  });
  return removidas;
}

/**
 * ESTOQUE — backfill: para cada despesa Material (a) preenche quantidade/unidade a
 * partir da oferta (preco_id) se estiverem vazias; (b) se já QUITADA com qtd>0 e
 * ainda sem `entrada_despesa`, cria a entrada no livro-razão. Idempotente (flag +
 * checagem de existência da entrada). Roda DEPOIS das migrações de cotação (precisa
 * de preco.quantidade já consolidado). Retorna nº de entradas criadas.
 */
function _migrarEstoqueBackfill_v1() {
  const ofertas = {};
  repoListar(SCHEMA.COTACAO_PRECOS).forEach(function (p) {
    ofertas[String(p.id)] = p;
  });
  const cotacoes = {};
  repoListar(SCHEMA.COTACOES).forEach(function (c) {
    cotacoes[String(c.id)] = c;
  });
  const jaTemEntrada = {};
  repoListar(SCHEMA.ESTOQUE).forEach(function (m) {
    if (String(m.tipo) === "entrada_despesa" && String(m.despesa_id))
      jaTemEntrada[String(m.despesa_id)] = true;
  });
  let entradas = 0;
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    if (String(d.classificacao || "") !== "Material") return;
    let qtd = Number(d.quantidade) || 0;
    let unidade = String(d.unidade || "");
    // (a) backfill quantidade/unidade da despesa a partir da oferta.
    if ((!qtd || !unidade) && String(d.preco_id || "")) {
      const p = ofertas[String(d.preco_id)];
      if (p) {
        const c = cotacoes[String(p.cotacao_id)] || null;
        if (!qtd)
          qtd = Number(p.quantidade) > 0 ? Number(p.quantidade) : (c && Number(c.quantidade) > 0 ? Number(c.quantidade) : 0);
        if (!unidade) unidade = String(p.unidade || (c && c.unidade) || "");
        const patch = {};
        if (!(Number(d.quantidade) > 0) && qtd > 0) patch.quantidade = qtd;
        if (!String(d.unidade || "") && unidade) patch.unidade = unidade;
        if (Object.keys(patch).length) repoAtualizar(SCHEMA.DESPESAS, "id", d.id, patch);
      }
    }
    // (b) entrada de estoque p/ as quitadas com qtd>0 ainda sem entrada.
    const pago = d.pago === true || d.pago === "TRUE" || d.pago === "true";
    if (pago && qtd > 0 && !jaTemEntrada[String(d.id)]) {
      const agora = agoraIso();
      repoInserir(SCHEMA.ESTOQUE, {
        id: novoId(),
        usuario_id: d.usuario_id,
        obra_id: d.obra_id,
        item_id: d.item_id,
        classificacao: d.classificacao,
        categoria_id: d.categoria_id || "",
        unidade: unidade,
        tipo: "entrada_despesa",
        quantidade: qtd,
        despesa_id: String(d.id),
        obra_origem_id: "",
        obra_destino_id: "",
        par_id: "",
        data: String(d.data || agora.substring(0, 10)),
        observacao: "",
        criado_em: agora,
        autor_nome: d.autor_nome || "",
        atualizado_em: agora,
        editor_nome: "",
      });
      jaTemEntrada[String(d.id)] = true;
      entradas++;
    }
  });
  return entradas;
}

/** Roda as migrações pendentes UMA vez (double-checked via flag + lock). */
function _migrarUmaVez() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("mig_ofertas_orfas_v1") !== "1") {
    comLock(function () {
      if (props.getProperty("mig_ofertas_orfas_v1") === "1") return;
      _repararOfertasOrfas();
      props.setProperty("mig_ofertas_orfas_v1", "1");
    });
  }
  if (props.getProperty("mig_pagamentos_v1") !== "1") {
    comLock(function () {
      if (props.getProperty("mig_pagamentos_v1") === "1") return;
      _migrarPagamentosEmbutidos_v1();
      props.setProperty("mig_pagamentos_v1", "1");
    });
  }
  // Depois de mig_pagamentos_v1 (precisa que as levas já sejam entidades Pagamento).
  if (props.getProperty("mig_transferencias_v1") !== "1") {
    comLock(function () {
      if (props.getProperty("mig_transferencias_v1") === "1") return;
      _migrarTransferencias_v1();
      props.setProperty("mig_transferencias_v1", "1");
    });
  }
  if (props.getProperty("mig_cotacoes_subclasse_v1") !== "1") {
    comLock(function () {
      if (props.getProperty("mig_cotacoes_subclasse_v1") === "1") return;
      _migrarCotacoesSubclasse_v1();
      props.setProperty("mig_cotacoes_subclasse_v1", "1");
    });
  }
  // Depois de subclasse_v1 (precisa do categoria_id já preenchido) — unifica 1 por subclasse.
  if (props.getProperty("mig_cotacoes_unicas_v1") !== "1") {
    comLock(function () {
      if (props.getProperty("mig_cotacoes_unicas_v1") === "1") return;
      _migrarCotacoesUnicas_v1();
      props.setProperty("mig_cotacoes_unicas_v1", "1");
    });
  }
  // Depois das migrações de cotação (precisa de preco.quantidade) — backfill do estoque.
  if (props.getProperty("mig_estoque_v1") !== "1") {
    comLock(function () {
      if (props.getProperty("mig_estoque_v1") === "1") return;
      _migrarEstoqueBackfill_v1();
      props.setProperty("mig_estoque_v1", "1");
    });
  }
}
