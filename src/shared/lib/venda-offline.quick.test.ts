import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { novaLinhaVenda } from "./venda-offline";

const base = { user_id: "u", session_id: "s", block_index: 0, amount: 10, method: "dinheiro" as const, late: false };

describe("a sale line (VANT Quick, 27/11/2026)", () => {
  it("every caller of the app still gets a new id per sale", () => {
    const a = novaLinhaVenda(base), b = novaLinhaVenda(base);
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
  });
  it("a widget tap passes its own id: the same tap is the SAME sale (the database keeps it once)", () => {
    const id = "0b7d7a2e-6a5f-4b8e-9d0c-000000000001";
    expect(novaLinhaVenda(base, id).id).toBe(id);
    expect(novaLinhaVenda(base, id).amount).toBe(10);
  });
});
