/**
 * <despesa-table> — Tabela de despesas (largura total, células proporcionais).
 * Reutiliza <ui-data-table> (fluido + clicavel) e <category-badge>.
 *
 * Propriedades: .despesas = [...], .categorias = [{id,nome,cor}]
 * Eventos: "abrir" ({despesa}) ao clicar na linha; "editar"/"remover" ({despesa}).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { moeda, data as fmtData } from "../../core/formatters.js";
import { totalPago, distribuicao, parseLista, statusPagamento } from "./despesa-split.js";
import { ofertanteNome, rotuloOrcamento } from "../orcamentos/orcamento-util.js";
import "../../components/ui-data-table.js";
import "../../components/ui-lista-gestos.js";
import { injetarBuscaNoCard } from "../../components/ui-busca.js";
import "./category-badge.js";

/** Nome da empresa (fornecedor) pelo id. */
function _empresaNome(id) {
  if (!id) return "";
  return (dataStore.fornecedores().find((f) => String(f.id) === String(id)) || {}).nome || "";
}

function _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/** Cor do badge por classificação (espelha itens-view / backend). */
const COR_CLASSIFICACAO = { Material: "#1d4ed8", "Serviço": "#6d28d9" };

/** Cor ESTÁVEL por id (hash → HSL) — usada p/ segmentar despesas por orçamento. */
function _corDeId(id) {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${(h * 137) % 360} 62% 46%)`; // ×137 (coprimo de 360) espalha bem as matizes
}

class DespesaTable extends BaseElement {
  set despesas(v) {
    // Ordem INICIAL: data CRESCENTE (mais antigas em cima); empate na data → ordem
    // ALFABÉTICA pelo nome do item (ao vivo). Cópia (slice) p/ não mutar o store; a
    // ordenação por clique na `ui-data-table` sobrepõe isto (desktop e mobile iguais).
    const nomeDe = (d) => (d.item_id && (dataStore.item(d.item_id) || {}).nome) || d.item || "";
    const arr = Array.isArray(v) ? v.slice() : [];
    arr.sort((a, b) => {
      const da = String(a.data || "");
      const db = String(b.data || "");
      if (da !== db) return da.localeCompare(db);
      return String(nomeDe(a)).localeCompare(String(nomeDe(b)), "pt", { numeric: true });
    });
    this._despesas = arr;
    this.atualizarTabela();
  }
  get despesas() {
    return this._despesas || [];
  }
  set categorias(v) {
    this._mapaCat = {};
    (Array.isArray(v) ? v : []).forEach((c) => (this._mapaCat[c.id] = c));
    this.atualizarTabela();
  }
  get mapaCat() {
    return this._mapaCat || {};
  }
  set participantes(v) {
    this._mapaPart = {};
    (Array.isArray(v) ? v : []).forEach((p) => (this._mapaPart[p.chave] = p.nome));
    this.atualizarTabela();
  }
  get mapaPart() {
    return this._mapaPart || {};
  }

  estilos() {
    return `
      :host { display: block; }
      #lista { display: none; }
      /* Mobile: some a tabela e mostra a lista de gestos (mesmo dado, mesmos eventos). */
      @media (max-width: 820px) {
        #tabela { display: none; }
        #lista { display: block; }
      }
    `;
  }
  template() {
    return `<ui-data-table id="tabela" fluido clicavel
        empty-text="Nenhuma despesa registrada nesta obra."></ui-data-table>
      <ui-lista-gestos id="lista"></ui-lista-gestos>`;
  }

  /** Card compacto da despesa no mobile (sem legendas/checkbox/botões). */
  _cardDespesa(d) {
    const item = (d.item_id && (dataStore.item(d.item_id) || {}).nome) || d.item || "—";
    const emp = _empresaNome(d.fornecedor_id) ||
      ((d.ofertante_contato_id || d.ofertante_equipe_id) ? ofertanteNome(d.ofertante_contato_id, d.ofertante_equipe_id) : "");
    const st = statusPagamento(d);
    const corSt = st === "Pago" ? "var(--cor-sucesso)" : st === "Em pagamento" ? "var(--cor-aviso)" : "var(--cor-neutro)";
    const corCl = COR_CLASSIFICACAO[d.classificacao] || "var(--cor-neutro)";
    // Botões por linha (editar/excluir) — DISCRETOS (só ícone, sem fundo), no canto
    // inferior direito. São <button> (o gesto os ignora) e disparam "acao-linha".
    const btn = (acao, aria, cor) =>
      `<button type="button" data-acao-linha="${acao}" aria-label="${aria}" title="${aria}"
        style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;
        border:none;background:none;cursor:pointer;color:${cor};padding:0">
        <ui-icon name="${acao}" size="20"></ui-icon></button>`;
    // Faixa de orçamento (mesma cor estável do desktop): MARCADOR DE GRUPO clicável — tocar
    // seleciona todas as despesas do mesmo orçamento. `.no-gesto` impede que o toque abra o
    // card; `background-clip:content-box` mantém a faixa fina com boa área de toque.
    const seg = this._segOrc(d);
    const stripe = seg
      ? `<span class="seg-orc grupo-sel no-gesto" data-grupo="${_esc(seg.orcId)}" title="Selecionar todas as despesas do orçamento: ${_esc(seg.label)}" style="flex:none;width:22px;align-self:stretch;margin:-2px 2px -2px -2px;padding:0 9px;box-sizing:border-box;background-clip:content-box;border-radius:3px;background:${seg.cor};cursor:pointer"></span>`
      : "";
    const corpo = `<div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
          <span style="font-weight:var(--peso-semi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(item)}</span>
          <span style="font-family:var(--fonte-titulo);font-weight:700;white-space:nowrap">${moeda(Number(d.valor) || 0)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:var(--fs-sm);color:var(--cor-texto-suave);min-width:0">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(emp) || "—"}</span>
          <span style="display:inline-flex;gap:4px;flex:none">${d.classificacao ? `<category-badge nome="${_esc(d.classificacao)}" cor="${corCl}"></category-badge>` : ""}<category-badge nome="${st}" cor="${corSt}"></category-badge></span>
        </div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px">
          <small style="color:var(--cor-texto-fraco)">${fmtData(d.data)}</small>
          <div style="display:flex;gap:2px;flex:none;margin:-4px -6px -6px 0">
            ${btn("editar", "Editar despesa", "var(--cor-texto-suave)")}
            ${btn("excluir", "Excluir despesa", "var(--cor-erro)")}
          </div>
        </div>
      </div>`;
    return `<div style="display:flex;align-items:stretch;gap:6px;width:100%;min-width:0">${stripe}${corpo}</div>`;
  }

  aposRender() {
    const tabela = this.$("#tabela");
    tabela.columns = [
      // valorOrd = data ISO ("AAAA-MM-DD") → ordena por DATA real, não pelo texto "DD/MM/AAAA".
      { chave: "data", titulo: "Data", formato: (v) => fmtData(v), valorOrd: (l) => String(l.data || "") },
      {
        chave: "item",
        titulo: "Item",
        // Item pode ter texto longo → coluna bem larga (evita quebra excessiva).
        largura: "280px",
        // Nome ao vivo do catálogo (reflete renome); `item` denormalizado é fallback.
        // Despesa vinda de ORÇAMENTO ganha uma FAIXA colorida (cor estável por orçamento)
        // → itens do mesmo orçamento ficam visualmente SEGMENTADOS/agrupados na mesa.
        formato: (v, linha) => {
          const nome = (linha.item_id && (dataStore.item(linha.item_id) || {}).nome) || v || "—";
          const seg = this._segOrc(linha);
          if (!seg) return nome;
          // A faixa é um MARCADOR DE GRUPO clicável: seleciona todas as despesas do mesmo
          // orçamento. `background-clip:content-box` mantém a barra fina (4px) visível, mas o
          // padding transparente dá ~18px de área de toque (dedo no mobile). Cor estável = grupo.
          return `<span style="display:inline-flex;align-items:center;gap:6px;min-width:0"><span class="seg-orc grupo-sel" data-grupo="${_esc(seg.orcId)}" title="Selecionar todas as despesas do orçamento: ${_esc(seg.label)}" style="flex:none;width:18px;padding:0 7px;box-sizing:border-box;background-clip:content-box;align-self:stretch;min-height:22px;border-radius:3px;background:${seg.cor};cursor:pointer"></span><span style="overflow:hidden;text-overflow:ellipsis">${_esc(nome)}</span></span>`;
        },
      },
      {
        chave: "classificacao",
        titulo: "Classificação",
        formato: (v) =>
          v
            ? `<category-badge nome="${v}" cor="${COR_CLASSIFICACAO[v] || "var(--cor-neutro)"}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "categoria_id",
        titulo: "Categoria",
        secundaria: true,
        formato: (id) =>
          this.mapaCat[id]
            ? `<category-badge nome="${this.mapaCat[id].nome}" cor="${this.mapaCat[id].cor}"></category-badge>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "ofertante_contato_id",
        titulo: "Ofertante",
        secundaria: true,
        // Ofertante ao vivo: equipe (se houver) ou contato; "—" p/ despesas legadas.
        formato: (_, linha) => {
          const id = linha.ofertante_contato_id || linha.ofertante_equipe_id;
          return id
            ? ofertanteNome(linha.ofertante_contato_id, linha.ofertante_equipe_id)
            : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      {
        chave: "fornecedor_id",
        titulo: "Empresa",
        secundaria: true,
        formato: (id) =>
          _empresaNome(id) || `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
      {
        chave: "criado_em",
        titulo: "Adicionado",
        secundaria: true,
        // Ordena pelo timestamp ISO de criação (o texto exibido leva "por <autor>").
        valorOrd: (l) => String(l.criado_em || ""),
        formato: (criadoEm, linha) =>
          criadoEm
            ? `<div>${fmtData(criadoEm)}</div><small style="color:var(--cor-texto-fraco)">por ${
                linha.autor_nome || "—"
              }</small>`
            : "—",
      },
      {
        chave: "editor_nome",
        titulo: "Editado por",
        secundaria: true,
        formato: (editor, linha) => {
          const editou =
            editor && linha.atualizado_em && String(linha.atualizado_em) !== String(linha.criado_em);
          return editou
            ? `<div>${editor}</div><small style="color:var(--cor-texto-fraco)">${fmtData(
                linha.atualizado_em
              )}</small>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      { chave: "valor", titulo: "Valor", alinhar: "dir", moeda: true, formato: (v) => moeda(v) },
      {
        chave: "pagamentos_realizados",
        titulo: "Status",
        // Status derivado dos pagamentos lançados: A pagar / Em pagamento / Pago.
        formato: (_, linha) => {
          const st = statusPagamento(linha);
          const cor = st === "Pago" ? "var(--cor-sucesso)" : st === "Em pagamento" ? "var(--cor-aviso)" : "var(--cor-neutro)";
          return `<category-badge nome="${st}" cor="${cor}"></category-badge>`;
        },
      },
      {
        chave: "pagamentos",
        titulo: "Pagamento",
        alinhar: "dir",
        secundaria: true,
        moeda: true,
        valorNum: (linha) => totalPago(linha),
        formato: (_, linha) => {
          const t = totalPago(linha);
          return t > 0 ? moeda(t) : `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      {
        chave: "pagamentos",
        titulo: "Distribuição",
        secundaria: true,
        formato: (_, linha) => {
          const d = distribuicao(linha);
          if (d === "distribuido")
            return `<category-badge nome="Distribuído" cor="var(--cor-info)"></category-badge>`;
          if (d === "unico")
            return `<category-badge nome="Único" cor="var(--cor-neutro)"></category-badge>`;
          return `<span style="color:var(--cor-texto-fraco)">—</span>`;
        },
      },
      {
        chave: "responsaveis",
        titulo: "Responsabilidade",
        secundaria: true,
        formato: (_, linha) => {
          const rs = parseLista(linha.responsaveis);
          if (!rs.length) return `<span style="color:var(--cor-texto-fraco)">—</span>`;
          return rs
            .map((r) => {
              const nome = this.mapaPart[r.chave] || "—";
              return `<category-badge nome="${nome} · ${Number(r.pct) || 0}%" cor="var(--cor-aviso)"></category-badge>`;
            })
            .join(" ");
        },
      },
      {
        chave: "preco_id",
        titulo: "Oferta",
        secundaria: true,
        formato: (v) =>
          v
            ? `<code title="${v}" style="font-size:var(--fs-xs)">…${String(v).slice(-6)}</code>`
            : `<span style="color:var(--cor-texto-fraco)">—</span>`,
      },
    ];
    tabela.acoes = [
      { nome: "editar", rotulo: "Editar" },
      { nome: "remover", rotulo: "Excluir", variant: "perigo" },
    ];
    // OBS.: os eventos internos (ui-data-table / ui-lista-gestos) são `composed`,
    // então sem `stopPropagation` eles atravessariam o shadow e chegariam ao
    // ouvinte da obra-detail JUNTO com o evento re-emitido aqui — abrindo DOIS
    // banners quando o nome coincide (ex.: `editar`→`editar`). Consumимos o evento
    // interno e repassamos só o traduzido.
    tabela.addEventListener("acao", (e) => {
      e.stopPropagation();
      this.emitir(e.detail.acao, { despesa: e.detail.linha });
    });
    tabela.addEventListener("linha", (e) => {
      e.stopPropagation();
      this.emitir("abrir", { despesa: e.detail.linha });
    });
    // Clique na FAIXA de orçamento → seleciona TODAS as despesas do mesmo orçamento
    // (visíveis, respeitando filtros). Reusa `_orcPorPreco` já montado em atualizarTabela.
    tabela.addEventListener("grupo", (e) => {
      e.stopPropagation();
      const orcId = String(e.detail.grupo || "");
      if (!orcId) return;
      const mapa = this._orcPorPreco || {};
      const ids = this.despesas
        .filter((d) => String(mapa[String((d && d.preco_id) || "")] || "") === orcId)
        .map((d) => d.id);
      tabela.selecionarPorId(ids);
    });
    // Exclusão em massa: a CONFIRMAÇÃO é da obra-detail (`removerMassa` oferece apagar os
    // pagamentos antes) — `sem-confirmar-massa` evita o diálogo genérico duplicado da tabela.
    tabela.setAttribute("excluir-massa", "");
    tabela.setAttribute("sem-confirmar-massa", "");
    tabela.addEventListener("excluir-massa", (e) => {
      e.stopPropagation();
      this.emitir("excluir-massa", { despesas: e.detail.linhas });
    });
    // Ações em massa nas selecionadas: lançar pagamento + definir responsabilidade.
    tabela.acoesMassa = [
      { nome: "pagar", rotulo: "Registrar pagamento" },
      { nome: "responsavel", rotulo: "Definir responsabilidade" },
      { nome: "editar-lote", rotulo: "Editar selecionadas" },
    ];
    tabela.addEventListener("acao-massa", (e) => {
      e.stopPropagation();
      this.emitir("acao-massa", { acao: e.detail.acao, despesas: e.detail.linhas });
    });
    // Busca no cabeçalho do card (a tabela interna não alcança o card por estar no shadow).
    injetarBuscaNoCard(this, tabela);

    // ----- Versão MOBILE: lista de gestos (emite os MESMOS eventos → obra-detail intacto) -----
    const lista = this.$("#lista");
    lista.render = (d) => this._cardDespesa(d);
    // Despesa NÃO usa "puxar" p/ editar/excluir — usa os BOTÕES por linha (acao-linha).
    // Assim o arraste horizontal fica livre p/ o swipe de troca de aba.
    lista.semSwipeAcao = true;
    lista.acoesMassa = [
      { nome: "pagar", rotulo: "Registrar pagamento" },
      { nome: "responsavel", rotulo: "Definir responsabilidade" },
      { nome: "editar-lote", rotulo: "Editar selecionadas" },
    ];
    lista.addEventListener("abrir", (e) => { e.stopPropagation(); this.emitir("abrir", { despesa: e.detail.item }); });
    // Tocar na FAIXA de orçamento (mobile) → seleciona todas as despesas do mesmo orçamento.
    lista.addEventListener("grupo", (e) => {
      e.stopPropagation();
      const orcId = String(e.detail.grupo || "");
      if (!orcId) return;
      const mapa = this._orcPorPreco || {};
      const ids = this.despesas
        .filter((d) => String(mapa[String((d && d.preco_id) || "")] || "") === orcId)
        .map((d) => d.id);
      lista.selecionarPorId(ids);
    });
    // Botões editar/excluir por linha.
    lista.addEventListener("acao-linha", (e) => {
      e.stopPropagation();
      if (e.detail.acao === "editar") this.emitir("editar", { despesa: e.detail.item });
      else if (e.detail.acao === "excluir") this.emitir("remover", { despesa: e.detail.item });
    });
    // (compat) arraste — inativo com semSwipeAcao, mantido inofensivo.
    lista.addEventListener("editar", (e) => { e.stopPropagation(); this.emitir("editar", { despesa: e.detail.item }); });
    lista.addEventListener("excluir", (e) => { e.stopPropagation(); this.emitir("remover", { despesa: e.detail.item }); });
    lista.addEventListener("acao-massa", (e) => {
      e.stopPropagation();
      if (e.detail.acao === "excluir") this.emitir("excluir-massa", { despesas: e.detail.itens });
      else this.emitir("acao-massa", { acao: e.detail.acao, despesas: e.detail.itens });
    });

    this.atualizarTabela();
  }

  atualizarTabela() {
    // Mapa oferta→orçamento (p/ segmentar despesas por orçamento) — refeito quando os dados mudam.
    this._orcPorPreco = {};
    dataStore.todasOfertas().forEach((o) => {
      if (o && o.orcamento_id) this._orcPorPreco[String(o.id)] = String(o.orcamento_id);
    });
    this._segCache = {};
    const tabela = this.$ ? this.$("#tabela") : null;
    if (tabela) tabela.rows = this.despesas;
    const lista = this.$ ? this.$("#lista") : null;
    if (lista) lista.itens = this.despesas;
  }

  /** Segmento de orçamento de uma despesa (via `preco_id`→oferta→orçamento): {cor,label} ou null. */
  _segOrc(d) {
    const orcId = (this._orcPorPreco || {})[String((d && d.preco_id) || "")];
    if (!orcId) return null;
    if (!this._segCache) this._segCache = {};
    if (!this._segCache[orcId]) {
      const orc = dataStore.orcamento(orcId) || {};
      this._segCache[orcId] = { orcId, cor: _corDeId(orcId), label: rotuloOrcamento(orc) || "Orçamento" };
    }
    return this._segCache[orcId];
  }
}

customElements.define("despesa-table", DespesaTable);
