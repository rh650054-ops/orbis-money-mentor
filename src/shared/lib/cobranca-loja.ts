/* Como o app da LOJA (Play Store / App Store) lida com assinatura.
 *  - "web":  site / PWA — Hotmart normal, os 3 planos na tela.
 *  - "link": modelo Néctar (Rick, 23/10/2026 — padrão nas duas lojas): o app NÃO mostra
 *            preço nem checkout. Quem não tem acesso vê "Assinatura inválida" com um botão
 *            "Assinar" que abre o site da VANT no navegador do celular, mais "Tentar
 *            novamente" e "Sair da conta". A compra acontece no site (Hotmart) e o
 *            webhook libera a conta pelo CPF.
 *  - "fora": reserva, se uma loja recusar o link: nem botão, só o aviso neutro com suporte.
 * Troca sem mexer no código: VITE_COBRANCA_LOJA=fora no build da loja. */
import { plataforma } from "./platform";

export type ModoCobranca = "web" | "fora" | "link";
export const EVENTO_ASSINATURA_LOJA = "vant:assinatura-loja";

/** Fallback when the token cannot be created: /assinar without a token (3 plans, straight to
 *  Hotmart). Not the landing (beta.vantapp.com.br/#planos): its buttons are "Começar 3 dias
 *  grátis", which starts a NEW account instead of paying for the one the vendor already has
 *  (24/11/2026). */
export const LINK_ASSINAR_SITE = "https://app.vantapp.com.br/assinar";

export function modoCobranca(env: string | undefined = import.meta.env.VITE_COBRANCA_LOJA): ModoCobranca {
  if (plataforma() === "web") return "web";
  return env === "fora" ? "fora" : "link";
}

/** Botão de assinar, preço e oferta podem aparecer nesta tela? Só no site. */
export const podeMostrarAssinatura = (): boolean => modoCobranca() === "web";

/** App da loja no modelo Néctar: tudo que é "assinar" vira o botão que abre o site. */
export const assinaPeloSite = (): boolean => modoCobranca() === "link";
