/**
 * confirmar.js — Modal de AVISO/CONFIRMAÇÃO reutilizável (substitui o `confirm()`
 * nativo nos fluxos de exclusão). Usa `ui-modal` + `ui-button` (sem componente novo).
 *
 * `confirmar(opts)` → Promise<boolean> (true = confirmou). `avisar(opts)` → Promise<void>
 * (só botão OK, informativo). `opts`: { titulo, mensagem, listaHtml?, rotuloOk?,
 * rotuloCancelar?, perigo?, soOk? }.
 */
import "./ui-modal.js";
import "./ui-button.js";

export function confirmar(opts = {}) {
  return new Promise((resolve) => {
    const modal = document.createElement("ui-modal");
    modal.setAttribute("open", "");
    modal.setAttribute("title", opts.titulo || "Confirmar");

    const corpo = document.createElement("div");
    corpo.innerHTML = `
      <style>
        .cf-msg { color: var(--cor-texto); margin-bottom: var(--esp-3); line-height: 1.5; }
        .cf-lista { background: var(--cor-superficie-2); border: 1px solid var(--cor-borda-forte);
          border-radius: var(--raio-sm); padding: var(--esp-3); display:flex; flex-direction:column; gap:4px;
          font-size: var(--fs-sm); color: var(--cor-texto-suave); max-height: 220px; overflow:auto; }
      </style>
      <div class="cf-msg">${opts.mensagem || ""}</div>
      ${opts.listaHtml ? `<div class="cf-lista">${opts.listaHtml}</div>` : ""}`;
    modal.appendChild(corpo);

    const rod = document.createElement("div");
    rod.setAttribute("slot", "rodape");
    let resolvido = false;
    const fechar = (v) => {
      if (resolvido) return;
      resolvido = true;
      modal.remove();
      resolve(v);
    };
    if (!opts.soOk) {
      const cancelar = document.createElement("ui-button");
      cancelar.setAttribute("variant", "secundario");
      cancelar.textContent = opts.rotuloCancelar || "Cancelar";
      cancelar.addEventListener("click", () => fechar(false));
      rod.appendChild(cancelar);
    }
    const ok = document.createElement("ui-button");
    if (opts.perigo) ok.setAttribute("variant", "perigo");
    ok.textContent = opts.rotuloOk || (opts.soOk ? "Entendi" : "Confirmar");
    ok.addEventListener("click", () => fechar(true));
    rod.appendChild(ok);
    modal.appendChild(rod);

    modal.addEventListener("fechar", () => fechar(false));
    document.body.appendChild(modal);
  });
}

/** Aviso informativo (só botão OK). */
export function avisar(opts = {}) {
  return confirmar(Object.assign({}, opts, { soOk: true })).then(() => {});
}
