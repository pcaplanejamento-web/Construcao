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

/* ----------------- Configuração do app (somente admin) ---------------- */

/**
 * admin.google.obter -> { clientId, secretConfigurado, redirectUri }. O admin vê
 * o Client ID atual (público), se o Secret já foi salvo (boolean, nunca o valor)
 * e a URL de redirect a autorizar no Google Cloud.
 */
function adminGoogleObter(data, sessao) {
  exigirAdmin(sessao);
  const props = PropertiesService.getScriptProperties();
  let redirect = "";
  try {
    redirect = _googleRedirectUri();
  } catch (e) {
    redirect = "";
  }
  return {
    clientId: props.getProperty("GOOGLE_CLIENT_ID") || "",
    secretConfigurado: !!props.getProperty("GOOGLE_CLIENT_SECRET"),
    redirectUri: redirect,
  };
}

/**
 * admin.google.definir -> { clientId, secretConfigurado }. Salva o Client ID e
 * (opcionalmente) o Secret nas Script Properties. O Secret em branco mantém o
 * atual; nunca é devolvido ao cliente.
 */
function adminGoogleDefinir(data, sessao) {
  exigirAdmin(sessao);
  const clientId = String((data && data.clientId) || "").trim();
  const clientSecret = String((data && data.clientSecret) || "").trim();
  if (!clientId) lancar(ERRO.VALIDACAO, "Informe o Client ID.");
  if (clientId.indexOf(".apps.googleusercontent.com") < 0) {
    lancar(
      ERRO.VALIDACAO,
      "Client ID inválido (deve terminar em .apps.googleusercontent.com)."
    );
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty("GOOGLE_CLIENT_ID", clientId);
  if (clientSecret) props.setProperty("GOOGLE_CLIENT_SECRET", clientSecret);
  return {
    clientId: clientId,
    secretConfigurado: !!props.getProperty("GOOGLE_CLIENT_SECRET"),
  };
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
