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
function chaveCategorias(usuarioId) {
  return "categorias:" + usuarioId;
}
