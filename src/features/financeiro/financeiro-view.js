/**
 * <financeiro-view> — Painel financeiro CONSOLIDADO entre todas as obras (rota
 * /financeiro). Compõe primitivos já existentes (KPIs inline + ui-tabs +
 * ui-data-table) e reusa `despesa-split` (balancos/resto/status). Tudo derivado.
 *
 *  - KPIs: Total, Pago, Em aberto, Despesas em pagamento.
 *  - A receber: por destinatário real (Empresa p/ Material; Equipe/Contato p/
 *    Serviço — um payee por despesa, sem dupla contagem).
 *  - A pagar: por responsável (saldo a pagar via `balancos`).
 *  - Em aberto: despesas com resto > 0 (clique → obra).
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { balancos, totalRealizado, restoDespesa, statusPagamento } from "../despesas/despesa-split.js";
import "../../components/ui-card.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../despesas/category-badge.js";

const COR_STATUS = { Pago: "var(--cor-sucesso)", "Em pagamento": "var(--cor-aviso)", "A pagar": "var(--cor-neutro)" };

class FinanceiroView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
      .kpis { display: grid; gap: var(--esp-5); grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
      @media (max-width: 600px) { .kpis { grid-template-columns: repeat(2, 1fr); gap: var(--esp-3); } }
      .cartao { position: relative; overflow: hidden; color: #fff; border-radius: var(--raio-lg);
        padding: var(--esp-5); box-shadow: var(--sombra-md); min-height: 120px;
        display: flex; flex-direction: column; gap: var(--esp-2); }
      .cartao::after { content: ""; position: absolute; top: -28px; right: -28px; width: 110px; height: 110px;
        border-radius: 50%; background: rgba(255,255,255,.12); }
      .azul { background: var(--grad-azul); }
      .verde { background: var(--grad-verde); }
      .laranja { background: var(--grad-laranja); }
      .roxo { background: var(--grad-roxo); }
      .icone { width: 40px; height: 40px; border-radius: var(--raio-md); background: rgba(255,255,255,.18);
        display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
      .rotulo { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .05em;
        font-weight: var(--peso-semi); opacity: .9; position: relative; z-index: 1; }
      .valor { font-size: var(--fs-2xl); font-weight: var(--peso-forte); line-height: 1.1; position: relative; z-index: 1; }
    `;
  }

  template() {
    return `
      <div class="area">
        <div>
          <h1>Financeiro</h1>
          <p class="sub">Visão consolidada de pagamentos e recebimentos de todas as obras.</p>
        </div>
        <div class="kpis" id="kpis"></div>
        <ui-tabs id="abas">
          <div slot="receber">
            <ui-card mesa title="Mesa com recebimentos por destinatário">
              <ui-data-table id="tabReceber" fluido empty-text="Nada a receber."></ui-data-table>
            </ui-card>
          </div>
          <div slot="pagar">
            <ui-card mesa title="Mesa com pagamentos por responsável">
              <ui-data-table id="tabPagar" fluido empty-text="Nada a pagar."></ui-data-table>
            </ui-card>
          </div>
          <div slot="aberto">
            <ui-card mesa title="Mesa com despesas em aberto">
              <ui-data-table id="tabAberto" fluido clicavel empty-text="Nenhuma despesa em aberto."></ui-data-table>
            </ui-card>
          </div>
        </ui-tabs>
      </div>
    `;
  }

  aoConectar() {
    this.$("#abas").abas = [
      { id: "receber", rotulo: "A receber", icone: "carteira" },
      { id: "pagar", rotulo: "A pagar", icone: "recibo" },
      { id: "aberto", rotulo: "Em aberto", icone: "cifrao" },
    ];
    this._tabReceber = this.$("#tabReceber");
    this._tabReceber.columns = [
      { chave: "_nome", titulo: "Destinatário" },
      { chave: "_tipo", titulo: "Tipo", formato: (v) => `<category-badge nome="${v}" cor="var(--cor-info)"></category-badge>` },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_saldo", titulo: "Saldo a receber", alinhar: "dir", moeda: true, formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`) },
    ];
    this._tabPagar = this.$("#tabPagar");
    this._tabPagar.columns = [
      { chave: "_nome", titulo: "Responsável" },
      { chave: "_pago", titulo: "Pago", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_saldo", titulo: "Saldo a pagar", alinhar: "dir", moeda: true, formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-erro)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`) },
    ];
    this._tabAberto = this.$("#tabAberto");
    this._tabAberto.columns = [
      { chave: "_obra", titulo: "Obra" },
      { chave: "_item", titulo: "Item", largura: "180px" },
      { chave: "_valor", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_pago", titulo: "Pago", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_resto", titulo: "Resto", alinhar: "dir", moeda: true, formato: (v) => `<strong style="color:var(--cor-aviso)">${moeda(v)}</strong>` },
      { chave: "_status", titulo: "Status", formato: (v) => `<category-badge nome="${v}" cor="${COR_STATUS[v] || "var(--cor-neutro)"}"></category-badge>` },
    ];
    this._tabAberto.addEventListener("linha", (e) => {
      if (e.detail.linha.id) irPara("/obras/" + e.detail.linha.id);
    });
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  /** Nome ao vivo por chave: e:equipe / c:contato / u:usuário (mapa de participantes). */
  _nome(chave) {
    const s = String(chave || "");
    const id = s.slice(2);
    if (s.startsWith("e:")) return (dataStore.equipe(id) || {}).nome || "—";
    if (s.startsWith("c:")) return (dataStore.contatos().find((c) => String(c.id) === id) || {}).nome || this._mapaPart[s] || "—";
    return this._mapaPart[s] || "—";
  }

  pintar() {
    const kpis = this.$("#kpis");
    if (!kpis) return;
    if (!dataStore.carregado()) {
      kpis.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }
    const despesas = dataStore.todasDespesas();
    const { porChave } = balancos(despesas);

    // Mapa global de participantes (resolve nomes de responsáveis u:/c:).
    this._mapaPart = {};
    dataStore.obras().forEach((o) =>
      dataStore.participantesDaObra(o.id).forEach((p) => (this._mapaPart[p.chave] = p.nome))
    );

    // KPIs.
    let total = 0;
    let pago = 0;
    let aberto = 0;
    let emPgto = 0;
    despesas.forEach((d) => {
      total += Number(d.valor) || 0;
      pago += totalRealizado(d);
      aberto += restoDespesa(d);
      if (statusPagamento(d) === "Em pagamento") emPgto += 1;
    });
    kpis.innerHTML =
      this._cartao("azul", "recibo", "Total", moeda(total)) +
      this._cartao("verde", "sucesso", "Pago", moeda(pago)) +
      this._cartao("laranja", "carteira", "Em aberto", moeda(aberto)) +
      this._cartao("roxo", "cifrao", "Em pagamento", String(emPgto));

    // A receber — por destinatário real (Empresa p/ Material; senão Equipe/Contato).
    const receber = {};
    despesas.forEach((d) => {
      const realizado = totalRealizado(d);
      const resto = restoDespesa(d);
      let key, nome, tipo;
      if (d.fornecedor_id) {
        key = "f:" + d.fornecedor_id;
        nome = (dataStore.fornecedores().find((f) => String(f.id) === String(d.fornecedor_id)) || {}).nome || "—";
        tipo = "Empresa";
      } else if (d.ofertante_equipe_id) {
        key = "e:" + d.ofertante_equipe_id;
        nome = this._nome(key);
        tipo = "Equipe";
      } else if (d.ofertante_contato_id) {
        key = "c:" + d.ofertante_contato_id;
        nome = this._nome(key);
        tipo = "Contato";
      } else {
        return;
      }
      const r = (receber[key] = receber[key] || { _nome: nome, _tipo: tipo, _recebido: 0, _saldo: 0 });
      r._recebido += realizado;
      r._saldo += resto;
    });
    this._tabReceber.rows = Object.values(receber)
      .filter((r) => r._recebido > 0.01 || r._saldo > 0.01)
      .sort((a, b) => b._saldo - a._saldo);

    // A pagar — por responsável (saldo a pagar).
    this._tabPagar.rows = Object.keys(porChave)
      .map((ch) => ({ _nome: this._nome(ch), _pago: porChave[ch].pago, _saldo: porChave[ch].saldoApagar }))
      .filter((r) => r._saldo > 0.01 || r._pago > 0.01)
      .sort((a, b) => b._saldo - a._saldo);

    // Em aberto — despesas com resto > 0.
    this._tabAberto.rows = despesas
      .filter((d) => restoDespesa(d) > 0.01)
      .map((d) => ({
        id: d.obra_id,
        _obra: (dataStore.obra(d.obra_id) || {}).nome || "—",
        _item: (d.item_id && (dataStore.item(d.item_id) || {}).nome) || d.item || "—",
        _valor: Number(d.valor) || 0,
        _pago: totalRealizado(d),
        _resto: restoDespesa(d),
        _status: statusPagamento(d),
      }))
      .sort((a, b) => b._resto - a._resto);
  }

  _cartao(cor, icone, rotulo, valor) {
    return `<div class="cartao ${cor}">
      <div class="icone"><ui-icon name="${icone}" size="20"></ui-icon></div>
      <span class="rotulo">${rotulo}</span>
      <span class="valor">${valor}</span>
    </div>`;
  }
}

customElements.define("financeiro-view", FinanceiroView);
