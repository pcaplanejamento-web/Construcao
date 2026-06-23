/**
 * <ofertas-view> — Lista TODAS as ofertas do usuário (rota /ofertas, aba própria
 * do menu). Usa a tabela PADRÃO de ofertas (montarTabelaOfertas) e o banner único
 * "Criar oferta" (preco-form) para criar uma oferta avulsa (sem cotação/orçamento).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { montarTabelaOfertas } from "../orcamentos/orcamento-util.js";
import { abrirOferta } from "./preco-form.js";
import { editarEmMassa } from "../shared/edicao-massa.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import { confirmar } from "../../components/confirmar.js";
import "../../components/ui-card.js";
import "../../components/ui-button.js";
import "../../components/ui-spinner.js";
import "./preco-form.js";

class OfertasView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); display: flex; flex-direction: column; gap: var(--esp-5); }
      .cabecalho { display: flex; align-items: center; justify-content: space-between;
        gap: var(--esp-3); flex-wrap: wrap; }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <div>
            <h1>Ofertas</h1>
            <p class="sub">Todas as ofertas (preços) registradas — de cotações, orçamentos ou avulsas.</p>
          </div>
        </div>
        <ui-card mesa title="Mesa com ofertas">
          <ui-button slot="acoes" id="nova">+ Criar oferta</ui-button>
          <div id="lista"></div>
        </ui-card>
      </div>
    `;
  }

  aoConectar() {
    this.$("#nova").addEventListener("click", () => this.abrirForm(null));
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    const el = this.$("#lista");
    if (!el) return;
    if (!dataStore.carregado()) {
      el.innerHTML = `<ui-spinner centro text="Carregando..."></ui-spinner>`;
      return;
    }
    montarTabelaOfertas(el, dataStore.todasOfertas(), {
      clicavel: true,
      onLinha: (oferta) => abrirOferta(oferta), // clique na oferta → banner único
      acoes: [{ nome: "remover", rotulo: "Excluir", variant: "perigo" }],
      onAcao: (acao, linha) => this.remover(linha),
      editarMassa: (linhas) => this.editarMassa(linhas),
      excluirMassa: (linhas) => this.removerMassa(linhas),
      vazio: "Crie ofertas para comparar preços e montar orçamentos.",
    });
  }

  /** Edição em massa: abre o MESMO preco-form; campos alterados valem p/ todas. */
  editarMassa(linhas) {
    editarEmMassa(linhas, {
      criarForm: (ref) => {
        const f = document.createElement("preco-form");
        f.preco = ref;
        return f;
      },
      reler: (ref) => dataStore.todasOfertas().find((o) => String(o.id) === String(ref.id)),
      aplicar: (l, diff) => dataStore.atualizarOferta(l.id, diff),
    });
  }

  abrirForm(preco) {
    const form = document.createElement("preco-form");
    form.preco = preco;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  async remover(oferta) {
    if (!(await confirmar({ titulo: "Excluir oferta", mensagem: `Excluir esta oferta?`, perigo: true, rotuloOk: "Excluir" }))) return;
    try {
      await dataStore.removerPreco(oferta.cotacao_id || "", oferta.id);
      toastSucesso("Oferta excluída.");
    } catch (e) {
      notificarErro(e);
    }
  }

  /** Exclusão em massa (a tabela já confirmou) — remove cada oferta selecionada. */
  async removerMassa(linhas) {
    try {
      for (const of of linhas || []) await dataStore.removerPreco(of.cotacao_id || "", of.id);
      toastSucesso(`${(linhas || []).length} oferta(s) excluída(s).`);
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("ofertas-view", OfertasView);
