import { describe, it, expect, vi } from "vitest";

vi.mock("@/shared/api", () => ({ supabase: {}, createQueryKeys: (n: string) => ({ all: [n], list: (f: unknown) => [n, "list", f], byUser: (u: string) => [n, u] }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { liberaProdutos } from "./use-acesso-produtos-query";

const base = { pro: false, billingExempt: false, trialAtivo: false, trialEnd: null, planStatus: "active", hoje: "2026-10-23" };

describe("liberaProdutos (produto e estoque só no Pro, 23/10/2026)", () => {
  it("Pro: liberado", () => expect(liberaProdutos({ ...base, pro: true }).liberado).toBe(true));
  it("Essencial pagante: bloqueado e vê só o upgrade", () => {
    expect(liberaProdutos(base)).toEqual({ liberado: false, assinaEssencial: true });
  });
  it("teste grátis valendo: liberado", () => {
    expect(liberaProdutos({ ...base, planStatus: "trial", trialAtivo: true, trialEnd: "2026-10-24" }).liberado).toBe(true);
  });
  it("teste que acabou: bloqueado", () => {
    expect(liberaProdutos({ ...base, planStatus: "trial", trialAtivo: true, trialEnd: "2026-10-22" }).liberado).toBe(false);
  });
  it("equipe/cortesia: liberado", () => expect(liberaProdutos({ ...base, billingExempt: true }).liberado).toBe(true));
});
