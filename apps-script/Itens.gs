/**
 * Itens.gs — Catálogo de itens do usuário. Cada item é classificado como
 * Material ou Serviço (CLASSIFICACOES_ITEM). Despesas e cotações referenciam um
 * item (Fase 2). Mesmo padrão de Fornecedores.gs: validação + comLock + remoção
 * lógica (ativo = false) para preservar histórico.
 */

/** Verdadeiro se o item está ativo (aceita boolean ou texto). */
function _itemAtivo(i) {
  return i.ativo === true || i.ativo === "TRUE" || i.ativo === "true";
}

/** Normaliza a classificação para um valor válido: base (CLASSIFICACOES_ITEM) OU uma
 *  classificação EXTRA criada pelo admin (Classificacoes.gs). Inválida → base[0]. */
function _classificacaoValida(v) {
  const canonical = _nomesClassificacaoValidos()[String(v || "").trim().toLowerCase()];
  return canonical || CLASSIFICACOES_ITEM[0];
}

/** Lista os itens ativos do usuário (ordenados por nome). */
function listarItensUsuario(usuarioId) {
  const lista = repoFiltrar(SCHEMA.ITENS, function (i) {
    return _itemAtivo(i) && String(i.usuario_id) === String(usuarioId);
  });
  lista.sort(function (a, b) {
    return String(a.nome).localeCompare(String(b.nome));
  });
  return lista;
}

/** Garante que o item é do usuário; senão lança. */
function _itemDoUsuario(itemId, usuarioId) {
  const i = repoEncontrar(SCHEMA.ITENS, function (x) {
    return String(x.id) === String(itemId);
  });
  if (!i || String(i.usuario_id) !== String(usuarioId)) {
    lancar(ERRO.NAO_AUTORIZADO, "Item não pode ser alterado.");
  }
  return i;
}

/** Item ATIVO do usuário por id (ou lança). Usado por despesas/cotações. */
function _itemPorId(itemId, usuarioId) {
  const i = _itemDoUsuario(itemId, usuarioId);
  if (!_itemAtivo(i)) lancar(ERRO.VALIDACAO, "Item inválido.");
  return i;
}

/**
 * Item ATIVO para uso (LEITURA) numa despesa/estoque de OBRA ACESSÍVEL: aceita o
 * item do PRÓPRIO usuário OU um item REFERENCIADO por alguma obra acessível
 * (`refI` = `_refsAcessiveis(usuarioId).refI`). Assim o colaborador só usa itens
 * que o snapshot já lhe mostrou — nunca um id arbitrário do catálogo do dono que
 * a obra não referencia (evita exfiltração via injeção→incorporar). Leitura-só.
 */
function _itemParaObra(itemId, usuarioId, refI) {
  const i = repoEncontrar(SCHEMA.ITENS, function (x) {
    return String(x.id) === String(itemId);
  });
  if (!i || (String(i.usuario_id) !== String(usuarioId) && !(refI && refI[String(itemId)]))) {
    lancar(ERRO.NAO_AUTORIZADO, "Item não disponível nesta obra.");
  }
  if (!_itemAtivo(i)) lancar(ERRO.VALIDACAO, "Item inválido.");
  return i;
}

/** itens.listar -> { itens: [...] }. */
function itensListar(data, sessao) {
  return { itens: listarItensUsuario(sessao.usuario_id) };
}

/**
 * itens.incorporar -> { item } — COPIA um item (catálogo) vindo de obra
 * compartilhada para o acervo PESSOAL. A subclassificação (categoria_id) do dono
 * é limpa (reclassificar manualmente).
 */
function itensIncorporar(data, sessao) {
  const id = String((data && data.id) || "");
  const origem = repoEncontrar(SCHEMA.ITENS, function (x) { return String(x.id) === id; });
  if (!origem) lancar(ERRO.NAO_ENCONTRADO, "Item não encontrado.");
  if (String(origem.usuario_id) === String(sessao.usuario_id)) lancar(ERRO.VALIDACAO, "Este item já é seu.");
  if (!_idReferenciadoEmObraAcessivel(id, sessao.usuario_id)) lancar(ERRO.NAO_AUTORIZADO, "Item não disponível para incorporar.");
  return comLock(function () {
    // Dedupe: cópia pessoal EXATA (origem_id) OU equivalente (nome+classificação) → devolve.
    const nk = String(origem.nome || "").trim().toLowerCase();
    const ck = String(_classificacaoValida(origem.classificacao) || "").trim().toLowerCase();
    const jaMeu = repoEncontrar(SCHEMA.ITENS, function (i) {
      if (String(i.usuario_id) !== String(sessao.usuario_id) || !_itemAtivo(i)) return false;
      if (String(i.origem_id || "") === String(origem.id)) return true;
      return String(i.nome || "").trim().toLowerCase() === nk && String(i.classificacao || "").trim().toLowerCase() === ck;
    });
    if (jaMeu) return { item: jaMeu };
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const item = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: origem.nome,
      classificacao: _classificacaoValida(origem.classificacao),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
      categoria_id: "", // subclassificação do dono não vale p/ mim
      origem_id: origem.id, // back-reference p/ dedup exato
    };
    repoInserir(SCHEMA.ITENS, item);
    return { item: item };
  });
}

/** itens.criar -> { item }. */
function itensCriar(data, sessao) {
  const nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome do item.");
  const categoriaId = String((data && data.categoria_id) || "");
  if (!categoriaId) lancar(ERRO.VALIDACAO, "Selecione a subclassificação do item.");

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const item = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      nome: nome,
      classificacao: _classificacaoValida(data && data.classificacao),
      ativo: true,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
      categoria_id: categoriaId, // SUBclassificação (obrigatória na criação)
    };
    repoInserir(SCHEMA.ITENS, item);
    return { item: item };
  });
}

/** itens.atualizar -> { item }. */
function itensAtualizar(data, sessao) {
  const id = data && data.id;
  _itemDoUsuario(id, sessao.usuario_id);

  const patch = { atualizado_em: agoraIso() };
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
    patch.nome = nome;
  }
  if (data.classificacao !== undefined) patch.classificacao = _classificacaoValida(data.classificacao);
  if (data.categoria_id !== undefined) {
    const c = String(data.categoria_id || "");
    if (!c) lancar(ERRO.VALIDACAO, "Selecione a subclassificação do item.");
    patch.categoria_id = c;
  }
  if (data.ativo !== undefined) patch.ativo = data.ativo === true;
  patch.editor_nome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";

  return comLock(function () {
    const item = repoAtualizar(SCHEMA.ITENS, "id", id, patch);
    // DADOS CONECTADOS: despesa, ESTOQUE e COTAÇÃO guardam uma CÓPIA do item
    // (nome/classificação/subclassificação). Ao editar o item, propaga para os TRÊS —
    // antes só as despesas eram atualizadas (estoque/cotações ficavam com o valor velho).
    // Devolve as despesas afetadas p/ o front espelhar sem esperar novo snapshot.
    const despesasAfetadas = [];
    const mexeu =
      patch.nome !== undefined || patch.classificacao !== undefined || patch.categoria_id !== undefined;
    if (mexeu) {
      // 1) DESPESAS (nome/classificação/subclassificação). Reclassificar (Material→Serviço)
      //    tira a despesa do estoque → re-sincroniza a entrada_despesa (NUNCA lança).
      repoFiltrar(SCHEMA.DESPESAS, function (d) {
        return String(d.item_id) === String(id);
      }).forEach(function (d) {
        const p = {};
        if (patch.nome !== undefined && String(d.item || "") !== String(item.nome)) p.item = item.nome;
        if (patch.classificacao !== undefined && String(d.classificacao || "") !== String(item.classificacao))
          p.classificacao = item.classificacao;
        if (patch.categoria_id !== undefined && String(d.categoria_id || "") !== String(item.categoria_id))
          p.categoria_id = item.categoria_id;
        if (Object.keys(p).length) {
          const atualizada = repoAtualizar(SCHEMA.DESPESAS, "id", d.id, p);
          despesasAfetadas.push(_lerDespesa(atualizada));
          if (patch.classificacao !== undefined) {
            try {
              _sincronizarEstoqueDaDespesa(atualizada, _boolDe(atualizada.pago));
            } catch (e) {
              console.error("sync estoque (itensAtualizar): " + e);
            }
          }
        }
      });
      // 2) ESTOQUE (classificação/subclassificação — sem nome) nos movimentos restantes.
      if (patch.classificacao !== undefined || patch.categoria_id !== undefined) {
        repoFiltrar(SCHEMA.ESTOQUE, function (m) {
          return String(m.item_id) === String(id);
        }).forEach(function (m) {
          const p = {};
          if (patch.classificacao !== undefined && String(m.classificacao || "") !== String(item.classificacao))
            p.classificacao = item.classificacao;
          if (patch.categoria_id !== undefined && String(m.categoria_id || "") !== String(item.categoria_id))
            p.categoria_id = item.categoria_id;
          if (Object.keys(p).length) repoAtualizar(SCHEMA.ESTOQUE, "id", m.id, p);
        });
      }
      // 3) COTAÇÕES (descricao=nome, classificação, subclassificação).
      repoFiltrar(SCHEMA.COTACOES, function (c) {
        return String(c.item_id) === String(id);
      }).forEach(function (c) {
        const p = {};
        if (patch.nome !== undefined && String(c.descricao || "") !== String(item.nome)) p.descricao = item.nome;
        if (patch.classificacao !== undefined && String(c.classificacao || "") !== String(item.classificacao))
          p.classificacao = item.classificacao;
        if (patch.categoria_id !== undefined && String(c.categoria_id || "") !== String(item.categoria_id))
          p.categoria_id = item.categoria_id;
        if (Object.keys(p).length) {
          p.atualizado_em = agoraIso();
          repoAtualizar(SCHEMA.COTACOES, "id", c.id, p);
        }
      });
    }
    return { item: item, despesas: despesasAfetadas };
  });
}

/** Verdadeiro se o item está vinculado a despesa, cotação, oferta OU movimento de estoque. */
function _itemEmUso(itemId) {
  const naDespesa = repoEncontrar(SCHEMA.DESPESAS, function (d) {
    return String(d.item_id) === String(itemId);
  });
  if (naDespesa) return true;
  const naCotacao = repoEncontrar(SCHEMA.COTACOES, function (c) {
    return String(c.item_id) === String(itemId);
  });
  if (naCotacao) return true;
  // Também bloqueia se uma OFERTA usa o item: senão desativá-lo deixaria o registro
  // dessa oferta como despesa falhar depois ("Item inválido." em _itemParaObra).
  const naOferta = repoEncontrar(SCHEMA.COTACAO_PRECOS, function (p) {
    return String(p.item_id) === String(itemId);
  });
  if (naOferta) return true;
  // E se há MOVIMENTO de estoque do item (entrada manual/transferência/consumo): desativar
  // deixaria o saldo derivado apontando p/ um item morto na aba Estoque.
  return !!repoEncontrar(SCHEMA.ESTOQUE, function (m) {
    return String(m.item_id) === String(itemId);
  });
}

/** itens.remover -> { id } (desativa logicamente). Bloqueia se vinculado. */
function itensRemover(data, sessao) {
  const id = data && data.id;
  _itemDoUsuario(id, sessao.usuario_id);
  if (_itemEmUso(id)) {
    lancar(ERRO.VALIDACAO, "Item vinculado a despesas/cotações/estoque; remova os vínculos primeiro.");
  }

  return comLock(function () {
    repoAtualizar(SCHEMA.ITENS, "id", id, { ativo: false, atualizado_em: agoraIso() });
    return { id: id };
  });
}
