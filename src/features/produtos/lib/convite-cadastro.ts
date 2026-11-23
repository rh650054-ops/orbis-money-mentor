/* Dashboard invite to register products (22/11, Etapa 2). Never insistent:
   - "Mais tarde" hides it for 7 days, then it may come back once more;
   - "Não mostrar novamente" hides it for good;
   - it never shows to someone who already has a product.
   Per user, on this device (same pattern as the other notices: there is no per-user preferences
   table in the database; keeping it across devices would be a new data model). */
const chave = (userId: string) => `vant_convite_cadastro_v1:${userId}`;
export const ADIAR_DIAS = 7;

export interface EstadoConvite { adiadoAte?: number; nunca?: boolean }

export function lerConvite(userId: string): EstadoConvite {
  try { return JSON.parse(localStorage.getItem(chave(userId)) ?? "{}") as EstadoConvite; } catch { return {}; }
}

function gravar(userId: string, e: EstadoConvite): void {
  try { localStorage.setItem(chave(userId), JSON.stringify(e)); } catch { /* private mode: hidden for this visit only */ }
}

export const adiarConvite = (userId: string, agora = Date.now()) => gravar(userId, { adiadoAte: agora + ADIAR_DIAS * 86_400_000 });
export const nuncaMaisConvite = (userId: string) => gravar(userId, { nunca: true });

export function deveMostrarConvite(p: { estado: EstadoConvite; liberado: boolean; produtos: number | undefined; agora?: number }): boolean {
  if (!p.liberado || p.produtos === undefined || p.produtos > 0 || p.estado.nunca) return false;
  return !(p.estado.adiadoAte && (p.agora ?? Date.now()) < p.estado.adiadoAte);
}
