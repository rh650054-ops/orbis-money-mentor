import { describe, expect, it, vi } from "vitest";

const bd = vi.hoisted(() => ({ pro: null as Record<string, unknown> | null, sub: null as Record<string, unknown> | null }));
vi.mock("@/integrations/supabase/client", () => {
  const fim = (t: string) => ({ maybeSingle: async () => ({
    data: t === "orbis_pro" ? bd.pro : t === "subscriptions" ? bd.sub : { nickname: "Zé", cpf: null, phone: null, email: "ze@x.com" }, error: null }) });
  return { supabase: { from: (t: string) => ({ select: () => ({ eq: () => ({ ...fim(t), order: () => ({ limit: () => fim(t) }) }) }) }) } };
});
import { linkDeRenovacao } from "./renovar-assinatura";

describe("Renovar assinatura vai pro checkout do plano que a pessoa tinha", () => {
  it("ex-Pro Mensal → oferta 5y86n311, com e-mail e a conta (xcod)", async () => {
    bd.pro = { produto_id: "5y86n311", origem: "hotmart" }; bd.sub = null;
    const url = await linkDeRenovacao("u1", null);
    expect(url).toContain("off=5y86n311");
    expect(url).toContain("email=ze%40x.com");
    expect(url).toContain("xcod=u1");
  });
  it("ex-Pro Anual → oferta ew11enu0", async () => {
    bd.pro = { produto_id: "ew11enu0", origem: "hotmart" };
    expect(await linkDeRenovacao("u1", null)).toContain("off=ew11enu0");
  });
  it("ex-Essencial (só subscriptions da Hotmart) → checkout do Essencial", async () => {
    bd.pro = null; bd.sub = { provider: "hotmart" };
    expect(await linkDeRenovacao("u1", null)).toContain("off=8qbxvm9p");
  });
  it("oferta antiga ou cortesia → null (abre a página de planos, não chuta plano)", async () => {
    bd.pro = { produto_id: "ckkw1xkf", origem: "hotmart" };
    expect(await linkDeRenovacao("u1", null)).toBeNull();
    bd.pro = { produto_id: null, origem: "cortesia" };
    expect(await linkDeRenovacao("u1", null)).toBeNull();
  });
});
