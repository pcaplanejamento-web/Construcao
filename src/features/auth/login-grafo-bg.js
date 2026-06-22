/**
 * <login-grafo-bg> — Fundo animado de "grafos" para o painel direito do login.
 *
 * Canvas leve: ~52 nós à deriva + arestas entre vizinhos, verde translúcido
 * sobre o fundo escuro. Respeita prefers-reduced-motion (desenha estático) e
 * pausa quando a aba está oculta. Cleanup de rAF/observer via aoLimpar.
 *
 * Uso: <login-grafo-bg></login-grafo-bg> (posiciona-se absolute, atrás do conteúdo).
 */
import { BaseElement } from "../../components/base-element.js";

const N = 52; // nós
const DIST = 150; // distância máx. (px CSS) p/ desenhar aresta
const VEL = 0.18; // velocidade base

class LoginGrafoBg extends BaseElement {
  estilos() {
    return `
      :host { position: absolute; inset: 0; display: block; overflow: hidden;
        pointer-events: none; }
      canvas { display: block; width: 100%; height: 100%; }
    `;
  }

  template() {
    return `<canvas></canvas>`;
  }

  aoConectar() {
    const canvas = this.$("canvas");
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduz =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let nos = [];
    let raf = 0;

    const criarNos = () => {
      nos = Array.from({ length: N }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * VEL,
        vy: (Math.random() - 0.5) * VEL,
      }));
    };

    const dimensionar = (w, h) => {
      if (w < 1 || h < 1) return; // painel oculto/sem layout: espera ter tamanho
      const ow = W;
      const oh = H;
      W = w;
      H = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!nos.length) criarNos();
      else if (ow > 0 && oh > 0) nos.forEach((n) => { n.x = (n.x / ow) * W; n.y = (n.y / oh) * H; });
    };

    const desenhar = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < nos.length; i++) {
        for (let j = i + 1; j < nos.length; j++) {
          const dx = nos[i].x - nos[j].x;
          const dy = nos[i].y - nos[j].y;
          const d = Math.hypot(dx, dy);
          if (d < DIST) {
            ctx.strokeStyle = `rgba(45, 212, 191, ${(1 - d / DIST) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nos[i].x, nos[i].y);
            ctx.lineTo(nos[j].x, nos[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = "rgba(110, 231, 183, 0.5)";
      for (const n of nos) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const passo = () => {
      for (const n of nos) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }
      desenhar();
      raf = requestAnimationFrame(passo);
    };

    const iniciar = () => {
      if (!raf && W && H) raf = requestAnimationFrame(passo);
    };
    const parar = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    // ResizeObserver dá o tamanho inicial + reage a mudanças de layout.
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      dimensionar(r.width, r.height);
      if (reduz) desenhar();
      else iniciar();
    });
    ro.observe(this);

    if (!reduz) {
      const onVis = () => (document.hidden ? parar() : iniciar());
      document.addEventListener("visibilitychange", onVis);
      this.aoLimpar(() => document.removeEventListener("visibilitychange", onVis));
    }

    this.aoLimpar(() => {
      parar();
      ro.disconnect();
    });
  }
}

customElements.define("login-grafo-bg", LoginGrafoBg);
