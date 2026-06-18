/**
 * Setup.gs — Inicialização do banco (rodado MANUALMENTE no editor, uma vez).
 *
 * Passos no editor do Apps Script (ver docs/SETUP-E-DEPLOY.md):
 *   1. Em "Configurações do projeto" > "Propriedades do script", defina:
 *        ADMIN_EMAIL, ADMIN_SENHA, ADMIN_NOME (opcional)
 *        SPREADSHEET_ID (opcional — se vazio, uma planilha é criada).
 *   2. Execute bootstrapAdmin() e autorize os escopos.
 *   3. Veja no log a URL da planilha (se foi criada) e confirme as abas.
 *
 * É idempotente: reexecutar não duplica abas, categorias nem o admin.
 */

/** Garante a planilha-banco e registra seu ID nas Script Properties. */
function _garantirPlanilha() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);

  const ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) {
    props.setProperty("SPREADSHEET_ID", ativa.getId());
    return ativa;
  }
  const nova = SpreadsheetApp.create("Gestão de Obras — Banco de Dados");
  props.setProperty("SPREADSHEET_ID", nova.getId());
  Logger.log("Planilha criada: " + nova.getUrl());
  return nova;
}

/** Cria todas as abas (com cabeçalho) caso não existam. */
function _garantirAbas() {
  Object.keys(SCHEMA).forEach(function (k) {
    _abaDe(SCHEMA[k]); // _abaDe cria a aba + cabeçalho se faltar.
  });
}

/** Insere as categorias GLOBAL semente se ainda não existirem. */
function _garantirCategoriasGlobais() {
  const existentes = repoFiltrar(SCHEMA.CATEGORIAS, function (c) {
    return String(c.usuario_id) === CATEGORIA_GLOBAL;
  });
  if (existentes.length > 0) return;
  CATEGORIAS_SEED.forEach(function (seed) {
    repoInserir(SCHEMA.CATEGORIAS, {
      id: novoId(),
      usuario_id: CATEGORIA_GLOBAL,
      nome: seed.nome,
      cor: seed.cor,
      ativo: true,
    });
  });
}

/** Cria o usuário admin a partir das Script Properties, se ainda não existir. */
function _garantirAdmin() {
  const props = PropertiesService.getScriptProperties();
  const email = (props.getProperty("ADMIN_EMAIL") || "").trim().toLowerCase();
  const senha = props.getProperty("ADMIN_SENHA") || "";
  const nome = props.getProperty("ADMIN_NOME") || "Administrador";

  if (!email || !senha) {
    Logger.log(
      "Defina ADMIN_EMAIL e ADMIN_SENHA nas Script Properties antes do bootstrap."
    );
    return;
  }
  if (buscarUsuarioPorEmail(email)) {
    Logger.log("Admin já existe: " + email);
    return;
  }
  const par = criarHashSenha(senha);
  repoInserir(SCHEMA.USUARIOS, {
    id: novoId(),
    email: email,
    nome: nome,
    senha_hash: par.hash,
    salt: par.salt,
    role: ROLES.ADMIN,
    ativo: true,
    criado_em: agoraIso(),
    criado_por: "BOOTSTRAP",
  });
  Logger.log("Admin criado: " + email);
}

/**
 * Ponto de entrada do setup. Execute esta função no editor.
 */
function bootstrapAdmin() {
  _garantirPlanilha();
  comLock(function () {
    _garantirAbas();
    _garantirCategoriasGlobais();
    _garantirAdmin();
    return true;
  });
  Logger.log("Bootstrap concluído.");
}

/* ----------------------- Manutenção de sessões ------------------------ */

/** Remove sessões expiradas. Pode ser chamado por um trigger diário. */
function limparSessoesExpiradas() {
  comLock(function () {
    const agora = Date.now();
    const expiradas = repoFiltrar(SCHEMA.SESSOES, function (s) {
      return new Date(s.expira_em).getTime() < agora;
    });
    expiradas.forEach(function (s) {
      repoRemover(SCHEMA.SESSOES, "token", s.token);
    });
    Logger.log("Sessões expiradas removidas: " + expiradas.length);
    return true;
  });
}

/** Instala (uma vez) o trigger diário de limpeza de sessões. */
function instalarTriggerLimpeza() {
  const jaExiste = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === "limparSessoesExpiradas";
  });
  if (jaExiste) {
    Logger.log("Trigger de limpeza já instalado.");
    return;
  }
  ScriptApp.newTrigger("limparSessoesExpiradas")
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log("Trigger de limpeza instalado (diário, 03h).");
}
