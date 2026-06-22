/**
 * Migracoes.gs — Reparos de dados que rodam UMA vez (guardados por flag em
 * ScriptProperties), disparados no próximo `dados.snapshot`. Idempotentes.
 */

/**
 * Reverte OFERTAS ÓRFÃS: `despesa_id` aponta para uma despesa que não existe mais
 * (despesas excluídas antes da regra de reversão). Limpa `despesa_id`/`escolhido`
 * e reabre a cotação vinculada — deixando a oferta disponível para novo registro.
 * Retorna o nº de ofertas reparadas.
 */
function _repararOfertasOrfas() {
  const idsDespesa = {};
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    idsDespesa[String(d.id)] = true;
  });
  let reparadas = 0;
  repoListar(SCHEMA.COTACAO_PRECOS).forEach(function (p) {
    const did = String(p.despesa_id || "");
    if (did && !idsDespesa[did]) {
      repoAtualizar(SCHEMA.COTACAO_PRECOS, "id", p.id, { despesa_id: "", escolhido: false });
      reparadas++;
      if (String(p.cotacao_id || "")) {
        const c = repoEncontrar(SCHEMA.COTACOES, function (x) {
          return String(x.id) === String(p.cotacao_id);
        });
        if (c) {
          repoAtualizar(SCHEMA.COTACOES, "id", p.cotacao_id, {
            status: "aberta",
            atualizado_em: agoraIso(),
          });
        }
      }
    }
  });
  return reparadas;
}

/** Roda as migrações pendentes UMA vez (double-checked via flag + lock). */
function _migrarUmaVez() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("mig_ofertas_orfas_v1") === "1") return;
  comLock(function () {
    if (props.getProperty("mig_ofertas_orfas_v1") === "1") return;
    _repararOfertasOrfas();
    props.setProperty("mig_ofertas_orfas_v1", "1");
  });
}
