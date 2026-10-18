/* Legacy fallback source for today's hero (vant_pro_hoje). */
import { supabase } from "@/shared/api";

export interface ProHoje { dia: string; caiu: number; qtd: number; lancou: number; ultima_leitura: string | null }

export async function carregarProHoje(): Promise<ProHoje | null> {
  const { data, error } = await (supabase.rpc as unknown as (f: string) => PromiseLike<{ data: unknown; error: unknown }>)("vant_pro_hoje");
  const r = data as Partial<ProHoje> | null;
  if (error || !r?.dia) return null;
  return { dia: String(r.dia), caiu: Number(r.caiu) || 0, qtd: Number(r.qtd) || 0, lancou: Number(r.lancou) || 0, ultima_leitura: r.ultima_leitura ?? null };
}
