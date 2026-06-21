/**
 * despesa-split.js — Helpers puros da divisão de pagamento/responsabilidade de
 * uma despesa. (Fase 2 acrescenta aqui o algoritmo de acerto entre participantes.)
 *
 * pagamentos: [{ chave, valor }]   responsaveis: [{ chave, pct }]
 * (o backend já devolve arrays; parseLista é tolerante a string/vazio.)
 */

export function parseLista(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

/** Soma do que foi pago (todos os pagamentos da despesa). */
export function totalPago(despesa) {
  return parseLista(despesa && despesa.pagamentos).reduce(
    (s, p) => s + (Number(p.valor) || 0),
    0
  );
}

/* --- Pagamentos parciais (lançamentos/levas pagos ao ofertante) --- */

/** Soma dos pagamentos lançados (realizados) da despesa. */
export function totalRealizado(despesa) {
  return parseLista(despesa && despesa.pagamentos_realizados).reduce(
    (s, p) => s + (Number(p.valor) || 0),
    0
  );
}

/** Valor ainda não pago da despesa (≥ 0). */
export function restoDespesa(despesa) {
  return Math.max(0, (Number((despesa || {}).valor) || 0) - totalRealizado(despesa));
}

/** Status de pagamento derivado: "A pagar" | "Em pagamento" | "Pago". */
export function statusPagamento(despesa) {
  const valor = Number((despesa || {}).valor) || 0;
  const pago = totalRealizado(despesa);
  if (pago <= 0.01) return "A pagar";
  if (pago - valor >= -0.01) return "Pago";
  return "Em pagamento";
}

/**
 * Balanços financeiros (modelo paga ↔ recebe) de um conjunto de despesas. Tudo
 * derivado: por despesa `realizado = Σ levas.valor`, `resto = valor − realizado`.
 *  - **pago**[chave]        = Σ levas onde `pagador = chave` (quem pagou)
 *  - **recebido**[chave]    = ofertante contato/grupo (`c:`/`e:`) → Σ realizado;
 *                             integrante → Σ `distribuicao`
 *  - **saldoApagar**[chave] = max(0, devido − pago); devido = Σ valor×(pct/100)
 *  - **saldoReceber**[chave]= ofertante (`c:`/`e:`) → Σ resto (grupo no nível `e:`)
 *  - **porFornecedor**[fid] = { total, recebido(=Σrealizado), saldoReceber(=Σresto) }
 * Retorna { porChave:{chave:{pago,recebido,saldoApagar,saldoReceber}}, porFornecedor }.
 */
export function balancos(despesas) {
  const pago = {};
  const devido = {};
  const recebido = {};
  const saldoReceber = {};
  const porFornecedor = {};
  (despesas || []).forEach((d) => {
    const valor = Number(d.valor) || 0;
    const realizado = totalRealizado(d);
    const resto = Math.max(0, valor - realizado);

    // Devido (responsabilidade) — base interna do saldo a pagar.
    parseLista(d.responsaveis).forEach((r) => {
      if (r && r.chave) devido[r.chave] = (devido[r.chave] || 0) + (valor * (Number(r.pct) || 0)) / 100;
    });

    // Levas: pago (por quem pagou) + recebido por integrante (distribuição).
    parseLista(d.pagamentos_realizados).forEach((lv) => {
      if (lv && lv.pagador) pago[lv.pagador] = (pago[lv.pagador] || 0) + (Number(lv.valor) || 0);
      parseLista(lv.distribuicao).forEach((x) => {
        if (x && x.chave) recebido[x.chave] = (recebido[x.chave] || 0) + (Number(x.valor) || 0);
      });
    });

    // Recebido + saldo a receber do ofertante (contato/grupo) e do fornecedor.
    if (d.ofertante_equipe_id) {
      const ch = "e:" + d.ofertante_equipe_id;
      recebido[ch] = (recebido[ch] || 0) + realizado;
      if (resto > 0.01) saldoReceber[ch] = (saldoReceber[ch] || 0) + resto;
    } else if (d.ofertante_contato_id) {
      const ch = "c:" + d.ofertante_contato_id;
      recebido[ch] = (recebido[ch] || 0) + realizado;
      if (resto > 0.01) saldoReceber[ch] = (saldoReceber[ch] || 0) + resto;
    }
    if (d.fornecedor_id) {
      const f = (porFornecedor[d.fornecedor_id] = porFornecedor[d.fornecedor_id] || { total: 0, recebido: 0, saldoReceber: 0 });
      f.total += valor;
      f.recebido += realizado;
      f.saldoReceber += resto;
    }
  });

  const porChave = {};
  const g = (k) => (porChave[k] = porChave[k] || { pago: 0, recebido: 0, saldoApagar: 0, saldoReceber: 0 });
  Object.keys(pago).forEach((k) => (g(k).pago = pago[k]));
  Object.keys(recebido).forEach((k) => (g(k).recebido = recebido[k]));
  Object.keys(saldoReceber).forEach((k) => (g(k).saldoReceber = saldoReceber[k]));
  Object.keys(devido).forEach((k) => (g(k).saldoApagar = Math.max(0, (devido[k] || 0) - (pago[k] || 0))));
  return { porChave, porFornecedor };
}

/** "nenhum" | "unico" | "distribuido" conforme o nº de pagantes com valor > 0. */
export function distribuicao(despesa) {
  const n = parseLista(despesa && despesa.pagamentos).filter((p) => Number(p.valor) > 0).length;
  return n === 0 ? "nenhum" : n === 1 ? "unico" : "distribuido";
}

/** Rótulo amigável da origem de um participante. */
export function rotuloOrigem(origem) {
  return origem === "dono" ? "Dono" : origem === "compartilhado" ? "Compartilhado" : "Contato";
}

/**
 * Acerto de contas de uma obra a partir das despesas + participantes.
 * Por participante: pago = Σ pagamentos; devido = Σ valor×(pct/100); saldo = pago − devido.
 * Saldo > 0 ⇒ tem a receber; < 0 ⇒ deve. `acertos` resolve "quem deve a quem"
 * (algoritmo guloso: maiores devedores quitam com maiores credores).
 *
 * Retorna { saldos: [{chave,nome,pago,devido,saldo}], acertos: [{de,de_nome,para,para_nome,valor}] }.
 */
export function acerto(despesas, participantes) {
  const nomes = {};
  (participantes || []).forEach((p) => (nomes[p.chave] = p.nome));

  const pago = {};
  const devido = {};
  (despesas || []).forEach((d) => {
    const v = Number(d.valor) || 0;
    parseLista(d.pagamentos).forEach((p) => {
      if (p && p.chave) pago[p.chave] = (pago[p.chave] || 0) + (Number(p.valor) || 0);
    });
    parseLista(d.responsaveis).forEach((r) => {
      if (r && r.chave) devido[r.chave] = (devido[r.chave] || 0) + (v * (Number(r.pct) || 0)) / 100;
    });
  });

  const chaves = {};
  (participantes || []).forEach((p) => (chaves[p.chave] = true));
  Object.keys(pago).forEach((k) => (chaves[k] = true));
  Object.keys(devido).forEach((k) => (chaves[k] = true));

  const saldos = Object.keys(chaves).map((ch) => {
    const pg = pago[ch] || 0;
    const dv = devido[ch] || 0;
    return { chave: ch, nome: nomes[ch] || "—", pago: pg, devido: dv, saldo: pg - dv };
  });
  saldos.sort((a, b) => b.saldo - a.saldo);

  // Acerto guloso entre credores (saldo>0) e devedores (saldo<0).
  const credores = saldos
    .filter((s) => s.saldo > 0.01)
    .map((s) => ({ chave: s.chave, nome: s.nome, v: s.saldo }))
    .sort((a, b) => b.v - a.v);
  const devedores = saldos
    .filter((s) => s.saldo < -0.01)
    .map((s) => ({ chave: s.chave, nome: s.nome, v: -s.saldo }))
    .sort((a, b) => b.v - a.v);

  const acertos = [];
  let i = 0;
  let j = 0;
  while (i < devedores.length && j < credores.length) {
    const t = Math.min(devedores[i].v, credores[j].v);
    if (t > 0.01) {
      acertos.push({
        de: devedores[i].chave,
        de_nome: devedores[i].nome,
        para: credores[j].chave,
        para_nome: credores[j].nome,
        valor: t,
      });
    }
    devedores[i].v -= t;
    credores[j].v -= t;
    if (devedores[i].v <= 0.01) i++;
    if (credores[j].v <= 0.01) j++;
  }

  return { saldos, acertos };
}
