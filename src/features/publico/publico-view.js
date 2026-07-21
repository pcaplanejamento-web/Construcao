/**
 * <publico-view> — Visão SOMENTE LEITURA de uma obra via link público.
 *
 * Rota: /publico/:token (sem login). Busca publico.obra(token) e mostra a obra
 * INTEIRA com TODAS as abas (Gráficos / Despesas / Acerto de contas / Orçamentos /
 * Equipes / Fornecedores / Transferências) — **sem nenhuma ação de edição**.
 * É um componente ISOLADO (não reusa obra-detail-view) → zero risco à tela
 * autenticada. Reusa os helpers PUROS (balancos/acerto) + ui-tabs + ui-data-table +
 * dashboard-summary + category-breakdown (display-only).
 */
import { BaseElement } from "../../components/base-element.js";
import { api } from "../../core/api-client.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { balancos, acerto } from "../despesas/despesa-split.js";
import { emEstoqueDaObra } from "../estoque/estoque.js";
import { corDeId } from "../shared/cor-id.js";
import "../../components/ui-card.js";
import "../../components/ui-icon.js";
import "../../components/ui-spinner.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../../components/ui-modal.js";
import "../../components/ui-button.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../dashboard/grafico-rosca.js";
import "../dashboard/grafico-mensal.js";
import "../despesas/category-badge.js";

import { COR_CLASSIFICACAO } from "../../core/classificacao.js";
const cap = (s) => {
  const t = String(s || "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

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
      .colunas { display: grid; gap: var(--esp-5); grid-template-columns: 2fr 1fr; }
      .colunas > * { min-width: 0; }
      @media (max-width: 860px) { .colunas { grid-template-columns: 1fr; } }
      /* Todos os gráficos (mesmos componentes da obra) numa grade de 3 colunas. */
      .graficos { display: grid; gap: var(--esp-5); grid-template-columns: repeat(3, 1fr); }
      .graficos > * { min-width: 0; height: 340px; }
      @media (max-width: 900px) {
        .graficos { grid-template-columns: 1fr; }
        .graficos > * { height: auto; min-height: 300px; }
      }
      .acertos { display: flex; flex-direction: column; gap: var(--esp-2); }
      .acerto-item { display: flex; align-items: center; gap: var(--esp-2);
        padding: var(--esp-2) var(--esp-3); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-sm); background: var(--cor-superficie); }
      .acerto-item .seta { color: var(--cor-texto-fraco); }
      .acerto-item .valor { margin-left: auto; font-weight: var(--peso-semi); color: var(--cor-erro); }
      .ok { display: inline-flex; align-items: center; gap: 6px; color: var(--cor-sucesso); font-size: var(--fs-sm); }
    `;
  }

  template() {
    return `<div class="area" id="conteudo"><ui-spinner centro text="Carregando..."></ui-spinner></div>`;
  }

  aoConectar() {
    this.carregar();
  }

  async carregar() {
    const alvo = this.$("#conteudo");
    try {
      const d = await api.call("publico.obra", { token: this.token });
      this.pintar(d);
    } catch (e) {
      alvo.innerHTML = `<ui-card title="Link indisponível"><p>${
        e.message || "Este link não está mais válido."
      }</p></ui-card>`;
    }
  }

  /* ----------------------------- Resolução de nomes ----------------------- */
  _maps(d) {
    const cont = {};
    (d.contatos || []).forEach((c) => (cont[String(c.id)] = c.nome));
    const eqp = {};
    (d.equipes || []).forEach((e) => (eqp[String(e.id)] = e.nome));
    const part = {};
    (d.participantes || []).forEach((p) => (part[p.chave] = p.nome));
    this._nm = { cont, eqp, part };
  }
  _nomeChave(ch) {
    const s = String(ch || "");
    if (this._nm.part[s]) return this._nm.part[s];
    if (s.indexOf("c:") === 0) return this._nm.cont[s.slice(2)] || "—";
    if (s.indexOf("e:") === 0) return (this._nm.eqp[s.slice(2)] || "—") + " (grupo)";
    if (s.indexOf("u:") === 0) return "Usuário";
    return s || "—";
  }
  _nomeContato(id) {
    return this._nm.cont[String(id)] || "—";
  }
  _nomeRecebedor(t) {
    if (t.recebedor_equipe_id) return (this._nm.eqp[String(t.recebedor_equipe_id)] || "—") + " (grupo)";
    return this._nomeContato(t.recebedor_contato_id);
  }

  pintar(d) {
    this._maps(d);
    const o = d.obra || {};
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
          <ui-card mesa title="Mesa com itens"><ui-data-table id="tDesp" fluido empty-text="Nenhuma despesa registrada."></ui-data-table></ui-card>
        </div>
        <div slot="acerto">
          <ui-card mesa title="Acerto de contas"><ui-data-table id="tAcerto" fluido empty-text="Sem participantes."></ui-data-table></ui-card>
          <ui-card mesa title="Quem deve a quem"><div id="qdaq"></div></ui-card>
        </div>
        <div slot="orcamentos">
          <ui-card mesa title="Mesa com orçamentos"><ui-data-table id="tOrc" fluido empty-text="Nenhum orçamento."></ui-data-table></ui-card>
        </div>
        <div slot="equipes">
          <ui-card mesa title="Mesa com equipes"><ui-data-table id="tEq" fluido empty-text="Nenhuma equipe."></ui-data-table></ui-card>
        </div>
        <div slot="fornecedores">
          <ui-card mesa title="Mesa com empresas"><ui-data-table id="tForn" fluido empty-text="Nenhuma empresa."></ui-data-table></ui-card>
        </div>
        <div slot="transferencias">
          <ui-card mesa title="Mesa com transferências"><ui-data-table id="tTransf" fluido empty-text="Nenhuma transferência."></ui-data-table></ui-card>
        </div>
      </ui-tabs>
    `;
    this.$("#abas").abas = [
      { id: "graficos", rotulo: "Gráficos", icone: "grafico" },
      { id: "despesas", rotulo: "Despesas", icone: "recibo" },
      { id: "acerto", rotulo: "Acerto de contas", icone: "usuarios" },
      { id: "orcamentos", rotulo: "Orçamentos", icone: "carteira" },
      { id: "equipes", rotulo: "Equipes", icone: "usuarios" },
      { id: "fornecedores", rotulo: "Empresas", icone: "fornecedor" },
      { id: "transferencias", rotulo: "Transferências", icone: "cifrao" },
    ];

    // Gráficos — TODOS os mesmos componentes da obra, somente leitura + drill-down.
    const resumo = d.resumo || {};
    const despRaw = d.despesasRaw || [];
    const { porChave, porFornecedor, porOfertante } = balancos(despRaw);
    const byId = {};
    despRaw.forEach((x) => (byId[String(x.id)] = x));
    const itemMap = {};
    (d.itens || []).forEach((i) => (itemMap[String(i.id)] = i));
    const nomeItem = (id) => (itemMap[String(id)] || {}).nome || "—";
    const nf = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString("pt-BR");
    const DESP_COLS = [
      { chave: "_item", titulo: "Despesa" },
      { chave: "_valor", titulo: "Valor", alinhar: "dir" },
      { chave: "_data", titulo: "Data" },
    ];
    const despRows = (arr) => arr.map((x) => ({ _item: nomeItem(x.item_id), _valor: moeda(x.valor), _data: fmtData(x.data) }));

    this.$("#dash").resumo = resumo;

    this.$("#break").aoSelecionar = (c) =>
      this._origem("Categoria · " + c.nome, DESP_COLS, despRows(despRaw.filter((x) => String(x.categoria_id) === String(c.categoria_id))));
    this.$("#break").porCategoria = resumo.por_subclassificacao || resumo.por_categoria || [];

    this.$("#rosca").aoSelecionar = (c) => {
      const alvo = c.nome === "Sem classificação" ? "" : c.nome;
      this._origem("Classificação · " + c.nome, DESP_COLS, despRows(despRaw.filter((x) => String(x.classificacao || "") === String(alvo))));
    };
    this.$("#rosca").porCategoria = resumo.por_classificacao || [];

    this.$("#mensal").aoSelecionar = (c) =>
      this._origem("Mês · " + (c.rotulo || c.mes), DESP_COLS, despRows(despRaw.filter((x) => String(x.data || "").startsWith(c.mes))));
    this.$("#mensal").despesas = despRaw;

    // Por ofertante (UNIFICADO: contato "c:" OU equipe "e:") — junta representante + ofertante-equipe.
    this.$("#gOfertante").aoSelecionar = (c) =>
      this._origem("Ofertante · " + c.nome, DESP_COLS, despRows(despRaw.filter((x) => {
        const k = x.ofertante_contato_id ? "c:" + x.ofertante_contato_id : (x.ofertante_equipe_id ? "e:" + x.ofertante_equipe_id : "");
        return k === c.chave;
      })));
    this.$("#gOfertante").porCategoria = Object.keys(porOfertante)
      .map((ch) => ({ nome: this._nomeChave(ch), cor: corDeId(ch), total: Number(porOfertante[ch]) || 0, chave: ch }))
      .filter((x) => x.total > 0.01).sort((a, b) => b.total - a.total);

    this.$("#gEmp").aoSelecionar = (c) =>
      this._origem("Empresa · " + c.nome, DESP_COLS, despRows(despRaw.filter((x) => String(x.fornecedor_id) === String(c.fornecedor_id))));
    this.$("#gEmp").porCategoria = Object.keys(porFornecedor)
      .map((fid) => ({ nome: this._nomeForn(d, fid), cor: corDeId(fid), total: Number(porFornecedor[fid].total) || 0, fornecedor_id: fid }))
      .filter((x) => x.total > 0.01).sort((a, b) => b.total - a.total);

    // Quantidade em estoque por item — MESMO componente de barras (item 2).
    const ROTULO_MOV = { entrada_despesa: "Compra (despesa)", entrada_manual: "Entrada manual", entrada_transferencia: "Recebido por transferência", saida_transferencia: "Enviado por transferência", consumo: "Consumo", retorno: "Retorno" };
    this.$("#gEst").aoSelecionar = (c) =>
      this._origem("Estoque · " + c.nome,
        [{ chave: "_tipo", titulo: "Movimento" }, { chave: "_qtd", titulo: "Quantidade", alinhar: "dir" }, { chave: "_data", titulo: "Data" }],
        (d.estoque || []).filter((m) => String(m.item_id) === String(c.item_id)).map((m) => ({ _tipo: ROTULO_MOV[m.tipo] || m.tipo, _qtd: nf(m.quantidade) + (m.unidade ? " " + m.unidade : ""), _data: fmtData(m.data) })));
    this.$("#gEst").formato = (c) => nf(c.total) + (c.unidade ? " " + c.unidade : "");
    this.$("#gEst").porCategoria = emEstoqueDaObra(d.estoque || [], o.id)
      .map((it) => ({ nome: nomeItem(it.item_id), cor: corDeId(it.item_id), total: Number(it.em_estoque) || 0, unidade: it.unidade || "", item_id: it.item_id }))
      .filter((x) => x.total > 0.0001).sort((a, b) => b.total - a.total);

    // Despesas (itens)
    this.$("#tDesp").columns = [
      { chave: "data", titulo: "Data", formato: (v) => fmtData(v) },
      { chave: "item", titulo: "Item" },
      {
        chave: "classificacao",
        titulo: "Classificação",
        formato: (v) =>
          v
            ? `<category-badge nome="${v}" cor="${COR_CLASSIFICACAO[v] || "var(--cor-neutro)"}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "categoria_nome",
        titulo: "Categoria",
        secundaria: true,
        formato: (nome, linha) =>
          nome
            ? `<category-badge nome="${nome}" cor="${linha.categoria_cor || ""}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      { chave: "valor", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
    ];
    this.$("#tDesp").rows = d.despesas || [];

    // Acerto de contas (balanços por participante + quem deve a quem) — helpers PUROS.
    // (despRaw/porChave/porFornecedor já calculados no bloco de Gráficos acima.)
    const participantes = d.participantes || [];
    const rowsAcerto = participantes.map((p) => {
      const b = porChave[p.chave] || { pago: 0, recebido: 0, saldoApagar: 0, saldoReceber: 0 };
      return { nome: p.nome, _pago: b.pago || 0, _recebido: b.recebido || 0, _saldoApagar: b.saldoApagar || 0, _saldoReceber: b.saldoReceber || 0 };
    });
    this.$("#tAcerto").columns = [
      { chave: "nome", titulo: "Participante" },
      { chave: "_pago", titulo: "Pago", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_saldoApagar", titulo: "Saldo a pagar", alinhar: "dir", moeda: true,
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-erro)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`) },
      { chave: "_saldoReceber", titulo: "Saldo a receber", alinhar: "dir", moeda: true,
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`) },
    ];
    this.$("#tAcerto").rows = rowsAcerto;
    const { acertos } = acerto(despRaw, participantes);
    this.$("#qdaq").innerHTML = acertos.length
      ? `<div class="acertos">${acertos
          .map(
            (a) =>
              `<div class="acerto-item"><span>${a.de_nome}</span><span class="seta">→</span><span>${a.para_nome}</span><span class="valor">${moeda(a.valor)}</span></div>`
          )
          .join("")}</div>`
      : `<div class="ok"><ui-icon name="sucesso" size="16"></ui-icon> Sem pendências — tudo acertado.</div>`;

    // Orçamentos
    this.$("#tOrc").columns = [
      { chave: "nome", titulo: "Orçamento" },
      { chave: "status", titulo: "Status", formato: (v) => v || "—" },
      { chave: "criado_em", titulo: "Criado", secundaria: true, formato: (v) => (v ? fmtData(v) : "—") },
    ];
    this.$("#tOrc").rows = d.orcamentos || [];

    // Equipes
    this.$("#tEq").columns = [
      { chave: "nome", titulo: "Equipe" },
      {
        chave: "membros",
        titulo: "Integrantes",
        alinhar: "dir",
        formato: (m, l) => String((Array.isArray(m) ? m.length : 0) + (l.lider_id ? 1 : 0)),
      },
    ];
    this.$("#tEq").rows = d.equipes || [];

    // Fornecedores (Total / Recebido / Saldo a receber) — balancos.porFornecedor.
    this.$("#tForn").columns = [
      { chave: "nome", titulo: "Empresa" },
      { chave: "_total", titulo: "Total", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_recebido", titulo: "Recebido", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "_saldoReceber", titulo: "Saldo a receber", alinhar: "dir", moeda: true,
        formato: (v) => (v > 0.01 ? `<strong style="color:var(--cor-sucesso)">${moeda(v)}</strong>` : `<span style="color:var(--cor-texto-fraco)">—</span>`) },
    ];
    this.$("#tForn").rows = Object.keys(porFornecedor).map((fid) => {
      const v = porFornecedor[fid];
      return { nome: this._nomeForn(d, fid), _total: v.total, _recebido: v.recebido, _saldoReceber: v.saldoReceber };
    });

    // Transferências
    this.$("#tTransf").columns = [
      { chave: "data", titulo: "Data", formato: (v) => fmtData(v) },
      { chave: "valor_total", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      { chave: "tipo", titulo: "Tipo", formato: (v) => cap(v || "dinheiro") },
      { chave: "pagador_chave", titulo: "Pagou", formato: (v) => this._nomeChave(v) },
      { chave: "_recebedor", titulo: "Recebedor", formato: (_, l) => this._nomeRecebedor(l) },
      { chave: "pagamento_ids", titulo: "Pagamentos", alinhar: "dir", formato: (v) => String((v || []).length) },
      {
        chave: "comprovante_url",
        titulo: "Comprovante",
        formato: (v) =>
          v
            ? `<a href="${v}" target="_blank" rel="noopener">Ver comprovante</a>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    this.$("#tTransf").rows = d.transferencias || [];
  }

  /** Nome do fornecedor pelo id (mapa próprio de fornecedores do payload). */
  _nomeForn(d, fid) {
    const f = (d.fornecedores || []).find((x) => String(x.id) === String(fid));
    return f ? f.nome : "—";
  }

  /**
   * Banner de ORIGEM (item 4) na visão pública — somente leitura (sem navegação/edição).
   * Compõe ui-modal + ui-data-table (isolado; não puxa o data-store autenticado).
   */
  _origem(titulo, colunas, linhas) {
    const modal = document.createElement("ui-modal");
    modal.setAttribute("open", "");
    modal.setAttribute("title", "Origem · " + titulo);
    const corpo = document.createElement("div");
    const tab = document.createElement("ui-data-table");
    tab.setAttribute("fluido", "");
    tab.setAttribute("empty-text", "Sem registros.");
    tab.columns = colunas;
    tab.rows = linhas;
    corpo.appendChild(tab);
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
  }
}

customElements.define("publico-view", PublicoView);
