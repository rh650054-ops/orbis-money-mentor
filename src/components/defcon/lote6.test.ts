import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { valoresSugeridos, diasNaFrente } from "./CaixinhaMeta";
import { mediaMensal, nomeMes } from "@/components/conectar/comprovante-renda";

describe("valoresSugeridos", () => {
  it("rounds the daily need up to tens and offers a step above and R$ 100", () => {
    expect(valoresSugeridos(38, 1080, 120)).toEqual([40, 60, 100]);
  });
  it("a strong Pix day suggests double first", () => {
    expect(valoresSugeridos(38, 1080, 610)[0]).toBe(80);
  });
  it("never suggests more than what is missing", () => {
    expect(valoresSugeridos(38, 25, 0)).toEqual([25]);
  });
});

describe("diasNaFrente", () => {
  it("counts the extra days the amount covers", () => {
    expect(diasNaFrente(80, 38)).toBe(1);
    expect(diasNaFrente(40, 38)).toBe(0);
  });
});

describe("comprovante de renda", () => {
  const m = (mes: string, banco: number, lancado: number, parcial = false) => ({ mes, parcial, entradas_banco: banco, pix_banco: 0, vendas_lancadas: lancado, dias_trabalhados: 10 });
  it("averages only closed months with bank data", () => {
    const r = mediaMensal([m("2026-08", 0, 9000), m("2026-09", 6000, 8000), m("2026-10", 1800, 800, true)]);
    expect(r).toEqual({ banco: 6000, lancado: 8500, mesesBanco: 1 });
  });
  it("names the month in Portuguese", () => {
    expect(nomeMes("2026-09")).toBe("setembro de 2026");
  });
});
