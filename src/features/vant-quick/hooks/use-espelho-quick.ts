import { useEffect, useRef } from "react";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { quick, temQuick } from "../api/ponte";
import { lerConfig } from "../lib/memoria";
import { atividadeDoBloco, painelDoDia } from "../lib/regras";

/** The DEFCON numbers VANT Quick mirrors (from useDefconChallenge). */
export interface DefconParaEspelho {
  /** true while the DEFCON is (re)loading its session: its numbers and phase are not real yet */
  loading: boolean;
  phase: string;
  totalSold: number;
  dailyGoal: number;
  totalSalesCount: number;
  totalApproaches: number;
  currentBlockIndex: number;
  blocks: { achieved_amount?: number; target_amount?: number }[];
  blockStartedAt: Date | null;
  blockEndTime: Date | null;
  blockSalesCount: number;
}

const ATIVA = new Set(["running", "break", "lunch_pause", "block_report"]);

/** Keeps the performance widget and the DEFCON Live Activity in step with the real session.
    The Live Activity exists only while a DEFCON session is on (block or pause) and ends with it. */
export function useEspelhoQuick(conta: string | null, d: DefconParaEspelho) {
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // while loading, totals are 0 and phase is "idle" by default: mirroring them would blank the
    // widget and end the Live Activity every time the DEFCON screen opens or comes back (build 29)
    if (!temQuick() || !conta || d.loading) return;
    if (tempo.current) clearTimeout(tempo.current);
    // a few changes in a row (a sale = money, count and approach) become one widget update
    tempo.current = setTimeout(() => {
      void quick.salvarPainel(painelDoDia({
        conta, data: getBrazilDate(), faturamento: d.totalSold, meta: d.dailyGoal,
        vendas: d.totalSalesCount, abordagens: d.totalApproaches, agora: Date.now(),
      }));
    }, 800);
    return () => { if (tempo.current) clearTimeout(tempo.current); };
  }, [conta, d.loading, d.totalSold, d.dailyGoal, d.totalSalesCount, d.totalApproaches]);

  const bloco = d.blocks[d.currentBlockIndex];
  const inicio = d.blockStartedAt?.getTime() ?? null, fim = d.blockEndTime?.getTime() ?? null;
  useEffect(() => {
    if (!temQuick() || !conta || d.loading) return;
    if (!ATIVA.has(d.phase)) { void quick.encerrarAtividade(); return; }
    const a = atividadeDoBloco({
      conta, inicio: inicio ? new Date(inicio) : null, fim: fim ? new Date(fim) : null, bloco: d.currentBlockIndex, totalBlocos: d.blocks.length,
      faturamentoBloco: bloco?.achieved_amount ?? 0, metaHora: bloco?.target_amount ?? 0, vendasBloco: d.blockSalesCount, pausado: d.phase !== "running",
      faturamentoDia: d.totalSold, metaDia: d.dailyGoal, vendasDia: d.totalSalesCount, abordagensDia: d.totalApproaches,
      rapidaValor: lerConfig(conta)?.valor ?? null,
    });
    if (a) void quick.atualizarAtividade(a);
  }, [conta, d.loading, d.phase, d.currentBlockIndex, d.blocks.length, bloco?.achieved_amount, bloco?.target_amount, d.blockSalesCount, inicio, fim,
      d.totalSold, d.dailyGoal, d.totalSalesCount, d.totalApproaches]);
}
