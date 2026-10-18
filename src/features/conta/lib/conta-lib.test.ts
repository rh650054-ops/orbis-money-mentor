import { describe, expect, it } from "vitest";
import { planoDe } from "./plano";
import { conversao, resumirAtividade } from "./atividade";
import { ehAvatarVant, ehFoto } from "./avatares";
import { fotoValida } from "@/shared/lib/avatar";

const base = { plan_status: "trial", trial_end: "2026-10-20", is_demo: false, billing_exempt: false, comp_label: null };

describe("plano", () => {
  it("names each situation the way the vendor reads it", () => {
    expect(planoDe(base, null)).toMatchObject({ selo: "TESTE", status: "teste", assinante: false });
    expect(planoDe({ ...base, plan_status: "active" }, null)).toMatchObject({ nome: "VANT ESSENCIAL", status: "ativo", assinante: true });
    expect(planoDe({ ...base, plan_status: "active" }, { pro: true, origem: "hotmart", ate: "2026-11-01" })).toMatchObject({ selo: "PRO", nome: "VANT PRO" });
    expect(planoDe({ ...base, billing_exempt: true }, null)).toMatchObject({ status: "cortesia", assinante: false });
    expect(planoDe({ ...base, plan_status: "expired" }, null).status).toBe("sem");
  });
});

describe("atividade", () => {
  it("counts sales, active days (Brasília) and conversion only with enough approaches", () => {
    const a = resumirAtividade([
      { started_at: "2026-10-10T13:00:00Z", created_at: null, sales_count: 10, approaches_count: 20, sold_amount: 200 },
      { started_at: "2026-10-10T20:00:00Z", created_at: null, sales_count: 5, approaches_count: 10, sold_amount: 100 },
      { started_at: "2026-10-11T02:00:00Z", created_at: null, sales_count: 0, approaches_count: 0, sold_amount: 0 },
      { started_at: "2026-10-12T13:00:00Z", created_at: null, sales_count: 3, approaches_count: 0, sold_amount: 60 },
    ]);
    expect(a).toEqual({ vendas: 18, abordagens: 30, diasAtivos: 2, faturamento: 360 });
    expect(conversao(a)).toBe(60);
    expect(conversao({ ...a, abordagens: 3 })).toBeNull();
  });
});

describe("avatares", () => {
  it("VANT icons are valid pictures everywhere; old emoji are not", () => {
    expect(ehAvatarVant("/avatares/raio.svg")).toBe(true);
    expect(fotoValida("/avatares/raio.svg")).toBe("/avatares/raio.svg");
    expect(fotoValida("/avatares/../x.svg")).toBeNull();
    expect(fotoValida("🦅")).toBeNull();
    expect(ehFoto("https://x.supabase.co/a.jpg")).toBe(true);
  });
});
