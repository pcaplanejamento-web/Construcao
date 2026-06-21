/**
 * Cache.gs — Wrapper fino sobre CacheService.
 *
 * Usado para (a) validação de sessão e (b) lista de categorias.
 * Limites do CacheService: ~100KB por chave, TTL máx 6h (21600s).
 * O cache é só otimização; a fonte de verdade é sempre o Sheets.
 */

const _CACHE_TTL_PADRAO = 21600; // 6h em segundos.

function _cache() {
  return CacheService.getScriptCache();
}

/** Lê e desserializa um valor do cache; retorna null se ausente/ inválido. */
function cacheGet(chave) {
  const bruto = _cache().get(chave);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto);
  } catch (e) {
    return null;
  }
}

/** Serializa e grava um valor no cache. */
function cachePut(chave, valor, ttlSegundos) {
  const ttl = Math.min(ttlSegundos || _CACHE_TTL_PADRAO, _CACHE_TTL_PADRAO);
  _cache().put(chave, JSON.stringify(valor), ttl);
}

/** Remove uma chave do cache. */
function cacheRemove(chave) {
  _cache().remove(chave);
}

/* Convenções de nomes de chave. */
function chaveSessao(token) {
  return "sessao:" + token;
}

/**
 * Versão global das categorias. Como as subclassificações padrão (GLOBAL) são
 * compartilhadas e editáveis, ao alterá-las precisamos invalidar o cache de
 * TODOS os usuários — fazemos isso embutindo esta versão na chave por usuário e
 * incrementando-a (bump) em cada mudança de GLOBAL. Persiste em ScriptProperties.
 */
function _versaoCategorias() {
  const emCache = _cache().get("categorias:versao");
  if (emCache) return emCache;
  const v = PropertiesService.getScriptProperties().getProperty("categorias_versao") || "0";
  _cache().put("categorias:versao", v, _CACHE_TTL_PADRAO);
  return v;
}

/** Incrementa a versão das categorias (invalida o cache de todos). */
function bumpVersaoCategorias() {
  const props = PropertiesService.getScriptProperties();
  const proxima = String((Number(props.getProperty("categorias_versao") || "0") || 0) + 1);
  props.setProperty("categorias_versao", proxima);
  _cache().put("categorias:versao", proxima, _CACHE_TTL_PADRAO);
  return proxima;
}

function chaveCategorias(usuarioId) {
  return "categorias:" + _versaoCategorias() + ":" + usuarioId;
}
