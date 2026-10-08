/* Who sees the "a Vant mudou de endereço" popup (Rick, 08/10/2026).
   Only people still opening the app on the OLD address, and only after Rick turns
   it on (app_settings.aviso_novo_dominio = 'on'). "Depois" hides it for a day. */

export const DOMINIO_NOVO = "app.vantapp.com.br";
export const DOMINIOS_ANTIGOS = ["app.orbis.inf.br", "vantapp.com.br", "orbis-money-mentor-two.vercel.app"];
export const ADIAR_MS = 24 * 60 * 60 * 1000;
export const CHAVE_ADIADO = "vant_aviso_dominio_adiado_em";

export function deveMostrarAviso(o: { host: string; ligado: boolean; adiadoEm: number | null; agora: number }): boolean {
  if (!o.ligado) return false;
  if (!DOMINIOS_ANTIGOS.includes(o.host.toLowerCase())) return false;
  if (o.adiadoEm && o.agora - o.adiadoEm < ADIAR_MS) return false;
  return true;
}

/** New address. With a passe the user arrives logged in (/entrar); without, at /install. */
export function linkNovoDominio(passe?: string | null): string {
  return passe
    ? `https://${DOMINIO_NOVO}/entrar#passe=${encodeURIComponent(passe)}`
    : `https://${DOMINIO_NOVO}/install?de=orbis`;
}

/** Reads the passe from the URL fragment (never sent to any server). */
export function passeDoHash(hash: string): string | null {
  const m = /(?:^#|&)passe=([A-Za-z0-9_-]{30,64})(?:&|$)/.exec(hash);
  return m ? m[1] ?? null : null;
}

export type Aparelho = "ios" | "android" | "outro";
export function aparelhoDe(ua: string): Aparelho {
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "outro";
}
