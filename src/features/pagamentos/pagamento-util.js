/**
 * pagamento-util.js — Card de prévia + banner de detalhe de um PAGAMENTO.
 *
 * Espelha o padrão da OFERTA (previaOfertaHtml + abrirOferta), mas para Pagamentos:
 * o card é levemente ESVERDEADO e o banner mostra os dados completos + os REPASSES
 * como itens (igual ao card do item dentro do banner da oferta). Reusa ui-modal,
 * ui-alert, ui-button (sem componentes visuais novos).
 */
import { dataStore } from "../../core/data-store.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { notificarErro } from "../../core/event-bus.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";

/* --------------------------- Resolução de nomes --------------------------- */

export function nomeContato(id) {
  if (!id) return "—";
  return (dataStore.contatos().find((c) => String(c.id) === String(id)) || {}).nome || "—";
}
export function nomeEquipe(id) {
  return (dataStore.equipe(id) || {}).nome || "—";
}
function nomeFornecedor(id) {
  if (!id) return "";
  return (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "";
}
/** Nome de uma chave de participante ("c:"/"e:"/"u:"). */
export function nomeChavePart(chave) {
  const s = String(chave || "");
  if (s.indexOf("c:") === 0) return nomeContato(s.slice(2));
  if (s.indexOf("e:") === 0) return nomeEquipe(s.slice(2));
  if (s.indexOf("u:") === 0) {
    const u = dataStore.usuario();
    return u && String(u.id) === s.slice(2) ? u.nome : "Usuário";
  }
  return s || "—";
}
export function nomeRecebedor(p) {
  if (p.recebedor_equipe_id) return nomeEquipe(p.recebedor_equipe_id) + " (grupo)";
  return nomeContato(p.recebedor_contato_id);
}
/** Nome de uma despesa (ao vivo). */
function nomeDespesa(d) {
  if (!d) return "Despesa";
  return (d.item_id && (dataStore.item(d.item_id) || {}).nome) || d.item || "Despesa";
}

/* ------------------------------- Card prévia ------------------------------ */

/**
 * Conteúdo interno do card de prévia (o chamador envolve num
 * `<div class="resumo pag clicavel">`). Estilo esverdeado fica no `.pag` do chamador.
 */
export function previaPagamentoHtml(p) {
  const o = p || {};
  const aloc = Array.isArray(o.alocacoes) ? o.alocacoes : [];
  const empresa = nomeFornecedor(o.fornecedor_id);
  return `
    <span class="item">Pagamento · ${nomeRecebedor(o)}</span>
    <span class="val">${moeda(Number(o.valor) || 0)}</span>
    <small>${fmtData(o.data)} · Pagou: ${nomeChavePart(o.pagador_chave)}</small>
    <small>${aloc.length} despesa(s)${empresa ? " · Empresa: " + empresa : ""}</small>`;
}

/* --------------------------------- Banner --------------------------------- */

/** Abre o banner de DETALHE do pagamento (dados completos + repasses). */
export function abrirPagamento(pagamento) {
  if (!pagamento) return;
  const p = pagamento;
  const aloc = Array.isArray(p.alocacoes) ? p.alocacoes : [];
  const despesasMap = {};
  dataStore.todasDespesas().forEach((d) => (despesasMap[d.id] = d));
  const empresa = nomeFornecedor(p.fornecedor_id);
  const obra = dataStore.obra(p.obra_id);
  const repasses = dataStore.repassesDoPagamento(p.id);

  const modal = document.createElement("ui-modal");
  modal.setAttribute("open", "");
  modal.setAttribute("title", "Pagamento");

  const linhasDesp = aloc
    .map(
      (a) =>
        `<div class="pg-row"><span>${nomeDespesa(despesasMap[a.despesa_id])}</span><strong>${moeda(Number(a.valor) || 0)}</strong></div>`
    )
    .join("");

  const corpo = document.createElement("div");
  corpo.innerHTML = `
    <style>
      .pg-campos { display:flex; flex-direction:column; gap: var(--esp-4); }
      .pg-val { font-size: var(--fs-2xl); font-weight: var(--peso-forte); color: var(--cor-sucesso); }
      .pg-meta { display:flex; flex-direction:column; gap:2px; color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .pg-sec label { font-size: var(--fs-sm); font-weight: var(--peso-medio); color: var(--cor-texto-suave); display:block; margin-bottom: var(--esp-2); }
      .pg-row { display:flex; justify-content:space-between; padding: var(--esp-2) 0; border-bottom: 1px solid var(--cor-divisor); }
      .pg-card { position: relative; background: var(--cor-sucesso-suave, rgba(22,163,74,.10)); border: 1px solid var(--cor-sucesso);
        border-radius: var(--raio-sm); padding: var(--esp-3); display:flex; flex-direction:column; gap:2px; margin-bottom: var(--esp-2); }
      .pg-card .item { font-weight: var(--peso-semi); }
      .pg-card small { color: var(--cor-texto-suave); }
      .pg-card .rem { position:absolute; top: var(--esp-2); right: var(--esp-2); border: 1px solid var(--cor-erro-suave);
        background: var(--cor-superficie); color: var(--cor-erro); border-radius: var(--raio-sm); width: 30px; height: 30px; cursor: pointer; }
      .pg-card .rem:hover { background: var(--cor-superficie-2); }
      .muted { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    </style>
    <div class="pg-campos">
      <div>
        <div class="pg-val">${moeda(Number(p.valor) || 0)}</div>
        <div class="pg-meta">
          <span>${fmtData(p.data)}</span>
          <span>Pagou: <strong>${nomeChavePart(p.pagador_chave)}</strong> · Recebedor: <strong>${nomeRecebedor(p)}</strong></span>
          ${empresa ? `<span>Empresa: ${empresa}</span>` : ""}
          ${obra ? `<span>Obra: ${obra.nome}</span>` : ""}
          ${p.observacao ? `<span>Obs.: ${p.observacao}</span>` : ""}
        </div>
      </div>
      <div class="pg-sec">
        <label>Despesas cobertas (${aloc.length})</label>
        ${linhasDesp || `<p class="muted">—</p>`}
      </div>
      <div class="pg-sec">
        <label id="repLabel">Repasses (${repasses.length})</label>
        <div id="pgReps"></div>
      </div>
    </div>`;
  modal.appendChild(corpo);

  // Repasses: cards com ✕ (excluir → desvincula, volta ao estado original). Re-renderiza.
  function pintarReps() {
    const cont = corpo.querySelector("#pgReps");
    const lista = dataStore.repassesDoPagamento(p.id);
    const lbl = corpo.querySelector("#repLabel");
    if (lbl) lbl.textContent = `Repasses (${lista.length})`;
    if (!cont) return;
    cont.innerHTML = "";
    if (!lista.length) {
      cont.innerHTML = `<p class="muted">Sem repasses.</p>`;
      return;
    }
    lista.forEach((r) => {
      const card = document.createElement("div");
      card.className = "pg-card";
      card.innerHTML = `
        <span class="item">Repasse · ${moeda(Number(r.valor) || 0)}</span>
        <small>${fmtData(r.data)} · de ${nomeContato(r.recebedor_contato_id)}</small>
        <small>Para: ${(r.contatos_repassados || []).map((c) => nomeContato(c)).join(", ") || "—"}</small>`;
      const x = document.createElement("button");
      x.type = "button";
      x.className = "rem";
      x.textContent = "✕";
      x.title = "Excluir repasse";
      x.addEventListener("click", async () => {
        if (!confirm("Excluir este repasse? O vínculo é desfeito (volta ao estado original).")) return;
        try {
          await dataStore.removerRepasse(r.id);
          pintarReps();
        } catch (e) {
          notificarErro(e);
        }
      });
      card.appendChild(x);
      cont.appendChild(card);
    });
  }
  pintarReps();

  const rod = document.createElement("div");
  rod.setAttribute("slot", "rodape");
  const btn = document.createElement("ui-button");
  btn.textContent = "Fechar";
  btn.addEventListener("click", () => modal.remove());
  rod.appendChild(btn);
  modal.appendChild(rod);

  modal.addEventListener("fechar", () => modal.remove());
  document.body.appendChild(modal);
}
