/**
 * <compartilhados-obra tipo="contato|fornecedor|item|oferta|orcamento">
 *
 * Aba "Compartilhados" organizada POR OBRA (mesmo padrão da tela Transferências):
 * chips com as obras COMPARTILHADAS comigo; ao escolher uma, lista os dados
 * daquele tipo que a obra referencia (só os que NÃO são meus), cada um com
 * **Incorporar** (copia para o meu acervo pessoal via `dataStore.incorporar`).
 * Assim o usuário analisa cada compartilhamento e escolhe o que trazer.
 * Reutilizado por contatos/empresas/itens/ofertas/orçamentos-view.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { avatarHtml } from "./avatar.js";
import { moeda } from "../../core/formatters.js";
import { ofertanteNome, rotuloOrcamento } from "../orcamentos/orcamento-util.js";
import { totalOferta } from "../cotacoes/cotacao-util.js";
import "../despesas/category-badge.js";
import "../../components/ui-empty-state.js";

const _esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const PLURAL = { contato: "contatos", fornecedor: "fornecedores", item: "itens", oferta: "ofertas", orcamento: "orcamentos" };

class CompartilhadosObra extends BaseElement {
  get tipo() {
    return this.getAttribute("tipo") || "contato";
  }

  estilos() {
    return `
      :host { display: block; }
      .chips { display: flex; gap: var(--esp-2); overflow-x: auto; padding-bottom: 2px; margin-bottom: var(--esp-3);
        -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .chips::-webkit-scrollbar { display: none; }
      .chip { flex: none; border: 1px solid var(--cor-borda); background: var(--cor-superficie); color: var(--cor-texto);
        cursor: pointer; border-radius: var(--raio-completo); font: inherit; font-size: var(--fs-sm);
        font-weight: var(--peso-medio); min-height: 40px; padding: 0 var(--esp-4); white-space: nowrap; }
      .chip.ativo { background: var(--cor-primaria); color: #fff; border-color: var(--cor-primaria); }
      .comp-lista { display: flex; flex-direction: column; }
      .comp-row { display: flex; align-items: center; gap: var(--esp-3); padding: var(--esp-2) 0;
        border-bottom: 1px solid var(--cor-borda); min-height: 60px; }
      .comp-row:last-child { border-bottom: none; }
      .comp-conteudo { flex: 1; min-width: 0; }
      .comp-inc { flex: none; border: 1px solid var(--cor-primaria); background: var(--cor-primaria-suave);
        color: var(--cor-primaria-escura, var(--cor-primaria)); cursor: pointer; border-radius: var(--raio-sm);
        font: inherit; font-size: var(--fs-sm); font-weight: var(--peso-semi); min-height: 40px; padding: 0 var(--esp-3); }
      .comp-inc:hover { background: var(--cor-primaria); color: #fff; }
      .comp-inc[disabled] { opacity: .5; cursor: default; }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); padding: var(--esp-3) 0; }
    `;
  }

  template() {
    return `<div class="chips" id="chips"></div><div id="lista"></div>`;
  }

  aoConectar() {
    this._obraSel = "";
    this._pintar();
    this.aoLimpar(dataStore.subscribe(() => this._pintar()));
  }

  _pintar() {
    const chipsEl = this.$("#chips");
    const listaEl = this.$("#lista");
    if (!chipsEl || !listaEl || !dataStore.carregado()) return;
    const obras = dataStore.obrasCompartilhadas();
    if (!obras.length) {
      chipsEl.innerHTML = "";
      listaEl.innerHTML = `<ui-empty-state icone="usuarios" titulo="Nada compartilhado"
        texto="Quando alguém compartilhar uma obra com você, os dados dela aparecem aqui para revisar e incorporar."></ui-empty-state>`;
      return;
    }
    if (!this._obraSel || !obras.some((o) => String(o.id) === String(this._obraSel))) this._obraSel = String(obras[0].id);
    chipsEl.innerHTML = obras
      .map((o) => `<button type="button" class="chip ${String(this._obraSel) === String(o.id) ? "ativo" : ""}" data-id="${o.id}">${_esc(o.nome)}</button>`)
      .join("");
    chipsEl.querySelectorAll(".chip").forEach((b) =>
      b.addEventListener("click", () => {
        this._obraSel = b.dataset.id;
        this._pintar();
      })
    );

    const lista = (dataStore.compartilhadoDaObra(this._obraSel) || {})[PLURAL[this.tipo]] || [];
    if (!lista.length) {
      listaEl.innerHTML = `<p class="vazio">Nada deste tipo compartilhado nesta obra.</p>`;
      return;
    }
    listaEl.innerHTML = `<div class="comp-lista">${lista
      .map(
        (x) => `<div class="comp-row">
          <div class="comp-conteudo">${this._linha(x)}</div>
          <button type="button" class="comp-inc" data-id="${x.id}">Incorporar</button>
        </div>`
      )
      .join("")}</div>`;
    listaEl.querySelectorAll(".comp-inc").forEach((b) =>
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await dataStore.incorporar(this.tipo, b.dataset.id);
          toastSucesso("Incorporado ao seu acervo.");
        } catch (e) {
          notificarErro(e);
          b.disabled = false;
        }
      })
    );
  }

  _linha(x) {
    const pessoa = (nome, sub) =>
      `<div style="display:flex;align-items:center;gap:12px;min-width:0">${avatarHtml(nome, 42)}
        <div style="min-width:0"><div style="font-weight:var(--peso-semi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(nome)}</div>
        ${sub ? `<div style="font-size:.85rem;color:var(--cor-texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(sub)}</div>` : ""}</div></div>`;
    switch (this.tipo) {
      case "contato": {
        const emp = x.fornecedor_id ? (dataStore.fornecedores().find((f) => String(f.id) === String(x.fornecedor_id)) || {}).nome : "";
        return pessoa(x.nome, [x.cargo, emp].filter(Boolean).join(" · "));
      }
      case "fornecedor": {
        const cat = (dataStore.categorias().find((c) => String(c.id) === String(x.categoria_id)) || {}).nome || "";
        return pessoa(x.nome, cat);
      }
      case "item":
        return `<div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-weight:var(--peso-semi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(x.nome)}</span>
          <category-badge nome="${_esc(x.classificacao || "—")}" cor="var(--cor-neutro)"></category-badge></div>`;
      case "oferta": {
        const it = dataStore.item(x.item_id);
        const nome = (it && it.nome) || x.item || "Oferta";
        const tot = totalOferta(x, dataStore.cotacao(x.cotacao_id));
        const of = ofertanteNome(x.contato_id, x.equipe_id);
        return `<div style="min-width:0"><div style="font-weight:var(--peso-semi)">${_esc(nome)} — ${moeda(tot)}</div>
          ${of ? `<div style="font-size:.85rem;color:var(--cor-texto-suave)">${_esc(of)}</div>` : ""}</div>`;
      }
      case "orcamento":
        return `<div style="min-width:0"><div style="font-weight:var(--peso-semi)">${_esc(rotuloOrcamento(x))}</div>
          ${x.tipo ? `<div style="font-size:.85rem;color:var(--cor-texto-suave)">${_esc(x.tipo)}</div>` : ""}</div>`;
      default:
        return _esc(x.nome || x.id || "");
    }
  }
}

customElements.define("compartilhados-obra", CompartilhadosObra);
