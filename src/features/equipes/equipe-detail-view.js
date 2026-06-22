/**
 * <equipe-detail-view> — Página de uma equipe (rota /equipes/:id).
 *
 * Cabeçalho (nome + líder) + `ui-tabs` **Obras / Membros / Dados**. Cada aba é um
 * `ui-card` + `ui-data-table` (padrão do sistema): o botão "+" fica no `slot="acoes"`
 * do card e abre um **banner flutuante** (`ui-modal` + `ui-select`, composto inline —
 * sem componente novo) para vincular obra / adicionar membro. Lê do data-store
 * (cache-first) e assina mudanças. Reusa ui-tabs/ui-card/ui-data-table/ui-modal/ui-select/ui-button.
 */
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { parseLista, totalRealizado, restoDespesa } from "../despesas/despesa-split.js";
import { liderNome } from "./equipe-util.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-select.js";
import "../../components/ui-modal.js";
import "../../components/ui-tabs.js";
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
      .voltar { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--esp-1); color: var(--cor-primaria); font-size: var(--fs-sm); font-weight: var(--peso-semi); }
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; margin-top: var(--esp-1); }
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
      this.$("#conteudo").innerHTML = `<p>Equipe não encontrada. <a href="/contatos">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  montarConteudo() {
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="/contatos">← Contatos</a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="obras">
          <ui-card title="Obras vinculadas">
            <ui-button slot="acoes" id="addObra">+ Vincular obra</ui-button>
            <ui-data-table id="tabObras" fluido clicavel
              empty-text="Nenhuma obra vinculada ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="membros">
          <ui-card title="Membros">
            <ui-button slot="acoes" id="addMembro">+ Adicionar membro</ui-button>
            <ui-data-table id="tabMembros" fluido clicavel
              empty-text="Nenhum membro ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="dados">
          <ui-card title="Dados — recebimentos da equipe">
            <ui-data-table id="tabDados" fluido clicavel
              empty-text="Nenhuma despesa vinculada a esta equipe ainda."></ui-data-table>
          </ui-card>
        </div>
      </ui-tabs>
    `;
    alvo.querySelector("#abas").abas = [
      { id: "obras", rotulo: "Obras", icone: "obra" },
      { id: "membros", rotulo: "Membros", icone: "usuario" },
      { id: "dados", rotulo: "Dados", icone: "grafico" },
    ];

    this._tabObras = alvo.querySelector("#tabObras");
    this._tabObras.columns = [{ chave: "_nome", titulo: "Obra" }];
    this._tabObras.acoes = [{ nome: "remover", rotulo: "Remover", variant: "perigo" }];
    this._tabObras.addEventListener("linha", (e) => {
      irPara("/obras/" + e.detail.linha.id);
    });
    this._tabObras.addEventListener("acao", (e) => this.removerObra(e.detail.linha.id));

    this._tabMembros = alvo.querySelector("#tabMembros");
    this._tabMembros.columns = [
      { chave: "_nome", titulo: "Contato" },
      { chave: "_cargo", titulo: "Cargo", formato: (v) => v || "—" },
    ];
    this._tabMembros.acoes = [{ nome: "remover", rotulo: "Remover", variant: "perigo" }];
    this._tabMembros.addEventListener("linha", (e) => {
      irPara("/contatos/" + e.detail.linha.id);
    });
    this._tabMembros.addEventListener("acao", (e) => this.removerMembro(e.detail.linha.id));

    this._tabDados = alvo.querySelector("#tabDados");
    this._tabDados.columns = [
      { chave: "_data", titulo: "Data", formato: (v) => fmtData(v) },
      { chave: "_obra", titulo: "Obra" },
      { chave: "_item", titulo: "Item", largura: "180px" },
      { chave: "_pagou", titulo: "Quem pagou" },
      {
        chave: "_dataPgto",
        titulo: "Data do pagamento",
        formato: (v) => (v && v.length ? v.map((d) => fmtData(d)).join(" · ") : `<span style="color:var(--cor-texto-fraco)">—</span>`),
      },
      { chave: "_pago", titulo: "Pago", alinhar: "dir", formato: (v) => moeda(v) },
      {
        chave: "_resto",
        titulo: "Saldo a receber",
        alinhar: "dir",
        formato: (v) =>
          v > 0.01
            ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    this._tabDados.addEventListener("linha", (e) => {
      if (e.detail.linha.id) irPara("/obras/" + e.detail.linha.id);
    });

    alvo.querySelector("#addObra").addEventListener("click", () => this.adicionarObra());
    alvo.querySelector("#addMembro").addEventListener("click", () => this.adicionarMembro());

    this._montado = true;
  }

  /**
   * Dados da equipe: uma linha por despesa vinculada à equipe (ofertante = equipe),
   * com obra, item, quem pagou + datas dos pagamentos (levas), pago e saldo a receber.
   */
  montarDados(eq) {
    const despesasEq = dataStore
      .todasDespesas()
      .filter((d) => String(d.ofertante_equipe_id) === String(eq.id));
    this._tabDados.rows = despesasEq
      .map((d) => {
        const levas = parseLista(d.pagamentos_realizados);
        const nomePart = {};
        dataStore.participantesDaObra(d.obra_id).forEach((p) => (nomePart[p.chave] = p.nome));
        const pagadores = [...new Set(levas.map((l) => nomePart[l.pagador]).filter(Boolean))];
        return {
          id: d.obra_id, // clique → abre a obra
          _data: d.data,
          _obra: (dataStore.obra(d.obra_id) || {}).nome || "—",
          _item: (d.item_id && (dataStore.item(d.item_id) || {}).nome) || d.item || "—",
          _pagou: pagadores.length ? pagadores.join(" · ") : "—",
          _dataPgto: levas.map((l) => l.data).filter(Boolean),
          _pago: totalRealizado(d),
          _resto: restoDespesa(d),
        };
      })
      .sort((a, b) => String(b._data).localeCompare(String(a._data)));
  }

  sincronizar() {
    if (!this._montado) return;
    const e = this._buscar();
    if (!e) {
      irPara("/contatos");
      return;
    }
    this._equipe = e;

    this._tabObras.rows = (e.obras || []).map((id) => ({ id, _nome: (dataStore.obra(id) || {}).nome || "—" }));
    this._tabMembros.rows = (e.membros || []).map((id) => {
      const c = dataStore.contatos().find((x) => String(x.id) === String(id)) || {};
      return { id, _nome: c.nome || "—", _cargo: c.cargo || "—" };
    });

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

  /**
   * Banner flutuante (ui-modal + ui-select, composto inline — sem componente novo)
   * para escolher 1 item de uma lista e confirmar. Mesmo padrão dos demais "+".
   */
  _abrirSelecao({ titulo, label, placeholder, vazio, opcoes, rotuloOk, aoConfirmar }) {
    const modal = document.createElement("ui-modal");
    modal.setAttribute("open", "");
    modal.setAttribute("title", titulo);
    modal.innerHTML = `
      <ui-select id="sel" label="${label}"></ui-select>
      <div slot="rodape">
        <ui-button id="cancelar" variant="secundario">Cancelar</ui-button>
        <ui-button id="ok">${rotuloOk}</ui-button>
      </div>`;
    document.body.appendChild(modal);
    const sel = modal.querySelector("#sel");
    sel.setAttribute("placeholder", opcoes.length ? placeholder : vazio);
    sel.options = opcoes;
    const fechar = () => modal.remove();
    modal.addEventListener("fechar", fechar);
    modal.querySelector("#cancelar").addEventListener("click", fechar);
    modal.querySelector("#ok").addEventListener("click", async () => {
      const v = sel.value;
      if (!v) {
        sel.setAttribute("error", "Selecione uma opção.");
        return;
      }
      const btn = modal.querySelector("#ok");
      btn.setAttribute("loading", "");
      try {
        await aoConfirmar(v);
        fechar();
      } catch (e) {
        notificarErro(e);
        btn.removeAttribute("loading");
      }
    });
  }

  adicionarObra() {
    const usadas = new Set((this._equipe.obras || []).map(String));
    const disp = dataStore.obras().filter((o) => !usadas.has(String(o.id)));
    this._abrirSelecao({
      titulo: "Vincular obra",
      label: "Obra",
      placeholder: "Selecione a obra",
      vazio: "Todas as obras já vinculadas",
      opcoes: disp.map((o) => ({ value: o.id, label: o.nome })),
      rotuloOk: "Vincular",
      aoConfirmar: async (id) => {
        await dataStore.atualizarEquipe(this._equipe.id, { obras: [...(this._equipe.obras || []), id] });
        toastSucesso("Obra vinculada.");
      },
    });
  }

  removerObra(id) {
    this._salvarListas({ obras: (this._equipe.obras || []).filter((o) => String(o) !== String(id)) });
  }

  adicionarMembro() {
    const usados = new Set((this._equipe.membros || []).map(String));
    const disp = dataStore
      .contatosAtivos()
      .filter((c) => !usados.has(String(c.id)) && String(c.id) !== String(this._equipe.lider_id));
    this._abrirSelecao({
      titulo: "Adicionar membro",
      label: "Contato",
      placeholder: "Selecione o contato",
      vazio: "Nenhum contato disponível",
      opcoes: disp.map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} — ${c.cargo}` : c.nome })),
      rotuloOk: "Adicionar",
      aoConfirmar: async (id) => {
        await dataStore.atualizarEquipe(this._equipe.id, { membros: [...(this._equipe.membros || []), id] });
        toastSucesso("Membro adicionado.");
      },
    });
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
