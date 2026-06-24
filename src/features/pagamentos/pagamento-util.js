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
import { notificarErro, toastSucesso } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";

/** Formas de transferência/pagamento (espelha TIPOS_TRANSFERENCIA do backend). */
export const TIPOS_TRANSFERENCIA = ["dinheiro", "crédito", "débito", "boleto"];
/** Nome amigável do tipo (capitalizado). */
export function nomeTipo(t) {
  const s = String(t || "dinheiro");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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
  const t = dataStore.transferenciaDoPagamento(o.id);
  const linhaTransf = t
    ? `<small>Transferência: ${nomeTipo(t.tipo)} · total ${moeda(Number(t.valor_total) || 0)}</small>`
    : "";
  // Distribuição entre integrantes (quando o recebedor é equipe): mostra quem recebeu quanto.
  const dist = (Array.isArray(o.distribuicao) ? o.distribuicao : []).filter((x) => Number(x.valor) > 0);
  const linhaDist = dist.length
    ? `<small>Distribuído: ${dist.map((x) => `${nomeChavePart(x.chave)} (${moeda(Number(x.valor) || 0)})`).join(" · ")}</small>`
    : "";
  return `
    <span class="item">Pagamento · ${nomeRecebedor(o)}</span>
    <span class="val">${moeda(Number(o.valor) || 0)}</span>
    <small>${fmtData(o.data)} · Pagou: ${nomeChavePart(o.pagador_chave)}</small>
    <small>${aloc.length} despesa(s)${empresa ? " · Empresa: " + empresa : ""}</small>
    ${linhaTransf}
    ${linhaDist}`;
}

/* --------------------------- Card prévia: transferência -------------------- */

/**
 * Conteúdo interno do card de prévia de uma TRANSFERÊNCIA (o chamador envolve num
 * `<div class="resumo transf clicavel">`). Estilo CINZA ESCURO fica no `.transf` do chamador.
 */
export function previaTransferenciaHtml(t) {
  const o = t || {};
  const ids = Array.isArray(o.pagamento_ids) ? o.pagamento_ids : [];
  const empresa = nomeFornecedor(o.fornecedor_id);
  return `
    <span class="item">Transferência · ${nomeTipo(o.tipo)}</span>
    <span class="val">${moeda(Number(o.valor_total) || 0)}</span>
    <small>${fmtData(o.data)} · Pagou: ${nomeChavePart(o.pagador_chave)} · Recebe: ${nomeRecebedor(o)}</small>
    <small>${ids.length} pagamento(s)${empresa ? " · Empresa: " + empresa : ""}</small>`;
}

/* --------------------------------- Banner --------------------------------- */

/** Abre o banner de DETALHE do pagamento (dados completos + repasses). */
export function abrirPagamento(pagamento) {
  if (!pagamento) return;
  const p = pagamento;
  const aloc = Array.isArray(p.alocacoes) ? p.alocacoes : [];
  const dist = (Array.isArray(p.distribuicao) ? p.distribuicao : []).filter((x) => Number(x.valor) > 0);
  const despesasMap = {};
  dataStore.todasDespesas().forEach((d) => (despesasMap[d.id] = d));
  const empresa = nomeFornecedor(p.fornecedor_id);
  const obra = dataStore.obra(p.obra_id);
  const transf = dataStore.transferenciaDoPagamento(p.id);

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
      .tf-bloco { background: color-mix(in srgb, var(--cor-neutro) 30%, var(--cor-superficie));
        border: 1px solid var(--cor-neutro); border-radius: var(--raio-sm); padding: var(--esp-3);
        display:flex; flex-direction:column; gap:2px; cursor: pointer; }
      .tf-bloco:hover { background: color-mix(in srgb, var(--cor-neutro) 40%, var(--cor-superficie)); }
      .tf-bloco .tf-top { display:flex; justify-content:space-between; align-items:center; }
      .tf-bloco .tf-tipo { font-weight: var(--peso-semi); color: var(--cor-texto); }
      .tf-bloco .tf-val { font-weight: var(--peso-forte); color: var(--cor-texto); }
      .tf-bloco small { color: var(--cor-texto-suave); }
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
      ${
        transf
          ? `<div class="pg-sec">
        <label>Transferência</label>
        <div class="tf-bloco" id="tfBloco" title="Ver transferência">
          <div class="tf-top"><span class="tf-tipo">${nomeTipo(transf.tipo)}</span><span class="tf-val">${moeda(Number(transf.valor_total) || 0)}</span></div>
          <small>${fmtData(transf.data)} · Pagou: ${nomeChavePart(transf.pagador_chave)} · Recebe: ${nomeRecebedor(transf)}</small>
          <small>${(transf.pagamento_ids || []).length} pagamento(s) nesta transferência</small>
        </div>
      </div>`
          : ""
      }
      <div class="pg-sec">
        <label>Despesas cobertas (${aloc.length})</label>
        ${linhasDesp || `<p class="muted">—</p>`}
      </div>
      ${
        dist.length
          ? `<div class="pg-sec">
        <label>Distribuição entre integrantes (${dist.length})</label>
        ${dist
          .map((x) => `<div class="pg-row"><span>${nomeChavePart(x.chave)}</span><strong>${moeda(Number(x.valor) || 0)}</strong></div>`)
          .join("")}
      </div>`
          : ""
      }
    </div>`;
  modal.appendChild(corpo);

  const rod = document.createElement("div");
  rod.setAttribute("slot", "rodape");
  const btn = document.createElement("ui-button");
  btn.textContent = "Fechar";
  btn.addEventListener("click", () => modal.remove());
  rod.appendChild(btn);
  modal.appendChild(rod);

  modal.addEventListener("fechar", () => modal.remove());
  document.body.appendChild(modal);

  // Clique no bloco da transferência → abre o detalhe completo da transferência.
  const tfBloco = corpo.querySelector("#tfBloco");
  if (tfBloco && transf) {
    tfBloco.addEventListener("click", () => {
      modal.remove();
      abrirTransferencia(transf);
    });
  }
}

/** Abre o banner de DETALHE da TRANSFERÊNCIA (dados completos + pagamentos agrupados). */
export function abrirTransferencia(transferencia) {
  if (!transferencia) return;
  const t = transferencia;
  const empresa = nomeFornecedor(t.fornecedor_id);
  const obra = dataStore.obra(t.obra_id);
  const pagamentos = dataStore.pagamentosDaTransferencia(t.id);

  const modal = document.createElement("ui-modal");
  modal.setAttribute("open", "");
  modal.setAttribute("title", "Transferência");

  const corpo = document.createElement("div");
  corpo.innerHTML = `
    <style>
      .tf-campos { display:flex; flex-direction:column; gap: var(--esp-4); }
      .tf-val { font-size: var(--fs-2xl); font-weight: var(--peso-forte); color: var(--cor-texto); }
      .tf-meta { display:flex; flex-direction:column; gap:2px; color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .tf-sec label { font-size: var(--fs-sm); font-weight: var(--peso-medio); color: var(--cor-texto-suave); display:block; margin-bottom: var(--esp-2); }
      .tf-pag { background: var(--cor-sucesso-suave, rgba(22,163,74,.10)); border: 1px solid var(--cor-sucesso);
        border-radius: var(--raio-sm); padding: var(--esp-3); display:flex; flex-direction:column; gap:2px; margin-bottom: var(--esp-2); cursor: pointer; }
      .tf-pag .top { display:flex; justify-content:space-between; }
      .tf-pag .item { font-weight: var(--peso-semi); }
      .tf-pag small { color: var(--cor-texto-suave); }
      .muted { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    </style>
    <div class="tf-campos">
      <div>
        <div class="tf-val">${moeda(Number(t.valor_total) || 0)} · ${nomeTipo(t.tipo)}</div>
        <div class="tf-meta">
          <span>${fmtData(t.data)}</span>
          <span>Pagou: <strong>${nomeChavePart(t.pagador_chave)}</strong> · Recebedor: <strong>${nomeRecebedor(t)}</strong></span>
          ${empresa ? `<span>Empresa: ${empresa}</span>` : ""}
          ${obra ? `<span>Obra: ${obra.nome}</span>` : ""}
          ${t.observacao ? `<span>Obs.: ${t.observacao}</span>` : ""}
        </div>
      </div>
      <div class="tf-sec">
        <label>Pagamentos desta transferência (${pagamentos.length})</label>
        <div id="tfPags"></div>
      </div>
    </div>`;
  modal.appendChild(corpo);

  // Cada pagamento → clique abre o banner do pagamento.
  const cont = corpo.querySelector("#tfPags");
  if (cont) {
    if (!pagamentos.length) cont.innerHTML = `<p class="muted">Sem pagamentos.</p>`;
    pagamentos.forEach((p) => {
      const aloc = Array.isArray(p.alocacoes) ? p.alocacoes : [];
      const desp = aloc.length ? nomeDespesa(dataStore.todasDespesas().find((d) => String(d.id) === String((aloc[0] || {}).despesa_id))) : "—";
      const card = document.createElement("div");
      card.className = "tf-pag";
      card.title = "Ver pagamento";
      card.innerHTML = `
        <div class="top"><span class="item">${desp}</span><strong>${moeda(Number(p.valor) || 0)}</strong></div>
        <small>${aloc.length} despesa(s) · ${nomeTipo(p.tipo || t.tipo)}</small>`;
      card.addEventListener("click", () => {
        modal.remove();
        abrirPagamento(p);
      });
      cont.appendChild(card);
    });
  }

  const rod = document.createElement("div");
  rod.setAttribute("slot", "rodape");
  const excluir = document.createElement("ui-button");
  excluir.setAttribute("variant", "perigo");
  excluir.textContent = "Excluir transferência";
  excluir.addEventListener("click", async () => {
    if (await excluirTransferenciaComAviso(t)) modal.remove();
  });
  const btn = document.createElement("ui-button");
  btn.textContent = "Fechar";
  btn.addEventListener("click", () => modal.remove());
  rod.appendChild(excluir);
  rod.appendChild(btn);
  modal.appendChild(rod);

  modal.addEventListener("fechar", () => modal.remove());
  document.body.appendChild(modal);
}

/**
 * Exclui uma transferência mostrando o AVISO (lista os pagamentos que serão excluídos).
 * Após o aceite: exclui a transferência + todos os pagamentos + repasses (vínculos desfeitos).
 * Retorna true se excluiu.
 */
export async function excluirTransferenciaComAviso(t) {
  if (!t) return false;
  const pags = dataStore.pagamentosDaTransferencia(t.id);
  const listaHtml =
    pags
      .map((p) => {
        const aloc = Array.isArray(p.alocacoes) ? p.alocacoes : [];
        const d = aloc.length
          ? dataStore.todasDespesas().find((x) => String(x.id) === String((aloc[0] || {}).despesa_id))
          : null;
        return `<span>• ${nomeDespesa(d)} — ${moeda(Number(p.valor) || 0)}</span>`;
      })
      .join("") || "<span>• (sem pagamentos)</span>";
  const ok = await confirmar({
    titulo: "Excluir transferência",
    mensagem: `Isso exclui a transferência e os ${pags.length} pagamento(s) abaixo, desfazendo todos os vínculos (as despesas voltam a ficar em aberto):`,
    listaHtml,
    perigo: true,
    rotuloOk: "Excluir tudo",
  });
  if (!ok) return false;
  try {
    await dataStore.excluirTransferencia(t);
    toastSucesso("Transferência e pagamentos excluídos.");
    return true;
  } catch (e) {
    notificarErro(e);
    return false;
  }
}

/* --------------------- Grade de cards (transf/pagamento) ------------------ */

/* Estilo da grade de cards-resumo — injetado no shadow de quem usa o helper
   (página Transferências do menu E aba Transferência da obra usam o MESMO visual).
   Classes próprias (card-resumo) p/ não colidir com outros .resumo do sistema. */
const ESTILO_RESUMOS = `<style>
  .grade-resumos { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--esp-3); }
  .grade-resumos .card-resumo { position: relative; border-radius: var(--raio-md); box-shadow: var(--sombra-sm);
    padding: var(--esp-3) var(--esp-4); display: flex; flex-direction: column; gap: 4px; cursor: pointer;
    transition: background var(--transicao), box-shadow var(--transicao), transform var(--transicao); }
  .grade-resumos .card-resumo:hover { transform: translateY(-4px); box-shadow: var(--sombra-md); }
  .grade-resumos .card-resumo .item { font-weight: var(--peso-semi); }
  .grade-resumos .card-resumo .val { font-size: var(--fs-lg); font-weight: var(--peso-forte); }
  .grade-resumos .card-resumo small { color: var(--cor-texto-suave); }
  .grade-resumos .card-resumo.pag { background: var(--cor-sucesso-suave, rgba(22,163,74,.10)); border: 1px solid var(--cor-sucesso); }
  .grade-resumos .card-resumo.pag:hover { background: rgba(22,163,74,.16); }
  .grade-resumos .card-resumo.pag .val { color: var(--cor-sucesso); }
  .grade-resumos .card-resumo.transf { background: color-mix(in srgb, var(--cor-neutro) 30%, var(--cor-superficie)); border: 1px solid var(--cor-neutro); }
  .grade-resumos .card-resumo.transf:hover { background: color-mix(in srgb, var(--cor-neutro) 40%, var(--cor-superficie)); }
  .grade-resumos .card-resumo.transf .val { color: var(--cor-texto); }
  .grade-resumos .vazio-resumos { color: var(--cor-texto-fraco); padding: var(--esp-6); text-align: center; }
</style>`;

/**
 * Renderiza uma GRADE de cards-resumo (transferências ou pagamentos) dentro de `el`.
 * `classe` = "transf" | "pag"; `previaHtml(it)` = conteúdo do card; `abrir(it)` = clique.
 * Componente ÚNICO reusado pela página /pagamentos e pela aba Transferência da obra.
 */
export function montarGradeResumos(el, itens, classe, previaHtml, abrir, vazio) {
  if (!el) return;
  if (!itens || !itens.length) {
    el.innerHTML = ESTILO_RESUMOS + `<div class="grade-resumos"><div class="vazio-resumos">${vazio}</div></div>`;
    return;
  }
  el.innerHTML = ESTILO_RESUMOS + `<div class="grade-resumos"></div>`;
  const grade = el.querySelector(".grade-resumos");
  itens.forEach((it) => {
    const card = document.createElement("div");
    card.className = "card-resumo " + classe;
    card.title = "Ver detalhes";
    card.innerHTML = previaHtml(it);
    card.addEventListener("click", () => abrir(it));
    grade.appendChild(card);
  });
}
