/**
 * equipe-grade.js — Helper para renderizar uma GRADE de `equipe-card` (mesmo
 * componente/layout de Orçamento), reusado nas abas Equipes de contatos/obra.
 */
import { irPara } from "../../core/router.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-empty-state.js";
import "./equipe-card.js";
import "./equipe-form.js";

function _abrirForm(equipe) {
  const form = document.createElement("equipe-form");
  form.equipe = equipe;
  const fechar = () => form.remove();
  form.addEventListener("fechar", fechar);
  form.addEventListener("salvo", fechar);
  document.body.appendChild(form);
}

async function _remover(equipe) {
  if (!confirm(`Excluir a equipe "${equipe.nome}"?`)) return;
  try {
    await dataStore.removerEquipe(equipe.id);
    toastSucesso("Equipe removida.");
  } catch (e) {
    notificarErro(e);
  }
}

/** Preenche `el` com uma grade de equipe-card a partir de `lista`. */
export function montarGradeEquipes(el, lista) {
  if (!el) return;
  if (!lista.length) {
    el.innerHTML = `<ui-empty-state icone="usuario" titulo="Nenhuma equipe"
      texto="Nenhuma equipe aqui ainda."></ui-empty-state>`;
    return;
  }
  const grid = document.createElement("div");
  grid.style.cssText =
    "display:grid; gap: var(--esp-4); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));";
  lista.forEach((e) => {
    const card = document.createElement("equipe-card");
    card.equipe = e;
    card.addEventListener("abrir", (ev) => {
      irPara("/equipes/" + ev.detail.equipe.id);
    });
    card.addEventListener("editar", (ev) => _abrirForm(ev.detail.equipe));
    card.addEventListener("remover", (ev) => _remover(ev.detail.equipe));
    grid.appendChild(card);
  });
  el.replaceChildren(grid);
}
