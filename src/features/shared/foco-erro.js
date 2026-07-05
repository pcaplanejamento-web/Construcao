/**
 * foco-erro.js — Ao submeter um form com erro, leva o foco (e a rolagem) para o
 * PRIMEIRO campo marcado com [error]. Útil em forms altos (no celular o erro pode
 * estar fora da vista). Atravessa o shadow do campo (ui-input/ui-select) para
 * focar o controle interno.
 *
 *   import { focarPrimeiroErro } from "../shared/foco-erro.js";
 *   // depois de setar os erros e antes de retornar:
 *   focarPrimeiroErro(this);
 */
export function focarPrimeiroErro(host) {
  const raiz = host && host.shadowRoot ? host.shadowRoot : host;
  if (!raiz || !raiz.querySelector) return false;
  const campo = raiz.querySelector("[error]");
  if (!campo) return false;
  const interno =
    (campo.shadowRoot && campo.shadowRoot.querySelector("input, textarea, .campo, [tabindex]")) || campo;
  try {
    if (interno.focus) interno.focus({ preventScroll: true });
  } catch (e) {
    if (interno.focus) interno.focus();
  }
  if (campo.scrollIntoView) campo.scrollIntoView({ block: "center", behavior: "smooth" });
  return true;
}
