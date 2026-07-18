/**
 * <contato-detail-view> — Página de um contato (rota /contatos/:id).
 *
 * Cabeçalho + ui-tabs (conforme o cargo):
 *  - Obras (sempre): obras onde o contato participa.
 *  - Fornecedores (se vinculado a um fornecedor — Vendedor): dados do fornecedor.
 *  - Equipes (sempre): equipes onde o contato é líder ou membro (nova lógica).
 *  - Ofertas / Orçamentos.
 * Lê do data-store (cache-first). Espelha fornecedor-detail-view.
 */
import { rotuloVoltar } from "../../core/router.js";
import { irPara } from "../../core/router.js";
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda } from "../../core/formatters.js";
import { balancos } from "../despesas/despesa-split.js";
import { avatarNomeHtml, whatsappBtnHtml } from "../shared/avatar.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { colunasOferta } from "../orcamentos/orcamento-util.js";
import { abrirRegistrarDespesa } from "../cotacoes/cotacao-despesa-form.js";
import { abrirOferta } from "../cotacoes/preco-form.js";
import { montarGradeOrcamentos } from "../orcamentos/orcamento-grade.js";
import { montarGradeEquipes } from "../equipes/equipe-grade.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "../../components/ui-icon.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "./contato-form.js";
import "./google-contato-picker.js";

class ContatoDetailView extends BaseElement {
  constructor() {
    super();
    this._montado = false;
  }

  get contatoId() {
    return this.getAttribute("id");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .voltar { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--esp-2); color: var(--cor-primaria); font-size: var(--fs-md); font-weight: var(--peso-forte); text-decoration: none; }
      .voltar:hover { text-decoration: none; color: var(--cor-primaria-escura); }
      #conteudo { display: flex; flex-direction: column; gap: var(--esp-5); }
      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      .acoes-topo { display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; gap: var(--esp-2); flex-wrap: wrap; align-items: center; margin-top: var(--esp-1); }
    `;
  }

  template() {
    return `<div class="area"><div id="conteudo"><ui-spinner centro text="Carregando contato..."></ui-spinner></div></div>`;
  }

  _buscar() {
    return dataStore.contatosAtivos().find((c) => String(c.id) === String(this.contatoId)) || null;
  }

  aoConectar() {
    if (!this._buscar()) {
      this.$("#conteudo").innerHTML = `<p>Contato não encontrado. <a href="/contatos">Voltar</a></p>`;
      return;
    }
    this.montarConteudo();
    this.sincronizar();
    this.aoLimpar(dataStore.subscribe(() => this.sincronizar()));
  }

  montarConteudo() {
    const c = this._buscar();
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <a class="voltar" href="/contatos"><ui-icon name="seta-esquerda" size="18"></ui-icon><span>${rotuloVoltar("/contatos")}</span></a>
      <div class="topo" id="topo"></div>
      <ui-tabs id="abas">
        <div slot="obras">
          <ui-card mesa title="Mesa com obras vinculadas">
            <ui-data-table id="tabObras" fluido clicavel
              empty-text="Este contato não participa de nenhuma obra ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="fornecedores">
          <ui-card mesa title="Mesa com empresa vinculada">
            <ui-data-table id="tabForn" fluido clicavel
              empty-text="Sem empresa vinculada."></ui-data-table>
          </ui-card>
        </div>
        <div slot="equipes">
          <ui-card mesa title="Mesa com equipes do contato">
            <div id="gradeEquipes"></div>
          </ui-card>
        </div>
        <div slot="ofertas">
          <ui-card mesa title="Mesa com ofertas deste contato">
            <ui-data-table id="tabOfertas" fluido
              empty-text="Este contato não tem ofertas ainda."></ui-data-table>
          </ui-card>
        </div>
        <div slot="orcamentos">
          <ui-card mesa title="Mesa com orçamentos deste contato">
            <div id="gradeOrc"></div>
          </ui-card>
        </div>
        <div slot="vendas">
          <ui-card mesa title="Mesa com vendas — quanto este contato nos vendeu">
            <ui-data-table id="tabVendas" fluido clicavel
              empty-text="Este contato ainda não nos vendeu nada."></ui-data-table>
          </ui-card>
        </div>
        <div slot="dados">
          <ui-card mesa title="Mesa com dados — a receber e a pagar por obra">
            <ui-data-table id="tabDados" fluido clicavel
              empty-text="Sem valores a receber ou a pagar."></ui-data-table>
          </ui-card>
        </div>
      </ui-tabs>
    `;

    const abas = [{ id: "obras", rotulo: "Obras", icone: "obra" }];
    if (c.fornecedor_id) abas.push({ id: "fornecedores", rotulo: "Empresa", icone: "fornecedor" });
    abas.push({ id: "equipes", rotulo: "Equipes", icone: "usuario" });
    abas.push({ id: "ofertas", rotulo: "Ofertas", icone: "cifrao" });
    abas.push({ id: "orcamentos", rotulo: "Orçamentos", icone: "carteira" });
    abas.push({ id: "vendas", rotulo: "Vendas", icone: "cifrao" });
    abas.push({ id: "dados", rotulo: "Dados", icone: "grafico" });
    alvo.querySelector("#abas").abas = abas;

    this._tabObras = alvo.querySelector("#tabObras");
    this._tabObras.columns = [{ chave: "nome", titulo: "Obra" }];
    this._tabObras.addEventListener("linha", (e) => {
      irPara("/obras/" + e.detail.linha.id);
    });

    this._tabForn = alvo.querySelector("#tabForn");
    this._tabForn.columns = [
      { chave: "nome", titulo: "Empresa", formato: (v) => avatarNomeHtml(v) },
      { chave: "telefone", titulo: "", formato: (v) => whatsappBtnHtml(v), largura: "52px" },
      { chave: "telefone", titulo: "Telefone", formato: (v) => v || "—" },
      { chave: "email", titulo: "E-mail", formato: (v) => v || "—" },
      { chave: "cnpj", titulo: "CNPJ", formato: (v) => v || "—" },
    ];
    this._tabForn.addEventListener("linha", (e) => {
      irPara("/fornecedores/" + e.detail.linha.id);
    });

    this._gradeEquipes = alvo.querySelector("#gradeEquipes");

    // Ofertas: tabela PADRÃO; clique → banner único da oferta; ação "Registrar".
    this._tabOfertas = alvo.querySelector("#tabOfertas");
    this._tabOfertas.setAttribute("clicavel", "");
    this._tabOfertas.columns = colunasOferta();
    this._tabOfertas.acoes = [{ nome: "registrar", rotulo: "Registrar" }];
    this._tabOfertas.addEventListener("acao", (e) => {
      if (e.detail.acao === "registrar") abrirRegistrarDespesa(e.detail.linha);
    });
    this._tabOfertas.addEventListener("linha", (e) => abrirOferta(e.detail.linha));
    this._gradeOrc = alvo.querySelector("#gradeOrc");

    // Vendas: quanto ele nos vendeu, quebrado por EMPRESA representada (e como pessoa
    // física). Visão COMERCIAL — na venda por empresa quem recebe o dinheiro é a empresa,
    // por isso esses valores NÃO aparecem em "Recebido" na aba Dados.
    this._tabVendas = alvo.querySelector("#tabVendas");
    this._tabVendas.columns = [
      { chave: "_origem", titulo: "Vendeu por" },
      { chave: "_total", titulo: "Vendido", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Já pago", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      {
        chave: "_resto",
        titulo: "A pagar",
        alinhar: "dir",
        moeda: true,
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`),
      },
    ];
    this._tabVendas.addEventListener("linha", (e) => {
      const fid = e.detail.linha.id;
      if (fid) irPara("/fornecedores/" + fid); // linha da pessoa física não tem empresa
    });

    // Dados: Pago/Recebido + Saldo a pagar/Saldo a receber, por obra.
    this._tabDados = alvo.querySelector("#tabDados");
    this._tabDados.columns = [
      { chave: "_obra", titulo: "Obra" },
      { chave: "_pago", titulo: "Pago", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      {
        chave: "_pagar",
        titulo: "Saldo a pagar",
        alinhar: "dir",
        moeda: true,
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-erro)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`),
      },
      {
        chave: "_receber",
        titulo: "Saldo a receber",
        alinhar: "dir",
        moeda: true,
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`),
      },
    ];
    this._tabDados.addEventListener("linha", (e) => {
      irPara("/obras/" + e.detail.linha.id);
    });

    this._montado = true;
  }

  sincronizar() {
    if (!this._montado) return;
    const c = this._buscar();
    if (!c) {
      irPara("/contatos");
      return;
    }
    this._contato = c;

    // Obras onde o contato participa (chave c:<id> em participantesPorObra).
    const chave = "c:" + c.id;
    const obras = dataStore.obras().filter((o) =>
      dataStore.participantesDaObra(o.id).some((p) => p.chave === chave)
    );
    this._tabObras.rows = obras.map((o) => ({ id: o.id, nome: o.nome }));

    // Fornecedor vinculado.
    const forn = dataStore.fornecedores().find((f) => String(f.id) === String(c.fornecedor_id));
    this._tabForn.rows = forn ? [forn] : [];

    // Equipes onde este contato é líder ou membro (nova lógica; grade de cards).
    montarGradeEquipes(this._gradeEquipes, dataStore.equipesDoContato(c.id));

    // Ofertas deste contato (lista plana — inclui avulsas e de orçamento).
    this._tabOfertas.rows = dataStore
      .todasOfertas()
      .filter((p) => String(p.contato_id) === String(c.id));

    // Orçamentos onde este contato é o ofertante (grade de cards).
    montarGradeOrcamentos(
      this._gradeOrc,
      dataStore.orcamentos().filter((o) => String(o.contato_id) === String(c.id))
    );

    // Dados (por obra) + Vendas (por empresa representada) — UMA passada de `balancos`
    // por obra alimenta as duas abas.
    const dados = [];
    const porEmpresa = {}; // fid ("" = pessoa física) -> {total, recebido, saldoReceber}
    dataStore.obras().forEach((o) => {
      const { porChave, porRepresentante } = balancos(dataStore.despesas(o.id));
      const v = porChave[chave];
      if (v && (v.pago > 0.01 || v.recebido > 0.01 || v.saldoApagar > 0.01 || v.saldoReceber > 0.01)) {
        dados.push({ id: o.id, _obra: o.nome, _pago: v.pago, _recebido: v.recebido, _pagar: v.saldoApagar, _receber: v.saldoReceber });
      }
      const rep = porRepresentante[c.id];
      if (rep) {
        Object.keys(rep.empresas).forEach((fid) => {
          const e = rep.empresas[fid];
          const acc = (porEmpresa[fid] = porEmpresa[fid] || { total: 0, recebido: 0, saldoReceber: 0 });
          acc.total += e.total;
          acc.recebido += e.recebido;
          acc.saldoReceber += e.saldoReceber;
        });
      }
    });
    this._tabDados.rows = dados;
    this._tabVendas.rows = Object.keys(porEmpresa)
      .map((fid) => ({
        id: fid, // "" = venda direta (sem empresa) → linha não navega
        _origem: fid
          ? (dataStore.fornecedores().find((f) => String(f.id) === String(fid)) || {}).nome || "—"
          : "Conta própria (pessoa física)",
        _total: porEmpresa[fid].total,
        _recebido: porEmpresa[fid].recebido,
        _resto: porEmpresa[fid].saldoReceber,
      }))
      .filter((r) => r._total > 0.01)
      .sort((a, b) => b._total - a._total);

    this.pintarTopo();
  }

  pintarTopo() {
    const topo = this.shadowRoot.querySelector("#topo");
    if (!topo) return;
    const c = this._contato;
    const partes = [];
    if (c.telefone) partes.push(c.telefone);
    if (c.email) partes.push(c.email);
    topo.innerHTML = `
      <div>
        <h1>${c.nome || ""}</h1>
        <div class="meta">
          ${c.cargo ? `<category-badge nome="${c.cargo}" cor="var(--cor-primaria)"></category-badge>` : ""}
          ${partes.length ? `<span>${partes.join(" · ")}</span>` : ""}
          ${c.google_resource_id ? `<span style="font-size:var(--fs-xs);color:var(--cor-sucesso)">● Vinculado ao Google</span>` : ""}
        </div>
      </div>
      <div class="acoes-topo">
        ${whatsappBtnHtml(c.telefone, 42)}
        <ui-button id="editar" variant="secundario">Editar contato</ui-button>
        ${this._googleAcoesHtml(c)}
      </div>
    `;
    topo.querySelector("#editar").addEventListener("click", () => this.editar());
    this._ligarGoogleAcoes(topo, c);
  }

  /* --------------------------- Google Contacts ------------------------- */

  _googleAcoesHtml(c) {
    if (!dataStore.config().google_conectado) return "";
    if (c.google_resource_id) {
      return `
        <ui-button id="gEnviar" variant="secundario" tamanho="sm">Atualizar no Google</ui-button>
        <ui-button id="gAbrir" variant="secundario" tamanho="sm">Abrir no Google</ui-button>
        <ui-button id="gDesvincular" variant="perigo-contorno" tamanho="sm">Desvincular</ui-button>`;
    }
    return `
      <ui-button id="gVincular" variant="secundario" tamanho="sm">Vincular ao Google</ui-button>
      <ui-button id="gEnviar" variant="secundario" tamanho="sm">Enviar ao Google</ui-button>`;
  }

  _ligarGoogleAcoes(topo, c) {
    const enviar = topo.querySelector("#gEnviar");
    if (enviar) enviar.addEventListener("click", async () => {
      try { await dataStore.enviarGoogle("contato", c.id); toastSucesso("Contato enviado ao Google."); }
      catch (e) { notificarErro(e); }
    });
    const vincular = topo.querySelector("#gVincular");
    if (vincular) vincular.addEventListener("click", () => this._vincularGoogle(c));
    const desvincular = topo.querySelector("#gDesvincular");
    if (desvincular) desvincular.addEventListener("click", async () => {
      try { await dataStore.desvincularGoogle("contato", c.id); toastSucesso("Vínculo com o Google removido."); }
      catch (e) { notificarErro(e); }
    });
    const abrir = topo.querySelector("#gAbrir");
    if (abrir) abrir.addEventListener("click", () => {
      const id = String(c.google_resource_id || "").replace("people/", "");
      if (id) window.open("https://contacts.google.com/person/" + encodeURIComponent(id), "_blank", "noopener");
    });
  }

  _vincularGoogle(c) {
    const picker = document.createElement("google-contato-picker");
    picker.titulo = "Vincular a um contato do Google";
    picker.addEventListener("fechar", () => picker.remove());
    picker.addEventListener("escolher", async (e) => {
      const g = e.detail && e.detail.contato;
      if (!g) return;
      try { await dataStore.vincularGoogle("contato", c.id, g.resourceName); toastSucesso("Contato vinculado ao Google."); }
      catch (err) { notificarErro(err); }
    });
    document.body.appendChild(picker);
  }

  editar() {
    const form = document.createElement("contato-form");
    form.contato = this._contato;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }
}

customElements.define("contato-detail-view", ContatoDetailView);
