/**
 * Drive.gs — Armazenamento de COMPROVANTES de transferência no Google Drive.
 *
 * O web app roda como USER_DEPLOYING (o dono), então os arquivos vivem no Drive do
 * dono, organizados em UMA pasta-raiz do app + uma SUBPASTA por usuário (usuario_id).
 * Escopo `drive` (o `DriveApp.createFolder` exige o escopo amplo — `drive.file` não
 * cobre criação de pastas). Roda como o dono, no Drive dele: a pasta-raiz é criada pelo
 * próprio script (id em Script Properties) e a subpasta de cada usuário tem o id
 * guardado em CONFIGURACOES (chave `drive_folder_id`).
 *
 * IMPORTANTE: estas funções NÃO usam comLock — os chamadores (Transferencias.gs)
 * já rodam dentro de um comLock; relockar aqui causaria lock aninhado.
 */

const _DRIVE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
// Mapa extensão → mime (fallback quando o navegador não informa o tipo).
const _DRIVE_EXT_MIME = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
};

/** Resolve o mime do comprovante: usa o informado; se vazio/desconhecido, infere pela extensão. */
function _mimeComprovante(comprovante) {
  let mime = String((comprovante && comprovante.mime) || "").trim().toLowerCase();
  const ehAceito = mime === "application/pdf" || mime.indexOf("image/") === 0;
  if (!ehAceito) {
    const nome = String((comprovante && comprovante.nome) || "").toLowerCase();
    const ext = nome.indexOf(".") >= 0 ? nome.slice(nome.lastIndexOf(".") + 1) : "";
    if (_DRIVE_EXT_MIME[ext]) mime = _DRIVE_EXT_MIME[ext];
  }
  return mime;
}

/** Pasta-raiz do app (cria 1× e guarda o id em Script Properties). */
function _driveRoot() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("DRIVE_ROOT_FOLDER_ID");
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      /* lixeira/sem acesso: recria abaixo */
    }
  }
  const pasta = DriveApp.createFolder("Dattaobra - Comprovantes");
  props.setProperty("DRIVE_ROOT_FOLDER_ID", pasta.getId());
  return pasta;
}

/** Subpasta do usuário (cria 1× e guarda o id em CONFIGURACOES). */
function _pastaDoUsuario(usuarioId) {
  const cfg = montarConfigUsuario(usuarioId);
  const id = cfg && cfg.drive_folder_id;
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      /* recria abaixo */
    }
  }
  const pasta = _driveRoot().createFolder(String(usuarioId));
  // upsert CONFIGURACOES.drive_folder_id (mesmo padrão de Config.gs, sem comLock).
  const existente = repoEncontrar(SCHEMA.CONFIGURACOES, function (c) {
    return String(c.usuario_id) === String(usuarioId) && c.chave === "drive_folder_id";
  });
  if (existente) {
    repoAtualizar(SCHEMA.CONFIGURACOES, "id", existente.id, {
      valor: pasta.getId(),
      atualizado_em: agoraIso(),
    });
  } else {
    repoInserir(SCHEMA.CONFIGURACOES, {
      id: novoId(),
      usuario_id: usuarioId,
      chave: "drive_folder_id",
      valor: pasta.getId(),
      atualizado_em: agoraIso(),
    });
  }
  return pasta;
}

/** Valida o comprovante recebido do cliente: aceita PDF e QUALQUER imagem; ≤10MB. */
function _validarComprovante(comprovante) {
  if (!comprovante || !comprovante.base64) lancar(ERRO.VALIDACAO, "Comprovante inválido.");
  const nome = String((comprovante && comprovante.nome) || "").trim();
  if (!nome) lancar(ERRO.VALIDACAO, "Comprovante sem nome.");
  const mime = _mimeComprovante(comprovante);
  if (mime !== "application/pdf" && mime.indexOf("image/") !== 0)
    lancar(ERRO.VALIDACAO, "Anexe um PDF ou uma imagem.");
  const bytes = Math.floor((String(comprovante.base64).length * 3) / 4);
  if (bytes > _DRIVE_MAX_BYTES) lancar(ERRO.VALIDACAO, "Arquivo muito grande (máximo 10MB).");
}

/**
 * Salva o comprovante na subpasta do usuário e devolve {file_id, nome, url}.
 * Deixa o arquivo visível por link (p/ aparecer no link público da obra). Se a
 * política do domínio bloquear o compartilhamento, mantém privado e segue (loga).
 */
function _salvarComprovante(usuarioId, comprovante) {
  _validarComprovante(comprovante);
  const mime = _mimeComprovante(comprovante) || "application/octet-stream";
  const bytes = Utilities.base64Decode(comprovante.base64);
  const blob = Utilities.newBlob(bytes, mime, String(comprovante.nome));
  const arquivo = _pastaDoUsuario(usuarioId).createFile(blob);
  try {
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.error("Não foi possível compartilhar o comprovante por link: " + e);
  }
  return { file_id: arquivo.getId(), nome: arquivo.getName(), url: arquivo.getUrl() };
}

/**
 * SETUP (uma vez): rode esta função NO EDITOR do Apps Script após adicionar o escopo
 * `drive` — ela dispara o consentimento do Drive e cria/garante a pasta-raiz.
 * Sem isso, o primeiro upload de comprovante falha (a transferência ainda é salva).
 */
function autorizarDrive() {
  const pasta = _driveRoot();
  Logger.log("Pasta-raiz de comprovantes pronta: " + pasta.getUrl());
  return pasta.getUrl();
}

/** Manda o arquivo para a lixeira. NUNCA lança (não pode quebrar a exclusão). */
function _excluirComprovante(fileId) {
  const id = String(fileId || "");
  if (!id) return;
  try {
    DriveApp.getFileById(id).setTrashed(true);
  } catch (e) {
    console.error("Falha ao excluir comprovante " + id + ": " + e);
  }
}
