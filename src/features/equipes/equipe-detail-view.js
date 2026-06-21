/**
 * <equipe-detail-view> — Página de uma equipe (rota #/equipes/:id).
 *
 * Cabeçalho (nome + líder) + duas seções: Obras vinculadas (N:N) e Membros, com
 * adicionar/remover. Lê do data-store (cache-first) e assina mudanças. Espelha
 * orcamento-detail-view. Reusa ui-card, ui-data-table, ui-select, ui-button.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { parseLista, totalRealizado, restoDespesa } from "../despesas/despesa-split.js";
import { liderNome, integrantesDaEquipe } from "./equipe-util.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-select.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "./equipe-form.js";

class EquipeDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
  }

  get equipeId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { color: var(--cor-texto-suave); font-size: var(--fs-sm); }
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; margin-top: var(--esp-1); }
      .add { display: flex; gap: var(--esp-3); align-items: end; margin-bottom: var(--esp-4); }
      .add ui-select { flex: 1; }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando equipe..."></ui-spinner></div></div>`;
  }

  _buscar() {
    return dataStore.equipe(this.equipeId);
  }

  aoConectar() {
    if (!this._buscar()) {
      this.$("#conteudo").innerHTML = `<p>Equipe não encontrada. <a href="#/contatos">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="#/contatos">← Contatos</a>
      <div class="topo" id="topo"></div>
      <ui-card title="Obras vinculadas">
        <div class="add">
          <ui-select id="selObra" label="Obra"></ui-select>
          <ui-button id="addObra">Vincular</ui-button>
        </div>
        <ui-data-table id="tabObras" fluido clicavel
          empty-text="Nenhuma obra vinculada ainda."></ui-data-table>
      </ui-card>
      <ui-card title="Membros">
        <div class="add">
          <ui-select id="selMembro" label="Contato"></ui-select>
          <ui-button id="addMembro">Adicionar</ui-button>
        </div>
        <ui-data-table id="tabMembros" fluido clicavel
          empty-text="Nenhum membro ainda."></ui-data-table>
      </ui-card>
      <ui-card title="Dados — recebimentos da equipe">
        <div class="meta" id="resumoEq"></div>
        <ui-data-table id="tabDados" fluido
          empty-text="Nenhum recebimento por integrante ainda."></ui-data-table>
      </ui-card>
    `;

    this._tabObras = alvo.querySelector("#tabObras");
    this._tabObras.columns = [{ chave: "_nome", titulo: "Obra" }];
    this._tabObras.acoes = [{ nome: "remover", rotulo: "Remover", variant: "perigo" }];
    this._tabObras.addEventListener("linha", (e) => {
      location.hash = "#/obras/" + e.detail.linha.id;
    });
    this._tabObras.addEventListener("acao", (e) => this.removerObra(e.detail.linha.id));

    this._tabMembros = alvo.querySelector("#tabMembros");
    this._tabMembros.columns = [
      { chave: "_nome", titulo: "Contato" },
      { chave: "_cargo", titulo: "Cargo", formato: (v) => v || "—" },
    ];
    this._tabMembros.acoes = [{ nome: "remover", rotulo: "Remover", variant: "perigo" }];
    this._tabMembros.addEventListener("linha", (e) => {
      location.hash = "#/contatos/" + e.detail.linha.id;
    });
    this._tabMembros.addEventListener("acao", (e) => this.removerMembro(e.detail.linha.id));

    this._tabDados = alvo.querySelector("#tabDados");
    this._tabDados.columns = [
      { chave: "_nome", titulo: "Integrante" },
      { chave: "_planejado", titulo: "Planejado", alinhar: "dir", formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", formato: (v) => moeda(v) },
      {
        chave: "_saldo",
        titulo: "Saldo a receber",
        alinhar: "dir",
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`),
      },
    ];

    alvo.querySelector("#addObra").addEventListener("click", () => this.adicionarObra());
    alvo.querySelector("#addMembro").addEventListener("click", () => this.adicionarMembro());

    this._montado = true;
  }

  /** Dados financeiros da equipe: total/pago/resto + planejado/recebido por integrante. */
  montarDados(eq) {
    const despesasEq = dataStore
      .todasDespesas()
      .filter((d) => String(d.ofertante_equipe_id) === String(eq.id));
    let total = 0;
    let pago = 0;
    let resto = 0;
    const planejado = {};
    const recebido = {};
    despesasEq.forEach((d) => {
      total += Number(d.valor) || 0;
      pago += totalRealizado(d);
      resto += restoDespesa(d);
      parseLista(d.recebidos).forEach((r) => {
        if (r && r.chave) planejado[r.chave] = (planejado[r.chave] || 0) + (Number(r.valor) || 0);
      });
      parseLista(d.pagamentos_realizados).forEach((p) => {
        parseLista(p.distribuicao).forEach((x) => {
          if (x && x.chave) recebido[x.chave] = (recebido[x.chave] || 0) + (Number(x.valor) || 0);
        });
      });
    });
    this._tabDados.rows = integrantesDaEquipe(eq.id)
      .map((p) => {
        const pl = planejado[p.chave] || 0;
        const rc = recebido[p.chave] || 0;
        return { _nome: p.nome, _planejado: pl, _recebido: rc, _saldo: Math.max(0, pl - rc) };
      })
      .filter((r) => r._planejado > 0.01 || r._recebido > 0.01);
    const resumo = this.shadowRoot.querySelector("#resumoEq");
    if (resumo) {
      resumo.innerHTML = `<span>Total ${moeda(total)}</span><span>· Pago ${moeda(pago)}</span><span>· Saldo a receber ${moeda(resto)}</span>`;
    }
  }

  sincronizar() {
    if (!this._montado) return;
    const e = this._buscar();
    if (!e) {
      location.hash = "#/contatos";
      return;
    }
    this._equipe = e;

    this._tabObras.rows = (e.obras || []).map((id) => ({ id, _nome: (dataStore.obra(id) || {}).nome || "—" }));
    this._tabMembros.rows = (e.membros || []).map((id) => {
      const c = dataStore.contatos().find((x) => String(x.id) === String(id)) || {};
      return { id, _nome: c.nome || "—", _cargo: c.cargo || "—" };
    });

    // Selects de adição (só o que ainda não está vinculado).
    const usadasObra = new Set((e.obras || []).map(String));
    const selObra = this.shadowRoot.querySelector("#selObra");
    const dispObra = dataStore.obras().filter((o) => !usadasObra.has(String(o.id)));
    selObra.setAttribute("placeholder", dispObra.length ? "Selecione a obra" : "Todas já vinculadas");
    selObra.options = dispObra.map((o) => ({ value: o.id, label: o.nome }));
    selObra.value = "";

    const usadosMembro = new Set((e.membros || []).map(String));
    const selMembro = this.shadowRoot.querySelector("#selMembro");
    const dispMembro = dataStore
      .contatosAtivos()
      .filter((c) => !usadosMembro.has(String(c.id)) && String(c.id) !== String(e.lider_id));
    selMembro.setAttribute("placeholder", dispMembro.length ? "Selecione o contato" : "Nenhum contato disponível");
    selMembro.options = dispMembro.map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} — ${c.cargo}` : c.nome }));
    selMembro.value = "";

    this.montarDados(e);
    this.pintarTopo();
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo) return;
    const e = this._equipe;
    topo.innerHTML = `
      <div>
        <h1>${e.nome || ""}</h1>
        <div class="meta">
          <category-badge nome="Líder: ${liderNome(e)}" cor="var(--cor-primaria)"></category-badge>
          <span>· ${(e.membros || []).length} membro(s)</span>
          <span>· ${(e.obras || []).length} obra(s)</span>
        </div>
      </div>
      <div><ui-button id="editarEq" variant="secundario">Editar equipe</ui-button></div>
    `;
    topo.querySelector("#editarEq").addEventListener("click", () => this.editarEquipe());
  }

  async _salvarListas(patch) {
    try {
      await dataStore.atualizarEquipe(this._equipe.id, patch);
    } catch (e) {
      notificarErro(e);
    }
  }

  adicionarObra() {
    const id = this.shadowRoot.querySelector("#selObra").value;
    if (!id) return;
    this._salvarListas({ obras: [...(this._equipe.obras || []), id] });
  }

  removerObra(id) {
    this._salvarListas({ obras: (this._equipe.obras || []).filter((o) => String(o) !== String(id)) });
  }

  adicionarMembro() {
    const id = this.shadowRoot.querySelector("#selMembro").value;
    if (!id) return;
    this._salvarListas({ membros: [...(this._equipe.membros || []), id] });
  }

  removerMembro(id) {
    this._salvarListas({ membros: (this._equipe.membros || []).filter((m) => String(m) !== String(id)) });
  }

  editarEquipe() {
    const form = document.createElement("equipe-form");
    form.equipe = this._equipe;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }
}

customElements.define("equipe-detail-view", EquipeDetailView);
