/* The active mission seen from outside the feature: planned revenue, profit target and
   which days are rest days. null when there is no active mission with a plan. */
import { useMemo } from "react";
import { useDesafioAtualQuery } from "./use-objetivo-lucro";
import { faturamentoDoPlano, mapaDeFolga } from "../lib/missao-dias";

export interface MissaoResumo { faturamento: number; alvo: number; fim: string; folgas: Map<string, boolean> }

export function useMissaoResumo(): MissaoResumo | null {
  const { data: d } = useDesafioAtualQuery();
  return useMemo(() => {
    if (!d || d.status !== "ativo" || d.plano.length === 0) return null;
    return { faturamento: faturamentoDoPlano(d.plano, d.custo_unid, d.lucro_unid), alvo: d.alvo, fim: d.fim, folgas: mapaDeFolga(d.plano) };
  }, [d]);
}
