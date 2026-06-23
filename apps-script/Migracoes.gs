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

/**
 * Extrai os pagamentos EMBUTIDOS (despesa.pagamentos_realizados) p/ a aba PAGAMENTOS,
 * como entidades próprias (1 leva → 1 pagamento, 1 alocação). Idempotente via
 * `origem_leva_id`. NÃO apaga os embutidos (continuam como espelho). Retorna nº criados.
 */
function _migrarPagamentosEmbutidos_v1() {
  const jaTem = {};
  repoListar(SCHEMA.PAGAMENTOS).forEach(function (p) {
    const lid = String(p.origem_leva_id || "");
    if (lid) jaTem[lid] = true;
  });
  let criados = 0;
  repoListar(SCHEMA.DESPESAS).forEach(function (d) {
    const levas = _parseJsonLista(d.pagamentos_realizados);
    levas.forEach(function (lv) {
      const lid = String((lv && lv.id) || "");
      if (!lid || jaTem[lid]) return;
      const valor = Number(lv.valor) || 0;
      repoInserir(SCHEMA.PAGAMENTOS, {
        id: novoId(),
        usuario_id: d.usuario_id,
        obra_id: d.obra_id,
        data: lv.data || "",
        valor: valor,
        pagador_chave: String(lv.pagador || ""),
        pagador_contato_id: _contatoDeChave(lv.pagador),
        recebedor_contato_id: String(lv.contato_id || ""),
        recebedor_equipe_id: String(d.ofertante_equipe_id || ""),
        fornecedor_id: String(lv.fornecedor_id || ""),
        alocacoes: JSON.stringify([{ despesa_id: d.id, valor: valor }]),
        distribuicao: JSON.stringify(_parseJsonLista(lv.distribuicao)),
        observacao: "",
        criado_em: lv.criado_em || agoraIso(),
        autor_nome: lv.autor_nome || "",
        atualizado_em: lv.criado_em || agoraIso(),
        editor_nome: "",
        origem_leva_id: lid,
      });
      jaTem[lid] = true;
      criados++;
    });
  });
  return criados;
}

/** Roda as migrações pendentes UMA vez (double-checked via flag + lock). */
function _migrarUmaVez() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("mig_ofertas_orfas_v1") !== "1") {
    comLock(function () {
      if (props.getProperty("mig_ofertas_orfas_v1") === "1") return;
      _repararOfertasOrfas();
      props.setProperty("mig_ofertas_orfas_v1", "1");
    });
  }
  if (props.getProperty("mig_pagamentos_v1") !== "1") {
    comLock(function () {
      if (props.getProperty("mig_pagamentos_v1") === "1") return;
      _migrarPagamentosEmbutidos_v1();
      props.setProperty("mig_pagamentos_v1", "1");
    });
  }
}
