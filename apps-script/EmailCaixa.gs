/**
 * EmailCaixa.gs — Caixa de e-mail da EMPRESA dentro do app (via GmailApp).
 *
 * O Web App roda como USER_DEPLOYING (= dattaobra@gmail.com), então o GmailApp
 * acessa a caixa dessa conta DIRETAMENTE — sem pipeline externo, sem API OAuth
 * por usuário. TODAS as rotas são **admin-only** (exigirAdmin): a caixa é a da
 * empresa; usuários comuns não a acessam.
 *
 * Escopo: `https://mail.google.com/` (appsscript.json). Depois de publicar o
 * escopo novo, o dono (dattaobra) precisa rodar `autorizarGmail` no editor e
 * reimplantar (a autorização é do usuário que executa).
 *
 * O corpo (HTML) das mensagens é conteúdo ARBITRÁRIO — o front SEMPRE renderiza
 * em <iframe sandbox> (sem scripts), então não injetamos nada aqui.
 */

var _EMAIL_PAG = 25; // threads por página

/**
 * autorizarGmail — RODAR NO EDITOR (logado como dattaobra) para conceder o escopo
 * do Gmail. Também serve de teste: loga quantas mensagens não lidas há na caixa.
 */
function autorizarGmail() {
  var n = GmailApp.getInboxUnreadCount();
  Logger.log("Gmail autorizado ✅. Não lidas na caixa: " + n);
  return n;
}

/** Extrai { nome, email } de um cabeçalho "Nome <e@mail>" (ou só o e-mail). */
function _emailRemetente(campo) {
  var f = String(campo || "");
  var m = f.match(/^\s*"?([^"<]*?)"?\s*<(.+?)>\s*$/);
  if (m && m[2]) return { nome: (m[1] || m[2]).trim(), email: m[2].trim() };
  return { nome: f.trim(), email: f.trim() };
}

/**
 * email.caixa.listar — { caixa:"inbox"|"enviados", q?, pagina? }
 *   -> { threads:[{ threadId, de, deEmail, assunto, previa, data, lido, qtdMsgs }], pagina, temMais }
 */
function emailCaixaListar(data, sessao) {
  exigirAdmin(sessao);
  var pagina = Math.max(0, parseInt((data && data.pagina) || 0, 10) || 0);
  var inicio = pagina * _EMAIL_PAG;
  var q = String((data && data.q) || "").trim();
  var caixa = String((data && data.caixa) || "inbox");

  var threads;
  if (q) threads = GmailApp.search(q, inicio, _EMAIL_PAG);
  else if (caixa === "enviados") threads = GmailApp.search("in:sent", inicio, _EMAIL_PAG);
  else threads = GmailApp.getInboxThreads(inicio, _EMAIL_PAG);

  var lista = threads.map(function (t) {
    var msgs = t.getMessages();
    var ultima = msgs[msgs.length - 1];
    var rem = _emailRemetente(ultima.getFrom());
    return {
      threadId: t.getId(),
      de: rem.nome,
      deEmail: rem.email,
      assunto: t.getFirstMessageSubject() || "(sem assunto)",
      previa: ultima.getPlainBody().replace(/\s+/g, " ").trim().slice(0, 140),
      data: ultima.getDate().toISOString(),
      lido: !t.isUnread(),
      qtdMsgs: t.getMessageCount(),
    };
  });
  return { threads: lista, pagina: pagina, temMais: threads.length === _EMAIL_PAG };
}

/**
 * email.caixa.ler — { threadId } -> { threadId, assunto, mensagens:[...] }.
 * Marca a conversa como lida. `html` é o corpo bruto (front renderiza em sandbox).
 */
function emailCaixaLer(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.threadId) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Conversa não informada.");
  var t = GmailApp.getThreadById(id);
  if (!t) lancar(ERRO.NAO_ENCONTRADO, "Conversa não encontrada.");

  var mensagens = t.getMessages().map(function (m) {
    var anexos = m.getAttachments().map(function (a, i) {
      return { nome: a.getName(), tamanho: a.getSize(), idx: i };
    });
    var rem = _emailRemetente(m.getFrom());
    return {
      de: rem.nome,
      deEmail: rem.email,
      para: m.getTo(),
      cc: m.getCc(),
      data: m.getDate().toISOString(),
      assunto: m.getSubject(),
      html: m.getBody(),
      anexos: anexos,
    };
  });
  t.markRead();
  return { threadId: id, assunto: t.getFirstMessageSubject() || "(sem assunto)", mensagens: mensagens };
}
