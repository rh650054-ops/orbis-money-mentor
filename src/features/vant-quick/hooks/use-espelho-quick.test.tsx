import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chamadas: { nome: string; arg?: unknown }[] = [];
vi.mock("../api/ponte", () => ({
  temQuick: () => true,
  quick: {
    salvarPainel: async (p: unknown) => { chamadas.push({ nome: "painel", arg: p }); },
    atualizarAtividade: async (a: unknown) => { chamadas.push({ nome: "atividade", arg: a }); },
    encerrarAtividade: async () => { chamadas.push({ nome: "encerrar" }); },
  },
}));

vi.mock("@/shared/lib/date-utils", () => ({ getBrazilDate: () => "2026-11-28" }));

import { useEspelhoQuick, type DefconParaEspelho } from "./use-espelho-quick";

const CONTA = "6261573e-d339-466d-b7de-665d2b6c76f4";
const inicio = new Date("2026-11-28T11:00:00Z"), fim = new Date("2026-11-28T12:00:00Z");
const base: DefconParaEspelho = {
  loading: false, phase: "running", totalSold: 120, dailyGoal: 300, totalSalesCount: 12, totalApproaches: 30,
  currentBlockIndex: 1, blocks: [{ achieved_amount: 60, target_amount: 50 }, { achieved_amount: 60, target_amount: 50 }],
  blockStartedAt: inicio, blockEndTime: fim, blockSalesCount: 6,
};
const so = (nome: string) => chamadas.filter((c) => c.nome === nome);

beforeEach(() => { chamadas.length = 0; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe("VANT Quick mirror of the DEFCON", () => {
  it("while the DEFCON is loading: nothing is written and the Live Activity is NOT ended (build 29 bug)", async () => {
    const { rerender } = renderHook((d: DefconParaEspelho) => useEspelhoQuick(CONTA, d),
      { initialProps: { ...base, loading: true, phase: "idle", totalSold: 0, totalSalesCount: 0, totalApproaches: 0 } });
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(chamadas).toEqual([]);
    // loaded: the real session comes in, and only then the widget and the Live Activity are fed
    rerender(base);
    await act(async () => { vi.advanceTimersByTime(900); });
    expect(so("encerrar")).toEqual([]);
    expect(so("painel")).toHaveLength(1);
    expect(so("painel")[0]!.arg).toMatchObject({ conta: CONTA, faturamento: 120, meta: 300, restante: 180, vendas: 12, abordagens: 30, conversao: 0.4 });
    expect(so("atividade")[0]!.arg).toMatchObject({ conta: CONTA, bloco: 2, totalBlocos: 2, faturamentoBloco: 60, metaHora: 50, vendasBloco: 6, pausado: false });
  });

  it("a sale updates the widget once (several changes in a row become one write)", async () => {
    const { rerender } = renderHook((d: DefconParaEspelho) => useEspelhoQuick(CONTA, d), { initialProps: base });
    await act(async () => { vi.advanceTimersByTime(900); });
    chamadas.length = 0;
    rerender({ ...base, totalSold: 130 });
    rerender({ ...base, totalSold: 130, totalSalesCount: 13 });
    rerender({ ...base, totalSold: 130, totalSalesCount: 13, totalApproaches: 31 });
    await act(async () => { vi.advanceTimersByTime(900); });
    expect(so("painel")).toHaveLength(1);
    expect(so("painel")[0]!.arg).toMatchObject({ faturamento: 130, vendas: 13, abordagens: 31 });
  });

  it("an approach alone also reaches the widget (conversion changes)", async () => {
    const { rerender } = renderHook((d: DefconParaEspelho) => useEspelhoQuick(CONTA, d), { initialProps: base });
    await act(async () => { vi.advanceTimersByTime(900); });
    chamadas.length = 0;
    rerender({ ...base, totalApproaches: 40 });
    await act(async () => { vi.advanceTimersByTime(900); });
    expect(so("painel")[0]!.arg).toMatchObject({ abordagens: 40, conversao: 0.3 });
  });

  it("the Live Activity ends only when the loaded session is really over", async () => {
    const { rerender } = renderHook((d: DefconParaEspelho) => useEspelhoQuick(CONTA, d), { initialProps: base });
    await act(async () => { vi.advanceTimersByTime(900); });
    rerender({ ...base, loading: true, phase: "idle" });     // coming back from the background: reload
    expect(so("encerrar")).toEqual([]);
    rerender({ ...base, phase: "finished" });
    expect(so("encerrar")).toHaveLength(1);
  });

  it("practice run / no account: nothing at all", async () => {
    renderHook(() => useEspelhoQuick(null, base));
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(chamadas).toEqual([]);
  });
});
