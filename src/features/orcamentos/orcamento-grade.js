/**
 * orcamento-grade.js — Helper para renderizar uma GRADE de `orcamento-card`
 * (o MESMO componente usado na aba Orçamento de Cotações), reusado nas abas
 * Orçamentos de fornecedor/contato/obra. Não é componente novo.
 */
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-empty-state.js";
import "./orcamento-card.js";
import "./orcamento-form.js";

function _abrirForm(orcamento) {
  const form = document.createElement("orcamento-form");
  form.orcamento = orcamento;
  const fechar = () => form.remove();
  form.addEventListener("fechar", fechar);
  form.addEventListener("salvo", fechar);
  document.body.appendChild(form);
}

async function _remover(orcamento) {
  if (!confirm("Excluir o orçamento e suas ofertas?")) return;
  try {
    await dataStore.removerOrcamento(orcamento.id);
    toastSucesso("Orçamento removido.");
  } catch (e) {
    notificarErro(e);
  }
}

/** Preenche `el` com uma grade de orcamento-card a partir de `lista`. */
export function montarGradeOrcamentos(el, lista) {
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = `<ui-empty-state icone="carteira" titulo="Nenhum orçamento"
      texto="Nenhum orçamento aqui ainda."></ui-empty-state>`;
    return;
  }
  const grid = document.createElement("div");
  grid.style.cssText =
    "display:grid; gap: var(--esp-4); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));";
  lista.forEach((o) => {
    const card = document.createElement("orcamento-card");
    card.orcamento = o;
    card.addEventListener("abrir", (e) => {
      location.hash = "#/orcamentos/" + e.detail.orcamento.id;
    });
    card.addEventListener("editar", (e) => _abrirForm(e.detail.orcamento));
    card.addEventListener("remover", (e) => _remover(e.detail.orcamento));
    grid.appendChild(card);
  });
  el.replaceChildren(grid);
}
