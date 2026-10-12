/* "Não consegui ler" ≠ "não vendeu": falha de leitura nunca pode zerar o placar. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  respostas: {} as Record<string, { data: unknown; error: unknown }>,
  escritas: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const consulta = (t: string) => {
    const q = {
      select: () => q, eq: () => q, gte: () => q, lte: () => q,
      maybeSingle: () => q,
      update: (v: Record<string, unknown>) => { estado.escritas.push(`${t}.update:${JSON.stringify(v)}`); return q; },
      insert: (v: Record<string, unknown>) => { estado.escritas.push(`${t}.insert:${JSON.stringify(v)}`); return q; },
      delete: () => { estado.escritas.push(`${t}.delete`); return q; },
      then: (res: (r: unknown) => unknown) => Promise.resolve(estado.respostas[t] ?? { data: null, error: null }).then(res),
    };
    return q;
  };
  return { supabase: { from: consulta } };
});
vi.mock("@/shared/lib/ranking-recalc", () => ({ recalcularRanking: vi.fn(async () => ({ error: null })) }));
vi.mock("@/shared/lib/avisar", () => ({ avisar: { erro: vi.fn(), usuario: vi.fn() } }));

import { syncLeaderboardRevenue } from "./syncDailySales";

const ok = {
  daily_sales: { data: [{ card_sales: 0, pix_sales: 300, cash_sales: 200, total_profit: 500 }], error: null },
  profiles: { data: { nickname: "Rick", ranking_hidden: false, ranking_oculto: false }, error: null },
  leaderboard_stats: { data: { id: "lb1", dias_trabalhados_mes: 3 }, error: null },
};

beforeEach(() => {
  estado.respostas = { ...ok };
  estado.escritas = [];
});

describe("ranking: falha de leitura mantém o placar", () => {
  it("leitura das vendas do mês falhou → não grava nada (não vira R$ 0)", async () => {
    estado.respostas.daily_sales = { data: null, error: { message: "timeout" } };
    await syncLeaderboardRevenue("u1");
    expect(estado.escritas).toEqual([]);
  });

  it("leitura do perfil falhou → não grava (nem troca o nome por 'Usuário')", async () => {
    estado.respostas.profiles = { data: null, error: { message: "timeout" } };
    await syncLeaderboardRevenue("u1");
    expect(estado.escritas).toEqual([]);
  });

  it("leitura da entrada do ranking falhou → não cria entrada duplicada", async () => {
    estado.respostas.leaderboard_stats = { data: null, error: { message: "timeout" } };
    await syncLeaderboardRevenue("u1");
    expect(estado.escritas).toEqual([]);
  });

  it("tudo leu certo → atualiza com o total real", async () => {
    await syncLeaderboardRevenue("u1");
    expect(estado.escritas).toHaveLength(1);
    expect(estado.escritas[0]).toContain('"faturamento_total_mes":500');
  });

  it("mês sem venda de verdade (lista vazia, sem erro) → grava 0, como antes", async () => {
    estado.respostas.daily_sales = { data: [], error: null };
    await syncLeaderboardRevenue("u1");
    expect(estado.escritas[0]).toContain('"faturamento_total_mes":0');
  });
});
