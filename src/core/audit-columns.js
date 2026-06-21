/**
 * audit-columns.js — Colunas de auditoria (log) reutilizáveis para as tabelas.
 *
 * Toda entidade tem `criado_em`/`autor_nome` e `atualizado_em`/`editor_nome`.
 * Este helper devolve as 2 colunas padrão de log (NÃO é componente). Reusado por
 * todas as listas (itens, fornecedores, contatos, cotações, detalhes…).
 *
 * Uso:  tabela.columns = [ ...colunas, ...colunasLog() ];
 */
import { data as fmtData } from "./formatters.js";

const _fraco = (txt) => `<span style="color:var(--cor-texto-fraco)">${txt}</span>`;

/** Devolve [colunaCriadoEm, colunaAtualizadoEm] no padrão do sistema. */
export function colunasLog() {
  return [
    {
      chave: "criado_em",
      titulo: "Criado em",
      formato: (v, linha) =>
        v
          ? `<div>${fmtData(v)}</div><small style="color:var(--cor-texto-fraco)">por ${linha.autor_nome || "—"}</small>`
          : _fraco("—"),
    },
    {
      chave: "atualizado_em",
      titulo: "Atualizado em",
      formato: (v, linha) => {
        const editou = linha.editor_nome && v && String(v) !== String(linha.criado_em);
        return editou
          ? `<div>${fmtData(v)}</div><small style="color:var(--cor-texto-fraco)">por ${linha.editor_nome}</small>`
          : _fraco("—");
      },
    },
  ];
}
