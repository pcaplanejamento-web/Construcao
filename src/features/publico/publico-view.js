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
import "../../components/ui-card.js";
import "../../components/ui-icon.js";
import "../../components/ui-spinner.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../dashboard/dashboard-summary.js";
import "../dashboard/category-breakdown.js";
import "../despesas/category-badge.js";

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };
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
        <div slot="graficos">
          <ui-card><category-breakdown id="break" titulo="Gastos por subclassificação"></category-breakdown></ui-card>
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

    // Gráficos
    this.$("#dash").resumo = d.resumo || {};
    this.$("#break").porCategoria =
      (d.resumo && (d.resumo.por_subclassificacao || d.resumo.por_categoria)) || [];

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
        titulo: "Subclassificação",
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
    const despRaw = d.despesasRaw || [];
    const participantes = d.participantes || [];
    const { porChave, porFornecedor } = balancos(despRaw);
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
    ];
    this.$("#tTransf").rows = d.transferencias || [];
  }

  /** Nome do fornecedor pelo id (mapa próprio de fornecedores do payload). */
  _nomeForn(d, fid) {
    const f = (d.fornecedores || []).find((x) => String(x.id) === String(fid));
    return f ? f.nome : "—";
  }
}

customElements.define("publico-view", PublicoView);
