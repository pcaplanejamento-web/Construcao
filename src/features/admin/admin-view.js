/**
 * <admin-view> — Painel de CONFIGURAÇÃO (rota /admin, somente admin).
 *
 * Componente de abas: [Usuários | Transferências]. Usuários: CRUD de usuários (do
 * snapshot admin) + config por usuário. Transferências: CRUD dos TIPOS de transferência
 * (os 4 base são fixos; o usuário cria/edita/exclui os extras). Espelho do padrão de
 * cargos (contatos-view). Espaço pensado para crescer (várias configurações).
 */
import { BaseElement } from "../../components/base-element.js";
import { dataStore } from "../../core/data-store.js";
import { editarEmMassa } from "../shared/edicao-massa.js";
import { confirmar } from "../../components/confirmar.js";
import { nomeTipo } from "../pagamentos/pagamento-util.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-button.js";
import "../../components/ui-card.js";
import "../../components/ui-tabs.js";
import "../../components/ui-data-table.js";
import "../despesas/category-badge.js";
import "../../components/ui-spinner.js";
import "./users-table.js";
import "./user-form.js";
import "./user-config-form.js";
import "./tipo-transf-form.js";

class AdminView extends BaseElement {
  estilos() {
    return `
      :host { display: block; }
      .area { padding: var(--esp-tela); }
      .cabecalho { margin-bottom: var(--esp-5); }
      h1 { font-size: var(--fs-2xl); font-weight: var(--peso-forte); }
      p.sub { color: var(--cor-texto-suave); margin-top: var(--esp-2); }
      .pilha { display: flex; flex-direction: column; gap: var(--esp-5); }
      .badges { display: flex; flex-wrap: wrap; gap: var(--esp-2); }
      .vazio { color: var(--cor-texto-fraco); font-size: var(--fs-sm); }
    `;
  }

  template() {
    return `
      <div class="area">
        <div class="cabecalho">
          <h1>Configuração</h1>
          <p class="sub">Usuários do sistema e tipos de transferência. (Mais configurações virão aqui.)</p>
        </div>
        <ui-tabs id="abas">
          <div slot="usuarios">
            <ui-card mesa title="Mesa com usuários">
              <ui-button slot="acoes" id="novo">+ Novo usuário</ui-button>
              <div id="conteudoUsuarios"></div>
            </ui-card>
          </div>
          <div slot="transferencias" class="pilha">
            <ui-card mesa title="Mesa com tipos de transferência">
              <ui-button slot="acoes" id="novoTipo">+ Novo tipo</ui-button>
              <div id="listaTipos"></div>
            </ui-card>
            <ui-card title="Tipos base (fixos)"><div id="tiposFixos"></div></ui-card>
          </div>
        </ui-tabs>
      </div>
    `;
  }

  aoConectar() {
    const abas = this.$("#abas");
    if (abas)
      abas.abas = [
        { id: "usuarios", rotulo: "Usuários", icone: "usuario" },
        { id: "transferencias", rotulo: "Transferências", icone: "cifrao" },
      ];
    this.$("#novo").addEventListener("click", () => this.abrirUserForm(null));
    this.$("#novoTipo").addEventListener("click", () => this.abrirTipoForm(null));
    this.pintar();
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  pintar() {
    this.pintarUsuarios();
    this.pintarTipos();
  }

  pintarUsuarios() {
    const alvo = this.$("#conteudoUsuarios");
    if (!alvo) return;
    if (!dataStore.carregado()) {
      alvo.innerHTML = `<ui-spinner centro text="Carregando usuários..."></ui-spinner>`;
      return;
    }
    const tabela = document.createElement("users-table");
    tabela.usuarios = dataStore.usuarios();
    tabela.addEventListener("editar", (e) => this.abrirUserForm(e.detail.usuario));
    tabela.addEventListener("config", (e) => this.abrirConfig(e.detail.usuario));
    tabela.addEventListener("editar-massa", (e) =>
      editarEmMassa(e.detail.usuarios, {
        criarForm: (ref) => {
          const f = document.createElement("user-form");
          f.usuario = ref;
          return f;
        },
        reler: (ref) => dataStore.usuarios().find((u) => String(u.id) === String(ref.id)),
        aplicar: (l, diff) =>
          dataStore.adminAtualizarUsuario({ id: l.id, nome: l.nome, role: l.role, ativo: l.ativo, ...diff }),
        ignorar: ["email", "criado_por", "novaSenha"],
      })
    );
    alvo.replaceChildren(tabela);
  }

  pintarTipos() {
    const el = this.$("#listaTipos");
    const fixosEl = this.$("#tiposFixos");
    if (!el || !dataStore.carregado()) return;
    const tipos = dataStore.tiposTransferencia();
    const extras = tipos.filter((t) => !t.fixo);
    const fixos = tipos.filter((t) => t.fixo);

    // Meus tipos (extras) — só estes têm Editar/Excluir.
    if (!extras.length) {
      el.innerHTML = `<p class="vazio">Nenhum tipo personalizado. Use "+ Novo tipo" para criar (ex.: Pix).</p>`;
    } else {
      const tabela = document.createElement("ui-data-table");
      tabela.setAttribute("fluido", "");
      tabela.columns = [{ chave: "nome", titulo: "Tipo", formato: (v) => nomeTipo(v) }];
      tabela.acoes = [
        { nome: "editar", rotulo: "Editar" },
        { nome: "excluir", rotulo: "Excluir", variant: "perigo" },
      ];
      tabela.rows = extras;
      tabela.addEventListener("acao", (e) => {
        if (e.detail.acao === "editar") this.abrirTipoForm(e.detail.linha);
        else this.removerTipo(e.detail.linha);
      });
      el.replaceChildren(tabela);
    }

    // Tipos base (fixos) — apenas referência, sem ações.
    if (fixosEl) {
      fixosEl.innerHTML = `<div class="badges">${fixos
        .map((t) => `<category-badge nome="${nomeTipo(t.nome)}" cor="var(--cor-neutro)"></category-badge>`)
        .join("")}</div>`;
    }
  }

  abrirUserForm(usuario) {
    const form = document.createElement("user-form");
    form.usuario = usuario;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  abrirConfig(usuario) {
    const form = document.createElement("user-config-form");
    form.usuario = usuario;
    form.addEventListener("fechar", () => form.remove());
    document.body.appendChild(form);
  }

  abrirTipoForm(tipo) {
    const form = document.createElement("tipo-transf-form");
    form.tipo = tipo;
    const fechar = () => form.remove();
    form.addEventListener("fechar", fechar);
    form.addEventListener("salvo", fechar);
    document.body.appendChild(form);
  }

  async removerTipo(tipo) {
    const ok = await confirmar({
      titulo: "Excluir tipo de transferência",
      mensagem: `Excluir o tipo "${nomeTipo(tipo.nome)}"? As transferências já registradas com este tipo mantêm o registro; ele apenas deixa de aparecer no seletor.`,
      perigo: true,
      rotuloOk: "Excluir",
    });
    if (!ok) return;
    try {
      await dataStore.removerTipoTransferencia(tipo.id);
      toastSucesso("Tipo excluído.");
    } catch (e) {
      notificarErro(e);
    }
  }
}

customElements.define("admin-view", AdminView);
