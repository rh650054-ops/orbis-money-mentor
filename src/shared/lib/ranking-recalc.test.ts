import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.hoisted(() => vi.fn(async () => ({ error: null })));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

describe("ranking recalc trava", () => {
  beforeEach(() => {
    rpc.mockClear();
    localStorage.clear();
    vi.resetModules();
  });

  it("asks once, then skips for 2 minutes; admin can force", async () => {
    const { recalcularRanking } = await import("./ranking-recalc");
    expect((await recalcularRanking("2026-10")).pulou).toBe(false);
    expect((await recalcularRanking("2026-10")).pulou).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect((await recalcularRanking("2026-10", true)).pulou).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
