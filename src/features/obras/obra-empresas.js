/**
 * <obra-empresas obra-id="…"> — Aba "Empresas" da obra: as empresas (fornecedores)
 * usadas na obra + **Total / Recebido / Saldo a receber** (via `balancos.porFornecedor`).
 *
 * MESMO padrão responsivo de <obra-participantes> (componente irmão): no desktop uma
 * `ui-data-table`; no mobile (≤820px) uma `ui-lista-gestos` de cards (avatar + nome +
 * valores). Lê do data-store (cache-first) e assina mudanças. Componente ÚNICO usado
 * TANTO na tela interna (`obra-detail-view`) QUANTO no link público (`publico-view`)
 * — elimina as réplicas `montarFornecedores`/`_montarFornecedores`.
 *
 * Somente-leitura (`dataStore.somenteLeitura()`, link público): sem navegação p/ a
 * rota protegida `/fornecedores/:id` (display-only). Default false → interno intacto.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { irPara } from "../../core/router.js";
import { moeda } from "../../core/formatters.js";
import { balancos } from "../despesas/despesa-split.js";
import { avatarNomeHtml, avatarHtml, whatsappBtnHtml } from "../shared/avatar.js";
import "../../components/ui-card.js";
import "../../components/ui-data-table.js";
import "../../components/ui-lista-gestos.js";
import "../../components/ui-empty-state.js";

const _esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

class ObraEmpresas extends BaseElement {
  get obraId() {
    return this.getAttribute("obra-id");
  }

  estilos() {
    return `:host { display: block; }`;
  }

  template() {
    return `<ui-card mesa title="Mesa com empresas da obra"><div id="lista"></div></ui-card>`;
  }

  aoConectar() {
    // Responsivo: desktop = tabela; mobile (≤820px) = cards de gesto (touch).
    this._mq = window.matchMedia("(max-width: 820px)");
    this._onMq = () => this.pintar();
    this._mq.addEventListener("change", this._onMq);
    this.aoLimpar(() => this._mq.removeEventListener("change", this._onMq));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
    this.pintar();
  }

  /** Empresas usadas na obra + Total/Recebido/Saldo a receber (via balancos.porFornecedor). */
  _linhas() {
    const despesas = dataStore.despesas(this.obraId);
    const { porFornecedor } = balancos(despesas);
    const qtd = {};
    despesas.forEach((d) => {
      if (d.fornecedor_id) qtd[d.fornecedor_id] = (qtd[d.fornecedor_id] || 0) + 1;
    });
    return Object.keys(porFornecedor)
      .map((fid) => {
        const f = dataStore.fornecedores().find((x) => String(x.id) === String(fid)) || {};
        const v = porFornecedor[fid];
        return { id: fid, _nome: f.nome || "—", _tel: f.telefone || "", _qtd: qtd[fid] || 0, _total: v.total, _recebido: v.recebido, _resto: v.saldoReceber };
      })
      .sort((a, b) => b._resto - a._resto);
  }

  pintar() {
    const lista = this.$("#lista");
    if (!lista) return;
    const rows = this._linhas();
    if (!rows.length) {
      lista.innerHTML = `<ui-empty-state icone="fornecedor" titulo="Nenhuma empresa"
        texto="Nenhuma empresa usada nesta obra ainda."></ui-empty-state>`;
      return;
    }
    const ro = dataStore.somenteLeitura();

    // MOBILE: cards de gesto (mesmo padrão de obra-participantes).
    if (this._mq && this._mq.matches) {
      let lg = lista.querySelector("ui-lista-gestos");
      if (!lg) { lg = this._novaLista(ro); lista.replaceChildren(lg); }
      lg.render = (e) => this._cardEmpresa(e);
      lg.itens = rows;
      return;
    }

    // DESKTOP: tabela (mesmas colunas de sempre).
    const tabela = document.createElement("ui-data-table");
    tabela.setAttribute("fluido", "");
    if (!ro) tabela.setAttribute("clicavel", ""); // sem hover "clicável" enganoso no link
    tabela.columns = [
      { chave: "_nome", titulo: "Empresa", formato: (v) => avatarNomeHtml(v) },
      { chave: "_tel", titulo: "", formato: (v) => whatsappBtnHtml(v), largura: "52px" },
      { chave: "_qtd", titulo: "Despesas", alinhar: "dir" },
      { chave: "_total", titulo: "Total", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      {
        chave: "_resto",
        titulo: "Saldo a receber",
        alinhar: "dir",
        moeda: true,
        formato: (v) =>
          v > 0.01
            ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    tabela.rows = rows;
    if (!ro) tabela.addEventListener("linha", (e) => { if (e.detail.linha.id) irPara("/fornecedores/" + e.detail.linha.id); });
    lista.replaceChildren(tabela);
  }

  /** Card mobile de uma empresa: avatar + nome + WhatsApp + valores compactos. */
  _cardEmpresa(e) {
    const resto = e._resto > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(e._resto)}</strong>` : "—";
    return `<div style="display:flex;gap:14px;width:100%;min-width:0">
      ${avatarHtml(e._nome, 46)}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="font-size:1.05rem;font-weight:var(--peso-semi);color:var(--cor-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(e._nome)}</span>
          <span style="flex:none">${e._tel ? whatsappBtnHtml(e._tel, 40) : ""}</span>
        </div>
        <div style="font-size:var(--fs-sm);color:var(--cor-texto-suave)">${e._qtd} despesa(s) · Total <strong style="color:var(--cor-texto)">${moeda(e._total)}</strong></div>
        <div style="font-size:var(--fs-sm);color:var(--cor-texto-suave)">Recebido <strong style="color:var(--cor-texto)">${moeda(e._recebido)}</strong> · A receber ${resto}</div>
      </div>
    </div>`;
  }

  /** Cria a lista de gestos (reusada entre pinturas). */
  _novaLista(ro) {
    const lg = document.createElement("ui-lista-gestos");
    lg.semSwipeAcao = true; // sem ações de arraste; empresas não têm ação de linha
    lg.render = (e) => this._cardEmpresa(e);
    lg.addEventListener("abrir", (ev) => {
      if (ro) return; // link público: sem navegação p/ rota protegida
      const l = ev.detail.item || {};
      if (l.id) irPara("/fornecedores/" + l.id);
    });
    return lg;
  }
}

customElements.define("obra-empresas", ObraEmpresas);
