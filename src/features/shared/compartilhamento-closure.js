/**
 * compartilhamento-closure.js — Fechamento TRANSITIVO das referências de uma obra
 * compartilhada (função PURA, testável). Ao compartilhar uma obra, o convidado
 * precisa não só do dado direto, mas de tudo que o NORTEIA:
 *   contato   → sua empresa (fornecedor_id), seu cargo, seu superior
 *   equipe    → seu líder + membros (contatos) → e os cargos/empresas deles
 *   fornecedor→ sua classificação (categoria_id)
 *   item      → sua subclassificação (categoria_id)
 *
 * `fecharCompartilhado(sementes, ctx)` recebe os ids-semente (referências diretas)
 * + funções de lookup e devolve os conjuntos FECHADOS (Sets), percorrendo as
 * arestas até estabilizar. Termina sempre: cada id é processado 1× (guardas
 * `proc*`) sobre conjuntos finitos; só re-itera quando um id NOVO é adicionado.
 *
 * Usado pelo `dataStore.compartilhadoDaObra` (mesma lógica espelha o backend
 * `_fecharRefsCompartilhadas` em Snapshot.gs).
 */

const _s = (v) => String(v == null ? "" : v);
const _nomeCargo = (v) => _s(v).trim().toLowerCase();

/**
 * @param {{c?:Iterable, f?:Iterable, i?:Iterable, e?:Iterable, cat?:Iterable, cargoNome?:Iterable}} sementes
 * @param {{contato:(id)=>any, fornecedor:(id)=>any, item:(id)=>any, equipe:(id)=>any}} ctx
 * @returns {{contatos:Set, fornecedores:Set, itens:Set, equipes:Set, categorias:Set, cargos:Set}}
 */
export function fecharCompartilhado(sementes, ctx) {
  sementes = sementes || {};
  ctx = ctx || {};
  const c = new Set([...(sementes.c || [])].map(_s).filter(Boolean));
  const f = new Set([...(sementes.f || [])].map(_s).filter(Boolean));
  const i = new Set([...(sementes.i || [])].map(_s).filter(Boolean));
  const e = new Set([...(sementes.e || [])].map(_s).filter(Boolean));
  const cat = new Set([...(sementes.cat || [])].map(_s).filter(Boolean));
  const cargos = new Set([...(sementes.cargoNome || [])].map(_nomeCargo).filter(Boolean));
  const procC = new Set(), procE = new Set(), procF = new Set(), procI = new Set();
  const get = (fn, id) => (typeof fn === "function" ? fn(id) : null);

  let seguir = true;
  let voltas = 0;
  while (seguir && voltas < 50) { // trava dura de segurança (nunca deve ser atingida)
    seguir = false;
    voltas++;
    for (const id of [...c]) {
      if (procC.has(id)) continue;
      procC.add(id);
      const x = get(ctx.contato, id);
      if (!x) continue;
      const forn = _s(x.fornecedor_id);
      if (forn && !f.has(forn)) { f.add(forn); seguir = true; }
      const sup = _s(x.superior_id);
      if (sup && !c.has(sup)) { c.add(sup); seguir = true; }
      if (x.cargo) cargos.add(_nomeCargo(x.cargo));
    }
    for (const id of [...e]) {
      if (procE.has(id)) continue;
      procE.add(id);
      const x = get(ctx.equipe, id);
      if (!x) continue;
      const lider = _s(x.lider_id);
      if (lider && !c.has(lider)) { c.add(lider); seguir = true; }
      (x.membros || []).forEach((m) => {
        const v = _s(m);
        if (v && !c.has(v)) { c.add(v); seguir = true; }
      });
    }
    for (const id of [...f]) {
      if (procF.has(id)) continue;
      procF.add(id);
      const x = get(ctx.fornecedor, id);
      if (x && x.categoria_id) cat.add(_s(x.categoria_id));
    }
    for (const id of [...i]) {
      if (procI.has(id)) continue;
      procI.add(id);
      const x = get(ctx.item, id);
      if (x && x.categoria_id) cat.add(_s(x.categoria_id));
    }
  }
  return { contatos: c, fornecedores: f, itens: i, equipes: e, categorias: cat, cargos };
}
