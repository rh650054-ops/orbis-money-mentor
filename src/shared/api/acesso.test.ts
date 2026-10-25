import { describe, expect, it, vi } from "vitest";
vi.mock("./supabase", () => ({ supabase: {} }));
import { lerAcesso, travaPro } from "./acesso";

describe("acesso por plano", () => {
  it("lê o retorno de vant_acesso", () => {
    expect(lerAcesso({ plano: "essencial", recursos_pro: false, mentor_limite: 10, mentor_hoje: 3 }))
      .toEqual({ plano: "essencial", recursosPro: false, mentorLimite: 10, mentorHoje: 3 });
    expect(lerAcesso({ plano: "xpto" })?.plano).toBe("sem_plano");
    expect(lerAcesso(null)).toBeNull();
  });

  it("só trava com resposta certa de quem não tem recursos do Pro", () => {
    const ess = lerAcesso({ plano: "essencial", recursos_pro: false });
    const pro = lerAcesso({ plano: "pro", recursos_pro: true });
    expect(travaPro({ data: ess, isLoading: false, isError: false })).toBe(true);
    expect(travaPro({ data: pro, isLoading: false, isError: false })).toBe(false);
    expect(travaPro({ data: ess, isLoading: true, isError: false })).toBe(false);
    expect(travaPro({ data: undefined, isLoading: false, isError: true })).toBe(false);
  });
});
