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

/** Localiza uma oferta garantindo a posse: dono direto (usuario_id) OU via
 * cotação/orçamento do usuário (cobre ofertas legadas sem usuario_id). */
function _precoDoUsuario(precoId, usuarioId) {
  const p = repoEncontrar(SCHEMA.COTACAO_PRECOS, function (x) {
    return String(x.id) === String(precoId);
  });
  if (!p) lancar(ERRO.NAO_ENCONTRADO, "Oferta não encontrada.");
  if (String(p.usuario_id || "") === String(usuarioId)) return p;
  if (String(p.cotacao_id || "")) {
    _cotacaoDoUsuario(p.cotacao_id, usuarioId);
    return p;
  }
  if (String(p.orcamento_id || "")) {
    _orcamentoDoUsuario(p.orcamento_id, usuarioId);
    return p;
  }
  lancar(ERRO.NAO_AUTORIZADO, "Oferta não pode ser alterada.");
}

/* ------------------------------ Cotações ------------------------------ */

/** cotacoes.listar -> { cotacoes: [...] }. */
function cotacoesListar(data, sessao) {
  return { cotacoes: listarCotacoesUsuario(sessao.usuario_id) };
}

/** cotacoes.criar -> { cotacao }. Modo ÚNICO: SEMPRE por subclassificação
 * (cada oferta define o próprio item; o detalhe agrupa as ofertas por item). */
function cotacoesCriar(data, sessao) {
  const categoriaId = String((data && data.categoria_id) || "");
  if (!categoriaId) lancar(ERRO.VALIDACAO, "Selecione a subclassificação da cotação.");
  const cat = listarCategoriasUsuario(sessao.usuario_id).find(function (c) {
    return String(c.id) === categoriaId && String(c.tipo || "") !== "fornecedor";
  });
  if (!cat) lancar(ERRO.VALIDACAO, "Subclassificação inválida.");
  const descricao = cat.nome; // rótulo = nome da subclassificação

  const obraId = String((data && data.obra_id) || "");
  if (obraId) _obraAcessivel(obraId, sessao.usuario_id);

  return comLock(function () {
    // 1 cotação por subclassificação: reaproveita a existente (todas as ofertas
    // da subclasse ficam agrupadas na mesma cotação) — não cria duplicata.
    const existente = listarCotacoesUsuario(sessao.usuario_id).find(function (c) {
      return String(c.categoria_id || "") === categoriaId;
    });
    if (existente) return { cotacao: existente };

    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const cotacao = {
      id: novoId(),
      usuario_id: sessao.usuario_id,
      obra_id: obraId,
      descricao: descricao,
      quantidade: Number((data && data.quantidade) || 0) || 0,
      unidade: String((data && data.unidade) || ""),
      categoria_id: categoriaId, // subclassificação
      status: _statusCotacaoValido(data && data.status),
      criado_em: agora,
      atualizado_em: agora,
      item_id: "", // a oferta é que define o item, dentro da subclassificação
      classificacao: "",
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
      modo: "subclasse",
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
  if (data.categoria_id !== undefined) {
    const cid = String(data.categoria_id || "");
    patch.categoria_id = cid;
    // Rótulo da cotação acompanha o nome da subclassificação (modo único).
    const cat = cid
      ? listarCategoriasUsuario(sessao.usuario_id).find(function (c) {
          return String(c.id) === cid && String(c.tipo || "") !== "fornecedor";
        })
      : null;
    if (cat) patch.descricao = cat.nome;
  }
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

/**
 * cotacoes.adicionarPreco -> { preco, historico }. CRIAR OFERTA (universal).
 * A oferta é independente: nasce de um ITEM (obrigatório) e pode (opcional)
 * vincular-se a uma cotação e/ou a um orçamento. Regras pela classificação do
 * item — Material: fornecedor obrigatório, ofertante opcional; Serviço:
 * ofertante obrigatório, fornecedor opcional. Prazo de entrega obrigatório.
 */
function cotacoesAdicionarPreco(data, sessao) {
  const usuarioId = sessao.usuario_id;

  // Vínculos OPCIONAIS: cotação e/ou orçamento (valida posse se vierem).
  const cotacaoId = String((data && data.cotacao_id) || "");
  const orcamentoId = String((data && data.orcamento_id) || "");
  const cotacao = cotacaoId ? _cotacaoDoUsuario(cotacaoId, usuarioId) : null;
  const orcamento = orcamentoId ? _orcamentoDoUsuario(orcamentoId, usuarioId) : null;

  // Item: obrigatório (herda da cotação se houver e não vier explícito).
  let itemId = String((data && data.item_id) || "");
  if (!itemId && cotacao) itemId = String(cotacao.item_id || "");
  if (!itemId) lancar(ERRO.VALIDACAO, "Selecione o item da oferta.");
  const item = _itemPorId(itemId, usuarioId);
  const classificacao = String(item.classificacao || "");
  // Cotação por subclassificação: o item da oferta deve pertencer àquela subclasse.
  if (cotacao && String(cotacao.modo || "") === "subclasse" && String(cotacao.categoria_id || "")) {
    if (String(item.categoria_id || "") !== String(cotacao.categoria_id))
      lancar(ERRO.VALIDACAO, "O item da oferta não pertence à subclassificação da cotação.");
  }

  // Ofertante (contato XOR equipe). Herdado do orçamento, se houver.
  let contatoId = String((data && data.contato_id) || "");
  let equipeId = String((data && data.equipe_id) || "");
  if (orcamento) {
    if (String(orcamento.equipe_id || "")) {
      equipeId = String(orcamento.equipe_id);
      contatoId = "";
    } else if (String(orcamento.contato_id || "")) {
      contatoId = String(orcamento.contato_id);
      equipeId = "";
    }
  }
  let contato = null;
  if (equipeId) {
    _equipeDoUsuario(equipeId, usuarioId);
    contatoId = "";
  } else if (contatoId) {
    contato = _contatoDoUsuario(contatoId, usuarioId);
  }

  // Fornecedor: herdado do orçamento (Material) ou auto pelo contato ofertante.
  let fornecedorId = String((data && data.fornecedor_id) || "");
  if (!fornecedorId && orcamento && String(orcamento.fornecedor_id || ""))
    fornecedorId = String(orcamento.fornecedor_id);
  if (!fornecedorId && contato && String(contato.fornecedor_id || ""))
    fornecedorId = String(contato.fornecedor_id);
  if (fornecedorId) _fornecedorDoUsuario(fornecedorId, usuarioId);

  // Regras por classificação do item.
  if (classificacao === "Material") {
    if (!fornecedorId) lancar(ERRO.VALIDACAO, "Material exige uma empresa.");
  } else {
    if (!contatoId && !equipeId)
      lancar(ERRO.VALIDACAO, "Serviço exige um ofertante (contato ou equipe).");
  }

  const prazo = String((data && data.prazo_entrega) || "").trim();
  if (!prazo) lancar(ERRO.VALIDACAO, "Informe a data/prazo de entrega.");
  const valor = Number(data && data.valor_unit);
  if (!(valor > 0)) lancar(ERRO.VALIDACAO, "Informe um valor maior que zero.");

  // Obra da oferta: explícita → herda da cotação → herda do orçamento (resolve obra de avulsa).
  let obraId = String((data && data.obra_id) || "");
  if (!obraId && cotacao) obraId = String(cotacao.obra_id || "");
  if (!obraId && orcamento) obraId = String(orcamento.obra_id || "");
  if (obraId) _obraAcessivel(obraId, usuarioId);

  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(usuarioId) || {}).nome || "";
    const preco = {
      id: novoId(),
      cotacao_id: cotacaoId,
      contato_id: contatoId,
      valor_unit: valor,
      prazo_entrega: prazo,
      observacao: String((data && data.observacao) || ""),
      escolhido: false,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
      orcamento_id: orcamentoId,
      equipe_id: equipeId,
      // Quantitativo e desconto PRÓPRIOS da oferta (vazios = comportamento legado).
      quantidade: Number(data && data.quantidade) > 0 ? Number(data.quantidade) : "",
      valor_unit_desconto:
        Number(data && data.valor_unit_desconto) > 0 ? Number(data.valor_unit_desconto) : "",
      // Oferta independente: carrega item, fornecedor e dono próprios.
      item_id: itemId,
      fornecedor_id: fornecedorId,
      usuario_id: usuarioId,
      obra_id: obraId, // herda cotação/orçamento; resolve obra de oferta avulsa
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
    if (contatoId) {
      _contatoDoUsuario(contatoId, sessao.usuario_id);
      patch.equipe_id = ""; // contato XOR equipe
    }
    patch.contato_id = contatoId;
  }
  if (data.equipe_id !== undefined) {
    const equipeId = String(data.equipe_id || "");
    if (equipeId) {
      _equipeDoUsuario(equipeId, sessao.usuario_id);
      patch.contato_id = "";
    }
    patch.equipe_id = equipeId;
  }
  if (data.item_id !== undefined && String(data.item_id || "")) {
    _itemPorId(String(data.item_id), sessao.usuario_id);
    patch.item_id = String(data.item_id);
  }
  if (data.fornecedor_id !== undefined) {
    const f = String(data.fornecedor_id || "");
    if (f) _fornecedorDoUsuario(f, sessao.usuario_id);
    patch.fornecedor_id = f;
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
  if (data.quantidade !== undefined)
    patch.quantidade = Number(data.quantidade) > 0 ? Number(data.quantidade) : "";
  if (data.valor_unit_desconto !== undefined)
    patch.valor_unit_desconto =
      Number(data.valor_unit_desconto) > 0 ? Number(data.valor_unit_desconto) : "";
  if (data.obra_id !== undefined) {
    const o = String(data.obra_id || "");
    if (o) _obraAcessivel(o, sessao.usuario_id);
    patch.obra_id = o;
  }
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
 * Lança a oferta (INTEIRA) como DESPESA na obra escolhida, MARCA a oferta
 * (despesa_id + escolhido exclusivo) e FECHA a cotação. A despesa guarda o
 * OFERTANTE (contato XOR equipe), a EMPRESA (fornecedor do contato; vazio p/
 * equipe) e — quando equipe — quanto cada integrante RECEBEU. Aceita também a
 * RESPONSABILIDADE (% por participante). Reusa _novaDespesa (Despesas.gs).
 */
function cotacoesRegistrarDespesa(data, sessao) {
  const precoId = data && data.preco_id;
  const preco = _precoDoUsuario(precoId, sessao.usuario_id);
  // Cotação é OPCIONAL (oferta pode ser avulsa ou só de orçamento).
  const cotacao = String(preco.cotacao_id || "")
    ? _cotacaoDoUsuario(preco.cotacao_id, sessao.usuario_id)
    : null;

  const obraId = String((data && data.obra_id) || "");
  if (!obraId) lancar(ERRO.VALIDACAO, "Selecione a obra.");
  _obraAcessivel(obraId, sessao.usuario_id);

  // Quantidade e valor unitário PRÓPRIOS da oferta (fallback ao legado da cotação).
  // Valor FINAL = unitário com desconto (se houver) × quantidade.
  const qtd = Number(preco.quantidade) > 0
    ? Number(preco.quantidade)
    : (cotacao && Number(cotacao.quantidade) > 0 ? Number(cotacao.quantidade) : 1);
  const unit = Number(preco.valor_unit_desconto) > 0
    ? Number(preco.valor_unit_desconto)
    : (Number(preco.valor_unit) || 0);
  const valor = unit * qtd;
  if (!(valor > 0)) lancar(ERRO.VALIDACAO, "Valor da oferta inválido.");

  // Item da oferta (próprio; fallback à cotação no legado) → nome/classificação/subclasse.
  const itemId = String(preco.item_id || (cotacao && cotacao.item_id) || "");
  let itemReg = null;
  if (itemId) {
    try {
      itemReg = _itemPorId(itemId, sessao.usuario_id);
    } catch (e) {
      itemReg = null;
    }
  }
  const item = (itemReg && itemReg.nome) || String((cotacao && cotacao.descricao) || "").trim() || "Oferta";
  const classificacao = (itemReg && itemReg.classificacao) || (cotacao && cotacao.classificacao) || "";

  // Ofertante = contato XOR equipe (herdado da oferta). Empresa = fornecedor PRÓPRIO
  // da oferta (fallback ao fornecedor do contato ofertante).
  const ofertanteContatoId = String(preco.contato_id || "");
  const ofertanteEquipeId = String(preco.equipe_id || "");
  let ofertanteNome = "";
  let fornecedorId = String(preco.fornecedor_id || "");
  if (ofertanteEquipeId) {
    const equipe = repoEncontrar(SCHEMA.EQUIPES, function (x) {
      return String(x.id) === ofertanteEquipeId;
    }) || {};
    ofertanteNome = equipe.nome || "";
  } else if (ofertanteContatoId) {
    const contato = repoEncontrar(SCHEMA.CONTATOS, function (x) {
      return String(x.id) === ofertanteContatoId;
    }) || {};
    ofertanteNome = contato.nome || "";
    if (!fornecedorId) fornecedorId = String(contato.fornecedor_id || "");
  }
  const categoriaId = String(
    (itemReg && itemReg.categoria_id) || (data && data.categoria_id) || (cotacao && cotacao.categoria_id) || ""
  );

  // Responsabilidade (% por participante). A distribuição por integrante (equipe)
  // é feita depois, em cada leva de pagamento — não no registro.
  const responsaveis = Array.isArray(data && data.responsaveis) ? data.responsaveis : [];
  const somaPct = responsaveis.reduce(function (s, r) {
    return s + (Number(r && r.pct) || 0);
  }, 0);
  if (somaPct - 100 > 0.01)
    lancar(ERRO.VALIDACAO, "A soma das responsabilidades não pode passar de 100%.");

  return comLock(function () {
    const despesa = _novaDespesa(obraId, sessao.usuario_id, {
      item_id: itemId, // item PRÓPRIO da oferta (fallback à cotação)
      item: item,
      classificacao: classificacao,
      valor: valor,
      categoria_id: categoriaId,
      observacao: "Oferta · " + (ofertanteNome || ""),
      preco_id: precoId,
      fornecedor_id: fornecedorId,
      ofertante_contato_id: ofertanteContatoId,
      ofertante_equipe_id: ofertanteEquipeId,
      responsaveis: responsaveis,
    });
    if (cotacao) {
      // Marca esta oferta como registrada/escolhida, desmarca as demais e fecha a cotação.
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
        preco: repoEncontrar(SCHEMA.COTACAO_PRECOS, function (x) {
          return String(x.id) === String(precoId);
        }),
      };
    }
    // Oferta avulsa / só de orçamento (sem cotação): marca apenas esta oferta.
    const precoAtual = repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", precoId, {
      escolhido: true,
      despesa_id: despesa.id,
    });
    return {
      despesa: despesa,
      resumo: _calcularResumo(obraId, sessao.usuario_id),
      precos: [precoAtual],
      cotacao: null,
      preco: precoAtual,
    };
  });
}

/** Normaliza booleano vindo do Sheets (TRUE/true/boolean). */
function _boolDe(v) {
  return v === true || v === "TRUE" || v === "true";
}
