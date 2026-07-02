/**
 * Email.gs — Envio de e-mail do APP via Resend (API HTTP).
 *
 * A chave NUNCA fica no código nem no frontend (que é público): vem das
 * Script Properties do projeto. Configure (Editor do Apps Script → Project
 * Settings → Script Properties), após verificar o domínio no Resend:
 *   - RESEND_API_KEY   = re_...               (a API key do Resend)
 *   - EMAIL_REMETENTE  = Dattaobra <notificacoes@dattaobra.com.br>
 *   - EMAIL_REPLYTO    = contato@dattaobra.com.br  (opcional; respostas caem na caixa)
 *   - EMAIL_TESTE      = seu@email.com         (só p/ testarEmailResend no editor)
 *
 * Uso interno (alertas/relatórios/link público):
 *   enviarEmailResend("alguem@x.com", "Assunto", "<p>HTML…</p>");
 */

/** "a@x, b@y; c@z" (ou array) -> ["a@x","b@y","c@z"]. */
function _listaEmails(v) {
  if (Array.isArray(v)) return v.map(function (s) { return String(s).trim(); }).filter(Boolean);
  return String(v || "").split(/[,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
}

/**
 * Envia um e-mail via Resend. Retorna { id }. Lança ERRO.VALIDACAO se não configurado.
 * opts: { from, cc, bcc, reply_to, attachments:[{filename,content(base64)}] }.
 */
function enviarEmailResend(para, assunto, html, opts) {
  opts = opts || {};
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty("RESEND_API_KEY");
  const remetente =
    opts.from || props.getProperty("EMAIL_REMETENTE") || "Dattaobra <notificacoes@dattaobra.com.br>";
  if (!key) lancar(ERRO.VALIDACAO, "RESEND_API_KEY não configurada nas Script Properties.");
  const to = _listaEmails(para);
  if (!to.length) lancar(ERRO.VALIDACAO, "Destinatário do e-mail vazio.");

  // Reply-To: usa o explícito; senão o padrão (EMAIL_REPLYTO) → respostas caem na caixa.
  const replyTo = opts.reply_to || props.getProperty("EMAIL_REPLYTO") || "";

  const corpo = {
    from: remetente,
    to: to,
    subject: String(assunto || ""),
    html: String(html || ""),
  };
  if (replyTo) corpo.reply_to = replyTo;
  const cc = _listaEmails(opts.cc); if (cc.length) corpo.cc = cc;
  const bcc = _listaEmails(opts.bcc); if (bcc.length) corpo.bcc = bcc;
  if (Array.isArray(opts.attachments) && opts.attachments.length) corpo.attachments = opts.attachments;

  const resp = UrlFetchApp.fetch("https://api.resend.com/emails", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + key },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  const texto = resp.getContentText();
  if (code >= 300) lancar(ERRO.INTERNO, "Falha no Resend (" + code + "): " + texto);
  return JSON.parse(texto || "{}");
}

/**
 * email.teste -> { ok, id, para }. Envia um e-mail de teste para o PRÓPRIO
 * e-mail do usuário logado (sem destino arbitrário — nada de spam a terceiros).
 */
function emailTeste(data, sessao) {
  const u = buscarUsuarioPorId(sessao.usuario_id) || {};
  const para = String(u.email || "").trim();
  if (!para) lancar(ERRO.VALIDACAO, "Seu usuário não tem e-mail cadastrado.");
  const r = enviarEmailResend(
    para,
    "Teste — Dattaobra",
    "<p>Funcionou! Este é um teste de envio via <b>Resend</b> do Dattaobra.</p>"
  );
  return { ok: true, id: r.id, para: para };
}

/** Rodável no Editor do Apps Script p/ validar a configuração (usa EMAIL_TESTE). */
function testarEmailResend() {
  const para = PropertiesService.getScriptProperties().getProperty("EMAIL_TESTE");
  if (!para) throw new Error("Defina a Script Property EMAIL_TESTE com seu e-mail.");
  return enviarEmailResend(para, "Teste — Dataobra", "<p>Envio via Resend OK ✅</p>");
}
