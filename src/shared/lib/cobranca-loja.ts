/* Como o app da LOJA (Play Store / App Store) lida com assinatura.
 *  - "web":  site / PWA — Hotmart normal.
 *  - "link": PADRÃO (decisão do Rick, 14/10 15h08) — modelo Néctar: o botão de
 *            assinar abre a Hotmart no navegador do celular. Na Apple (Brasil, desde
 *            18/06/2026) pede o entitlement de compra externa e paga 10% (Small
 *            Business) das compras em até 7 dias do toque; no Google ainda não há
 *            programa pro Brasil — risco de reprovação conhecido e aceito.
 *  - "fora": plano B se uma loja reprovar — o app da loja não vende: botões e preços
 *            somem e quem cai numa tela de pagamento vê um aviso neutro.
 * Troca sem mexer no código: VITE_COBRANCA_LOJA=fora no build da loja. */
import { plataforma } from "./platform";

export type ModoCobranca = "web" | "fora" | "link";
export const EVENTO_ASSINATURA_LOJA = "vant:assinatura-loja";

export function modoCobranca(env: string | undefined = import.meta.env.VITE_COBRANCA_LOJA): ModoCobranca {
  if (plataforma() === "web") return "web";
  return env === "fora" ? "fora" : "link";
}

/** Botão de assinar, preço e oferta podem aparecer nesta tela? */
export const podeMostrarAssinatura = (): boolean => modoCobranca() !== "fora";
