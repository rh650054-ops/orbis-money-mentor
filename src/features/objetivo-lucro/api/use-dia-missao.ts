/* 05/11 (Rick): tap a day of the mission → how that day went (objetivo_lucro_dia). */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { diaMissaoSchema, type DiaMissao } from "../types";
import { objetivoLucroKeys } from "./use-objetivo-lucro";

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

export function useDiaMissaoQuery(objId: string | undefined, dia: string | null) {
  return useQuery({
    queryKey: objetivoLucroKeys.detail(`dia:${objId ?? ""}:${dia ?? ""}`),
    enabled: !!objId && !!dia,
    queryFn: async (): Promise<DiaMissao | null> => {
      const { data, error } = await rpc("objetivo_lucro_dia", { p_obj: objId, p_dia: dia });
      if (error) throw error;
      return data ? diaMissaoSchema.parse(data) : null;
    },
  });
}
