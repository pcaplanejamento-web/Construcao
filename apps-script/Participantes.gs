/**
 * Participantes.gs — Participantes de uma obra.
 *
 * Participante = DONO + usuários com quem a obra foi COMPARTILHADA (derivados) +
 * CONTATOS adicionados (gravados em ObraParticipantes). Cada participante tem uma
 * chave estável: "u:<usuario_id>" ou "c:<contato_id>". Usado na divisão de
 * pagamento/responsabilidade das despesas.
 *
 * Acesso: qualquer usuário com acesso à obra (dono ou colaborador) — _obraAcessivel.
 */

function _chaveParticipante(tipo, refId) {
  return (tipo === "contato" ? "c:" : "u:") + refId;
}

/** Lista os participantes de uma obra (derivados + contatos adicionados). */
function listarParticipantesObra(obraId) {
  const obra = repoEncontrar(SCHEMA.OBRAS, function (o) {
    return String(o.id) === String(obraId);
  });
  const usuarios = _mapaUsuarios();
  const lista = [];
  const indice = {}; // chave -> item

  function addUsuario(uid, origem) {
    const chave = "u:" + uid;
    if (indice[chave]) return;
    const u = usuarios[uid] || {};
    const item = {
      chave: chave,
      tipo: "usuario",
      ref_id: uid,
      nome: u.nome || "(usuário)",
      email: u.email || "",
      origem: origem, // dono | compartilhado
      eh_responsavel: false,
    };
    indice[chave] = item;
    lista.push(item);
  }

  if (obra) addUsuario(obra.usuario_id, "dono");
  repoFiltrar(SCHEMA.COMPARTILHAMENTOS, function (s) {
    return String(s.obra_id) === String(obraId);
  }).forEach(function (s) {
    addUsuario(s.usuario_id, "compartilhado");
  });

  // Linhas gravadas: contatos adicionados + flags de responsável (Fase 2).
  repoFiltrar(SCHEMA.OBRA_PARTICIPANTES, function (p) {
    return String(p.obra_id) === String(obraId);
  }).forEach(function (p) {
    const chave = _chaveParticipante(p.tipo, p.ref_id);
    if (p.tipo === "contato") {
      if (!indice[chave]) {
        const item = {
          id: p.id,
          chave: chave,
          tipo: "contato",
          ref_id: p.ref_id,
          nome: p.nome || "(contato)",
          email: "",
          origem: "contato",
          eh_responsavel: _boolDe(p.eh_responsavel),
        };
        indice[chave] = item;
        lista.push(item);
      }
    } else if (indice[chave]) {
      // usuário marcado como responsável (Fase 2)
      indice[chave].eh_responsavel = _boolDe(p.eh_responsavel);
      indice[chave]._linhaId = p.id;
    }
  });

  return lista;
}

/** participantes.listar -> { participantes: [...] }. */
function participantesListar(data, sessao) {
  const obraId = data && data.obra_id;
  _obraAcessivel(obraId, sessao.usuario_id);
  return { participantes: listarParticipantesObra(obraId) };
}

/** participantes.adicionarContato -> { participante } (idempotente por contato). */
function participantesAdicionarContato(data, sessao) {
  const obraId = data && data.obra_id;
  _obraAcessivel(obraId, sessao.usuario_id);
  const contatoId = String((data && data.contato_id) || "");
  if (!contatoId) lancar(ERRO.VALIDACAO, "Selecione um contato.");
  const contato = _contatoDoUsuario(contatoId, sessao.usuario_id);

  return comLock(function () {
    const existe = repoEncontrar(SCHEMA.OBRA_PARTICIPANTES, function (p) {
      return (
        String(p.obra_id) === String(obraId) &&
        p.tipo === "contato" &&
        String(p.ref_id) === String(contatoId)
      );
    });
    if (existe) return { participante: existe };
    const part = {
      id: novoId(),
      obra_id: obraId,
      tipo: "contato",
      ref_id: contatoId,
      nome: contato.nome || "",
      eh_responsavel: false,
      criado_em: agoraIso(),
    };
    repoInserir(SCHEMA.OBRA_PARTICIPANTES, part);
    return { participante: part };
  });
}

/**
 * participantes.definirResponsavel -> { participantes }.
 * Marca/desmarca um participante como responsável da obra. Para usuário derivado
 * (sem linha), cria a linha quando marcado; para contato, alterna o flag.
 */
function participantesDefinirResponsavel(data, sessao) {
  const obraId = data && data.obra_id;
  _obraAcessivel(obraId, sessao.usuario_id);
  const chave = String((data && data.chave) || "");
  if (!chave) lancar(ERRO.VALIDACAO, "Participante inválido.");
  const eh = (data && data.eh_responsavel) === true;
  const tipo = chave.indexOf("c:") === 0 ? "contato" : "usuario";
  const refId = chave.substring(2);

  return comLock(function () {
    const linha = repoEncontrar(SCHEMA.OBRA_PARTICIPANTES, function (p) {
      return (
        String(p.obra_id) === String(obraId) &&
        p.tipo === tipo &&
        String(p.ref_id) === String(refId)
      );
    });
    if (linha) {
      repoAtualizar(SCHEMA.OBRA_PARTICIPANTES, "id", linha.id, { eh_responsavel: eh });
    } else if (eh) {
      // Usuário derivado: cria a linha só para guardar o flag.
      let nome = "";
      if (tipo === "usuario") {
        nome = (_mapaUsuarios()[refId] || {}).nome || "";
      } else {
        nome = (repoEncontrar(SCHEMA.CONTATOS, function (c) {
          return String(c.id) === String(refId);
        }) || {}).nome || "";
      }
      repoInserir(SCHEMA.OBRA_PARTICIPANTES, {
        id: novoId(),
        obra_id: obraId,
        tipo: tipo,
        ref_id: refId,
        nome: nome,
        eh_responsavel: true,
        criado_em: agoraIso(),
      });
    }
    return { participantes: listarParticipantesObra(obraId) };
  });
}

/** participantes.remover -> { id } (remove a linha; só contatos têm linha). */
function participantesRemover(data, sessao) {
  const id = data && data.id;
  const p = repoEncontrar(SCHEMA.OBRA_PARTICIPANTES, function (x) {
    return String(x.id) === String(id);
  });
  if (!p) lancar(ERRO.NAO_ENCONTRADO, "Participante não encontrado.");
  _obraAcessivel(p.obra_id, sessao.usuario_id);

  return comLock(function () {
    repoRemover(SCHEMA.OBRA_PARTICIPANTES, "id", id);
    return { id: id };
  });
}
