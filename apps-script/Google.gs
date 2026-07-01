/**
 * Google.gs — "Conectar Google" (OAuth2 authorization-code) por usuário do app.
 *
 * O Web App roda executeAs USER_DEPLOYING (o efetivo é sempre o dono). Por isso
 * a agenda de CADA usuário do app não pode usar o token do dono: cada usuário
 * autoriza a própria conta Google e guardamos o REFRESH TOKEN por usuario_id em
 * CONFIGURACOES (chave "google_refresh_token", omitida do cliente por
 * montarConfigUsuario — ver Auth.gs). O acesso à Calendar API é feito via
 * UrlFetchApp com o access token renovado (não usa os oauthScopes do manifesto).
 *
 * Segredos nas Script Properties (Editor → Project Settings → Script Properties):
 *   - GOOGLE_CLIENT_ID      = ....apps.googleusercontent.com   (mesmo do login)
 *   - GOOGLE_CLIENT_SECRET  = ....                              (nunca no front)
 *   - OAUTH_REDIRECT_URI    = https://.../exec  (opcional; padrão = URL do Web App)
 *
 * Escopo pedido: calendar.events (ler/criar eventos — base para calendário nas
 * obras). O callback é servido pelo doGet (Code.gs) → googleTratarCallback.
 */

/* ------------------------------ Helpers ------------------------------- */

function _googleProp(nome) {
  return PropertiesService.getScriptProperties().getProperty(nome);
}

/** URL de redirect do OAuth: Script Property OAUTH_REDIRECT_URI ou a URL do Web App. */
function _googleRedirectUri() {
  return _googleProp("OAUTH_REDIRECT_URI") || ScriptApp.getService().getUrl();
}

/** Escopo do OAuth (calendar.events cobre ler/criar eventos). */
function _googleScope() {
  return "https://www.googleapis.com/auth/calendar.events";
}

function _escaparHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rodar UMA VEZ no Editor do Apps Script (botão Executar) para conceder o escopo
 * `script.external_request`, necessário ao UrlFetchApp (chamadas à API do Google/
 * OAuth). Faz uma requisição HTTP inofensiva só para disparar o consentimento.
 * Como o web app roda como USER_DEPLOYING (o dono), essa autorização vale para o
 * "Entrar com Google" e o "Conectar Google" no app. (Espelha autorizarDrive.)
 */
function autorizarGoogle() {
  const resp = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?access_token=invalido",
    { muteHttpExceptions: true }
  );
  return "OK (" + resp.getResponseCode() + ") — escopo external_request autorizado.";
}

/* ------------------------------ Actions ------------------------------- */

/**
 * google.iniciarOAuth -> { authUrl }. Gera um state (nonce, 10 min, uso único)
 * ligado ao usuario_id e devolve a URL de consentimento do Google. O front abre
 * essa URL numa janela; ao término o Google chama o doGet (callback).
 */
function googleIniciarOAuth(data, sessao) {
  const clientId = _googleProp("GOOGLE_CLIENT_ID");
  if (!clientId) {
    lancar(ERRO.INTERNO, "GOOGLE_CLIENT_ID não configurado nas Script Properties.");
  }
  const state = novoId();
  cachePut("oauth_state:" + state, sessao.usuario_id, 600); // 10 min

  const url =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    "?client_id=" + encodeURIComponent(clientId) +
    "&redirect_uri=" + encodeURIComponent(_googleRedirectUri()) +
    "&response_type=code" +
    "&scope=" + encodeURIComponent(_googleScope()) +
    "&access_type=offline" +
    "&include_granted_scopes=true" +
    "&prompt=consent" +
    "&state=" + encodeURIComponent(state);
  return { authUrl: url };
}

/** google.status -> { conectado, google_email }. */
function googleStatus(data, sessao) {
  const refresh = _lerConfig(sessao.usuario_id, "google_refresh_token");
  const email = _lerConfig(sessao.usuario_id, "google_email");
  return { conectado: !!refresh, google_email: email || "" };
}

/**
 * google.desconectar -> { conectado:false }. Apaga o refresh token guardado e
 * tenta revogar o acesso no Google (best-effort — não falha se a revogação der erro).
 */
function googleDesconectar(data, sessao) {
  const refresh = _lerConfig(sessao.usuario_id, "google_refresh_token");
  if (refresh) {
    try {
      UrlFetchApp.fetch(
        "https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(refresh),
        { method: "post", muteHttpExceptions: true }
      );
    } catch (e) {
      // ignora falha de revogação — o essencial é apagar localmente.
    }
  }
  return comLock(function () {
    _definirConfig(sessao.usuario_id, "google_refresh_token", "");
    return { conectado: false };
  });
}

/**
 * google.testarConexao -> { agenda, eventos }. Renova o access token e lê 1
 * evento da agenda principal (prova o refresh token de ponta a ponta).
 */
function googleTestarConexao(data, sessao) {
  const acesso = _refrescarAccessToken(sessao.usuario_id);
  const resp = UrlFetchApp.fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
      "?maxResults=1&singleEvents=true&orderBy=startTime&timeMin=" +
      encodeURIComponent(new Date().toISOString()),
    { headers: { Authorization: "Bearer " + acesso }, muteHttpExceptions: true }
  );
  if (resp.getResponseCode() !== 200) {
    lancar(
      ERRO.INTERNO,
      "Falha ao acessar a agenda (" + resp.getResponseCode() + "). Reconecte sua conta."
    );
  }
  const json = JSON.parse(resp.getContentText() || "{}");
  return { agenda: json.summary || "principal", eventos: (json.items || []).length };
}

/* --------------------- Callback (chamado pelo doGet) ------------------ */

/**
 * Trata o retorno do consentimento (?code=&state= no doGet). Valida o state,
 * troca o código por tokens, guarda o refresh token e devolve um HtmlOutput que
 * avisa a janela-mãe (postMessage) e se fecha. Nunca lança (sempre devolve HTML).
 */
function googleTratarCallback(code, state, erroOAuth) {
  try {
    if (erroOAuth) {
      return _googleHtmlCallback("Autorização não concluída (" + erroOAuth + ").", false);
    }
    const usuarioId = cacheGet("oauth_state:" + state);
    if (!usuarioId) {
      return _googleHtmlCallback(
        "Sessão de autorização expirada. Volte ao app e tente conectar novamente.",
        false
      );
    }
    cacheRemove("oauth_state:" + state); // uso único
    const tokens = _trocarCodigoPorTokens(code);
    if (!tokens.refresh_token) {
      return _googleHtmlCallback(
        "O Google não devolveu autorização permanente. Remova o app em " +
          "myaccount.google.com/permissions e conecte de novo.",
        false
      );
    }
    comLock(function () {
      _definirConfig(usuarioId, "google_refresh_token", tokens.refresh_token);
    });
    return _googleHtmlCallback("Conta Google conectada! Você pode fechar esta aba.", true);
  } catch (ex) {
    return _googleHtmlCallback(
      "Erro ao conectar: " + (ex && ex.message ? ex.message : ex),
      false
    );
  }
}

/** Monta a página do callback: avisa a janela-mãe e se fecha. */
function _googleHtmlCallback(mensagem, sucesso) {
  const tipo = sucesso ? "google_conectado" : "google_erro";
  const cor = sucesso ? "#0f766e" : "#b91c1c";
  const html =
    "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>" +
    "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
    "<title>Dattaobra</title></head>" +
    "<body style=\"margin:0;min-height:100vh;display:flex;align-items:center;" +
    "justify-content:center;font-family:-apple-system,Segoe UI,Roboto,sans-serif;" +
    "background:#f8fafc;color:#0f172a;padding:24px;text-align:center\">" +
    "<div><p style=\"font-size:16px;font-weight:600;color:" + cor + "\">" +
    _escaparHtml(mensagem) + "</p>" +
    "<p style=\"font-size:13px;color:#64748b\">Esta aba fecha sozinha.</p></div>" +
    "<script>try{window.opener&&window.opener.postMessage({tipo:'" + tipo +
    "'},'*');}catch(e){}setTimeout(function(){try{window.close();}catch(e){}},1400);</script>" +
    "</body></html>";
  return HtmlService.createHtmlOutput(html)
    .setTitle("Dattaobra")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/* ------------------------- Tokens (OAuth2) ---------------------------- */

/** Troca o authorization code por { access_token, refresh_token, ... }. */
function _trocarCodigoPorTokens(code) {
  const clientId = _googleProp("GOOGLE_CLIENT_ID");
  const clientSecret = _googleProp("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    lancar(ERRO.INTERNO, "OAuth do Google não configurado (client id/secret).");
  }
  const resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: {
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: _googleRedirectUri(),
      grant_type: "authorization_code",
    },
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) {
    lancar(ERRO.INTERNO, "Falha ao trocar o código OAuth: " + resp.getContentText());
  }
  return JSON.parse(resp.getContentText() || "{}");
}

/** Usa o refresh token guardado para obter um access token novo. Retorna a string. */
function _refrescarAccessToken(usuarioId) {
  const refresh = _lerConfig(usuarioId, "google_refresh_token");
  if (!refresh) {
    lancar(ERRO.VALIDACAO, "Google não conectado. Conecte sua conta no perfil.");
  }
  const clientId = _googleProp("GOOGLE_CLIENT_ID");
  const clientSecret = _googleProp("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    lancar(ERRO.INTERNO, "OAuth do Google não configurado (client id/secret).");
  }
  const resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    },
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) {
    lancar(ERRO.INTERNO, "Não foi possível renovar o acesso ao Google. Reconecte sua conta.");
  }
  const json = JSON.parse(resp.getContentText() || "{}");
  if (!json.access_token) {
    lancar(ERRO.INTERNO, "Resposta inválida ao renovar o token do Google.");
  }
  return json.access_token;
}

/* --------------------- Agenda da obra (Calendar) ---------------------- */
/*
 * Eventos do Google Agenda do usuário vinculados a UMA obra, via
 * extendedProperties.private.dattaobra_obra = <obraId>. Usa o access token do
 * próprio usuário (escopo calendar.events). Ler = events.list filtrando por essa
 * propriedade; criar = events.insert com a propriedade; remover = events.delete.
 */

var _CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
var _CAL_TZ = "America/Sao_Paulo";

function _mapearEvento(ev) {
  const inicio = (ev.start && (ev.start.dateTime || ev.start.date)) || "";
  const fimRaw = (ev.end && (ev.end.dateTime || ev.end.date)) || "";
  const diaInteiro = !!(ev.start && ev.start.date);
  // No all-day o fim vem EXCLUSIVO; devolvemos o último dia INCLUSIVO p/ exibir/editar.
  const fim = diaInteiro && fimRaw ? _somarDias(fimRaw, -1) : fimRaw;
  const rec = (ev.recurrence && ev.recurrence[0]) || "";
  const freq = (/FREQ=([A-Z]+)/.exec(rec) || [])[1] || "";
  let lembreteMin = 0;
  if (ev.reminders && ev.reminders.overrides && ev.reminders.overrides.length) {
    lembreteMin = Number(ev.reminders.overrides[0].minutes) || 0;
  }
  return {
    id: ev.id,
    titulo: ev.summary || "(sem título)",
    diaInteiro: diaInteiro,
    inicio: inicio,
    fim: fim,
    local: ev.location || "",
    descricao: ev.description || "",
    cor: ev.colorId || "",
    recorrencia: freq,
    lembreteMin: lembreteMin,
    convidados: (ev.attendees || []).map(function (a) { return a.email; }),
    link: ev.htmlLink || "",
  };
}

/** "YYYY-MM-DDTHH:MM" (datetime-local) -> "YYYY-MM-DDTHH:MM:00". */
function _normalizarDataHora(s) {
  const t = String(s || "").trim();
  return t.length === 16 ? t + ":00" : t;
}

/** Soma 1h a um "YYYY-MM-DDTHH:MM:SS" local, devolvendo no mesmo formato. */
function _somarUmaHora(iso) {
  const d = new Date(iso);
  d.setHours(d.getHours() + 1);
  const p = function (n) { return (n < 10 ? "0" : "") + n; };
  return (
    d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" +
    p(d.getHours()) + ":" + p(d.getMinutes()) + ":00"
  );
}

/** Soma n dias a um "YYYY-MM-DD", devolvendo "YYYY-MM-DD". */
function _somarDias(ymd, n) {
  const d = new Date(String(ymd).slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + n);
  const p = function (x) { return (x < 10 ? "0" : "") + x; };
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

/**
 * Monta o corpo de um evento do Calendar a partir dos campos do formulário:
 * { obraId, obraNome, titulo, diaInteiro, inicio, fim, local, descricao, cor,
 *   recorrencia (DAILY|WEEKLY|MONTHLY|YEARLY), lembreteMin, convidados[] }.
 */
function _montarCorpoEvento(data) {
  const titulo = String((data && data.titulo) || "").trim();
  const inicio = String((data && data.inicio) || "").trim();
  if (!titulo) lancar(ERRO.VALIDACAO, "Informe o título do evento.");
  if (!inicio) lancar(ERRO.VALIDACAO, "Informe a data de início.");

  const obraId = data && data.obraId;
  const corpo = { summary: titulo };

  const local = String((data && data.local) || "").trim();
  if (local) corpo.location = local;

  const nome = String((data && data.obraNome) || "").trim();
  const desc = String((data && data.descricao) || "").trim();
  corpo.description =
    (desc ? desc + "\n\n" : "") + "Obra: " + (nome || obraId || "") + " · via Dattaobra";

  if (data && data.diaInteiro) {
    const ini = inicio.slice(0, 10);
    let fimInc = String((data && data.fim) || "").slice(0, 10) || ini;
    if (fimInc < ini) fimInc = ini;
    corpo.start = { date: ini };
    corpo.end = { date: _somarDias(fimInc, 1) }; // end.date é EXCLUSIVO
  } else {
    const inicioIso = _normalizarDataHora(inicio);
    const fimIso = data && data.fim ? _normalizarDataHora(String(data.fim)) : _somarUmaHora(inicioIso);
    corpo.start = { dateTime: inicioIso, timeZone: _CAL_TZ };
    corpo.end = { dateTime: fimIso, timeZone: _CAL_TZ };
  }

  const freq = String((data && data.recorrencia) || "").trim().toUpperCase();
  if (["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].indexOf(freq) >= 0) {
    corpo.recurrence = ["RRULE:FREQ=" + freq];
  }

  const cor = String((data && data.cor) || "").trim();
  if (cor) corpo.colorId = cor;

  const lembreteMin = Number(data && data.lembreteMin);
  corpo.reminders = lembreteMin > 0
    ? { useDefault: false, overrides: [{ method: "popup", minutes: lembreteMin }] }
    : { useDefault: true };

  const conv = (data && data.convidados) || [];
  const emails = (Array.isArray(conv) ? conv : String(conv).split(","))
    .map(function (e) { return String(e).trim(); })
    .filter(function (e) { return e.indexOf("@") > 0; });
  if (emails.length) corpo.attendees = emails.map(function (e) { return { email: e }; });

  if (obraId) corpo.extendedProperties = { private: { dattaobra_obra: String(obraId) } };

  return corpo;
}

/** google.agenda.listar — { obraId } -> { eventos:[...] } desta obra. */
function googleAgendaListar(data, sessao) {
  const obraId = data && data.obraId;
  if (!obraId) lancar(ERRO.VALIDACAO, "Obra não informada.");
  const acesso = _refrescarAccessToken(sessao.usuario_id);
  const desde = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const url =
    _CAL_BASE +
    "?singleEvents=true&orderBy=startTime&maxResults=250" +
    "&timeMin=" + encodeURIComponent(desde) +
    "&privateExtendedProperty=" + encodeURIComponent("dattaobra_obra=" + obraId);
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + acesso },
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) {
    lancar(ERRO.INTERNO, "Falha ao ler a agenda (" + resp.getResponseCode() + ").");
  }
  const json = JSON.parse(resp.getContentText() || "{}");
  return { eventos: (json.items || []).map(_mapearEvento) };
}

/**
 * google.agenda.criar — cria o evento vinculado à obra com todos os campos
 * (dia inteiro, recorrência, lembrete, convidados, local, cor). `sendUpdates=all`
 * envia convite por e-mail aos convidados (intenção do usuário ao adicioná-los).
 */
function googleAgendaCriar(data, sessao) {
  if (!(data && data.obraId)) lancar(ERRO.VALIDACAO, "Obra não informada.");
  const corpo = _montarCorpoEvento(data);
  const acesso = _refrescarAccessToken(sessao.usuario_id);
  const resp = UrlFetchApp.fetch(_CAL_BASE + "?sendUpdates=all", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + acesso },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() >= 300) {
    lancar(ERRO.INTERNO, "Falha ao criar o evento: " + resp.getContentText());
  }
  return { evento: _mapearEvento(JSON.parse(resp.getContentText() || "{}")) };
}

/**
 * google.agenda.atualizar — { eventoId, ...campos } -> { evento }. Substitui o
 * evento (events.update / PUT) com o corpo montado dos campos do formulário.
 * Em eventos recorrentes (lista com singleEvents=true), o id é da OCORRÊNCIA →
 * a edição afeta a ocorrência mostrada (comportamento v1).
 */
function googleAgendaAtualizar(data, sessao) {
  const eventoId = String((data && data.eventoId) || "").trim();
  if (!eventoId) lancar(ERRO.VALIDACAO, "Evento não informado.");
  const corpo = _montarCorpoEvento(data);
  const acesso = _refrescarAccessToken(sessao.usuario_id);
  const resp = UrlFetchApp.fetch(
    _CAL_BASE + "/" + encodeURIComponent(eventoId) + "?sendUpdates=all",
    {
      method: "put",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + acesso },
      payload: JSON.stringify(corpo),
      muteHttpExceptions: true,
    }
  );
  if (resp.getResponseCode() >= 300) {
    lancar(ERRO.INTERNO, "Falha ao atualizar o evento: " + resp.getContentText());
  }
  return { evento: _mapearEvento(JSON.parse(resp.getContentText() || "{}")) };
}

/** google.agenda.remover — { eventoId } -> { removido:true }. */
function googleAgendaRemover(data, sessao) {
  const eventoId = String((data && data.eventoId) || "").trim();
  if (!eventoId) lancar(ERRO.VALIDACAO, "Evento não informado.");
  const acesso = _refrescarAccessToken(sessao.usuario_id);
  const resp = UrlFetchApp.fetch(
    _CAL_BASE + "/" + encodeURIComponent(eventoId),
    {
      method: "delete",
      headers: { Authorization: "Bearer " + acesso },
      muteHttpExceptions: true,
    }
  );
  const code = resp.getResponseCode();
  // 410 = já removido (idempotente).
  if (code !== 200 && code !== 204 && code !== 410) {
    lancar(ERRO.INTERNO, "Falha ao remover o evento (" + code + ").");
  }
  return { removido: true };
}
