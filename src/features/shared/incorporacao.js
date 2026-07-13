/**
 * incorporacao.js — Regras PURAS da fronteira "acervo pessoal × dados da obra"
 * (sem store/DOM → testável com `node --test`). Duas funções:
 *
 *  - `jaIncorporado(tipo, x, cat)`: o usuário JÁ tem uma cópia PESSOAL equivalente
 *    do item de catálogo compartilhado? (desativa o botão "Incorporar" →
 *    "Incorporado"). Espelha o dedupe do backend (contatos/fornecedores/itens/
 *    categorias `.incorporar`): casa por NOME (case-insensitive) + discriminador
 *    do tipo (telefone/classificação/tipo).
 *  - `filtrarDadosDaObra(obraId, pools)`: os itens que pertencem à OBRA
 *    (ofertas/cotações/orçamentos com `obra_id` = obraId, de QUALQUER criador;
 *    ofertas também via `preco_id` das despesas da obra).
 */

const _nrm = (s) => String(s == null ? "" : s).trim().toLowerCase();
const _nomeIgual = (a, b) => _nrm(a) !== "" && _nrm(a) === _nrm(b);

/**
 * @param {string} tipo  contato|fornecedor|item|equipe|cargo|categoria-item|categoria-fornecedor
 * @param {object} x  item compartilhado (candidato a incorporar)
 * @param {object} cat  { meuId, contatos, fornecedores, itens, equipes, cargos, categorias }
 *   (listas ATIVAS; a função filtra as do próprio usuário por `meuId`; `cargos`
 *   inclui os fixos; `categorias` inclui as GLOBAL). Um item com `origem_id`
 *   apontando um id já no meu acervo também conta como incorporado (dedup exato).
 * @returns {boolean}
 */
export function jaIncorporado(tipo, x, cat) {
  if (!x || !cat) return false;
  const meu = String(cat.meuId || "");
  const meus = (arr) => (arr || []).filter((y) => y && String(y.usuario_id || "") === meu);
  const minhasCats = () =>
    (cat.categorias || []).filter(
      (c) => String(c.usuario_id || "") === meu || String(c.usuario_id || "") === "GLOBAL"
    );
  switch (tipo) {
    case "contato":
      return meus(cat.contatos).some((c) => _nomeIgual(c.nome, x.nome) && _nrm(c.telefone) === _nrm(x.telefone));
    case "fornecedor":
      return meus(cat.fornecedores).some((f) => _nomeIgual(f.nome, x.nome));
    case "item":
      return meus(cat.itens).some((i) => _nomeIgual(i.nome, x.nome) && _nrm(i.classificacao) === _nrm(x.classificacao));
    case "equipe":
      return meus(cat.equipes).some((e) => _nomeIgual(e.nome, x.nome));
    case "cargo":
      return (cat.cargos || [])
        .filter((cg) => cg.fixo || String(cg.usuario_id || "") === meu)
        .some((cg) => _nomeIgual(cg.nome, x.nome));
    case "categoria-item":
      return minhasCats().some((c) => _nomeIgual(c.nome, x.nome) && _nrm(c.tipo) !== "fornecedor");
    case "categoria-fornecedor":
      return minhasCats().some((c) => _nomeIgual(c.nome, x.nome) && _nrm(c.tipo) === "fornecedor");
    default:
      return false; // oferta/cotação/orçamento (escopo=obra) não bloqueiam
  }
}

/**
 * @param {string} obraId
 * @param {object} pools  { ofertas, cotacoes, orcamentos, despesasDaObra }
 * @returns {{ofertas:Array, cotacoes:Array, orcamentos:Array}}
 */
export function filtrarDadosDaObra(obraId, pools) {
  pools = pools || {};
  const oid = String(obraId);
  const precoIds = new Set(
    (pools.despesasDaObra || []).map((d) => String(d.preco_id || "")).filter(Boolean)
  );
  return {
    ofertas: (pools.ofertas || []).filter((o) => String(o.obra_id || "") === oid || precoIds.has(String(o.id))),
    cotacoes: (pools.cotacoes || []).filter((c) => String(c.obra_id || "") === oid),
    orcamentos: (pools.orcamentos || []).filter((o) => String(o.obra_id || "") === oid),
  };
}
