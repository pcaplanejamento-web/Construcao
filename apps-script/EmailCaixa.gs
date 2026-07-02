/**
 * EmailCaixa.gs — Caixa de e-mail da EMPRESA dentro do app (via GmailApp).
 *
 * O Web App roda como USER_DEPLOYING (= dattaobra@gmail.com), então o GmailApp
 * acessa a caixa dessa conta DIRETAMENTE. TODAS as rotas são **admin-only**
 * (exigirAdmin). Escopo `https://mail.google.com/` (appsscript.json); autorizar
 * com `autorizarGmail`.
 *
 * "Endereços @dattaobra.com.br" = APELIDOS (getAliases) — receber via Cloudflare
 * Email Routing, enviar via "Enviar e-mail como" do Gmail. O app detecta e usa.
 *
 * O corpo (HTML) das mensagens é ARBITRÁRIO — o front SEMPRE renderiza em
 * <iframe sandbox> (sem scripts).
 */

var _EMAIL_PAG = 25; // itens por página

/** autorizarGmail — RODAR NO EDITOR (como dattaobra) p/ conceder o escopo do Gmail. */
function autorizarGmail() {
  var n = GmailApp.getInboxUnreadCount();
  Logger.log("Gmail autorizado ✅. Não lidas na caixa: " + n);
  return n;
}

/** Extrai { nome, email } de "Nome <e@mail>" (ou só o e-mail). */
function _emailRemetente(campo) {
  var f = String(campo || "");
  var m = f.match(/^\s*"?([^"<]*?)"?\s*<(.+?)>\s*$/);
  if (m && m[2]) return { nome: (m[1] || m[2]).trim(), email: m[2].trim() };
  return { nome: f.trim(), email: f.trim() };
}

/* --------------------------- Remetentes / envio --------------------------- */

/** Conta principal + aliases "Enviar como". */
function _remetentes() {
  var principal = "";
  try { principal = Session.getActiveUser().getEmail() || ""; } catch (e) { /* pode vir vazio */ }
  return { principal: principal, aliases: GmailApp.getAliases() || [] };
}

/** Endereços @dattaobra.com.br criados no app (enviados via Resend). */
function _enderecos() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("EMAIL_ENDERECOS") || "[]") || []; }
  catch (e) { return []; }
}
function _ehEnderecoResend(from) {
  var f = String(from || "").trim();
  return !!f && _enderecos().indexOf(f) >= 0;
}
/** [{nome,mimeType,base64}] -> formato de anexo do Resend. */
function _anexosResend(anexos) {
  return (anexos || []).filter(function (a) { return a && a.base64; })
    .map(function (a) { return { filename: a.nome || "anexo", content: a.base64 }; });
}

/** email.caixa.remetentes -> { principal, aliases, enderecos, assinatura }. */
function emailCaixaRemetentes(data, sessao) {
  exigirAdmin(sessao);
  var r = _remetentes();
  r.enderecos = _enderecos();
  r.assinatura = PropertiesService.getScriptProperties().getProperty("EMAIL_ASSINATURA") || "";
  return r;
}

/** email.caixa.criarEndereco -> { enderecos }. Adiciona local@dattaobra.com.br à lista. */
function emailCaixaCriarEndereco(data, sessao) {
  exigirAdmin(sessao);
  var local = String((data && data.local) || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(local)) {
    lancar(ERRO.VALIDACAO, "Nome inválido: use letras, números, ponto, hífen ou sublinhado.");
  }
  var addr = local + "@dattaobra.com.br";
  var lista = _enderecos();
  if (lista.indexOf(addr) < 0) lista.push(addr);
  PropertiesService.getScriptProperties().setProperty("EMAIL_ENDERECOS", JSON.stringify(lista));
  return { enderecos: lista };
}

/** email.caixa.removerEndereco -> { enderecos }. */
function emailCaixaRemoverEndereco(data, sessao) {
  exigirAdmin(sessao);
  var addr = String((data && data.endereco) || "").trim();
  var lista = _enderecos().filter(function (e) { return e !== addr; });
  PropertiesService.getScriptProperties().setProperty("EMAIL_ENDERECOS", JSON.stringify(lista));
  return { enderecos: lista };
}

/** Valida o "De": só a conta principal ou um alias (evita forjar remetente). "" = padrão. */
function _validarDe(from) {
  var f = String(from || "").trim();
  if (!f) return "";
  var r = _remetentes();
  if (f === r.principal) return f;
  for (var i = 0; i < r.aliases.length; i++) if (r.aliases[i] === f) return f;
  return "";
}

/** [{nome,mimeType,base64}] -> Blobs para anexar. */
function _anexosBlobs(anexos) {
  var out = [];
  (anexos || []).forEach(function (a) {
    if (a && a.base64) {
      out.push(Utilities.newBlob(Utilities.base64Decode(a.base64), a.mimeType || "application/octet-stream", a.nome || "anexo"));
    }
  });
  return out;
}

/** Monta as options de envio a partir do payload (cc/bcc/from/anexos/html). */
function _opcoesEnvio(data) {
  var html = String((data && data.html) || "");
  var opts = { htmlBody: html, name: "Dattaobra" };
  var cc = String((data && data.cc) || "").trim(); if (cc) opts.cc = cc;
  var bcc = String((data && data.bcc) || "").trim(); if (bcc) opts.bcc = bcc;
  var de = _validarDe(data && data.from); if (de) opts.from = de;
  var anexos = _anexosBlobs(data && data.anexos); if (anexos.length) opts.attachments = anexos;
  return opts;
}

/** Fallback texto puro a partir do HTML. */
function _emailTexto(html) {
  return String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim();
}

/** email.caixa.enviar — { para, cc?, bcc?, from?, assunto, html, anexos? } -> { ok:true }. */
function emailCaixaEnviar(data, sessao) {
  exigirAdmin(sessao);
  var para = String((data && data.para) || "").trim();
  var assunto = String((data && data.assunto) || "").trim();
  var html = String((data && data.html) || "");
  if (!para) lancar(ERRO.VALIDACAO, "Informe o destinatário.");
  if (!assunto && !html) lancar(ERRO.VALIDACAO, "Escreva o assunto ou a mensagem.");
  if (_ehEnderecoResend(data && data.from)) {
    enviarEmailResend(para, assunto, html, { from: data.from, cc: data.cc, bcc: data.bcc, attachments: _anexosResend(data && data.anexos) });
  } else {
    GmailApp.sendEmail(para, assunto, _emailTexto(html), _opcoesEnvio(data));
  }
  return { ok: true };
}

/** email.caixa.responder — { threadId, html, todos?, cc?, bcc?, from?, anexos? } -> { ok:true }. */
function emailCaixaResponder(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.threadId) || "");
  var html = String((data && data.html) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Conversa não informada.");
  if (!html.trim()) lancar(ERRO.VALIDACAO, "Escreva a resposta.");
  var t = GmailApp.getThreadById(id);
  if (!t) lancar(ERRO.NAO_ENCONTRADO, "Conversa não encontrada.");
  if (_ehEnderecoResend(data && data.from)) {
    // Responder "como" um endereço @dattaobra.com.br → via Resend (para quem enviou).
    var msgs = t.getMessages();
    var to = _emailRemetente(msgs[msgs.length - 1].getFrom()).email;
    var assuntoRe = "Re: " + (t.getFirstMessageSubject() || "").replace(/^Re:\s*/i, "");
    enviarEmailResend(to, assuntoRe, html, { from: data.from, cc: data.cc, bcc: data.bcc, attachments: _anexosResend(data && data.anexos) });
  } else {
    var opts = _opcoesEnvio(data);
    if (data && data.todos) t.replyAll(_emailTexto(html), opts);
    else t.reply(_emailTexto(html), opts);
  }
  return { ok: true };
}

/** email.caixa.encaminhar — { threadId, msgIdx?, para, cc?, bcc?, from?, html? } -> { ok:true }. */
function emailCaixaEncaminhar(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.threadId) || "");
  var para = String((data && data.para) || "").trim();
  if (!id) lancar(ERRO.VALIDACAO, "Conversa não informada.");
  if (!para) lancar(ERRO.VALIDACAO, "Informe o destinatário.");
  var t = GmailApp.getThreadById(id);
  if (!t) lancar(ERRO.NAO_ENCONTRADO, "Conversa não encontrada.");
  var msgs = t.getMessages();
  var mi = parseInt((data && data.msgIdx), 10);
  var m = (!isNaN(mi) && msgs[mi]) ? msgs[mi] : msgs[msgs.length - 1];
  var opts = { name: "Dattaobra" };
  var html = String((data && data.html) || ""); if (html) opts.htmlBody = html;
  var cc = String((data && data.cc) || "").trim(); if (cc) opts.cc = cc;
  var bcc = String((data && data.bcc) || "").trim(); if (bcc) opts.bcc = bcc;
  var de = _validarDe(data && data.from); if (de) opts.from = de;
  m.forward(para, opts);
  return { ok: true };
}

/* ------------------------------- Listagem -------------------------------- */

/** Query do Gmail conforme a caixa escolhida. */
function _queryCaixa(caixa) {
  if (caixa === "enviados") return "in:sent";
  if (caixa === "lixeira") return "in:trash";
  if (caixa === "estrela") return "is:starred";
  if (caixa && caixa.indexOf("label:") === 0) return caixa;
  return "in:inbox";
}

/**
 * email.caixa.listar — { caixa, q?, pagina? }
 *   -> { threads:[{threadId,de,deEmail,assunto,previa,data,lido,estrela,labels,qtdMsgs}], pagina, temMais }
 */
function emailCaixaListar(data, sessao) {
  exigirAdmin(sessao);
  var pagina = Math.max(0, parseInt((data && data.pagina) || 0, 10) || 0);
  var inicio = pagina * _EMAIL_PAG;
  var q = String((data && data.q) || "").trim();
  var query = q || _queryCaixa(String((data && data.caixa) || "inbox"));

  var threads = GmailApp.search(query, inicio, _EMAIL_PAG);
  var lista = threads.map(function (t) {
    var msgs = t.getMessages();
    var ultima = msgs[msgs.length - 1];
    var rem = _emailRemetente(ultima.getFrom());
    var estrela = false;
    for (var i = 0; i < msgs.length; i++) { if (msgs[i].isStarred()) { estrela = true; break; } }
    return {
      threadId: t.getId(),
      de: rem.nome,
      deEmail: rem.email,
      assunto: t.getFirstMessageSubject() || "(sem assunto)",
      previa: ultima.getPlainBody().replace(/\s+/g, " ").trim().slice(0, 140),
      data: ultima.getDate().toISOString(),
      lido: !t.isUnread(),
      estrela: estrela,
      labels: (t.getLabels() || []).map(function (l) { return l.getName(); }),
      qtdMsgs: t.getMessageCount(),
    };
  });
  return { threads: lista, pagina: pagina, temMais: threads.length === _EMAIL_PAG };
}

/** email.caixa.ler — { threadId } -> { threadId, assunto, mensagens:[...] }. Marca lida. */
function emailCaixaLer(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.threadId) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Conversa não informada.");
  var t = GmailApp.getThreadById(id);
  if (!t) lancar(ERRO.NAO_ENCONTRADO, "Conversa não encontrada.");
  var mensagens = t.getMessages().map(function (m) {
    var anexos = m.getAttachments().map(function (a, i) { return { nome: a.getName(), tamanho: a.getSize(), idx: i }; });
    var rem = _emailRemetente(m.getFrom());
    return {
      de: rem.nome, deEmail: rem.email, para: m.getTo(), cc: m.getCc(),
      data: m.getDate().toISOString(), assunto: m.getSubject(), html: m.getBody(), anexos: anexos,
    };
  });
  t.markRead();
  return {
    threadId: id, assunto: t.getFirstMessageSubject() || "(sem assunto)",
    estrela: t.getMessages().some(function (m) { return m.isStarred(); }),
    labels: (t.getLabels() || []).map(function (l) { return l.getName(); }),
    mensagens: mensagens,
  };
}

/* ------------------------- Ações (marcar/labels) -------------------------- */

/** email.caixa.marcar — { threadId, acao:"lida"|"naoLida"|"arquivar"|"lixeira"|"estrela"|"tirarEstrela" }. */
function emailCaixaMarcar(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.threadId) || "");
  var acao = String((data && data.acao) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Conversa não informada.");
  var t = GmailApp.getThreadById(id);
  if (!t) lancar(ERRO.NAO_ENCONTRADO, "Conversa não encontrada.");
  if (acao === "lida") t.markRead();
  else if (acao === "naoLida") t.markUnread();
  else if (acao === "arquivar") t.moveToArchive();
  else if (acao === "lixeira") t.moveToTrash();
  else if (acao === "estrela") t.getMessages().forEach(function (m) { m.star(); });
  else if (acao === "tirarEstrela") t.getMessages().forEach(function (m) { m.unstar(); });
  else lancar(ERRO.VALIDACAO, "Ação inválida.");
  return { ok: true };
}

/** email.caixa.labels -> { labels:[nome,...] } (marcadores do usuário). */
function emailCaixaLabels(data, sessao) {
  exigirAdmin(sessao);
  return { labels: (GmailApp.getUserLabels() || []).map(function (l) { return l.getName(); }) };
}

/** email.caixa.aplicarLabel — { threadId, label, aplicar } -> { ok:true } (cria o label se preciso). */
function emailCaixaAplicarLabel(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.threadId) || "");
  var nome = String((data && data.label) || "").trim();
  var aplicar = (data && data.aplicar) !== false;
  if (!id || !nome) lancar(ERRO.VALIDACAO, "Informe conversa e marcador.");
  var t = GmailApp.getThreadById(id);
  if (!t) lancar(ERRO.NAO_ENCONTRADO, "Conversa não encontrada.");
  var label = GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
  if (aplicar) t.addLabel(label); else t.removeLabel(label);
  return { ok: true };
}

/** email.caixa.anexo — { threadId, msgIdx, anexoIdx } -> { nome, mimeType, base64 }. */
function emailCaixaAnexo(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.threadId) || "");
  var mi = parseInt((data && data.msgIdx), 10);
  var ai = parseInt((data && data.anexoIdx), 10);
  if (!id || isNaN(mi) || isNaN(ai)) lancar(ERRO.VALIDACAO, "Anexo não informado.");
  var t = GmailApp.getThreadById(id);
  if (!t) lancar(ERRO.NAO_ENCONTRADO, "Conversa não encontrada.");
  var m = t.getMessages()[mi];
  if (!m) lancar(ERRO.NAO_ENCONTRADO, "Mensagem não encontrada.");
  var a = m.getAttachments()[ai];
  if (!a) lancar(ERRO.NAO_ENCONTRADO, "Anexo não encontrado.");
  if (a.getSize() > 20 * 1024 * 1024) lancar(ERRO.VALIDACAO, "Anexo muito grande para baixar aqui — abra no Gmail.");
  return { nome: a.getName(), mimeType: a.getContentType(), base64: Utilities.base64Encode(a.getBytes()) };
}

/* ------------------------- Rascunhos / assinatura ------------------------- */

/** email.caixa.rascunhos -> { rascunhos:[{draftId,para,assunto,previa,data,html}], pagina, temMais }. */
function emailCaixaRascunhos(data, sessao) {
  exigirAdmin(sessao);
  var pagina = Math.max(0, parseInt((data && data.pagina) || 0, 10) || 0);
  var todos = GmailApp.getDrafts() || [];
  var ini = pagina * _EMAIL_PAG;
  var slice = todos.slice(ini, ini + _EMAIL_PAG);
  var lista = slice.map(function (d) {
    var m = d.getMessage();
    return {
      draftId: d.getId(), para: m.getTo(), cc: m.getCc(),
      assunto: m.getSubject() || "(sem assunto)",
      previa: m.getPlainBody().replace(/\s+/g, " ").trim().slice(0, 140),
      data: m.getDate().toISOString(), html: m.getBody(),
    };
  });
  return { rascunhos: lista, pagina: pagina, temMais: todos.length > ini + _EMAIL_PAG };
}

/** email.caixa.salvarRascunho — { draftId?, para, cc?, bcc?, from?, assunto, html, anexos? } -> { draftId }. */
function emailCaixaSalvarRascunho(data, sessao) {
  exigirAdmin(sessao);
  var para = String((data && data.para) || "").trim();
  var assunto = String((data && data.assunto) || "").trim();
  var html = String((data && data.html) || "");
  var opts = _opcoesEnvio(data);
  var id = String((data && data.draftId) || "");
  var d;
  if (id) { d = GmailApp.getDraft(id).update(para, assunto, _emailTexto(html), opts); }
  else { d = GmailApp.createDraft(para, assunto, _emailTexto(html), opts); }
  return { draftId: d.getId() };
}

/** email.caixa.enviarRascunho — { draftId } -> { ok:true }. */
function emailCaixaEnviarRascunho(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.draftId) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Rascunho não informado.");
  GmailApp.getDraft(id).send();
  return { ok: true };
}

/** email.caixa.excluirRascunho — { draftId } -> { ok:true }. */
function emailCaixaExcluirRascunho(data, sessao) {
  exigirAdmin(sessao);
  var id = String((data && data.draftId) || "");
  if (!id) lancar(ERRO.VALIDACAO, "Rascunho não informado.");
  GmailApp.getDraft(id).deleteDraft();
  return { ok: true };
}

/** email.caixa.assinatura — { html } -> { ok:true } (define a assinatura padrão). */
function emailCaixaAssinatura(data, sessao) {
  exigirAdmin(sessao);
  PropertiesService.getScriptProperties().setProperty("EMAIL_ASSINATURA", String((data && data.html) || ""));
  return { ok: true };
}
