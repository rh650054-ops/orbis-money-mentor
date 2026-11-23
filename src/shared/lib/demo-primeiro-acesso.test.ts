import { describe, expect, it, vi } from "vitest";

const bd = vi.hoisted(() => ({ perfil: null as Record<string, unknown> | null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: bd.perfil, error: null }) }) }) }) },
}));
import { demoNoPrimeiroAcesso } from "./demo-primeiro-acesso";

describe("conta demo no 1º acesso vai pro onboarding", () => {
  it("demo que nunca começou o onboarding → sim", async () => {
    bd.perfil = { is_demo: true, onboarding_completed: false, onboarding_step: 0 };
    expect(await demoNoPrimeiroAcesso("u")).toBe(true);
  });
  it("demo que já avançou ou concluiu → não", async () => {
    bd.perfil = { is_demo: true, onboarding_completed: false, onboarding_step: 2 };
    expect(await demoNoPrimeiroAcesso("u")).toBe(false);
    bd.perfil = { is_demo: true, onboarding_completed: true, onboarding_step: 0 };
    expect(await demoNoPrimeiroAcesso("u")).toBe(false);
  });
  it("conta normal → nunca muda nada", async () => {
    bd.perfil = { is_demo: false, onboarding_completed: false, onboarding_step: 0 };
    expect(await demoNoPrimeiroAcesso("u")).toBe(false);
  });
});
