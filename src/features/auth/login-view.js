/**
 * <login-view> — Tela de login (rota pública /login).
 *
 * Layout split-screen (igual ao design): à ESQUERDA (fundo claro) a marca + o
 * <login-form>; à DIREITA (fundo verde-escuro) um painel de marketing com card
 * "Execução das obras" (sparkline), título, destaques e o fundo animado de
 * grafos (<login-grafo-bg>). Visual FIXO (não segue tema claro/escuro). No
 * mobile (< 900px) o painel direito some e fica só o formulário.
 *
 * O carregamento dos dados após o login acontece nesta tela (o botão do
 * formulário fica em loading) — ver login-form.js e app.js.
 */
import { BaseElement } from "../../components/base-element.js";
import { API_NAO_CONFIGURADA } from "../../core/config.js";
import "./login-form.js";
import "./login-grafo-bg.js";
import "../../components/ui-icon.js";

class LoginView extends BaseElement {
  estilos() {
    return `
      :host { position: fixed; inset: 0; display: grid;
        grid-template-columns: 1fr 1fr; overflow: auto; background: #ffffff;
        color: #0f172a; font-family: var(--fonte, inherit); }

      /* ---------- Esquerda (formulário) ---------- */
      .esq { display: flex; flex-direction: column; justify-content: center;
        padding: var(--esp-6); }
      .esq-inner { width: 100%; max-width: 400px; margin: 0 auto; }
      .marca { display: flex; align-items: center; gap: 10px; margin-bottom: var(--esp-6); }
      .marca img { height: 30px; width: auto; display: block; }
      .marca .nome { font-size: 20px; font-weight: 800; letter-spacing: -.01em; }
      h1 { font-size: 30px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 8px; }
      .sub { color: #64748b; font-size: 15px; margin: 0 0 var(--esp-6); line-height: 1.5; }
      .rodape-esq { margin-top: var(--esp-6); color: #94a3b8; font-size: 13px; }
      .aviso { margin-top: var(--esp-4); font-size: 12px; background: #fffbeb;
        border: 1px solid #fde68a; color: #92400e; padding: var(--esp-3);
        border-radius: var(--raio-md); }

      /* ---------- Direita (marketing) ---------- */
      .dir { position: relative; overflow: hidden; color: #ecfdf5;
        background:
          radial-gradient(120% 80% at 80% 0%, rgba(16,185,129,.18), transparent 60%),
          linear-gradient(155deg, #06140e 0%, #0a1f16 55%, #0c2a1d 100%); }
      .dir-inner { position: relative; z-index: 1; height: 100%; box-sizing: border-box;
        display: flex; flex-direction: column; padding: 44px clamp(40px, 5vw, 72px); }

      .topo { display: flex; align-items: flex-start; justify-content: space-between;
        gap: var(--esp-4); }
      .marca-dir { display: flex; align-items: center; gap: 10px; }
      .marca-dir img { height: 28px; width: auto; display: block; }
      .marca-dir .nome { font-size: 19px; font-weight: 800; color: #fff; }

      .card { width: 230px; flex: none; border-radius: 16px; padding: 14px 16px;
        background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10);
        backdrop-filter: blur(6px); box-shadow: 0 12px 30px rgba(0,0,0,.25); }
      .card .lin { display: flex; align-items: center; justify-content: space-between; }
      .card .rot { font-size: 12px; color: #a7c4b5; }
      .card .delta { font-size: 12px; font-weight: 700; color: #34d399; }
      .card .val { font-size: 26px; font-weight: 800; color: #fff; margin-top: 2px; letter-spacing: -.01em; }
      .card svg { display: block; width: 100%; height: 44px; margin-top: 8px; overflow: visible; }
      .card polyline { fill: none; stroke: #34d399; stroke-width: 2;
        stroke-linecap: round; stroke-linejoin: round;
        stroke-dasharray: 1; stroke-dashoffset: 1; animation: traco 1.8s ease forwards .2s; }
      @keyframes traco { to { stroke-dashoffset: 0; } }

      .centro { flex: 1; display: flex; flex-direction: column; justify-content: center;
        padding: clamp(24px, 6vh, 64px) 0; max-width: 560px; }
      .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: #34d399; margin-bottom: var(--esp-4); }
      h2 { font-size: clamp(34px, 4vw, 52px); line-height: 1.05; font-weight: 800;
        letter-spacing: -.02em; color: #fff; margin: 0 0 var(--esp-5); }
      h2 .verde { color: #34d399; }
      .lead { font-size: 16px; line-height: 1.6; color: #c5d8cf; margin: 0; max-width: 520px; }

      .feats { display: flex; flex-direction: column; gap: var(--esp-4);
        padding-top: clamp(20px, 4vh, 40px); }
      .feat { display: flex; align-items: flex-start; gap: 14px; }
      .feat .ic { flex: none; width: 40px; height: 40px; border-radius: 11px;
        display: flex; align-items: center; justify-content: center; color: #34d399;
        background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.20); }
      .feat .tit { font-size: 15px; font-weight: 700; color: #fff; }
      .feat .desc { font-size: 13.5px; color: #a7c4b5; line-height: 1.5; margin-top: 2px; }

      .rodape-dir { margin-top: clamp(24px, 4vh, 40px); font-size: 12px; color: #6f8a7d; }

      /* ---------- Responsivo ---------- */
      @media (max-width: 900px) {
        :host { grid-template-columns: 1fr; }
        .dir { display: none; }
      }
    `;
  }

  template() {
    const logo = `<img src="src/assets/dattaobra.png" alt="Dattaobra" />`;
    const feat = (icone, tit, desc) => `
      <div class="feat">
        <div class="ic"><ui-icon name="${icone}" size="20"></ui-icon></div>
        <div>
          <div class="tit">${tit}</div>
          <div class="desc">${desc}</div>
        </div>
      </div>`;

    return `
      <div class="esq">
        <div class="esq-inner">
          <div class="marca">${logo}<span class="nome">Dattaobra</span></div>
          <h1>Bem-vindo de volta</h1>
          <p class="sub">Acesse o painel do Dattaobra e continue acompanhando suas obras.</p>
          <login-form></login-form>
          ${
            API_NAO_CONFIGURADA
              ? `<div class="aviso">API não configurada. Defina a URL do Web App em
                 <code>src/core/config.js</code> (veja docs/SETUP-E-DEPLOY.md).</div>`
              : ""
          }
          <p class="rodape-esq">Acesso restrito. Solicite cadastro ao administrador da obra.</p>
        </div>
      </div>

      <div class="dir">
        <login-grafo-bg></login-grafo-bg>
        <div class="dir-inner">
          <div class="topo">
            <div class="marca-dir">${logo}<span class="nome">Dattaobra</span></div>
            <div class="card">
              <div class="lin">
                <span class="rot">Execução das obras</span>
                <span class="delta">▲ 6%</span>
              </div>
              <div class="val">R$ 318,7 mil</div>
              <svg viewBox="0 0 200 44" aria-hidden="true">
                <polyline pathLength="1" points="0,38 22,32 44,35 66,24 88,28 110,18 132,22 154,11 176,15 200,5"></polyline>
              </svg>
            </div>
          </div>

          <div class="centro">
            <div class="eyebrow">Gestão de obras em tempo real</div>
            <h2>Cada obra. Cada real. <span class="verde">Sob controle.</span></h2>
            <p class="lead">O Dattaobra reúne orçamento, gastos, fornecedores e cotações de
              cada obra em uma única interface — para você acompanhar a execução em tempo
              real e decidir com dados atualizados.</p>
          </div>

          <div class="feats">
            ${feat("tendencia", "Gastos em tempo real", "Acompanhe orçamento e execução de cada obra, atualizados a cada lançamento.")}
            ${feat("fornecedor", "Fornecedores e cotações", "Compare preços, centralize compras e negocie com o histórico na mão.")}
            ${feat("usuarios", "Equipe e clientes juntos", "Compartilhe a obra e mantenha todos acompanhando o mesmo painel.")}
          </div>

          <div class="rodape-dir">© 2026 Dattaobra · Gestão de obras guiada por dados</div>
        </div>
      </div>
    `;
  }
}

customElements.define("login-view", LoginView);
