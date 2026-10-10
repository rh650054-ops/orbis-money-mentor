/* FEZ × CAIU por dia (aba Vender, Rick 10/10/2026). Dados de vender_fez_caiu(). */
import { supabase } from "@/integrations/supabase/client";

import type { DiaFezCaiu } from "./fez-caiu-conta";
export { naoApareceu, somaSemana, type DiaFezCaiu } from "./fez-caiu-conta";

const n = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

export async function carregarFezCaiu(dias = 7): Promise<DiaFezCaiu[]> {
  const { data, error } = await (supabase as unknown as { rpc: (f: string, a: object) => Promise<{ data: unknown; error: unknown }> })
    .rpc("vender_fez_caiu", { p_dias: dias });
  if (error || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    dia: String(r.dia ?? ""),
    fez: n(r.fez),
    dinheiro: n(r.dinheiro),
    caiu: r.caiu === null || r.caiu === undefined ? null : n(r.caiu),
    conferido: Boolean(r.conferido),
  }));
}
