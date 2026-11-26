/* Renewal path (Rick, 26/11/2026): "Plano de assinatura já foi comprado anteriormente".
   Every checkout button used to open a NEW Hotmart checkout of the same plan — refused by Hotmart
   while the old subscription is still alive (overdue, first payment open, or active). The server
   (assinatura_caminho) says which path is right; abrirCheckout asks here before opening:
     em_dia       → nothing to buy again (same plan)
     regularizar  → pay the existing charge (Pix / Hotmart area)
     pendente     → the first payment is still open → pay it
     conciliar    → paid at Hotmart, blocked here → check with Hotmart and release
     nova         → a new checkout is valid
   Never blocks: the extra-bank add-on, or moving up to Pro from a plan that is not Pro. When the
   server cannot answer (old database, offline) the old checkout opens, as before. */
import { supabase } from "@/integrations/supabase/client";

export type AcaoCaminho = "em_dia" | "conciliar" | "regularizar" | "pendente" | "nova";
export interface Caminho {
  acao: AcaoCaminho; assinatura?: string; status?: string; oferta?: string | null; plano?: string | null;
  proxima_cobranca?: string | null; valor?: number | null; tem_pix?: boolean;
}

export const EVENTO_CAMINHO = "vant:caminho-assinatura";
const BANCO_EXTRA = new Set(["3nnrr1xn", "otgozkn9"]);
const OFERTAS_PRO = new Set(["5y86n311", "6vkxbh8c", "ew11enu0", "t9xt3k4z", "ckkw1xkf"]);
const ehPro = (oferta?: string | null, plano?: string | null) => OFERTAS_PRO.has(oferta ?? "") || /\bpro\b/i.test(plano ?? "");

export function ofertaDoLink(url: string): string | null {
  try { return new URL(url).searchParams.get("off"); } catch { return null; }
}

/** Should this checkout link be replaced by the right path? (pure, tested) */
export function precisaDesviar(c: Caminho | null | undefined, url: string): boolean {
  if (!c || c.acao === "nova") return false;
  const off = ofertaDoLink(url);
  if (off && BANCO_EXTRA.has(off)) return false;
  if (c.acao === "em_dia") return !off || off === c.oferta;
  // overdue / open / paid-not-released: only an upgrade to Pro from a plan that is not Pro goes on
  return !(off && OFERTAS_PRO.has(off) && !ehPro(c.oferta, c.plano));
}

/* The logged-in person's path, kept in memory so the tap on "Assinar" is decided at once
   (an await before window.open would get the checkout blocked as a popup). */
let USUARIO: string | null = null;
let CAMINHO: Caminho | null | undefined;

export function caminhoDaSessao(): { usuario: string | null; caminho: Caminho | null | undefined } {
  return { usuario: USUARIO, caminho: CAMINHO };
}
export function definirUsuarioDoCaminho(userId: string | null): void {
  if (userId !== USUARIO) { USUARIO = userId; CAMINHO = undefined; }
}

/** Reads the path from the server (null = the server cannot tell: old checkout behaviour). */
export async function carregarCaminho(): Promise<Caminho | null> {
  try {
    const { data, error } = await supabase.rpc("assinatura_caminho" as never);
    const c = error ? null : ((data as unknown as Caminho | null) ?? null);
    CAMINHO = c;
    return c;
  } catch { CAMINHO = null; return null; }
}

/** After "Já paguei": asks Hotmart (read only) and releases access when it is paid. */
export async function conferirNaHotmart(token?: string | null): Promise<{ liberado: boolean; caminho: Caminho | null; limitado?: boolean } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("hotmart-conciliar", { body: token ? { t: token } : {} });
    if (error) return null;
    const r = data as { liberado?: boolean; caminho?: Caminho | null; limitado?: boolean };
    if (r.caminho !== undefined && !token) CAMINHO = r.caminho ?? null;
    return { liberado: !!r.liberado, caminho: r.caminho ?? null, limitado: r.limitado };
  } catch { return null; }
}

/** dd/mm/aaaa in Brasília, or null */
export function dataBR(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
