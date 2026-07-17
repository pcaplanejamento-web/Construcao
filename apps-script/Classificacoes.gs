/**
 * Classificacoes.gs — CLASSIFICAÇÕES de item. As 5 base são FIXAS (constante
 * CLASSIFICACOES_ITEM: Material/Serviço/Documentação/Inicial/Comissão), sempre
 * presentes. Classificações EXTRAS são GLOBAIS (valem p/ todos os usuários) e só o
 * ADMIN cria/edita/exclui, na aba Configuração → Classificações. Espelha Tipos.gs,
 * mas GLOBAL (sem usuario_id no escopo de leitura) e admin-only na escrita.
 *
 * O item guarda a classificação pelo NOME (string, desnormalizado). Esta lista
 * popula os seletores (item-form/orçamento) e as cores dos badges.
 *
 * Regra de pagador: Material→empresa (+estoque); Serviço→ofertante; as demais
 * (base flexíveis + TODAS as extras) → empresa OU ofertante. Extras NÃO entram
 * em estoque (só Material entra) — comportamento herdado por serem ≠ "Material".
 */

/** Só as EXTRAS (linhas da planilha), ordenadas por nome. Vão no snapshot. Blindado:
 *  qualquer falha na leitura da aba retorna [] — nunca derruba o snapshot inteiro. */
function listarClassificacoesExtras() {
  try {
    return repoFiltrar(SCHEMA.CLASSIFICACOES, function () {
      return true;
    })
      .map(function (c) {
        return {
          id: c.id,
          nome: c.nome,
          cor: c.cor || "",
          fixo: false,
          criado_em: c.criado_em,
          atualizado_em: c.atualizado_em,
        };
      })
      .sort(function (a, b) {
        return String(a.nome).localeCompare(String(b.nome));
      });
  } catch (e) {
    return [];
  }
}

/** Lista completa: base fixas (com cor) + extras. */
function listarClassificacoes() {
  const fixos = CLASSIFICACOES_ITEM.map(function (nome) {
    return { id: "builtin:" + nome, nome: nome, cor: CLASSIFICACAO_COR[nome] || "", fixo: true };
  });
  return fixos.concat(listarClassificacoesExtras());
}

/** Nomes válidos (base + extras), minúsculos — p/ validar a classificação de um item. */
function _nomesClassificacaoValidos() {
  const nomes = {};
  CLASSIFICACOES_ITEM.forEach(function (n) {
    nomes[String(n).trim().toLowerCase()] = n;
  });
  listarClassificacoesExtras().forEach(function (c) {
    nomes[String(c.nome).trim().toLowerCase()] = c.nome;
  });
  return nomes;
}

/** Verdadeiro se já existe uma classificação (base ou extra) com esse nome. */
function _classificacaoNomeEmUso(nome, ignorarId) {
  const n = String(nome).trim().toLowerCase();
  if (CLASSIFICACOES_ITEM.some(function (o) { return o.toLowerCase() === n; })) return true;
  return !!repoEncontrar(SCHEMA.CLASSIFICACOES, function (c) {
    return String(c.id) !== String(ignorarId || "") && String(c.nome).trim().toLowerCase() === n;
  });
}

/** Garante que a classificação (extra) existe; senão lança. */
function _classificacaoExtra(id) {
  const c = repoEncontrar(SCHEMA.CLASSIFICACOES, function (x) {
    return String(x.id) === String(id);
  });
  if (!c) lancar(ERRO.NAO_ENCONTRADO, "Classificação não encontrada (as base não podem ser alteradas).");
  return c;
}

/** classificacoes.listar -> { classificacoes: [...] } (todos veem; escrita é admin). */
function classificacoesListar(data, sessao) {
  return { classificacoes: listarClassificacoes() };
}

/** classificacoes.criar -> { classificacao } (ADMIN). */
function classificacoesCriar(data, sessao) {
  exigirAdmin(sessao);
  const nome = String((data && data.nome) || "").trim();
  const cor = String((data && data.cor) || "").trim() || "#64748b";
  if (!nome) lancar(ERRO.VALIDACAO, "Informe o nome da classificação.");
  if (_classificacaoNomeEmUso(nome)) lancar(ERRO.VALIDACAO, "Já existe uma classificação com esse nome.");
  return comLock(function () {
    const agora = agoraIso();
    const nomeUsuario = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
    const c = {
      id: novoId(),
      nome: nome,
      cor: cor,
      criado_em: agora,
      atualizado_em: agora,
      autor_nome: nomeUsuario,
      editor_nome: nomeUsuario,
    };
    repoInserir(SCHEMA.CLASSIFICACOES, c);
    return { classificacao: { id: c.id, nome: c.nome, cor: c.cor, fixo: false } };
  });
}

/** classificacoes.atualizar -> { classificacao } (ADMIN). */
function classificacoesAtualizar(data, sessao) {
  exigirAdmin(sessao);
  const id = data && data.id;
  _classificacaoExtra(id);
  const nome = String((data && data.nome) || "").trim();
  const cor = String((data && data.cor) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Nome inválido.");
  if (_classificacaoNomeEmUso(nome, id)) lancar(ERRO.VALIDACAO, "Já existe uma classificação com esse nome.");
  return comLock(function () {
    const c = repoAtualizar(SCHEMA.CLASSIFICACOES, "id", id, {
      nome: nome,
      cor: cor || "#64748b",
      atualizado_em: agoraIso(),
      editor_nome: (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "",
    });
    return { classificacao: { id: c.id, nome: c.nome, cor: c.cor, fixo: false } };
  });
}

/** classificacoes.remover -> { id } (ADMIN). Base não podem ser removidas (são fixas). */
function classificacoesRemover(data, sessao) {
  exigirAdmin(sessao);
  const id = data && data.id;
  _classificacaoExtra(id);
  return comLock(function () {
    repoRemover(SCHEMA.CLASSIFICACOES, "id", id);
    return { id: id };
  });
}
