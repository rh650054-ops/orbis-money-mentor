/* Weather for the mission: the 7-day forecast the weather screen already has (summarised
   by selling hours) + how much a rainy day costs this seller (objetivo_lucro_clima). */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { useClima } from "@/hooks/useClima";
import type { ClimaDia, ClimaPlano } from "../lib/cronograma";
import { objetivoLucroKeys } from "./use-objetivo-lucro";

const num = z.coerce.number().catch(0);
const impactoSchema = z.object({ fator: num, dias_chuva: num, dias_seco: num, unid_chuva: num, unid_seco: num, proprio: z.boolean().catch(false) });
export type ImpactoChuva = z.infer<typeof impactoSchema>;

type Rpc = (fn: string) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc: Rpc = (fn) => (supabase as unknown as { rpc: Rpc }).rpc(fn);

export function useClimaPlano(ativo: boolean): { plano: ClimaPlano | undefined; impacto: ImpactoChuva | null; cidade: string | null } {
  const { tempo } = useClima({ comOpiniao: false, auto: ativo });
  const { data: impacto } = useQuery({
    queryKey: objetivoLucroKeys.detail("clima"),
    enabled: ativo,
    queryFn: async () => {
      const { data, error } = await rpc("objetivo_lucro_clima");
      if (error) throw error;
      return data ? impactoSchema.parse(data) : null;
    },
  });
  const plano = useMemo(() => {
    if (!tempo?.dias?.length) return undefined;
    const previsao = new Map<string, ClimaDia>(tempo.dias.map((d) => {
      const tipo: ClimaDia["tipo"] = d.garoa ? "garoa" : (d.codigo ?? 0) >= 61 && (d.prob ?? 0) >= 50 ? "chuva" : "seco";
      return [d.data, { tipo, prob: d.prob ?? 0, codigo: d.codigo, max: d.max }];
    }));
    return { previsao, fator: impacto?.fator ?? 0.7 };
  }, [tempo, impacto]);
  return { plano, impacto: impacto ?? null, cidade: tempo?.cidade ?? null };
}
