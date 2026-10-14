/* Como o app da LOJA (Play Store / App Store) lida com assinatura (Rick, 14/10).
 *  - "web":  site / PWA — Hotmart normal.
 *  - "fora": app da loja NÃO vende. Botões e preços somem; quem cai numa tela de
 *            pagamento vê um aviso neutro. É o formato que a Apple aprova mais rápido
 *            (sem botão = 0% pra Apple) e o que o Google aceita no Brasil hoje.
 *  - "link": modelo Néctar — o botão abre a Hotmart no navegador do celular.
 *            Na Apple (Brasil, desde 18/06/2026) exige o entitlement de compra
 *            externa e paga 10%; no Google ainda não há programa pro Brasil.
 * Troca sem mexer no código: VITE_COBRANCA_LOJA=link no build da loja. */
import { plataforma } from "./platform";

export type ModoCobranca = "web" | "fora" | "link";
export const EVENTO_ASSINATURA_LOJA = "vant:assinatura-loja";

export function modoCobranca(env: string | undefined = import.meta.env.VITE_COBRANCA_LOJA): ModoCobranca {
  if (plataforma() === "web") return "web";
  return env === "link" ? "link" : "fora";
}

/** Botão de assinar, preço e oferta podem aparecer nesta tela? */
export const podeMostrarAssinatura = (): boolean => modoCobranca() !== "fora";
