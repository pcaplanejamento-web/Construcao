/**
 * <painel-atencao> — "O que precisa de atenção": resume, no topo da tela inicial
 * (/obras), os itens acionáveis do dia — prazos críticos, total a pagar e
 * cotações abertas — cada um levando à tela certa. Compõe helpers existentes
 * (prazo-util, despesa-split) e o data-store; auto-contido (assina o store e
 * repinta). Some quando não há nada a fazer (mostra "Tudo em dia" se há obras).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { ehFinalizada, diasRestantes, textoPrazoCurto, corPrazo } from "../obras/prazo-util.js";
import { restoDespesa } from "../despesas/despesa-split.js";
import "../../components/ui-icon.js";

const JANELA_DIAS = 7; // "vencendo" = prazo em até 7 dias

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

class PainelAtencao extends BaseElement {
  aoConectar() {
    this.pintar();
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  estilos() {
    return `
      :host { display: block; }
      #raiz:empty { display: none; }
      .titulo { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-md);
        font-weight: var(--peso-semi); color: var(--cor-texto); margin-bottom: var(--esp-3); }
      .titulo ui-icon { color: var(--cor-aviso); }
      .cards { display: grid; gap: var(--esp-3);
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
      @media (max-width: 600px) { .cards { grid-template-columns: repeat(2, 1fr); } }
      .card { position: relative; overflow: hidden; color: #fff; border-radius: var(--raio-lg);
        padding: var(--esp-4) var(--esp-5); box-shadow: var(--sombra-md); min-height: 104px;
        display: flex; flex-direction: column; gap: var(--esp-1); text-decoration: none;
        transition: transform .12s ease, box-shadow .12s ease; }
      .card:hover { transform: translateY(-2px); box-shadow: var(--sombra-lg); text-decoration: none; }
      .card:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--cor-primaria-suave), var(--sombra-md); }
      .card::after { content: ""; position: absolute; top: -28px; right: -28px; width: 100px; height: 100px;
        border-radius: 50%; background: rgba(255,255,255,.12); }
      .card.vermelho { background: var(--grad-vermelho); }
      .card.laranja { background: var(--grad-laranja); }
      .card.roxo { background: var(--grad-roxo); }
      .card.azul { background: var(--grad-azul); }
      .ic { width: 38px; height: 38px; border-radius: var(--raio-md); background: rgba(255,255,255,.18);
        display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
      .rot { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: .05em;
        font-weight: var(--peso-semi); opacity: .92; position: relative; z-index: 1; margin-top: var(--esp-1); }
      .val { font-size: var(--fs-xl); font-weight: var(--peso-forte); line-height: 1.1; position: relative; z-index: 1; }
      .sub { font-size: var(--fs-xs); opacity: .9; position: relative; z-index: 1; }
      /* Lista de obras críticas (prazo) */
      .criticas { display: flex; flex-direction: column; gap: var(--esp-1); margin-top: var(--esp-3); }
      .obra { display: flex; align-items: center; justify-content: space-between; gap: var(--esp-3);
        padding: var(--esp-2) var(--esp-3); border-radius: var(--raio-sm); background: var(--cor-superficie-2);
        text-decoration: none; color: var(--cor-texto); min-height: 40px; }
      .obra:hover { background: var(--cor-divisor); text-decoration: none; }
      .obra .nome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--peso-medio); }
      .obra .badge { flex: none; font-size: var(--fs-xs); font-weight: var(--peso-semi); white-space: nowrap; }
      .mais { align-self: flex-start; font-size: var(--fs-sm); color: var(--cor-primaria);
        text-decoration: none; padding: var(--esp-1) var(--esp-2); }
      .mais:hover { text-decoration: underline; }
      /* Tudo em dia */
      .ok { display: flex; align-items: center; gap: var(--esp-2); font-size: var(--fs-sm);
        color: var(--cor-texto-suave); background: var(--cor-sucesso-suave); border-radius: var(--raio-md);
        padding: var(--esp-3) var(--esp-4); }
      .ok ui-icon { color: var(--cor-sucesso); }
      .painel { margin-bottom: var(--esp-5); }
    `;
  }

  template() {
    return `<div id="raiz"></div>`;
  }

  /** Reúne os itens acionáveis a partir do store + helpers. */
  _dados() {
    const criticas = dataStore
      .obras()
      .filter((o) => !ehFinalizada(o) && o.prazo)
      .map((o) => ({ obra: o, dias: diasRestantes(o.prazo) }))
      .filter((x) => x.dias != null && x.dias <= JANELA_DIAS)
      .sort((a, b) => a.dias - b.dias);
    const atrasadas = criticas.filter((x) => x.dias < 0).length;

    let aPagar = 0;
    let nPagar = 0;
    dataStore.todasDespesas().forEach((d) => {
      const r = restoDespesa(d);
      if (r > 0.01) { aPagar += r; nPagar += 1; }
    });

    const cotAbertas = dataStore.cotacoes().filter((c) => {
      const ps = dataStore.precosDaCotacao(c.id);
      return ps.length && ps.some((p) => !p.despesa_id);
    }).length;

    return { criticas, atrasadas, vencendo: criticas.length - atrasadas, aPagar, nPagar, cotAbertas, temObras: dataStore.obras().length > 0 };
  }

  pintar() {
    const raiz = this.$("#raiz");
    if (!raiz) return;
    if (!dataStore.carregado()) { raiz.innerHTML = ""; return; }

    const d = this._dados();
    const temAtencao = d.criticas.length || d.aPagar > 0.01 || d.cotAbertas;
    if (!temAtencao) {
      raiz.innerHTML = d.temObras
        ? `<div class="painel"><div class="ok"><ui-icon name="sucesso" size="18"></ui-icon>
             Tudo em dia — nenhum prazo crítico, nada a pagar e sem cotações abertas.</div></div>`
        : "";
      return;
    }

    const cards = [];
    if (d.criticas.length) {
      const cor = d.atrasadas ? "vermelho" : "laranja";
      const sub = [d.atrasadas ? `${d.atrasadas} atrasada(s)` : "", d.vencendo ? `${d.vencendo} vencendo` : ""]
        .filter(Boolean).join(" · ");
      cards.push(`<a class="card ${cor}" href="/obras"><div class="ic"><ui-icon name="relogio" size="20"></ui-icon></div>
        <span class="rot">Prazos</span><span class="val">${d.criticas.length}</span><span class="sub">${sub}</span></a>`);
    }
    if (d.aPagar > 0.01) {
      cards.push(`<a class="card roxo" href="/financeiro"><div class="ic"><ui-icon name="carteira" size="20"></ui-icon></div>
        <span class="rot">A pagar</span><span class="val">${moeda(d.aPagar)}</span><span class="sub">${d.nPagar} despesa(s) em aberto</span></a>`);
    }
    if (d.cotAbertas) {
      cards.push(`<a class="card azul" href="/cotacoes"><div class="ic"><ui-icon name="cotacao" size="20"></ui-icon></div>
        <span class="rot">Cotações abertas</span><span class="val">${d.cotAbertas}</span><span class="sub">aguardando decisão</span></a>`);
    }

    const lista = d.criticas.slice(0, 5).map((x) =>
      `<a class="obra" href="/obras/${esc(x.obra.id)}"><span class="nome">${esc(x.obra.nome)}</span>
        <span class="badge" style="color:${corPrazo(x.obra)}">${esc(textoPrazoCurto(x.obra))}</span></a>`
    ).join("");
    const mais = d.criticas.length > 5
      ? `<a class="mais" href="/obras">+${d.criticas.length - 5} obra(s) com prazo</a>` : "";

    raiz.innerHTML = `
      <div class="painel">
        <div class="titulo"><ui-icon name="aviso" size="18"></ui-icon> O que precisa de atenção</div>
        <div class="cards">${cards.join("")}</div>
        ${d.criticas.length ? `<div class="criticas">${lista}${mais}</div>` : ""}
      </div>
    `;
  }
}

customElements.define("painel-atencao", PainelAtencao);
