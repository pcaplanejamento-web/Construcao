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
import { api } from "../../core/api-client.js";
import { editarEmMassa } from "../shared/edicao-massa.js";
import { confirmar } from "../../components/confirmar.js";
import { nomeTipo } from "../pagamentos/pagamento-util.js";
import { toastSucesso, notificarErro } from "../../core/event-bus.js";
import "../../components/ui-button.js";
import "../../components/ui-card.js";
import "../../components/ui-input.js";
import "../../components/ui-badge.js";
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

      /* Integrações — Google */
      .gcfg { display: flex; flex-direction: column; gap: var(--esp-4); max-width: 560px; }
      .gcfg .sub { color: var(--cor-texto-suave); font-size: var(--fs-sm); line-height: 1.5; }
      .gstatus { display: flex; align-items: center; gap: var(--esp-2); flex-wrap: wrap;
        font-size: var(--fs-sm); }
      .ghelp { font-size: var(--fs-sm); color: var(--cor-texto-suave); line-height: 1.6;
        background: var(--cor-superficie-2); border: 1px solid var(--cor-borda);
        border-radius: var(--raio-md); padding: var(--esp-3); }
      .ghelp code { font-family: var(--fonte-mono, monospace); font-size: 12px;
        background: var(--cor-superficie); padding: 1px 5px; border-radius: var(--raio-sm);
        word-break: break-all; }
      .ghelp a { color: var(--cor-primaria); font-weight: var(--peso-semi); }
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
          <div slot="integracoes" class="pilha">
            <ui-card title="Google — login e agenda">
              <div class="gcfg">
                <p class="sub">Cole o <b>Client ID</b> e o <b>Client Secret</b> do OAuth
                  (Google Cloud → Credenciais → Aplicativo da Web). Ficam guardados no
                  servidor; o Secret nunca volta ao navegador. Habilita "Entrar com
                  Google" e "Conectar Google".</p>
                <div class="gstatus" id="gStatus"></div>
                <ui-input id="gClientId" label="Client ID" placeholder="....apps.googleusercontent.com"></ui-input>
                <ui-input id="gSecret" label="Client Secret" type="password" placeholder="deixe em branco para manter o atual"></ui-input>
                <ui-button id="gSalvar">Salvar</ui-button>
                <div class="ghelp" id="gHelp"></div>
              </div>
            </ui-card>
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
        { id: "integracoes", rotulo: "Integrações", icone: "config" },
      ];
    this.$("#novo").addEventListener("click", () => this.abrirUserForm(null));
    this.$("#novoTipo").addEventListener("click", () => this.abrirTipoForm(null));
    this.$("#gSalvar").addEventListener("click", () => this.salvarGoogle());
    this.pintar();
    this.carregarGoogle();
    this.aoLimpar(dataStore.subscribe(() => this.pintar()));
  }

  /** Carrega o status atual da configuração Google (Client ID + Secret?). */
  async carregarGoogle() {
    let cfg = { clientId: "", secretConfigurado: false, redirectUri: "" };
    try {
      cfg = await api.call("admin.google.obter");
    } catch (e) {
      /* sem permissão ou backend antigo: mantém vazio */
    }
    this._redirectGoogle = cfg.redirectUri || "";
    this.pintarGoogle(cfg);
  }

  pintarGoogle(cfg) {
    const idEl = this.$("#gClientId");
    if (idEl) idEl.value = cfg.clientId || "";
    const st = this.$("#gStatus");
    if (st) {
      const idOk = !!cfg.clientId;
      const secOk = !!cfg.secretConfigurado;
      const pastilha = (ok, txt) =>
        `<ui-badge color="var(--cor-${ok ? "sucesso" : "neutro"})" text="${txt}"></ui-badge>`;
      st.innerHTML =
        pastilha(idOk, idOk ? "Client ID salvo" : "Client ID pendente") +
        pastilha(secOk, secOk ? "Secret salvo" : "Secret pendente");
    }
    const help = this.$("#gHelp");
    if (help) {
      const redirect = cfg.redirectUri || "(a URL /exec do Web App)";
      help.innerHTML =
        `No <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud → Credenciais</a>, ` +
        `crie um <b>ID do cliente OAuth</b> (Aplicativo da Web) e habilite a ` +
        `<a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener">Calendar API</a>.<br>` +
        `<b>Origens JavaScript:</b> <code>https://dattaobra.com.br</code> e <code>https://pcaplanejamento-web.github.io</code><br>` +
        `<b>URI de redirecionamento:</b> <code>${redirect}</code>`;
    }
  }

  async salvarGoogle() {
    const clientId = this.$("#gClientId").value.trim();
    const clientSecret = this.$("#gSecret").value.trim();
    if (!clientId) {
      notificarErro(new Error("Informe o Client ID."));
      return;
    }
    const btn = this.$("#gSalvar");
    btn.setAttribute("loading", "");
    try {
      const cfg = await api.call("admin.google.definir", { clientId, clientSecret });
      this.$("#gSecret").value = "";
      this.pintarGoogle({ ...cfg, redirectUri: this._redirectGoogle });
      toastSucesso("Configuração do Google salva. O botão de login já reflete o Client ID.");
    } catch (e) {
      notificarErro(e);
    } finally {
      btn.removeAttribute("loading");
    }
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
