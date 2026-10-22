import { ehAppDaLoja } from "./platform";

/*
 * X1 in the STORE build (Play Store / App Store) — Rick, 22/10/2026.
 * The stores treat a wallet with real money between users as gambling/payments,
 * so the store app runs the X1 on points only: no wallet, no stakes, every fight
 * "na honra" (XP). The web/PWA keeps the money mode untouched.
 *
 * Deliberately low-key: nothing says "money is off". Amounts simply show as
 * zero, so every existing "stakes > 0" text falls back to "na honra".
 */

/** True inside the store binary: X1 is points only. */
export const x1SoPontos = (): boolean => ehAppDaLoja();

/** Amount to SHOW. Zero in the store build, the real value on the web. */
export const apostaVisivel = (valor: number): number => (x1SoPontos() ? 0 : Number(valor) || 0);
