/**
 * GoogleContatos.gs — Sincroniza Contatos e Empresas (fornecedores) do app com o
 * Google Contacts (People API), POR USUÁRIO (reusa o refresh token do "Conectar
 * Google" — ver Google.gs). O Cargo do contato <-> um grupo ("classificação"/
 * contactGroup) do Google, nos DOIS sentidos. Fonte da verdade = app.
 *
 * Mapeamento:
 *  - Contato/Empresa  -> contato (person) no Google. resourceName guardado na
 *    coluna `google_resource_id` de CONTATOS/FORNECEDORES.
 *  - Cargo (por nome) -> grupo (contactGroup). Mapa por usuário em config JSON
 *    `google_grupos_cargo` = { "Vendedor":"contactGroups/xxx", ... } (segredo,
 *    não vai ao cliente — ver CONFIG_CHAVES_SECRETAS em Auth.gs).
 *
 * Todas as chamadas ao Google são best-effort no front (uma falha nunca desfaz a
 * escrita do app). Escopo `contacts` pedido em Google.gs (_googleScope).
 */

var _PEOPLE_BASE = "https://people.googleapis.com/v1/";
var _PEOPLE_FIELDS = "names,emailAddresses,phoneNumbers,memberships";

/* ---------------------------- REST helpers ---------------------------- */

/** Chamada REST autenticada à People API (Bearer + JSON). Lança em erro !2xx. */
function _peopleFetch(acesso, metodo, url, corpo) {
  var opc = {
    method: metodo || "get",
    headers: { Authorization: "Bearer " + acesso },
    muteHttpExceptions: true,
  };
  if (corpo) {
    opc.contentType = "application/json";
    opc.payload = JSON.stringify(corpo);
  }
  var resp = UrlFetchApp.fetch(url, opc);
  var codigo = resp.getResponseCode();
  var texto = resp.getContentText() || "";
  if (codigo < 200 || codigo >= 300) {
    // Extrai a mensagem do Google (ex.: "People API has not been used... Enable it
    // by visiting https://console.../people.googleapis.com..." ou "insufficient
    // authentication scopes") para o usuário saber EXATAMENTE o que ajustar.
    var msg = texto;
    try { var j = JSON.parse(texto); if (j && j.error && j.error.message) msg = j.error.message; } catch (e) {}
    lancar(ERRO.INTERNO, "Google Contacts (" + codigo + "): " + String(msg).slice(0, 500));
  }
  return texto ? JSON.parse(texto) : {};
}

/** Reduz um `person` da People API ao essencial usado pelo app. */
function _pessoaSimples(p) {
  p = p || {};
  var nomes = p.names || [];
  var emails = p.emailAddresses || [];
  var tels = p.phoneNumbers || [];
  var grupos = (p.memberships || [])
    .filter(function (m) { return m.contactGroupMembership && m.contactGroupMembership.contactGroupResourceName; })
    .map(function (m) { return m.contactGroupMembership.contactGroupResourceName; });
  return {
    resourceName: p.resourceName || "",
    etag: p.etag || "",
    nome: (nomes[0] && (nomes[0].displayName || nomes[0].givenName)) || "",
    email: (emails[0] && emails[0].value) || "",
    telefone: (tels[0] && tels[0].value) || "",
    grupos: grupos,
  };
}

/** Corpo de person (só os campos informados) para create/update. */
function _peopleCorpoPessoa(dados) {
  var corpo = {};
  if (dados.nome !== undefined) corpo.names = [{ givenName: String(dados.nome || "") }];
  if (dados.email !== undefined) corpo.emailAddresses = dados.email ? [{ value: String(dados.email) }] : [];
  if (dados.telefone !== undefined) corpo.phoneNumbers = dados.telefone ? [{ value: String(dados.telefone) }] : [];
  return corpo;
}

/** Lista os contatos (connections) do usuário, filtrando por `q` (nome/email/tel). */
function _peopleListarContatos(acesso, q) {
  var termo = String(q || "").trim().toLowerCase();
  var out = [];
  var pageToken = "", guarda = 0;
  do {
    var url = _PEOPLE_BASE + "people/me/connections?personFields=" + encodeURIComponent(_PEOPLE_FIELDS) +
      "&pageSize=200&sortOrder=FIRST_NAME_ASCENDING";
    if (pageToken) url += "&pageToken=" + encodeURIComponent(pageToken);
    var json = _peopleFetch(acesso, "get", url);
    (json.connections || []).forEach(function (p) {
      var s = _pessoaSimples(p);
      if (!s.resourceName) return;
      if (!termo || (s.nome + " " + s.email + " " + s.telefone).toLowerCase().indexOf(termo) >= 0) out.push(s);
    });
    pageToken = json.nextPageToken || "";
  } while (pageToken && ++guarda < 15);
  return out;
}

/** Busca uma pessoa (com etag + memberships). */
function _peoplePessoa(acesso, resourceName) {
  var url = _PEOPLE_BASE + resourceName + "?personFields=" + encodeURIComponent(_PEOPLE_FIELDS);
  return _peopleFetch(acesso, "get", url);
}

/** Cria um contato no Google a partir de {nome,email,telefone}. */
function _peopleCriarContato(acesso, dados) {
  var json = _peopleFetch(acesso, "post", _PEOPLE_BASE + "people:createContact", _peopleCorpoPessoa(dados));
  return _pessoaSimples(json);
}

/** Atualiza um contato do Google (busca o etag antes; PATCH). */
function _peopleAtualizarContato(acesso, resourceName, dados) {
  var atual = _pessoaSimples(_peoplePessoa(acesso, resourceName));
  var corpo = _peopleCorpoPessoa(dados);
  corpo.etag = atual.etag;
  var campos = [];
  if (corpo.names) campos.push("names");
  if (corpo.emailAddresses) campos.push("emailAddresses");
  if (corpo.phoneNumbers) campos.push("phoneNumbers");
  var url = _PEOPLE_BASE + resourceName + ":updateContact?updatePersonFields=" + encodeURIComponent(campos.join(","));
  return _pessoaSimples(_peopleFetch(acesso, "patch", url, corpo));
}

/** Lista os grupos (classificações) do usuário: [{resourceName,nome,tipo}]. */
function _peopleListarGrupos(acesso) {
  var out = [], pageToken = "", guarda = 0;
  do {
    var url = _PEOPLE_BASE + "contactGroups?groupFields=name,groupType&pageSize=200";
    if (pageToken) url += "&pageToken=" + encodeURIComponent(pageToken);
    var json = _peopleFetch(acesso, "get", url);
    (json.contactGroups || []).forEach(function (g) {
      out.push({ resourceName: g.resourceName, nome: g.formattedName || g.name || "", tipo: g.groupType || "" });
    });
    pageToken = json.nextPageToken || "";
  } while (pageToken && ++guarda < 10);
  return out;
}

/** Cria um grupo (classificação) e devolve o resourceName. */
function _peopleCriarGrupo(acesso, nome) {
  var json = _peopleFetch(acesso, "post", _PEOPLE_BASE + "contactGroups", { contactGroup: { name: String(nome) } });
  return json.resourceName;
}

/** Adiciona/remove membros de um grupo (best-effort: não lança). */
function _peopleMembros(acesso, grupoResourceName, adicionar, remover) {
  var corpo = {};
  if (adicionar && adicionar.length) corpo.resourceNamesToAdd = adicionar;
  if (remover && remover.length) corpo.resourceNamesToRemove = remover;
  if (!corpo.resourceNamesToAdd && !corpo.resourceNamesToRemove) return;
  UrlFetchApp.fetch(_PEOPLE_BASE + grupoResourceName + "/members:modify", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + acesso },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
}

/* --------------------------- Cargo <-> grupo -------------------------- */

/** Lê o mapa cargo->grupo (config JSON, por usuário). */
function _lerGruposCargo(usuarioId) {
  var raw = _lerConfig(usuarioId, "google_grupos_cargo");
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}

/**
 * Garante que existe um grupo do Google para o cargo `nome`; devolve o
 * resourceName e ATUALIZA `mapa` em memória (o chamador persiste no comLock).
 * Dedup por nome nos grupos existentes antes de criar.
 */
function _garantirGrupoCargo(acesso, nome, mapa) {
  if (mapa[nome]) return mapa[nome];
  var grupos = _peopleListarGrupos(acesso);
  var achado = null;
  for (var i = 0; i < grupos.length; i++) {
    if (grupos[i].tipo === "USER_CONTACT_GROUP" && String(grupos[i].nome).trim() === String(nome).trim()) {
      achado = grupos[i]; break;
    }
  }
  var rn = achado ? achado.resourceName : _peopleCriarGrupo(acesso, nome);
  mapa[nome] = rn;
  return rn;
}

/** Deriva o Cargo (nome) a partir dos grupos de usuário de um contato do Google. */
function _cargoDeGrupos(acesso, gruposDoContato) {
  if (!gruposDoContato || !gruposDoContato.length) return "";
  var grupos = _peopleListarGrupos(acesso);
  var porRN = {};
  grupos.forEach(function (g) { porRN[g.resourceName] = g; });
  for (var i = 0; i < gruposDoContato.length; i++) {
    var g = porRN[gruposDoContato[i]];
    if (g && g.tipo === "USER_CONTACT_GROUP" && g.nome) return g.nome;
  }
  return "";
}

/** Garante que o cargo (nome) existe no app (fixo ou extra); cria como extra se faltar. */
function _garantirCargoApp(usuarioId, nome, autorNome) {
  if (!nome || _cargoNomeEmUso(nome, usuarioId)) return;
  comLock(function () {
    repoInserir(SCHEMA.CARGOS, {
      id: novoId(),
      usuario_id: usuarioId,
      nome: nome,
      criado_em: agoraIso(),
      atualizado_em: agoraIso(),
      autor_nome: autorNome || "",
      editor_nome: autorNome || "",
    });
  });
}

/* ------------------------------- Rotas -------------------------------- */

/** Garante que o registro (contato|fornecedor) é do usuário e devolve-o. */
function _registroGoogle(tipo, id, usuarioId) {
  if (tipo === "contato") return _contatoDoUsuario(id, usuarioId);
  if (tipo === "fornecedor") return _fornecedorDoUsuario(id, usuarioId);
  lancar(ERRO.VALIDACAO, "Tipo inválido (use contato|fornecedor).");
}
function _esquemaGoogle(tipo) {
  return tipo === "fornecedor" ? SCHEMA.FORNECEDORES : SCHEMA.CONTATOS;
}

/** google.contatos.listar { q? } -> { contatos:[{resourceName,nome,email,telefone,grupos}] }. */
function googleContatosListar(data, sessao) {
  var acesso = _refrescarAccessToken(sessao.usuario_id);
  return { contatos: _peopleListarContatos(acesso, data && data.q) };
}

/**
 * google.contatos.enviar { tipo, id } -> { google_resource_id }.
 * Cria (ou atualiza, se já vinculado) o contato no Google a partir do registro
 * do app e — para contato com cargo — garante o grupo e ajusta a associação
 * (entra no grupo do cargo, sai dos outros grupos de cargo). (#4, #6)
 */
function googleContatosEnviar(data, sessao) {
  var tipo = String((data && data.tipo) || "").trim();
  var id = String((data && data.id) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Registro não informado.");
  var registro = _registroGoogle(tipo, id, sessao.usuario_id);
  var acesso = _refrescarAccessToken(sessao.usuario_id);

  var dados = { nome: registro.nome, email: registro.email, telefone: registro.telefone };
  var rnAtual = String(registro.google_resource_id || "");
  var pessoa = rnAtual ? _peopleAtualizarContato(acesso, rnAtual, dados) : _peopleCriarContato(acesso, dados);
  var rn = pessoa.resourceName;

  var mapa = _lerGruposCargo(sessao.usuario_id);
  var cargo = tipo === "contato" ? String(registro.cargo || "").trim() : "";
  if (cargo) {
    var grupoRN = _garantirGrupoCargo(acesso, cargo, mapa);
    _peopleMembros(acesso, grupoRN, [rn], []);
    Object.keys(mapa).forEach(function (k) {
      if (mapa[k] && mapa[k] !== grupoRN) _peopleMembros(acesso, mapa[k], [], [rn]);
    });
  }

  var esquema = _esquemaGoogle(tipo);
  comLock(function () {
    repoAtualizar(esquema, "id", id, { google_resource_id: rn });
    if (cargo) _definirConfig(sessao.usuario_id, "google_grupos_cargo", mapa);
  });
  return { google_resource_id: rn, tipo: tipo, id: id };
}

/** google.contatos.vincular { tipo, id, resourceName } -> só associa (sem alterar dados). (#1, #3) */
function googleContatosVincular(data, sessao) {
  var tipo = String((data && data.tipo) || "").trim();
  var id = String((data && data.id) || "");
  var rn = String((data && data.resourceName) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Registro não informado.");
  if (rn.indexOf("people/") !== 0) lancar(ERRO.VALIDACAO, "Contato do Google inválido.");
  _registroGoogle(tipo, id, sessao.usuario_id);
  var esquema = _esquemaGoogle(tipo);
  comLock(function () {
    repoAtualizar(esquema, "id", id, { google_resource_id: rn });
  });
  return { google_resource_id: rn, tipo: tipo, id: id };
}

/** google.contatos.desvincular { tipo, id } -> limpa o vínculo. */
function googleContatosDesvincular(data, sessao) {
  var tipo = String((data && data.tipo) || "").trim();
  var id = String((data && data.id) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Registro não informado.");
  _registroGoogle(tipo, id, sessao.usuario_id);
  var esquema = _esquemaGoogle(tipo);
  comLock(function () {
    repoAtualizar(esquema, "id", id, { google_resource_id: "" });
  });
  return { tipo: tipo, id: id };
}

/**
 * google.contatos.importar { resourceName, tipo, cargo? } -> { contato | fornecedor }.
 * Cria um registro no app a partir de um contato do Google e o vincula. Para
 * contato, deriva o Cargo do grupo dele se `cargo` não vier (cria o cargo se
 * faltar). (#2, #5 no sentido Google->app)
 */
function googleContatosImportar(data, sessao) {
  var tipo = String((data && data.tipo) || "").trim();
  var rn = String((data && data.resourceName) || "");
  if (rn.indexOf("people/") !== 0) lancar(ERRO.VALIDACAO, "Contato do Google inválido.");
  if (tipo !== "contato" && tipo !== "fornecedor") lancar(ERRO.VALIDACAO, "Tipo inválido (use contato|fornecedor).");
  var acesso = _refrescarAccessToken(sessao.usuario_id);
  var s = _pessoaSimples(_peoplePessoa(acesso, rn));
  var nome = s.nome || "(sem nome)";

  if (tipo === "fornecedor") {
    var rf = fornecedoresCriar({ nome: nome, email: s.email, telefone: s.telefone }, sessao);
    comLock(function () { repoAtualizar(SCHEMA.FORNECEDORES, "id", rf.fornecedor.id, { google_resource_id: rn }); });
    rf.fornecedor.google_resource_id = rn;
    return { fornecedor: rf.fornecedor };
  }

  var autorNome = (buscarUsuarioPorId(sessao.usuario_id) || {}).nome || "";
  var cargo = (data && data.cargo !== undefined) ? String(data.cargo || "").trim() : _cargoDeGrupos(acesso, s.grupos);
  if (cargo === "Vendedor") cargo = ""; // Vendedor exige empresa vinculada; não dá p/ importar direto
  if (cargo) _garantirCargoApp(sessao.usuario_id, cargo, autorNome);

  var rc = contatosCriar({ nome: nome, email: s.email, telefone: s.telefone, cargo: cargo }, sessao);
  comLock(function () { repoAtualizar(SCHEMA.CONTATOS, "id", rc.contato.id, { google_resource_id: rn }); });
  rc.contato.google_resource_id = rn;

  if (cargo) {
    var mapa = _lerGruposCargo(sessao.usuario_id);
    _garantirGrupoCargo(acesso, cargo, mapa);
    comLock(function () { _definirConfig(sessao.usuario_id, "google_grupos_cargo", mapa); });
  }
  return { contato: rc.contato };
}

/** google.cargos.sincronizar { nome } -> { grupo }. Garante o grupo do cargo. (#7) */
function googleCargosSincronizar(data, sessao) {
  var nome = String((data && data.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Cargo não informado.");
  var acesso = _refrescarAccessToken(sessao.usuario_id);
  var mapa = _lerGruposCargo(sessao.usuario_id);
  var rn = _garantirGrupoCargo(acesso, nome, mapa);
  comLock(function () { _definirConfig(sessao.usuario_id, "google_grupos_cargo", mapa); });
  return { grupo: rn, nome: nome };
}
