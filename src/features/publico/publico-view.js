/**
 * <publico-view> — Visão SOMENTE LEITURA de uma obra via link público.
 *
 * Rota: /publico/:token (sem login) — ou modo GRUPO (montada por <publico-grupo-view>
 * com grupo-token + obra-id). Mostra a obra INTEIRA com TODAS as abas, usando os
 * MESMOS componentes internos da tela autenticada (despesa-table, orçamento, equipe,
 * participantes, estoque, notas, agenda, gráficos, transferências) — sem réplicas.
 *
 * Como: HIDRATA o data-store singleton com o snapshot público da obra
 * (`dataStore.hidratarPublico`, que liga `somenteLeitura`) e monta os componentes de
 * domínio, que resolvem tudo pelo store como na obra interna. O modo somente-leitura
 * (global) esconde toda ação de editar/criar/excluir e navegação para rotas protegidas.
 * A visão é a CASCA (não reusa obra-detail-view, o "coração"): monta os componentes
 * reais em vez de tabelas na mão. `hidratarPublico` NÃO persiste (o cache do usuário
 * logado, se houver, fica intacto e é restaurado ao sair — ver `aoConectar`).
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { balancos } from "../despesas/despesa-split.js";
import { corDeId } from "../shared/cor-id.js";
import { abrirOrigemGrafico } from "../shared/vinculos.js";
import { COR_CLASSIFICACAO } from "../../core/classificacao.js";
import { montarGradeOrcamentos } from "../orcamentos/orcamento-grade.js";
import { montarGradeEquipes } from "../equipes/equipe-grade.js";
import "../orcamentos/orcamento-detail-view.js";
import "../equipes/equipe-detail-view.js";
import {
  montarGradeResumos,
  previaTransferenciaHtml,
  previaPagamentoHtml,
  abrirTransferencia,
  abrirPagamento,
} from "../pagamentos/pagamento-util.js";
import "../../components/ui-card.js";
import "../../components/ui-icon.js";
import "../../components/ui-spinner.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../../components/ui-button.js";
import "../../components/ui-modal.js";
import "../../components/ui-alert.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../dashboard/grafico-rosca.js";
import "../dashboard/grafico-mensal.js";
import "../despesas/despesa-table.js";
import "../despesas/despesa-detail.js";
import "../despesas/category-badge.js";
import "../obras/obra-participantes.js";
import "../obras/obra-empresas.js";
import "../obras/obra-agenda.js";
import "../obras/obra-notas.js";

const nf3 = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString("pt-BR");

class PublicoView extends BaseElement {
  get token() {
    return this.getAttribute("token");
  }

  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      .meta { color: var(--cor-texto-suave); font-size: var(--fs-sm);
        display: flex; align-items: center; gap: var(--esp-1); }
      .selo { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
        font-size: var(--fs-sm); color: var(--cor-texto-suave);
        border: 1px solid var(--cor-borda-forte); border-radius: var(--raio-completo);
        padding: 4px 12px; }
      /* Gráficos: MESMA grade de 3 colunas da obra interna. */
      .graficos { display: grid; gap: var(--esp-5); grid-template-columns: repeat(3, 1fr); }
      .graficos > * { min-width: 0; height: 340px; }
      @media (max-width: 900px) {
        .graficos { grid-template-columns: 1fr; }
        .graficos > * { height: auto; min-height: 300px; }
      }
    `;
  }

  template() {
    return `<div class="area" id="conteudo"><ui-spinner centro text="Carregando..."></ui-spinner></div>`;
  }

  aoConectar() {
    this._ligado = true;
    // Se sair da visão pública e havia uma sessão AUTENTICADA carregada, restaura o
    // cache do usuário (o link hidratou o store singleton em modo somente-leitura;
    // `hidratarPublico` não persiste → o localStorage do usuário está intacto).
    this.aoLimpar(() => { if (this._eraAutenticado) dataStore.restaurarCache(); });
    // Payload já buscado (link de grupo com prefetch/cache) → renderiza SEM refazer a chamada.
    if (this._injetado) this.pintar(this._injetado);
    else this.carregar();
  }

  /** Renderiza a partir de um payload JÁ carregado (evita recarregar ao trocar de obra no grupo). */
  mostrar(d) {
    this._injetado = d;
    if (this._ligado) this.pintar(d);
  }

  async carregar() {
    const alvo = this.$("#conteudo");
    try {
      // Modo GRUPO: quando montado por <publico-grupo-view> com grupo-token + obra-id,
      // busca a obra escolhida via o link do grupo (sem exigir link próprio da obra).
      const grupoToken = this.getAttribute("grupo-token");
      const obraId = this.getAttribute("obra-id");
      const d = grupoToken && obraId
        ? await api.call("publico.grupoObra", { token: grupoToken, obra_id: obraId })
        : await api.call("publico.obra", { token: this.token });
      this.pintar(d);
    } catch (e) {
      alvo.innerHTML = `<ui-card title="Link indisponível"><p>${
        e.message || "Este link não está mais válido."
      }</p></ui-card>`;
    }
  }

  /* ------------------------------- Render ------------------------------- */

  pintar(d) {
    // Preserva a sessão autenticada (se houver) p/ restaurar ao sair; então hidrata o
    // store com a obra pública (liga `somenteLeitura` → os componentes viram display-only).
    this._eraAutenticado = this._eraAutenticado || (dataStore.carregado() && !dataStore.somenteLeitura() && !!dataStore.usuario());
    dataStore.hidratarPublico(d);

    const o = d.obra || {};
    const obraId = o.id;
    this._obraId = obraId;
    this._payload = d; // guarda p/ o "Voltar" do detalhe de orçamento/equipe

    this.$("#conteudo").innerHTML = `
      <div>
        <h1>${o.nome || "Obra"}</h1>
        <div class="meta">${
          o.endereco ? `<ui-icon name="local" size="14"></ui-icon> ${o.endereco}` : ""
        }${o.descricao ? (o.endereco ? " · " : "") + o.descricao : ""}</div>
      </div>
      <span class="selo"><ui-icon name="olho" size="14"></ui-icon> Somente leitura — link compartilhado</span>
      <dashboard-summary id="dash"></dashboard-summary>
      <ui-tabs id="abas">
        <div slot="graficos" class="graficos">
          <ui-card><category-breakdown id="break" titulo="Gastos por categoria"></category-breakdown></ui-card>
          <ui-card><grafico-rosca id="rosca" titulo="Distribuição por classificação"></grafico-rosca></ui-card>
          <ui-card><grafico-mensal id="mensal"></grafico-mensal></ui-card>
          <ui-card><category-breakdown id="gOfertante" titulo="Por ofertante" vazio="Nenhum ofertante com vendas."></category-breakdown></ui-card>
          <ui-card><category-breakdown id="gEmp" titulo="Total por empresa" vazio="Nenhuma empresa com despesas."></category-breakdown></ui-card>
          <ui-card><category-breakdown id="gEst" titulo="Quantidade em estoque por item" vazio="Nenhum item em estoque."></category-breakdown></ui-card>
        </div>
        <div slot="despesas">
          <ui-card mesa title="Mesa com despesas da obra">
            <despesa-table id="tabela"></despesa-table>
          </ui-card>
        </div>
        <div slot="participantes">
          <obra-participantes obra-id="${obraId}"></obra-participantes>
        </div>
        <div slot="responsaveis">
          <obra-participantes obra-id="${obraId}" modo="responsaveis"></obra-participantes>
        </div>
        <div slot="orcamentos">
          <ui-card mesa title="Mesa com orçamentos da obra"><div id="gradeOrc"></div></ui-card>
        </div>
        <div slot="equipes">
          <ui-card mesa title="Mesa com equipes da obra"><div id="gradeEquipes"></div></ui-card>
        </div>
        <div slot="fornecedores">
          <obra-empresas obra-id="${obraId}"></obra-empresas>
        </div>
        <div slot="pagamentos">
          <ui-tabs id="abasPag">
            <div slot="transferencias">
              <ui-card mesa title="Mesa com transferências da obra"><div id="listaTransf"></div></ui-card>
            </div>
            <div slot="pagamentos">
              <ui-card mesa title="Mesa com pagamentos da obra"><div id="listaPagTransf"></div></ui-card>
            </div>
          </ui-tabs>
        </div>
        <div slot="estoque">
          <ui-tabs id="abasEstoque">
            <div slot="emEstoque">
              <ui-card mesa title="Mesa com itens em estoque">
                <ui-data-table id="tabEstoque" fluido
                  empty-text="Nenhum item em estoque."></ui-data-table>
              </ui-card>
            </div>
            <div slot="consumidos">
              <ui-card mesa title="Mesa com itens consumidos">
                <ui-data-table id="tabConsumido" fluido
                  empty-text="Nenhum item consumido nesta obra."></ui-data-table>
              </ui-card>
            </div>
          </ui-tabs>
        </div>
        <div slot="agenda">
          <obra-agenda obra-id="${obraId}"></obra-agenda>
        </div>
        <div slot="notas">
          <obra-notas obra-id="${obraId}"></obra-notas>
        </div>
      </ui-tabs>
    `;

    this.$("#abas").abas = [
      { id: "graficos", rotulo: "Gráficos", icone: "grafico" },
      { id: "despesas", rotulo: "Despesas", icone: "recibo" },
      { id: "participantes", rotulo: "Participantes", icone: "usuario" },
      { id: "responsaveis", rotulo: "Responsáveis", icone: "seguranca" },
      { id: "orcamentos", rotulo: "Orçamentos", icone: "carteira" },
      { id: "equipes", rotulo: "Equipes", icone: "usuario" },
      { id: "fornecedores", rotulo: "Empresas", icone: "fornecedor" },
      { id: "pagamentos", rotulo: "Transferências e pagamentos", icone: "cifrao" },
      { id: "estoque", rotulo: "Estoque", icone: "tag" },
      { id: "agenda", rotulo: "Agenda", icone: "relogio" },
      { id: "notas", rotulo: "Notas", icone: "recibo" },
    ];
    const abasPag = this.$("#abasPag");
    if (abasPag)
      abasPag.abas = [
        { id: "transferencias", rotulo: "Transferências", icone: "cifrao" },
        { id: "pagamentos", rotulo: "Pagamentos", icone: "recibo" },
      ];
    const abasEstoque = this.$("#abasEstoque");
    if (abasEstoque)
      abasEstoque.abas = [
        { id: "emEstoque", rotulo: "Estoque", icone: "tag" },
        { id: "consumidos", rotulo: "Consumidos", icone: "recibo" },
      ];

    // --- Alimenta os componentes a partir do store hidratado (espelha o `sincronizar`
    //     da obra interna). Como é somente-leitura, o store não muda → pintar 1× basta. ---
    const categorias = dataStore.categoriasDaObra(obraId).filter((c) => String(c.tipo || "") !== "fornecedor");
    const resumo = dataStore.resumo(obraId);
    const despesas = dataStore.despesas(obraId);
    this._despesas = despesas;

    const S = (rotulo, fn) => {
      try { fn(); } catch (e) { console.error("[publico-view] falha ao montar " + rotulo, e); }
    };

    S("dashboard", () => (this.$("#dash").resumo = resumo));
    S("gráfico por categoria", () => {
      const g = this.$("#break");
      g.aoSelecionar = (c) => this._origemCategoria(c);
      g.porCategoria = resumo.por_subclassificacao || resumo.por_categoria || [];
    });
    S("gráfico por classificação", () => {
      const g = this.$("#rosca");
      g.aoSelecionar = (c) => this._origemClassificacao(c);
      g.porCategoria = resumo.por_classificacao || [];
    });
    S("gráfico mensal", () => {
      const g = this.$("#mensal");
      g.aoSelecionar = (c) => this._origemMes(c);
      g.despesas = despesas;
    });
    S("tabela de despesas", () => {
      const tabela = this.$("#tabela");
      tabela.categorias = categorias;
      tabela.participantes = dataStore.participantesDaObra(obraId);
      tabela.despesas = despesas;
      // Clicar numa despesa abre o MESMO banner da tela interna (despesa-detail),
      // em modo somente-leitura (item 2 do pedido).
      tabela.addEventListener("abrir", (e) => this._abrirDespesa(e.detail.despesa));
    });
    S("grade de orçamentos", () => {
      montarGradeOrcamentos(this.$("#gradeOrc"), dataStore.orcamentos().filter((x) => String(x.obra_id) === String(obraId)));
      // Clicar num card abre o DETALHE interno (orcamento-detail-view) read-only + Voltar.
      // O card emite "abrir" (borbulha) mesmo em somente-leitura; a navegação p/ rota
      // protegida foi gated na grade, então tratamos aqui.
      this.$("#gradeOrc").addEventListener("abrir", (e) => this._abrirDetalhe("orcamento-detail-view", (e.detail.orcamento || {}).id));
    });
    S("grade de equipes", () => {
      montarGradeEquipes(this.$("#gradeEquipes"), dataStore.equipesDaObra(obraId));
      this.$("#gradeEquipes").addEventListener("abrir", (e) => this._abrirDetalhe("equipe-detail-view", (e.detail.equipe || {}).id));
    });
    S("gráficos extras", () => this._montarGraficosExtras(despesas));
    S("transferências", () =>
      montarGradeResumos(this.$("#listaTransf"), dataStore.transferenciasDaObra(obraId), "transf", previaTransferenciaHtml, abrirTransferencia, "Nenhuma transferência registrada nesta obra.")
    );
    S("pagamentos", () =>
      montarGradeResumos(this.$("#listaPagTransf"), dataStore.pagamentosDaObra(obraId), "pag", previaPagamentoHtml, abrirPagamento, "Nenhum pagamento registrado nesta obra.")
    );
    S("estoque", () => this._montarEstoque(categorias));
  }

  /* ------------------------------ Estoque ------------------------------- */

  /** Tabelas Estoque e Consumidos (consolidação derivada) — display-only (sem ações). */
  _montarEstoque(categorias) {
    const tabEstoque = this.$("#tabEstoque");
    const tabConsumido = this.$("#tabConsumido");
    if (!tabEstoque || !tabConsumido) return;
    const mapaCat = {};
    (categorias || []).forEach((c) => (mapaCat[String(c.id)] = c));

    const nomeItem = (it) => (dataStore.item(it.item_id) || {}).nome || "—";
    const subBadge = (it) => {
      const c = mapaCat[String(it.categoria_id)];
      return c
        ? `<category-badge nome="${c.nome}" cor="${c.cor || "var(--cor-neutro)"}"></category-badge>`
        : `<span style="color:var(--cor-texto-fraco)">Sem categoria</span>`;
    };
    const classBadge = (it) =>
      it.classificacao
        ? `<category-badge nome="${it.classificacao}" cor="${COR_CLASSIFICACAO[it.classificacao] || "var(--cor-neutro)"}"></category-badge>`
        : "—";
    const unidade = (it) =>
      (it.unidade || "—") + (it.unidades && it.unidades.length > 1 ? ` <span title="Unidades divergentes: ${it.unidades.join(", ")}" style="color:var(--cor-aviso)">⚠</span>` : "");

    const colunas = (chaveQtd, tituloQtd) => [
      { chave: "_item", titulo: "Item" },
      { chave: "_class", titulo: "Classificação", formato: (v, l) => classBadge(l) },
      { chave: "_sub", titulo: "Categoria", formato: (v, l) => subBadge(l) },
      { chave: "unidade", titulo: "Unidade", formato: (v, l) => unidade(l) },
      { chave: chaveQtd, titulo: tituloQtd, alinhar: "dir", formato: (v) => `<strong>${nf3(v)}</strong>` },
    ];
    const linha = (it) => Object.assign({}, it, { _item: nomeItem(it) });

    tabEstoque.columns = colunas("em_estoque", "Em estoque");
    tabEstoque.rows = dataStore.estoqueDaObra(this._obraId).map(linha).sort((a, b) => String(a._item).localeCompare(String(b._item)));
    tabConsumido.columns = colunas("consumido", "Consumido");
    tabConsumido.rows = dataStore.estoqueConsumidoDaObra(this._obraId).map(linha).sort((a, b) => String(a._item).localeCompare(String(b._item)));
  }

  /* ------------------------- Gráficos extras ---------------------------- */

  /** Nome ao vivo de uma CHAVE de participante ("c:"/"e:"/"u:") p/ o gráfico de ofertante. */
  _nomeDaChave(ch) {
    const s = String(ch || "");
    if (s.indexOf("c:") === 0) return (dataStore.contatos().find((x) => String(x.id) === s.slice(2)) || {}).nome || "Contato";
    if (s.indexOf("e:") === 0) return (dataStore.equipes().find((x) => String(x.id) === s.slice(2)) || {}).nome || "Grupo";
    if (s.indexOf("u:") === 0) return dataStore.usuarioNome(s.slice(2)) || "Usuário";
    return "—";
  }

  /** Alimenta Ofertante / Empresa / Estoque (mesmos componentes de barras da obra interna). */
  _montarGraficosExtras(despesas) {
    const { porFornecedor, porOfertante } = balancos(despesas);

    const gOfertante = this.$("#gOfertante");
    if (gOfertante) {
      gOfertante.aoSelecionar = (c) => this._origemOfertante(c);
      gOfertante.porCategoria = Object.keys(porOfertante)
        .map((ch) => ({ nome: this._nomeDaChave(ch), cor: corDeId(ch), total: Number(porOfertante[ch]) || 0, chave: ch }))
        .filter((x) => x.total > 0.01)
        .sort((a, b) => b.total - a.total);
    }

    const gEmp = this.$("#gEmp");
    if (gEmp) {
      gEmp.aoSelecionar = (c) => this._origemEmpresa(c);
      gEmp.porCategoria = Object.keys(porFornecedor)
        .map((fid) => ({
          nome: (dataStore.fornecedores().find((f) => String(f.id) === String(fid)) || {}).nome || "—",
          cor: corDeId(fid),
          total: Number(porFornecedor[fid].total) || 0,
          fornecedor_id: fid,
        }))
        .filter((x) => x.total > 0.01)
        .sort((a, b) => b.total - a.total);
    }

    const gEst = this.$("#gEst");
    if (gEst) {
      gEst.aoSelecionar = (c) => this._origemEstoqueItem(c);
      gEst.formato = (c) => nf3(c.total) + (c.unidade ? " " + c.unidade : "");
      gEst.porCategoria = dataStore
        .estoqueDaObra(this._obraId)
        .map((it) => ({
          nome: (dataStore.item(it.item_id) || {}).nome || "—",
          cor: corDeId(it.item_id),
          total: Number(it.em_estoque) || 0,
          unidade: it.unidade || "",
          item_id: it.item_id,
        }))
        .filter((x) => x.total > 0.0001)
        .sort((a, b) => b.total - a.total);
    }
  }

  /* --------------------- Origem dos gráficos (read-only) ----------------- */

  /** Banner de origem de um gráfico: mostra as despesas no MESMO componente padrão
   *  (`despesa-table`) da aba Despesas — clicar numa linha abre o `despesa-detail`
   *  read-only (mesmo da tela interna). Responsivo (tabela desktop / cards mobile). */
  _bannerDespesas(titulo, descricao, despesas) {
    const modal = document.createElement("ui-modal");
    modal.setAttribute("open", "");
    modal.setAttribute("title", "Origem · " + (titulo || ""));
    const corpo = document.createElement("div");
    if (descricao) {
      const alerta = document.createElement("ui-alert");
      alerta.setAttribute("tipo", "info");
      alerta.style.cssText = "display:block;margin-bottom:var(--esp-3)";
      alerta.mensagem = descricao;
      corpo.appendChild(alerta);
    }
    const tabela = document.createElement("despesa-table");
    corpo.appendChild(tabela);
    modal.appendChild(corpo);
    const rod = document.createElement("div");
    rod.setAttribute("slot", "rodape");
    const btn = document.createElement("ui-button");
    btn.textContent = "Fechar";
    btn.addEventListener("click", () => modal.remove());
    rod.appendChild(btn);
    modal.appendChild(rod);
    modal.addEventListener("fechar", () => modal.remove());
    document.body.appendChild(modal);
    // Alimenta o MESMO componente padrão de despesa (display-only via store + somenteLeitura).
    tabela.categorias = dataStore.categoriasDaObra(this._obraId).filter((c) => String(c.tipo || "") !== "fornecedor");
    tabela.participantes = dataStore.participantesDaObra(this._obraId);
    tabela.despesas = despesas || [];
    tabela.addEventListener("abrir", (e) => { modal.remove(); this._abrirDespesa(e.detail.despesa); });
  }

  /** Troca o conteúdo pelo DETALHE interno (orcamento-detail-view / equipe-detail-view)
   *  em somente-leitura + botão "Voltar" (reusa os MESMOS componentes internos). */
  _abrirDetalhe(tag, id) {
    if (!id) return;
    const alvo = this.$("#conteudo");
    alvo.innerHTML = `
      <ui-button id="voltarDet" variant="secundario"><ui-icon name="seta-esquerda" size="16"></ui-icon> Voltar</ui-button>
      <div id="detalhe"></div>`;
    this.$("#voltarDet").addEventListener("click", () => this.pintar(this._payload));
    const el = document.createElement(tag);
    el.setAttribute("id", id);
    this.$("#detalhe").appendChild(el);
  }

  /** Abre o banner da despesa (mesmo `despesa-detail` da tela interna, read-only). */
  _abrirDespesa(despesa) {
    if (!despesa) return;
    document.querySelectorAll("despesa-detail").forEach((b) => b.remove());
    const banner = document.createElement("despesa-detail");
    banner.despesa = despesa;
    banner.categorias = dataStore.categoriasDaObra(this._obraId).filter((c) => String(c.tipo || "") !== "fornecedor");
    banner.addEventListener("fechar", () => banner.remove());
    document.body.appendChild(banner);
  }

  _origemCategoria(c) {
    const ds = (this._despesas || []).filter((d) => String(d.categoria_id) === String(c.categoria_id));
    this._bannerDespesas("Categoria · " + c.nome, "Despesas desta categoria.", ds);
  }
  _origemClassificacao(c) {
    const alvo = c.nome === "Sem classificação" ? "" : c.nome;
    const ds = (this._despesas || []).filter((d) => String(d.classificacao || "") === String(alvo));
    this._bannerDespesas("Classificação · " + c.nome, "Despesas desta classificação.", ds);
  }
  _origemMes(c) {
    const ds = (this._despesas || []).filter((d) => String(d.data || "").startsWith(c.mes));
    this._bannerDespesas("Mês · " + (c.rotulo || c.mes), "Despesas deste mês.", ds);
  }
  _origemEmpresa(c) {
    const ds = (this._despesas || []).filter((d) => String(d.fornecedor_id) === String(c.fornecedor_id));
    this._bannerDespesas("Empresa · " + c.nome, "Despesas desta empresa.", ds);
  }
  _origemOfertante(c) {
    const ds = (this._despesas || []).filter((d) => {
      const k = d.ofertante_contato_id ? "c:" + d.ofertante_contato_id : (d.ofertante_equipe_id ? "e:" + d.ofertante_equipe_id : "");
      return k === c.chave;
    });
    this._bannerDespesas("Ofertante · " + c.nome, "Despesas ofertadas/vendidas por este ofertante.", ds);
  }
  /** Estoque: movimentos do item (read-only; sem navegar p/ outra obra — rota protegida). */
  _origemEstoqueItem(c) {
    const ROTULO_MOV = {
      entrada_despesa: "Compra (despesa)", entrada_manual: "Entrada manual",
      entrada_transferencia: "Recebido por transferência", saida_transferencia: "Enviado por transferência",
      consumo: "Consumo", retorno: "Retorno",
    };
    const linhas = dataStore
      .movimentosDoItemEstoque(this._obraId, c.item_id)
      .map((m) => ({ _tipo: ROTULO_MOV[m.tipo] || m.tipo, _qtd: nf3(m.quantidade) + (m.unidade ? " " + m.unidade : ""), _data: m.data ? fmtData(m.data) : "—" }));
    abrirOrigemGrafico({
      titulo: "Estoque · " + c.nome,
      descricao: "Movimentos deste item no estoque da obra.",
      linhas,
      colunas: [
        { chave: "_tipo", titulo: "Movimento" },
        { chave: "_qtd", titulo: "Quantidade", alinhar: "dir" },
        { chave: "_data", titulo: "Data" },
      ],
    });
  }
}

customElements.define("publico-view", PublicoView);
