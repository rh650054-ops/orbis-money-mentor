import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 15/11 (Rick): "toda hora fica mostrando que subi/caí de liga". The screen opens with the stored
// value (16th) and swaps to the live one (22nd). The league must be judged on the FINAL position only.
const EU = "eu";
const guardado = [
  // stored: 15 people ahead, 6 behind (their stored value is older)
  ...Array.from({ length: 21 }, (_, i) => ({ user_id: `o${i}`, faturamento_total_mes: i < 15 ? 9000 - i * 100 : 3000, dias_trabalhados_mes: 5 })),
  { user_id: EU, faturamento_total_mes: 4830, dias_trabalhados_mes: 10 },
];
// live: 21 people ahead
const aoVivo = [
  ...Array.from({ length: 21 }, (_, i) => ({ user_id: `o${i}`, faturamento_semana: 9000 - i * 100 })),
  { user_id: EU, faturamento_semana: 3992 },
];

function cadeia(resultado: unknown): unknown {
  const p = Promise.resolve(resultado);
  return new Proxy(() => undefined, {
    get: (_t, k) => (k === "then" ? p.then.bind(p) : () => cadeia(resultado)),
    apply: () => cadeia(resultado),
  });
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => cadeia({ data: t === "leaderboard_stats" ? guardado.map((g) => ({ ...g })) : [], error: null }),
    rpc: () => Promise.resolve({ data: aoVivo, error: null }),
    channel: () => cadeia({}),
    removeChannel: () => undefined,
  },
}));

describe("useLeaderboard.posicaoFinal", () => {
  it("is the position after the live value, never the stored one", async () => {
    const { useLeaderboard } = await import("@/hooks/useLeaderboard");
    const { result } = renderHook(() => useLeaderboard(EU));
    await waitFor(() => expect(result.current.posicaoFinal).not.toBeNull());
    expect(result.current.posicaoFinal).toBe(22);
  });
});
