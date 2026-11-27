import { criarFluxo, type Fluxo } from "../lib/fluxo-compra";
import { ponteApple } from "../lib/ponte";
import { validarNoServidor } from "./validar-compra";

/* The one purchase flow of the running app, shared by the plans screen, the bank add-on card and
   the recovery that runs in the background, so the same transaction is never processed twice. */
let conta: string | null = null;
let fluxo: Fluxo | null | undefined;

/** The logged-in VANT account (set by the recovery component on every change of session). */
export function definirContaDaCompra(id: string | null): void { conta = id; }

/** null outside the iPhone app. */
export function fluxoDoApp(): Fluxo | null {
  if (fluxo === undefined) {
    const p = ponteApple();
    fluxo = p ? criarFluxo({ ponte: p, validar: validarNoServidor, conta: () => conta }) : null;
  }
  return fluxo;
}
