/**
 * glossario.js — Fonte ÚNICA das explicações dos termos de domínio do app.
 *
 * Usado pelo <ui-ajuda termo="..."> (botão "?") para mostrar um popover curto
 * ao lado dos rótulos. Manter os textos em linguagem simples (o dono do sistema
 * não é técnico) e curtos (cabem num balão). Uma entrada = um termo.
 *
 *   import { termoGlossario } from "../shared/glossario.js";
 *   const { titulo, texto } = termoGlossario("responsabilidade");
 */

export const GLOSSARIO = {
  "o-que-registrar": {
    titulo: "O que registrar",
    texto:
      "Como lançar o gasto: «Uma oferta» (um preço já cotado); «Uma despesa nova» " +
      "(você digita item, ofertante e valor na hora); «Orçamento completo» (lança de " +
      "uma vez todas as ofertas de um orçamento).",
  },
  oferta: {
    titulo: "Oferta",
    texto:
      "É um preço proposto por uma empresa (material) ou por um contato/grupo (serviço) para um item. " +
      "Registrar uma despesa cria — ou reusa — uma oferta com o valor combinado.",
  },
  cotacao: {
    titulo: "Cotação",
    texto:
      "É a coleta de vários preços (ofertas) para o MESMO item, para comparar antes de decidir. " +
      "Uma despesa pode nascer de uma cotação ou ser lançada direto (oferta avulsa).",
  },
  orcamento: {
    titulo: "Orçamento",
    texto:
      "É a previsão de quanto a obra deve custar (planejado). Serve de referência para comparar " +
      "com o que foi realmente gasto (as despesas).",
  },
  ofertante: {
    titulo: "Ofertante",
    texto:
      "É quem faz a oferta: para MATERIAL, uma empresa (loja/fornecedor); para SERVIÇO, um contato " +
      "ou um grupo (equipe). O sistema mostra a lista certa conforme o tipo do item.",
  },
  responsabilidade: {
    titulo: "Responsabilidade",
    texto:
      "É o rateio INTERNO da despesa: quanto (%) cabe a cada participante da obra. " +
      "É independente de quem pagou — quem pagou é registrado nos pagamentos.",
  },
  "transferencia-pagamento": {
    titulo: "Transferência × Pagamento",
    texto:
      "Pagamento é quando você quita uma despesa (paga o fornecedor/prestador). " +
      "Transferência é mover dinheiro entre participantes da obra. São coisas diferentes.",
  },
  subclassificacao: {
    titulo: "Subclassificação",
    texto:
      "É a categoria detalhada do item (ex.: Estrutura › Concreto). Ela VEM DO ITEM — " +
      "para mudar, edite o item. Aqui ela só é exibida.",
  },
};

/** Retorna { titulo, texto } do termo (ou null se não existir). Aceita chave com acento/caixa. */
export function termoGlossario(chave) {
  if (!chave) return null;
  const k = String(chave)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return GLOSSARIO[k] || null;
}
