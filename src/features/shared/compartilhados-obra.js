/**
 * <compartilhados-obra tipos="contato,equipe,cargo" [tipo="contato"]>
 *
 * Aba "Compartilhados" organizada POR OBRA (mesmo padrão da tela Transferências):
 * chips com as obras COMPARTILHADAS comigo; ao escolher uma, ESPELHA as sub-abas
 * daquela tela — uma SEÇÃO por sub-tipo (Contatos → Contatos + Equipes + Cargos;
 * Itens → Itens + Categorias; Empresas → Empresas + Classificação; etc.) — listando
 * os dados que a obra referencia TRANSITIVAMENTE (só os que NÃO são meus), cada um
 * com **Incorporar** (copia para o meu acervo pessoal via `dataStore.incorporar`).
 * Assim o convidado recebe todo o grafo que norteia cada dado e escolhe o que trazer.
 *
 * `tipos` (lista separada por vírgula) é o novo modo multi-seção; `tipo` (singular)
 * continua aceito como fallback. Reutilizado por contatos/empresas/itens/ofertas/
 * orçamentos/cotações-view.
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { avatarHtml } from "./avatar.js";
import { moeda } from "../../core/formatters.js";
import { ofertanteNome, rotuloOrcamento } from "../orcamentos/orcamento-util.js";
import { totalOferta } from "../cotacoes/cotacao-util.js";
import "../despesas/category-badge.js";
import "../../components/ui-empty-state.js";

const _esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// tipo → { chave (no retorno de compartilhadoDaObra), titulo (cabeçalho da seção),
//          incorporavel (mostra botão), idDe (identificador enviado ao incorporar) }.
const TIPOS = {
  contato: { chave: "contatos", titulo: "Contatos" },
  equipe: { chave: "equipes", titulo: "Equipes" },
  cargo: { chave: "cargos", titulo: "Cargos", idDe: (x) => x.nome },
  item: { chave: "itens", titulo: "Itens" },
  "categoria-item": { chave: "categoriasItem", titulo: "Categorias" },
  fornecedor: { chave: "fornecedores", titulo: "Empresas" },
  "categoria-fornecedor": { chave: "categoriasFornecedor", titulo: "Classificação" },
  oferta: { chave: "ofertas", titulo: "Ofertas" },
  orcamento: { chave: "orcamentos", titulo: "Orçamentos" },
  cotacao: { chave: "cotacoes", titulo: "Cotações", incorporavel: false },
};

class CompartilhadosObra extends BaseElement {
  get tiposList() {
    const attr = (this.getAttribute("tipos") || this.getAttribute("tipo") || "contato").trim();
    return attr
      .split(",")
      .map((s) => s.trim())
      .filter((t) => TIPOS[t]);
  }

  // "catalogo" (default) = dados de CATÁLOGO compartilhados por outros usuários
  // (contatos/itens/empresas — filtro usuario_id !== me, só obras compartilhadas).
  // "obra" = dados DA OBRA (ofertas/cotações/orçamentos com obra_id) de TODAS as
  // obras acessíveis (próprias + compartilhadas), de qualquer criador — "Salvar
  // nos meus dados" disponível a todos (a obra vive sozinha).
  get escopo() {
    return this.getAttribute("escopo") === "obra" ? "obra" : "catalogo";
  }

  estilos() {
    return `
      :host { display: block; }
      .chips { display: flex; gap: var(--esp-2); overflow-x: auto; padding-bottom: 2px; margin-bottom: var(--esp-3);
        -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .chips::-webkit-scrollbar { display: none; }
      .chip { flex: none; border: 1px solid var(--cor-borda); background: var(--cor-superficie); color: var(--cor-texto);
        cursor: pointer; border-radius: var(--raio-completo); font: inherit; font-size: var(--fs-sm);
        font-weight: var(--peso-medio); min-height: 40px; padding: 0 var(--esp-4); white-space: nowrap; }
      .chip.ativo { background: var(--cor-primaria); color: #fff; border-color: var(--cor-primaria); }
      .secao + .secao { margin-top: var(--esp-4); }
      .secao-titulo { font-size: var(--fs-sm); font-weight: var(--peso-semi); color: var(--cor-texto-suave);
        text-transform: uppercase; letter-spacing: .04em; margin: 0 0 var(--esp-1); }
      .comp-lista { display: flex; flex-direction: column; }
      .comp-row { display: flex; align-items: center; gap: var(--esp-3); padding: var(--esp-2) 0;
        border-bottom: 1px solid var(--cor-borda); min-height: 60px; }
      .comp-row:last-child { border-bottom: none; }
      .comp-conteudo { flex: 1; min-width: 0; }
      .comp-inc { flex: none; border: 1px solid var(--cor-primaria); background: var(--cor-primaria-suave);
        color: var(--cor-primaria-escura, var(--cor-primaria)); cursor: pointer; border-radius: var(--raio-sm);
        font: inherit; font-size: var(--fs-sm); font-weight: var(--peso-semi); min-height: 40px; padding: 0 var(--esp-3); }
      .comp-inc:hover { background: var(--cor-primaria); color: #fff; }
      .comp-inc[disabled] { opacity: .5; cursor: default; }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); padding: var(--esp-3) 0; }
      .badge { display: inline-block; padding: 2px 10px; border-radius: var(--raio-completo);
        font-size: var(--fs-sm); font-weight: var(--peso-semi); }
    `;
  }

  template() {
    return `<div class="chips" id="chips"></div><div id="lista"></div>`;
  }

  aoConectar() {
    this._obraSel = "";
    this._pintar();
    this.aoLimpar(dataStore.subscribe(() => this._pintar()));
  }

  _pintar() {
    const chipsEl = this.$("#chips");
    const listaEl = this.$("#lista");
    if (!chipsEl || !listaEl || !dataStore.carregado()) return;
    const ehObra = this.escopo === "obra";
    const tipos = this.tiposList;
    const chaves = tipos.map((t) => TIPOS[t].chave);
    // escopo "obra": TODAS as obras acessíveis (com dados dos tipos); "catalogo":
    // só as obras COMPARTILHADAS comigo.
    const temItens = (o) => chaves.some((k) => ((dataStore.dadosDaObra(o.id) || {})[k] || []).length);
    const obras = ehObra ? dataStore.obras().filter(temItens) : dataStore.obrasCompartilhadas();
    if (!obras.length) {
      chipsEl.innerHTML = "";
      listaEl.innerHTML = ehObra
        ? `<ui-empty-state icone="cifrao" titulo="Nada das obras aqui"
            texto="Ofertas, cotações e orçamentos registrados nas suas obras aparecem aqui para você salvar no seu acervo."></ui-empty-state>`
        : `<ui-empty-state icone="usuarios" titulo="Nada compartilhado"
            texto="Quando alguém compartilhar uma obra com você, os dados dela aparecem aqui para revisar e incorporar."></ui-empty-state>`;
      return;
    }
    if (!this._obraSel || !obras.some((o) => String(o.id) === String(this._obraSel))) this._obraSel = String(obras[0].id);
    chipsEl.innerHTML = obras
      .map((o) => `<button type="button" class="chip ${String(this._obraSel) === String(o.id) ? "ativo" : ""}" data-id="${o.id}">${_esc(o.nome)}</button>`)
      .join("");
    chipsEl.querySelectorAll(".chip").forEach((b) =>
      b.addEventListener("click", () => {
        this._obraSel = b.dataset.id;
        this._pintar();
      })
    );

    const dados = (ehObra ? dataStore.dadosDaObra(this._obraSel) : dataStore.compartilhadoDaObra(this._obraSel)) || {};
    const rotuloBtn = ehObra ? "Salvar nos meus dados" : "Incorporar";
    const mostrarTitulo = tipos.length > 1;
    const secoes = tipos
      .map((tipo) => {
        const cfg = TIPOS[tipo];
        const lista = dados[cfg.chave] || [];
        if (!lista.length) return "";
        // No escopo "obra" tudo é salvável (inclui cotação); no "catalogo" respeita cfg.
        const incorporavel = ehObra ? true : cfg.incorporavel !== false;
        const linhas = lista
          .map((x) => {
            const idd = _esc(String((cfg.idDe ? cfg.idDe(x) : x.id) || ""));
            // Catálogo: se já tenho uma cópia pessoal equivalente, o botão fica
            // inativo com "Incorporado" (não incorporar 2×).
            const jaTem = !ehObra && dataStore.jaIncorporado(tipo, x);
            const botao = !incorporavel
              ? ""
              : jaTem
                ? `<button type="button" class="comp-inc" disabled>Incorporado</button>`
                : `<button type="button" class="comp-inc" data-tipo="${tipo}" data-id="${idd}">${rotuloBtn}</button>`;
            return `<div class="comp-row">
              <div class="comp-conteudo">${this._linha(tipo, x)}</div>
              ${botao}
            </div>`;
          })
          .join("");
        return `<div class="secao">
          ${mostrarTitulo ? `<p class="secao-titulo">${_esc(cfg.titulo)}</p>` : ""}
          <div class="comp-lista">${linhas}</div>
        </div>`;
      })
      .filter(Boolean);

    if (!secoes.length) {
      listaEl.innerHTML = `<p class="vazio">${ehObra ? "Nada registrado nesta obra." : "Nada compartilhado nesta obra."}</p>`;
      return;
    }
    listaEl.innerHTML = secoes.join("");
    listaEl.querySelectorAll(".comp-inc:not([disabled])").forEach((b) =>
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await dataStore.incorporar(b.dataset.tipo, b.dataset.id);
          toastSucesso(ehObra ? "Salvo no seu acervo." : "Incorporado ao seu acervo.");
        } catch (e) {
          notificarErro(e);
          b.disabled = false;
        }
      })
    );
  }

  _linha(tipo, x) {
    const pessoa = (nome, sub) =>
      `<div style="display:flex;align-items:center;gap:12px;min-width:0">${avatarHtml(nome, 42)}
        <div style="min-width:0"><div style="font-weight:var(--peso-semi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(nome)}</div>
        ${sub ? `<div style="font-size:.85rem;color:var(--cor-texto-suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(sub)}</div>` : ""}</div></div>`;
    const badge = (nome, cor) =>
      `<span class="badge" style="background:${cor || "var(--cor-neutro)"};color:#fff">${_esc(nome || "—")}</span>`;
    switch (tipo) {
      case "contato": {
        const emp = x.fornecedor_id ? (dataStore.fornecedores().find((f) => String(f.id) === String(x.fornecedor_id)) || {}).nome : "";
        return pessoa(x.nome, [x.cargo, emp].filter(Boolean).join(" · "));
      }
      case "fornecedor": {
        const cat = (dataStore.categorias().find((c) => String(c.id) === String(x.categoria_id)) || {}).nome || "";
        return pessoa(x.nome, cat);
      }
      case "equipe": {
        const n = (x.membros || []).length;
        return pessoa(x.nome, `${n} ${n === 1 ? "integrante" : "integrantes"}`);
      }
      case "cargo":
        return badge(x.nome, "var(--cor-neutro)");
      case "categoria-item":
      case "categoria-fornecedor":
        return badge(x.nome, x.cor);
      case "item":
        return `<div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="font-weight:var(--peso-semi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(x.nome)}</span>
          <category-badge nome="${_esc(x.classificacao || "—")}" cor="var(--cor-neutro)"></category-badge></div>`;
      case "oferta": {
        const it = dataStore.item(x.item_id);
        const nome = (it && it.nome) || x.item || "Oferta";
        const tot = totalOferta(x, dataStore.cotacao(x.cotacao_id));
        const of = ofertanteNome(x.contato_id, x.equipe_id);
        return `<div style="min-width:0"><div style="font-weight:var(--peso-semi)">${_esc(nome)} — ${moeda(tot)}</div>
          ${of ? `<div style="font-size:.85rem;color:var(--cor-texto-suave)">${_esc(of)}</div>` : ""}</div>`;
      }
      case "orcamento":
        return `<div style="min-width:0"><div style="font-weight:var(--peso-semi)">${_esc(rotuloOrcamento(x))}</div>
          ${x.tipo ? `<div style="font-size:.85rem;color:var(--cor-texto-suave)">${_esc(x.tipo)}</div>` : ""}</div>`;
      case "cotacao": {
        const rot = x.descricao || x.nome || "Cotação";
        const sub = [x.quantidade && x.unidade ? `${x.quantidade} ${x.unidade}` : "", x.classificacao].filter(Boolean).join(" · ");
        return `<div style="min-width:0"><div style="font-weight:var(--peso-semi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(rot)}</div>
          ${sub ? `<div style="font-size:.85rem;color:var(--cor-texto-suave)">${_esc(sub)}</div>` : ""}</div>`;
      }
      default:
        return _esc(x.nome || x.id || "");
    }
  }
}

customElements.define("compartilhados-obra", CompartilhadosObra);
