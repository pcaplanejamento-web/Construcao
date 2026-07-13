/**
 * compartilhados-lista.js — Monta a lista "Compartilhados" das telas de catálogo
 * (Contatos/Empresas/Itens). São entidades que vieram de uma OBRA COMPARTILHADA
 * (referenciadas por ela): somente-leitura, com um botão **Incorporar** que copia
 * a entidade para o acervo PESSOAL do usuário (via dataStore.incorporar) — aí ela
 * vira dele e sobrevive ao descompartilhamento.
 *
 * Reutilizável: o consumidor passa `render(x)→html` (a mesma linha avatar+nome do
 * mobile) + o `tipo` ("contato" | "fornecedor" | "item"). Renderiza no container
 * (light DOM da view; usa tokens via inline style + um <style> escopado).
 */
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-empty-state.js";

export function montarCompartilhados(el, itens, opts) {
  if (!el) return;
  const o = opts || {};
  if (!itens || !itens.length) {
    el.innerHTML = `<ui-empty-state icone="${o.icone || "usuarios"}" titulo="Nada compartilhado"
      texto="${o.vazio || "Dados de obras compartilhadas com você aparecem aqui."}"></ui-empty-state>`;
    return;
  }
  el.innerHTML = `
    <style>
      .comp-lista { display: flex; flex-direction: column; }
      .comp-row { display: flex; align-items: center; gap: var(--esp-3);
        padding: var(--esp-2) 0; border-bottom: 1px solid var(--cor-borda); min-height: 60px; }
      .comp-row:last-child { border-bottom: none; }
      .comp-conteudo { flex: 1; min-width: 0; }
      .comp-inc { flex: none; border: 1px solid var(--cor-primaria); background: var(--cor-primaria-suave);
        color: var(--cor-primaria-escura, var(--cor-primaria)); cursor: pointer; border-radius: var(--raio-sm);
        font: inherit; font-size: var(--fs-sm); font-weight: var(--peso-semi); min-height: 40px; padding: 0 var(--esp-3); }
      .comp-inc:hover { background: var(--cor-primaria); color: #fff; }
      .comp-inc[disabled] { opacity: .5; cursor: default; }
    </style>
    <div class="comp-lista">${itens
      .map(
        (x) => `<div class="comp-row">
          <div class="comp-conteudo">${o.render ? o.render(x) : ""}</div>
          <button type="button" class="comp-inc" data-id="${x.id}">Incorporar</button>
        </div>`
      )
      .join("")}</div>`;
  el.querySelectorAll(".comp-inc").forEach((b) =>
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await dataStore.incorporar(o.tipo, b.dataset.id);
        toastSucesso("Incorporado ao seu acervo.");
      } catch (e) {
        notificarErro(e);
        b.disabled = false;
      }
    })
  );
}
