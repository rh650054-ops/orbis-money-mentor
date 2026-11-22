/* 22/11 (Etapa 2): the registration in progress survives leaving the screen (call, app in the
   background, back button). Per user, on this device; cleared when the product is saved or he starts
   over. Storage blocked (private mode) = it just is not kept, nothing breaks. */
import { RASCUNHO_VAZIO, type RascunhoProduto } from "../types";

export type PassoGuardado = "nome" | "origem" | "custo" | "sabores" | "preco" | "revisao";
const chave = (userId: string) => `vant_cadastro_rascunho_v1:${userId}`;

export function lerRascunho(userId: string | undefined): { r: RascunhoProduto; passo: PassoGuardado } | null {
  if (!userId) return null;
  try {
    const bruto = localStorage.getItem(chave(userId));
    if (!bruto) return null;
    const v = JSON.parse(bruto) as { r?: Partial<RascunhoProduto>; passo?: PassoGuardado };
    if (!v.r || typeof v.r.nome !== "string" || !v.r.nome.trim()) return null;
    return { r: { ...RASCUNHO_VAZIO, ...v.r, id: undefined }, passo: v.passo ?? "nome" };
  } catch { return null; }
}

export function guardarRascunho(userId: string | undefined, r: RascunhoProduto, passo: PassoGuardado): void {
  if (!userId || !r.nome.trim()) return;
  try { localStorage.setItem(chave(userId), JSON.stringify({ r, passo })); } catch { /* not kept */ }
}

export function apagarRascunho(userId: string | undefined): void {
  if (!userId) return;
  try { localStorage.removeItem(chave(userId)); } catch { /* nothing to clear */ }
}
