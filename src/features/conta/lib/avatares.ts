/* VANT avatar family (18/10/2026): one line-icon set, same stroke and geometry,
   served as files from /public/avatares. The profile stores the path
   ("/avatares/raio.svg"), so every <img src> in the app renders it as-is. */
export const AVATARES_VANT = [
  { id: "raio", nome: "Raio" },
  { id: "coroa", nome: "Coroa" },
  { id: "diamante", nome: "Diamante" },
  { id: "alvo", nome: "Alvo" },
  { id: "trofeu", nome: "Troféu" },
  { id: "foguete", nome: "Foguete" },
  { id: "fogo", nome: "Fogo" },
  { id: "vendedor", nome: "Vendedor" },
  { id: "campeao", nome: "Campeão" },
] as const;

export const caminhoAvatar = (id: string) => `/avatares/${id}.svg`;

export function ehAvatarVant(url: string | null | undefined): boolean {
  return !!url && /^\/avatares\/[a-z]+\.svg$/.test(url);
}

/** A real picture the vendor uploaded (not an icon, not an old emoji). */
export function ehFoto(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url);
}
